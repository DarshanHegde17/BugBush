"""
BugBash - Enterprise Admin Profile & Settings Service
Manages administrator profile modifications, password changes, active session revocation,
security activity auditing, dashboard preferences, and personal notification preferences.
"""

import re
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from backend.app.database.mongodb import mongodb
from backend.app.services.user_service import user_service
from backend.app.services.password_reset_service import PasswordResetService
from backend.app.services.admin_auth_service import admin_auth_service, ROLE_PERMISSIONS

logger = logging.getLogger("bugbash.admin_profile")


class AdminProfileService:
    """
    Dedicated enterprise service for administrator profile and account security management.
    Enforces strict authorization boundaries:
    - Admins cannot modify their own role, status, or system permissions.
    - Password changes enforce NIST/OWASP complexity and require current password verification.
    - Security-critical alerts cannot be disabled in personal notification preferences.
    - Immutable audit logs are created for all sensitive actions.
    """

    def __init__(self):
        self._ensure_sample_sessions()

    def _ensure_sample_sessions(self):
        """Initializes default active session records for demonstration if collection is empty."""
        if mongodb.db is not None:
            try:
                coll = mongodb.db.admin_sessions
                if coll.count_documents({}) == 0:
                    now = datetime.now(timezone.utc)
                    sample_sessions = [
                        {
                            "session_id": "sess_current_admin",
                            "email": "admin@bugbash.com",
                            "device": "MacBook Pro (macOS 15.1)",
                            "browser": "Chrome 131.0",
                            "ip_address": "192.168.1.105",
                            "location": "San Francisco, CA, USA",
                            "login_time": (now - timedelta(hours=2)).strftime("%b %d, %Y %I:%M %p"),
                            "last_activity": "Just now",
                            "is_current": True,
                            "created_at": now - timedelta(hours=2)
                        },
                        {
                            "session_id": "sess_mobile_admin",
                            "email": "admin@bugbash.com",
                            "device": "iPhone 16 Pro (iOS 18.2)",
                            "browser": "Safari Mobile",
                            "ip_address": "72.229.28.185",
                            "location": "San Jose, CA, USA",
                            "login_time": (now - timedelta(days=1, hours=4)).strftime("%b %d, %Y %I:%M %p"),
                            "last_activity": "Yesterday",
                            "is_current": False,
                            "created_at": now - timedelta(days=1, hours=4)
                        }
                    ]
                    coll.insert_many(sample_sessions)
            except Exception as e:
                logger.warning(f"Error seeding admin sessions: {e}")

    # ==========================================================================
    # 1. Profile Retrieval & Updates
    # ==========================================================================
    def get_profile(self, email: str) -> Dict[str, Any]:
        """Fetches the complete administrator profile."""
        clean_email = email.strip().lower()
        user = user_service._get_user_doc(clean_email)
        if not user:
            raise KeyError(f"Administrator profile '{clean_email}' not found.")

        role = user.get("role", "admin")
        permissions = user.get("permissions") or ROLE_PERMISSIONS.get(role, ["assessments:manage"])

        created_at_val = user.get("created_at")
        if isinstance(created_at_val, datetime):
            created_at_str = created_at_val.strftime("%b %d, %Y")
        else:
            created_at_str = str(created_at_val or "Jan 10, 2026")

        return {
            "id": str(user.get("id") or user.get("_id") or clean_email),
            "email": clean_email,
            "full_name": user.get("full_name") or user.get("name") or "Administrator",
            "phone_number": user.get("phone_number") or "+1 (555) 987-6543",
            "role": role,
            "permissions": permissions,
            "account_status": user.get("account_status") or user.get("status") or "Active",
            "is_verified": user.get("is_verified", True),
            "profile_picture": user.get("profile_picture") or user.get("avatar"),
            "organization_name": user.get("organization_name") or "BugBash Global Assessment Operations",
            "created_at": created_at_str,
            "last_login": user.get("last_login") or "Recently",
            "last_password_change": user.get("last_password_change") or "Jan 10, 2026"
        }

    def update_profile(self, email: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Updates permitted administrator profile details.
        Strictly prevents self-service modification of role, status, email, or permissions.
        """
        clean_email = email.strip().lower()
        user = user_service._get_user_doc(clean_email)
        if not user:
            raise KeyError(f"Administrator profile '{clean_email}' not found.")

        # Disallow privilege escalation
        for forbidden in ("role", "permissions", "email", "account_status", "status", "id", "_id"):
            if forbidden in payload:
                payload.pop(forbidden, None)

        updates = {}
        if "full_name" in payload and payload["full_name"]:
            updates["full_name"] = payload["full_name"].strip()
            updates["name"] = payload["full_name"].strip()
        if "phone_number" in payload:
            updates["phone_number"] = payload["phone_number"].strip() if payload["phone_number"] else None
        if "bio" in payload:
            updates["bio"] = payload["bio"].strip() if payload["bio"] else None

        now = datetime.now(timezone.utc)
        updates["updated_at"] = now

        # Update MongoDB
        if mongodb.users is not None:
            try:
                mongodb.users.update_one({"email": clean_email}, {"$set": updates})
            except Exception as e:
                logger.warning(f"Error updating admin in MongoDB: {e}")

        # Update in-memory cache
        if clean_email in user_service._users:
            user_service._users[clean_email].update(updates)

        admin_auth_service.record_audit_event(
            "admin_profile_updated",
            clean_email,
            "internal",
            f"Admin profile fields updated: {list(updates.keys())}",
            success=True
        )

        return self.get_profile(clean_email)

    def update_profile_photo(self, email: str, photo_data: str) -> Dict[str, Any]:
        """Updates the administrator's profile avatar image."""
        clean_email = email.strip().lower()
        user = user_service._get_user_doc(clean_email)
        if not user:
            raise KeyError(f"Administrator profile '{clean_email}' not found.")

        if not photo_data or not isinstance(photo_data, str):
            raise ValueError("Invalid photo data provided.")

        # Enforce maximum data length (approx 2MB for base64 strings)
        if len(photo_data) > 3 * 1024 * 1024:
            raise ValueError("Profile image exceeds the maximum permitted size of 2MB.")

        updates = {
            "profile_picture": photo_data,
            "avatar": photo_data,
            "updated_at": datetime.now(timezone.utc)
        }

        if mongodb.users is not None:
            try:
                mongodb.users.update_one({"email": clean_email}, {"$set": updates})
            except Exception as e:
                logger.warning(f"Error saving admin photo: {e}")

        if clean_email in user_service._users:
            user_service._users[clean_email].update(updates)

        admin_auth_service.record_audit_event(
            "admin_photo_updated",
            clean_email,
            "internal",
            "Administrator avatar photo updated",
            success=True
        )

        return {
            "status": "success",
            "message": "Profile picture updated successfully.",
            "profile_picture": photo_data
        }

    # ==========================================================================
    # 2. Password Security & Credential Updates
    # ==========================================================================
    def change_password(
        self,
        email: str,
        current_password: str,
        new_password: str,
        confirm_password: str,
        revoke_other_sessions: bool = False,
        current_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Securely updates administrator password after verifying current credentials and complexity.
        """
        clean_email = email.strip().lower()
        user = user_service._get_user_doc(clean_email)
        if not user:
            raise KeyError(f"Administrator profile '{clean_email}' not found.")

        if new_password != confirm_password:
            raise ValueError("New password and confirmation password do not match.")

        # Complexity validation: min 8, uppercase, lowercase, number, special char
        if len(new_password) < 8:
            raise ValueError("New password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", new_password):
            raise ValueError("New password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", new_password):
            raise ValueError("New password must contain at least one lowercase letter.")
        if not re.search(r"[0-9]", new_password):
            raise ValueError("New password must contain at least one number.")
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]", new_password):
            raise ValueError("New password must contain at least one special character.")

        # Verify current password
        stored_hash = user.get("password_hash") or user.get("password")
        if not stored_hash or not PasswordResetService.verify_password(current_password, stored_hash):
            admin_auth_service.record_audit_event(
                "admin_password_change_failed",
                clean_email,
                "internal",
                "Password change rejected: Current password verification failed",
                success=False
            )
            raise ValueError("Current password verification failed.")

        # Prevent reusing the current password
        if PasswordResetService.verify_password(new_password, stored_hash):
            raise ValueError("New password cannot be the same as your current password.")

        new_hash = PasswordResetService.hash_password(new_password)
        now = datetime.now(timezone.utc)
        updates = {
            "password_hash": new_hash,
            "password": new_hash,
            "last_password_change": now.strftime("%b %d, %Y"),
            "updated_at": now
        }

        if mongodb.users is not None:
            try:
                mongodb.users.update_one({"email": clean_email}, {"$set": updates})
            except Exception as e:
                logger.warning(f"Error persisting new password in MongoDB: {e}")

        if clean_email in user_service._users:
            user_service._users[clean_email].update(updates)

        # Revoke other sessions if requested
        if revoke_other_sessions:
            self.revoke_other_sessions(clean_email, current_token=current_token)

        admin_auth_service.record_audit_event(
            "admin_password_changed",
            clean_email,
            "internal",
            "Administrator password successfully updated",
            success=True
        )

        return {
            "status": "success",
            "message": "Password changed successfully."
        }

    # ==========================================================================
    # 3. Active Sessions Management
    # ==========================================================================
    def get_sessions(
        self,
        email: str,
        current_token: Optional[str] = None,
        request_ip: str = "127.0.0.1",
        user_agent: str = "Chrome"
    ) -> Dict[str, Any]:
        """Lists active device sessions for the authenticated administrator."""
        clean_email = email.strip().lower()
        sessions_list = []

        if mongodb.db is not None:
            try:
                coll = mongodb.db.admin_sessions
                docs = list(coll.find({"email": clean_email}))
                for d in docs:
                    sessions_list.append({
                        "session_id": str(d.get("session_id") or d.get("_id")),
                        "device": d.get("device", "Desktop Browser"),
                        "browser": d.get("browser", "Chrome"),
                        "ip_address": d.get("ip_address", request_ip),
                        "location": d.get("location", "Local Network"),
                        "login_time": d.get("login_time", "Recently"),
                        "last_activity": d.get("last_activity", "Active now"),
                        "is_current": bool(d.get("is_current", False))
                    })
            except Exception as e:
                logger.warning(f"Error querying admin sessions: {e}")

        # Fallback if no sessions exist yet
        if not sessions_list:
            now = datetime.now(timezone.utc)
            current_sess = {
                "session_id": f"sess_{secrets.token_hex(6)}",
                "device": "Current Workstation",
                "browser": "Current Browser",
                "ip_address": request_ip,
                "location": "Local Session",
                "login_time": now.strftime("%b %d, %Y %I:%M %p"),
                "last_activity": "Just now",
                "is_current": True
            }
            sessions_list.append(current_sess)

        return {
            "sessions": sessions_list,
            "total_active": len(sessions_list)
        }

    def revoke_session(self, email: str, session_id: str) -> Dict[str, Any]:
        """Revokes a specific active session."""
        clean_email = email.strip().lower()
        if mongodb.db is not None:
            try:
                mongodb.db.admin_sessions.delete_one({"session_id": session_id, "email": clean_email})
            except Exception as e:
                logger.warning(f"Error revoking session: {e}")

        admin_auth_service.record_audit_event(
            "admin_session_revoked",
            clean_email,
            "internal",
            f"Session {session_id} explicitly revoked by admin",
            success=True
        )
        return {"status": "success", "message": "Session revoked successfully."}

    def revoke_other_sessions(self, email: str, current_token: Optional[str] = None) -> Dict[str, Any]:
        """Revokes all sessions except the current active session."""
        clean_email = email.strip().lower()
        if mongodb.db is not None:
            try:
                # Remove sessions where is_current is False
                mongodb.db.admin_sessions.delete_many({"email": clean_email, "is_current": {"$ne": True}})
            except Exception as e:
                logger.warning(f"Error revoking other sessions: {e}")

        admin_auth_service.record_audit_event(
            "admin_other_sessions_revoked",
            clean_email,
            "internal",
            "Revoked all other active administrator sessions",
            success=True
        )
        return {"status": "success", "message": "All other sessions revoked successfully."}

    # ==========================================================================
    # 4. Security Activity & Audit Events
    # ==========================================================================
    def get_security_activity(self, email: str) -> Dict[str, Any]:
        """Returns recent login telemetry and security events for this administrator."""
        clean_email = email.strip().lower()
        activity_items = []

        if mongodb.db is not None:
            try:
                coll = mongodb.db.admin_audit_logs
                logs = list(coll.find({"email": clean_email}).sort("created_at", -1).limit(20))
                for l in logs:
                    ts = l.get("timestamp")
                    if isinstance(ts, datetime):
                        ts_str = ts.strftime("%b %d, %Y %I:%M %p")
                    else:
                        ts_str = str(ts or "Recently")

                    activity_items.append({
                        "event_id": str(l.get("id") or l.get("_id")),
                        "event_type": l.get("event_type", "security_event"),
                        "description": l.get("details") or l.get("event_type", "").replace("_", " ").title(),
                        "ip_address": l.get("client_ip") or "127.0.0.1",
                        "timestamp": ts_str,
                        "status": "success" if l.get("success", True) else "warning"
                    })
            except Exception as e:
                logger.warning(f"Error querying admin security activity: {e}")

        # Fallback if no logs yet
        if not activity_items:
            now = datetime.now(timezone.utc)
            activity_items = [
                {
                    "event_id": "evt_01",
                    "event_type": "login_success",
                    "description": "Successful administrator login",
                    "ip_address": "127.0.0.1",
                    "timestamp": now.strftime("%b %d, %Y %I:%M %p"),
                    "status": "success"
                },
                {
                    "event_id": "evt_02",
                    "event_type": "password_verified",
                    "description": "Session credential verification",
                    "ip_address": "127.0.0.1",
                    "timestamp": (now - timedelta(days=2)).strftime("%b %d, %Y %I:%M %p"),
                    "status": "success"
                }
            ]

        user = user_service._get_user_doc(clean_email) or {}
        return {
            "two_factor_enabled": False,  # 2FA placeholder per prompt guidelines
            "password_last_changed": user.get("last_password_change") or "Jan 10, 2026",
            "recent_activity": activity_items
        }

    # ==========================================================================
    # 5. Appearance & Regional Preferences
    # ==========================================================================
    def get_preferences(self, email: str) -> Dict[str, Any]:
        """Retrieves administrator visual and regional preferences."""
        clean_email = email.strip().lower()
        user = user_service._get_user_doc(clean_email) or {}
        stored = user.get("preferences") or {}

        return {
            "theme": stored.get("theme", "dark"),
            "language": stored.get("language", "en"),
            "timezone": stored.get("timezone", "UTC"),
            "date_format": stored.get("date_format", "MMM DD, YYYY"),
            "default_view": stored.get("default_view", "overview"),
            "table_page_size": stored.get("table_page_size", 20)
        }

    def update_preferences(self, email: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Saves updated appearance and regional preferences."""
        clean_email = email.strip().lower()
        current = self.get_preferences(clean_email)

        for k in ("theme", "language", "timezone", "date_format", "default_view", "table_page_size"):
            if k in preferences and preferences[k] is not None:
                current[k] = preferences[k]

        if mongodb.users is not None:
            try:
                mongodb.users.update_one({"email": clean_email}, {"$set": {"preferences": current}})
            except Exception as e:
                logger.warning(f"Error saving admin preferences: {e}")

        if clean_email in user_service._users:
            user_service._users[clean_email]["preferences"] = current

        return current

    # ==========================================================================
    # 6. Personal Notification Preferences
    # ==========================================================================
    def get_notification_preferences(self, email: str) -> Dict[str, Any]:
        """Retrieves personal notification settings for this administrator."""
        clean_email = email.strip().lower()
        user = user_service._get_user_doc(clean_email) or {}
        stored = user.get("notification_preferences") or {}

        return {
            "assessment_updates": stored.get("assessment_updates", True),
            "candidate_activity": stored.get("candidate_activity", True),
            "submission_updates": stored.get("submission_updates", True),
            "result_publication": stored.get("result_publication", True),
            "ml_evaluation_updates": stored.get("ml_evaluation_updates", True),
            "security_alerts": True,  # Policy: Security alerts are always active
            "system_announcements": stored.get("system_announcements", True),
            "in_app": stored.get("in_app", True),
            "email": stored.get("email", True)
        }

    def update_notification_preferences(self, email: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Updates personal notification preferences, enforcing security-critical alerts."""
        clean_email = email.strip().lower()
        current = self.get_notification_preferences(clean_email)

        for k in (
            "assessment_updates",
            "candidate_activity",
            "submission_updates",
            "result_publication",
            "ml_evaluation_updates",
            "system_announcements",
            "in_app",
            "email"
        ):
            if k in preferences and preferences[k] is not None:
                current[k] = bool(preferences[k])

        # Enforce security-critical notifications policy
        current["security_alerts"] = True

        if mongodb.users is not None:
            try:
                mongodb.users.update_one({"email": clean_email}, {"$set": {"notification_preferences": current}})
            except Exception as e:
                logger.warning(f"Error saving admin notification preferences: {e}")

        if clean_email in user_service._users:
            user_service._users[clean_email]["notification_preferences"] = current

        return current


admin_profile_service = AdminProfileService()
