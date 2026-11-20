import os
import time
import logging
import secrets
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, List, Set

from backend.app.database.mongodb import mongodb
from backend.app.services.password_reset_service import PasswordResetService
from backend.app.services.user_service import user_service, JWT_SECRET, JWT_ALGORITHM

logger = logging.getLogger("bugbash.admin_auth")

# Authorized administrator roles permitted to access the Admin Portal
AUTHORIZED_ADMIN_ROLES: Set[str] = {
    "admin",
    "super_admin",
    "organization_admin",
    "college_admin",
    "company_admin"
}

ROLE_PERMISSIONS: Dict[str, List[str]] = {
    "super_admin": ["*"],
    "admin": [
        "assessments:manage",
        "questions:manage",
        "candidates:view",
        "results:view",
        "monitoring:live"
    ],
    "organization_admin": [
        "assessments:manage",
        "users:manage",
        "reports:export",
        "org:settings"
    ],
    "college_admin": [
        "assessments:schedule",
        "students:manage",
        "reports:view"
    ],
    "company_admin": [
        "assessments:create",
        "candidates:evaluate",
        "interviews:manage"
    ]
}


class AdminAuthService:
    """
    Dedicated enterprise security service for BugBash Administrative Portals.
    Enforces:
    - Role-based authorization boundary (Restricts candidates and public users)
    - Sliding window login rate limiting & brute-force defense
    - Audit logging of successful and failed administrative authentications
    - Session tracking and token revocation
    """

    def __init__(self, max_failed_attempts: int = 5, lockout_window_minutes: int = 15):
        self.max_failed_attempts = max_failed_attempts
        self.lockout_window = timedelta(minutes=lockout_window_minutes)

        # In-memory rate limiting tracker: key -> List[datetime]
        self._failed_attempts: Dict[str, List[datetime]] = {}
        
        # Revoked session tokens
        self._revoked_tokens: Set[str] = set()
        self._revoked_emails: Dict[str, datetime] = {}

        # Audit activity store
        self._audit_logs: List[dict] = []

    def _cleanup_old_attempts(self, key: str, now: datetime):
        """Purges failed attempt timestamps older than the lockout window."""
        if key in self._failed_attempts:
            cutoff = now - self.lockout_window
            self._failed_attempts[key] = [
                ts for ts in self._failed_attempts[key] if ts > cutoff
            ]
            if not self._failed_attempts[key]:
                del self._failed_attempts[key]

    def is_rate_limited(self, identifier: str, is_ip: bool = False) -> bool:
        """Checks if an email or IP address is currently locked out."""
        if not identifier:
            return False
        clean_key = identifier.strip().lower()
        if is_ip and clean_key in ("127.0.0.1", "localhost", "::1", "testclient"):
            return False
        now = datetime.now(timezone.utc)
        self._cleanup_old_attempts(clean_key, now)
        threshold = 20 if is_ip else self.max_failed_attempts
        return len(self._failed_attempts.get(clean_key, [])) >= threshold

    def record_failed_attempt(self, identifier: str):
        """Records a failed authentication attempt."""
        if not identifier:
            return
        clean_key = identifier.strip().lower()
        now = datetime.now(timezone.utc)
        self._cleanup_old_attempts(clean_key, now)
        if clean_key not in self._failed_attempts:
            self._failed_attempts[clean_key] = []
        self._failed_attempts[clean_key].append(now)

    def reset_failed_attempts(self, identifier: str):
        """Resets the failed attempts counter upon successful login."""
        clean_key = identifier.strip().lower()
        if clean_key in self._failed_attempts:
            del self._failed_attempts[clean_key]

    def record_audit_event(
        self,
        event_type: str,
        email: str,
        client_ip: str,
        details: str,
        success: bool = True
    ):
        """Records an immutable security audit event."""
        now = datetime.now(timezone.utc)
        entry = {
            "id": f"aud_{secrets.token_hex(6)}",
            "event_type": event_type,
            "email": email.strip().lower(),
            "client_ip": client_ip,
            "details": details,
            "success": success,
            "timestamp": now.isoformat(),
            "created_at": now
        }
        self._audit_logs.insert(0, entry)
        if len(self._audit_logs) > 500:
            self._audit_logs.pop()

        if mongodb.db is not None:
            try:
                mongodb.db.admin_audit_logs.insert_one(dict(entry))
            except Exception as e:
                logger.warning(f"Error persisting admin audit log: {e}")

    def authenticate_admin(
        self,
        email: str,
        password: str,
        client_ip: str = ""
    ) -> Tuple[bool, Optional[dict], Optional[str], int]:
        """
        Authenticates an administrative user.
        Returns: (success, result_dict, error_message, http_status_code)
        """
        clean_email = email.strip().lower()
        client_ip_clean = client_ip.strip()

        # 1. Rate Limiting Check
        if self.is_rate_limited(clean_email, is_ip=False) or (client_ip_clean and self.is_rate_limited(client_ip_clean, is_ip=True)):
            self.record_audit_event(
                "login_rate_limited",
                clean_email,
                client_ip_clean,
                "Authentication rejected due to excessive failed attempts",
                success=False
            )
            return (
                False,
                None,
                "Too many failed login attempts. Your access has been temporarily rate-limited. Please wait 15 minutes before trying again.",
                429
            )

        # 2. Retrieve user record
        user = user_service._get_user_doc(clean_email)
        if not user:
            self.record_failed_attempt(clean_email)
            if client_ip_clean:
                self.record_failed_attempt(client_ip_clean)
            self.record_audit_event(
                "login_failed_user_not_found",
                clean_email,
                client_ip_clean,
                "Attempted admin login with non-existent email",
                success=False
            )
            # Generic error to prevent email enumeration
            return (
                False,
                None,
                "Invalid email or password. Please verify your administrative credentials.",
                401
            )

        # 3. Password Verification
        stored_hash = user.get("password_hash") or user.get("password")
        if not stored_hash or not PasswordResetService.verify_password(password, stored_hash):
            self.record_failed_attempt(clean_email)
            if client_ip_clean:
                self.record_failed_attempt(client_ip_clean)
            self.record_audit_event(
                "login_failed_bad_password",
                clean_email,
                client_ip_clean,
                "Invalid password provided for administrative user",
                success=False
            )
            return (
                False,
                None,
                "Invalid email or password. Please verify your administrative credentials.",
                401
            )

        # 4. Role Authorization Check
        user_role = (user.get("role") or "").strip().lower()
        if user_role not in AUTHORIZED_ADMIN_ROLES:
            self.record_audit_event(
                "unauthorized_role_attempt",
                clean_email,
                client_ip_clean,
                f"Candidate account '{user_role}' attempted access to Admin Portal",
                success=False
            )
            return (
                False,
                None,
                "Access restricted: Candidate accounts are not permitted in the Admin Portal. Please use the candidate login.",
                403
            )

        # 5. Account Status & Permissions Check
        account_status = user.get("account_status") or user.get("status") or "Active"
        status_clean = str(account_status).strip().lower()

        if status_clean in ("inactive", "deactivated", "disabled"):
            self.record_audit_event(
                "login_inactive_account",
                clean_email,
                client_ip_clean,
                "Attempted login with inactive administrative account",
                success=False
            )
            return (
                False,
                None,
                "Your administrative account is inactive. Please contact your Super Administrator.",
                403
            )

        if "pending" in status_clean:
            self.record_audit_event(
                "login_pending_invitation",
                clean_email,
                client_ip_clean,
                "Attempted login with pending administrative invitation",
                success=False
            )
            return (
                False,
                None,
                "Your administrative invitation has not been accepted yet. Please follow the instructions sent to your email.",
                403
            )

        if status_clean in ("suspended", "locked", "blocked"):
            self.record_audit_event(
                "login_suspended_account",
                clean_email,
                client_ip_clean,
                "Attempted login with suspended administrative account",
                success=False
            )
            return (
                False,
                None,
                "Your administrative account has been suspended. Please contact platform security.",
                403
            )

        # 6. Authentication Successful
        self.reset_failed_attempts(clean_email)
        if client_ip_clean:
            self.reset_failed_attempts(client_ip_clean)

        now = datetime.now(timezone.utc)
        user["last_login"] = now.isoformat()
        if mongodb.users is not None:
            try:
                mongodb.users.update_one(
                    {"email": clean_email},
                    {"$set": {"last_login": now.isoformat(), "updated_at": now}}
                )
            except Exception as e:
                logger.warning(f"Error updating admin last_login in MongoDB: {e}")

        self.record_audit_event(
            "login_success",
            clean_email,
            client_ip_clean,
            f"Admin authenticated successfully with role '{user_role}'",
            success=True
        )

        permissions = ROLE_PERMISSIONS.get(user_role, ["assessments:manage"])

        user_info = {
            "id": str(user.get("id") or user.get("_id") or clean_email),
            "email": clean_email,
            "name": user.get("full_name") or user.get("name") or "Administrator",
            "role": user_role,
            "account_status": account_status,
            "organization_name": user.get("organization_name") or user.get("college_name") or "BugBash Global Assessment Operations",
            "permissions": permissions,
            "last_login": now.strftime("%B %d, %Y - %H:%M UTC")
        }

        return True, user_info, None, 200

    def create_admin_token(self, admin_info: dict, remember_me: bool = False) -> Tuple[str, int]:
        """Generates a signed JWT session token with administrative claims."""
        now = datetime.now(timezone.utc)
        duration_days = 30 if remember_me else 1
        expires_at = now + timedelta(days=duration_days)
        expires_in = int(timedelta(days=duration_days).total_seconds())

        payload = {
            "sub": admin_info["email"],
            "email": admin_info["email"],
            "name": admin_info["name"],
            "role": admin_info["role"],
            "is_admin": True,
            "permissions": admin_info.get("permissions", []),
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
            "jti": secrets.token_hex(16)
        }

        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return token, expires_in

    def get_admin_by_token(self, token: str) -> Optional[dict]:
        """Validates Bearer token and resolves active administrative user."""
        if not token or token in self._revoked_tokens:
            return None

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            email = payload.get("sub") or payload.get("email")
            role = payload.get("role")
            if not email or not role or role not in AUTHORIZED_ADMIN_ROLES:
                return None

            clean_email = email.strip().lower()
            revoked_at = self._revoked_emails.get(clean_email)
            if revoked_at:
                iat = payload.get("iat")
                if iat:
                    token_iat = datetime.fromtimestamp(iat, tz=timezone.utc)
                    if token_iat <= revoked_at:
                        return None
                else:
                    return None

            user = user_service._get_user_doc(clean_email)
            if not user:
                return None

            user_role = (user.get("role") or "").strip().lower()
            if user_role not in AUTHORIZED_ADMIN_ROLES:
                return None

            account_status = user.get("account_status") or user.get("status") or "Active"
            status_clean = str(account_status).strip().lower()
            if status_clean in ("inactive", "suspended", "locked", "deactivated", "disabled") or "pending" in status_clean:
                return None

            permissions = ROLE_PERMISSIONS.get(user_role, ["assessments:manage"])

            return {
                "id": str(user.get("id") or user.get("_id") or email),
                "email": user["email"],
                "name": user.get("full_name") or user.get("name") or "Administrator",
                "role": user_role,
                "account_status": account_status,
                "organization_name": user.get("organization_name") or user.get("college_name") or "BugBash Global Assessment Operations",
                "permissions": permissions,
                "last_login": user.get("last_login")
            }
        except (jwt.PyJWTError, Exception) as e:
            logger.debug(f"Admin token validation error: {e}")
            return None

    def revoke_token(self, token: str):
        """Revokes an active administrative token upon sign out."""
        if token:
            self._revoked_tokens.add(token)

    def revoke_user_sessions(self, email: str):
        """Invalidates all current sessions for an administrative user."""
        if email:
            clean = email.strip().lower()
            self._revoked_emails[clean] = datetime.now(timezone.utc)


admin_auth_service = AdminAuthService()
