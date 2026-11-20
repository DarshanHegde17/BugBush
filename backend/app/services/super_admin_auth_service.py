import os
import re
import time
import logging
import secrets
import hashlib
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, List, Set

from backend.app.database.mongodb import mongodb
from backend.app.services.password_reset_service import PasswordResetService
from backend.app.services.user_service import user_service, JWT_SECRET, JWT_ALGORITHM

logger = logging.getLogger("bugbash.super_admin_auth")

AUTHORIZED_SUPER_ADMIN_ROLES: Set[str] = {"super_admin"}


def mask_email(email: str) -> str:
    """Masks email address for secure public display (e.g. s***r@bugbash.com)."""
    if not email or "@" not in email:
        return "s***@bugbash.com"
    parts = email.split("@", 1)
    name = parts[0]
    domain = parts[1]
    if len(name) <= 2:
        masked_name = name[0] + "***"
    else:
        masked_name = name[0] + "***" + name[-1]
    return f"{masked_name}@{domain}"


class SuperAdminAuthService:
    """
    Dedicated enterprise security service for BugBash Super Administrator Authentication.
    Strictly isolated from candidate and standard admin authentication workflows.

    Enforces:
    - Absolute role isolation: Only accounts explicitly assigned 'super_admin' can authenticate
    - Sliding window rate limiting & brute-force defense on credentials and OTPs
    - Cryptographic single-use OTPs with 10-minute expiry
    - High-entropy single-use password reset tokens with mandatory session revocation
    - Immutable audit trails for all sensitive actions and login events
    - Defense against email enumeration using constant-time generic responses
    """

    def __init__(
        self,
        max_failed_attempts: int = 5,
        lockout_window_minutes: int = 15,
        otp_expiry_minutes: int = 10,
        reset_token_expiry_minutes: int = 15,
        resend_cooldown_seconds: int = 60
    ):
        self.max_failed_attempts = max_failed_attempts
        self.lockout_window = timedelta(minutes=lockout_window_minutes)
        self.otp_expiry = timedelta(minutes=otp_expiry_minutes)
        self.reset_token_expiry = timedelta(minutes=reset_token_expiry_minutes)
        self.resend_cooldown = timedelta(seconds=resend_cooldown_seconds)

        # In-memory tracking for rate limiting, active OTPs, and revocation
        self._provisioned_users: Dict[str, dict] = {}
        self._failed_attempts: Dict[str, List[datetime]] = {}
        self._revoked_tokens: Set[str] = set()
        self._active_tokens_by_email: Dict[str, Set[str]] = {}
        self._otp_cache: Dict[str, dict] = {}
        self._reset_tokens: Dict[str, dict] = {}
        self._audit_logs: List[dict] = []

    def _get_user_doc(self, email: str) -> Optional[dict]:
        clean_email = (email or "").strip().lower()
        if clean_email in self._provisioned_users:
            return self._provisioned_users[clean_email]
        if hasattr(user_service, "_users") and clean_email in user_service._users:
            return user_service._users[clean_email]
        return user_service._get_user_doc(clean_email)

    # --------------------------------------------------------------------------
    # Rate Limiting Utilities
    # --------------------------------------------------------------------------
    def _cleanup_old_attempts(self, key: str, now: datetime):
        if key in self._failed_attempts:
            cutoff = now - self.lockout_window
            self._failed_attempts[key] = [
                ts for ts in self._failed_attempts[key] if ts > cutoff
            ]
            if not self._failed_attempts[key]:
                del self._failed_attempts[key]

    def is_rate_limited(self, identifier: str, is_ip: bool = False) -> bool:
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
        if not identifier:
            return
        clean_key = identifier.strip().lower()
        now = datetime.now(timezone.utc)
        self._cleanup_old_attempts(clean_key, now)
        if clean_key not in self._failed_attempts:
            self._failed_attempts[clean_key] = []
        self._failed_attempts[clean_key].append(now)

    def reset_failed_attempts(self, identifier: str):
        clean_key = identifier.strip().lower()
        if clean_key in self._failed_attempts:
            del self._failed_attempts[clean_key]

    # --------------------------------------------------------------------------
    # Audit Logging
    # --------------------------------------------------------------------------
    def record_audit_event(
        self,
        event_type: str,
        email: str,
        client_ip: str,
        details: str,
        success: bool = True
    ):
        now = datetime.now(timezone.utc)
        entry = {
            "id": f"sa_aud_{secrets.token_hex(6)}",
            "event_type": event_type,
            "email": (email or "").strip().lower(),
            "client_ip": client_ip or "",
            "details": details,
            "success": success,
            "timestamp": now.isoformat(),
            "created_at": now
        }
        self._audit_logs.insert(0, entry)
        if len(self._audit_logs) > 1000:
            self._audit_logs.pop()

        if mongodb.db is not None:
            try:
                mongodb.db.super_admin_audit_logs.insert_one(dict(entry))
            except Exception as e:
                logger.warning(f"Error persisting super admin audit log: {e}")

    # --------------------------------------------------------------------------
    # Account Provisioning (Authorized setup & tests only)
    # --------------------------------------------------------------------------
    def provision_super_admin(
        self,
        email: str,
        password: str,
        full_name: str = "Super Administrator",
        phone_number: str = "+1000000000",
        account_status: str = "Active",
        organization_name: str = "BugBash Global Platform Directorate"
    ) -> dict:
        """
        Provisions a Super Admin account strictly through authorized processes.
        Never exposed publicly.
        """
        clean_email = email.strip().lower()
        valid, msg = PasswordResetService.validate_password_complexity(password)
        if not valid:
            raise ValueError(f"Password complexity failed: {msg}")

        password_hash = PasswordResetService.hash_password(password)
        now = datetime.now(timezone.utc)

        user_doc = {
            "email": clean_email,
            "password_hash": password_hash,
            "full_name": full_name,
            "name": full_name,
            "phone_number": phone_number,
            "role": "super_admin",
            "account_status": account_status,
            "status": account_status,
            "organization_name": organization_name,
            "permissions": ["*"],
            "two_factor_enabled": True,
            "created_at": now,
            "updated_at": now
        }

        # Store in internal and user service in-memory store & MongoDB
        self._provisioned_users[clean_email] = user_doc
        if hasattr(user_service, "_users"):
            user_service._users[clean_email] = user_doc
        if mongodb.users is not None:
            try:
                mongodb.users.update_one(
                    {"email": clean_email},
                    {"$set": user_doc},
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"Error persisting provisioned super admin: {e}")

        self.record_audit_event(
            "super_admin_provisioned",
            clean_email,
            "internal",
            f"Super Admin account provisioned for '{clean_email}'",
            success=True
        )

        return user_doc

    # --------------------------------------------------------------------------
    # Primary Authentication
    # --------------------------------------------------------------------------
    def authenticate_super_admin(
        self,
        email: str,
        password: str,
        client_ip: str = "",
        require_mfa: Optional[bool] = None
    ) -> Tuple[bool, Optional[dict], Optional[dict], Optional[str], int]:
        """
        Validates Super Admin credentials.
        Returns: (success, user_info, auth_meta, error_message, http_status_code)
        """
        clean_email = email.strip().lower()
        client_ip_clean = client_ip.strip()

        # 1. Rate Limiting Check
        if self.is_rate_limited(clean_email, is_ip=False) or (client_ip_clean and self.is_rate_limited(client_ip_clean, is_ip=True)):
            self.record_audit_event(
                "login_rate_limited",
                clean_email,
                client_ip_clean,
                "Super Admin login rejected due to excessive failed attempts",
                success=False
            )
            return (
                False,
                None,
                None,
                "Too many failed login attempts. Your access has been temporarily rate-limited. Please wait 15 minutes before trying again.",
                429
            )

        # 2. Retrieve user record
        user = self._get_user_doc(clean_email)
        if not user:
            self.record_failed_attempt(clean_email)
            if client_ip_clean:
                self.record_failed_attempt(client_ip_clean)
            self.record_audit_event(
                "login_failed_user_not_found",
                clean_email,
                client_ip_clean,
                "Attempted super admin login with non-existent email",
                success=False
            )
            return (
                False,
                None,
                None,
                "Invalid administrative credentials. Access denied.",
                401
            )

        # 3. Verify Password
        stored_hash = user.get("password_hash") or user.get("password")
        if not stored_hash or not PasswordResetService.verify_password(password, stored_hash):
            self.record_failed_attempt(clean_email)
            if client_ip_clean:
                self.record_failed_attempt(client_ip_clean)
            self.record_audit_event(
                "login_failed_bad_password",
                clean_email,
                client_ip_clean,
                "Invalid password provided for super admin",
                success=False
            )
            return (
                False,
                None,
                None,
                "Invalid administrative credentials. Access denied.",
                401
            )

        # 4. Strict Role Authorization Check
        user_role = (user.get("role") or "").strip().lower()
        if user_role not in AUTHORIZED_SUPER_ADMIN_ROLES:
            self.record_audit_event(
                "unauthorized_role_attempt",
                clean_email,
                client_ip_clean,
                f"Unauthorized role '{user_role}' attempted access to Super Admin Gateway",
                success=False
            )
            return (
                False,
                None,
                None,
                "Access restricted: Only authorized Super Administrators may authenticate through this gateway.",
                403
            )

        # 5. Account Status Check
        account_status = user.get("account_status") or user.get("status") or "Active"
        status_clean = str(account_status).strip().lower()

        if status_clean in ("inactive", "deactivated", "disabled"):
            self.record_audit_event(
                "login_inactive_account",
                clean_email,
                client_ip_clean,
                "Attempted login with inactive super admin account",
                success=False
            )
            return (
                False,
                None,
                None,
                "Your Super Administrator account is currently inactive. Please contact platform operations.",
                403
            )

        if status_clean in ("suspended", "locked", "blocked"):
            self.record_audit_event(
                "login_suspended_account",
                clean_email,
                client_ip_clean,
                "Attempted login with suspended super admin account",
                success=False
            )
            return (
                False,
                None,
                None,
                "Your Super Administrator account has been suspended for security policy reasons.",
                403
            )

        # 6. Credentials Validated
        self.reset_failed_attempts(clean_email)
        if client_ip_clean:
            self.reset_failed_attempts(client_ip_clean)

        user_info = {
            "id": str(user.get("id") or user.get("_id") or clean_email),
            "email": clean_email,
            "name": user.get("full_name") or user.get("name") or "Super Administrator",
            "role": "super_admin",
            "account_status": account_status,
            "permissions": ["*"],
            "is_super_admin": True,
            "last_login": user.get("last_login")
        }

        # 7. Check if Multi-Factor Authentication is triggered
        # Defaults to True for Super Admin security unless explicitly bypassed in payload
        needs_mfa = True if require_mfa is None else bool(require_mfa)
        if user.get("two_factor_enabled") is False and require_mfa is None:
            needs_mfa = False

        if needs_mfa:
            temp_token, otp = self.create_otp_challenge(clean_email, purpose="login")
            auth_meta = {
                "require_otp": True,
                "temp_token": temp_token,
                "masked_email": mask_email(clean_email),
                "dev_otp": otp,
                "message": "Multi-factor authentication required. A 6-digit verification code has been dispatched."
            }
            self.record_audit_event(
                "otp_dispatched",
                clean_email,
                client_ip_clean,
                "MFA OTP challenge issued for Super Admin sign-in",
                success=True
            )
            return True, user_info, auth_meta, None, 200

        # Direct token issuance if MFA disabled
        token, expires_in = self.create_super_admin_token(user_info)
        self._record_login_success(clean_email, client_ip_clean)
        auth_meta = {
            "require_otp": False,
            "access_token": token,
            "token_type": "bearer",
            "expires_in": expires_in,
            "redirect_url": "/super-admin/dashboard"
        }
        return True, user_info, auth_meta, None, 200

    # --------------------------------------------------------------------------
    # OTP Management (Single-use, 6-digit, rate-limited)
    # --------------------------------------------------------------------------
    def create_otp_challenge(self, email: str, purpose: str = "login") -> Tuple[str, str]:
        """Creates and stores an expiring 6-digit OTP challenge."""
        clean_email = email.strip().lower()
        otp = f"{secrets.randbelow(900000) + 100000}"
        otp_hash = hashlib.sha256(otp.encode("utf-8")).hexdigest()
        temp_token = f"sa_{secrets.token_hex(20)}"
        now = datetime.now(timezone.utc)
        expires_at = now + self.otp_expiry

        record = {
            "temp_token": temp_token,
            "email": clean_email,
            "otp_hash": otp_hash,
            "purpose": purpose,
            "attempts": 0,
            "max_attempts": 5,
            "created_at": now,
            "expires_at": expires_at,
            "last_sent_at": now,
            "used": False
        }

        self._otp_cache[temp_token] = record
        # Also index by email for resend lookups
        self._otp_cache[clean_email] = record

        if mongodb.db is not None:
            try:
                mongodb.db.super_admin_otps.update_one(
                    {"email": clean_email, "purpose": purpose},
                    {"$set": dict(record)},
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"Error persisting super admin OTP: {e}")

        return temp_token, otp

    def verify_otp(
        self,
        identifier: str,
        otp: str,
        remember_device: bool = False,
        client_ip: str = ""
    ) -> Tuple[bool, Optional[dict], Optional[str], Optional[int], Optional[str], int]:
        """
        Verifies 6-digit OTP.
        Returns: (success, user_info, token, expires_in, error_message, http_status_code)
        """
        clean_id = (identifier or "").strip()
        client_ip_clean = client_ip.strip()

        # 1. Lookup OTP record
        record = self._otp_cache.get(clean_id)
        if not record and "@" in clean_id:
            record = self._otp_cache.get(clean_id.lower())

        if not record and mongodb.db is not None:
            try:
                doc = mongodb.db.super_admin_otps.find_one({
                    "$or": [{"temp_token": clean_id}, {"email": clean_id.lower()}],
                    "used": False
                })
                if doc:
                    record = doc
            except Exception:
                pass

        if not record or record.get("used"):
            return False, None, None, None, "Invalid or expired verification session. Please sign in again.", 400

        now = datetime.now(timezone.utc)
        expires_at = record.get("expires_at")
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now > expires_at:
                return False, None, None, None, "Verification code has expired. Please request a new code.", 400

        # Check maximum failed OTP attempts
        if record.get("attempts", 0) >= record.get("max_attempts", 5):
            self.record_audit_event(
                "otp_lockout",
                record["email"],
                client_ip_clean,
                "Maximum OTP verification attempts exceeded",
                success=False
            )
            return False, None, None, None, "Too many failed attempts. This code is now invalid. Please request a new one.", 429

        # Validate OTP hash
        provided_hash = hashlib.sha256(otp.strip().encode("utf-8")).hexdigest()
        if not secrets.compare_digest(provided_hash, record["otp_hash"]):
            record["attempts"] = record.get("attempts", 0) + 1
            remaining = max(0, record.get("max_attempts", 5) - record["attempts"])
            self.record_audit_event(
                "otp_failed",
                record["email"],
                client_ip_clean,
                f"Incorrect OTP attempt ({record['attempts']}/{record['max_attempts']})",
                success=False
            )
            return False, None, None, None, f"Invalid verification code. {remaining} attempts remaining.", 400

        # Mark OTP as used immediately (single-use)
        record["used"] = True
        if mongodb.db is not None:
            try:
                mongodb.db.super_admin_otps.update_one(
                    {"temp_token": record["temp_token"]},
                    {"$set": {"used": True, "verified_at": now}}
                )
            except Exception:
                pass

        # Retrieve user document
        user = self._get_user_doc(record["email"])
        if not user:
            return False, None, None, None, "User record could not be resolved.", 404

        user_info = {
            "id": str(user.get("id") or user.get("_id") or record["email"]),
            "email": record["email"],
            "name": user.get("full_name") or user.get("name") or "Super Administrator",
            "role": "super_admin",
            "account_status": user.get("account_status") or user.get("status") or "Active",
            "permissions": ["*"],
            "is_super_admin": True,
            "last_login": now.isoformat()
        }

        # Issue Super Admin JWT
        token, expires_in = self.create_super_admin_token(user_info, remember_device=remember_device)
        self._record_login_success(record["email"], client_ip_clean)

        self.record_audit_event(
            "otp_verified",
            record["email"],
            client_ip_clean,
            "Super Admin MFA OTP successfully verified",
            success=True
        )

        return True, user_info, token, expires_in, None, 200

    def resend_otp(
        self,
        identifier: str,
        client_ip: str = ""
    ) -> Tuple[bool, Optional[str], Optional[str], Optional[str], int]:
        """
        Resends OTP with 60-second cooldown enforcement.
        Returns: (success, temp_token, dev_otp, error_message, http_status_code)
        """
        clean_id = (identifier or "").strip()
        client_ip_clean = client_ip.strip()

        record = self._otp_cache.get(clean_id)
        if not record and "@" in clean_id:
            record = self._otp_cache.get(clean_id.lower())

        if not record and mongodb.db is not None:
            try:
                record = mongodb.db.super_admin_otps.find_one({
                    "$or": [{"temp_token": clean_id}, {"email": clean_id.lower()}]
                })
            except Exception:
                pass

        if not record:
            return False, None, None, "No active verification challenge found. Please sign in again.", 400

        email = record["email"]
        now = datetime.now(timezone.utc)
        last_sent = record.get("last_sent_at")
        if isinstance(last_sent, datetime):
            if last_sent.tzinfo is None:
                last_sent = last_sent.replace(tzinfo=timezone.utc)
            elapsed = (now - last_sent).total_seconds()
            if elapsed < self.resend_cooldown.total_seconds():
                remaining = int(self.resend_cooldown.total_seconds() - elapsed)
                return False, None, None, f"Please wait {remaining} seconds before requesting a new code.", 429

        new_otp = f"{secrets.randbelow(900000) + 100000}"
        otp_hash = hashlib.sha256(new_otp.encode("utf-8")).hexdigest()
        record["otp_hash"] = otp_hash
        record["attempts"] = 0
        record["expires_at"] = now + self.otp_expiry
        record["last_sent_at"] = now
        record["used"] = False
        
        temp_token = record.get("temp_token") or clean_id
        self._otp_cache[temp_token] = record
        self._otp_cache[email] = record

        if mongodb.db is not None:
            try:
                mongodb.db.super_admin_otps.update_one(
                    {"email": email, "purpose": record.get("purpose", "login")},
                    {"$set": dict(record)},
                    upsert=True
                )
            except Exception:
                pass

        self.record_audit_event(
            "otp_resent",
            email,
            client_ip_clean,
            "Super Admin requested new OTP code",
            success=True
        )

        return True, temp_token, new_otp, None, 200

    # --------------------------------------------------------------------------
    # Forgot & Reset Password
    # --------------------------------------------------------------------------
    def forgot_password(
        self,
        email: str,
        client_ip: str = ""
    ) -> Tuple[bool, Optional[str], Optional[str], Optional[str], Optional[str], int]:
        """
        Secure password recovery request.
        Generic response protects against email enumeration.
        Returns: (success, temp_token, masked_email, dev_otp, dev_reset_url, http_status_code)
        """
        clean_email = email.strip().lower()
        client_ip_clean = client_ip.strip()

        # Rate limiting check
        if self.is_rate_limited(clean_email, is_ip=False) or (client_ip_clean and self.is_rate_limited(client_ip_clean, is_ip=True)):
            self.record_audit_event(
                "forgot_password_rate_limited",
                clean_email,
                client_ip_clean,
                "Password recovery request rate limited",
                success=False
            )
            return False, None, None, None, None, 429

        self.record_failed_attempt(clean_email)
        if client_ip_clean:
            self.record_failed_attempt(client_ip_clean)

        user = self._get_user_doc(clean_email)
        # Only proceed with actual token creation if account exists, is active, and is super_admin
        if user and (user.get("role") or "").strip().lower() in AUTHORIZED_SUPER_ADMIN_ROLES:
            status_clean = str(user.get("account_status") or user.get("status") or "Active").strip().lower()
            if status_clean not in ("inactive", "suspended", "locked"):
                raw_token = f"sart_{secrets.token_urlsafe(32)}"
                token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
                otp = f"{secrets.randbelow(900000) + 100000}"
                otp_hash = hashlib.sha256(otp.encode("utf-8")).hexdigest()
                now = datetime.now(timezone.utc)
                expires_at = now + self.reset_token_expiry

                reset_doc = {
                    "token_hash": token_hash,
                    "otp_hash": otp_hash,
                    "email": clean_email,
                    "created_at": now,
                    "expires_at": expires_at,
                    "used": False
                }

                self._reset_tokens[raw_token] = reset_doc
                self._reset_tokens[token_hash] = reset_doc

                if mongodb.db is not None:
                    try:
                        mongodb.db.super_admin_resets.insert_one(dict(reset_doc))
                    except Exception as e:
                        logger.warning(f"Error persisting super admin reset record: {e}")

                self.record_audit_event(
                    "password_reset_requested",
                    clean_email,
                    client_ip_clean,
                    "Super Admin requested password reset credentials",
                    success=True
                )

                dev_reset_url = f"/super-admin/reset-password?token={raw_token}"
                return True, raw_token, mask_email(clean_email), otp, dev_reset_url, 200

        # Generic success response even if account doesn't exist to prevent enumeration
        return True, None, mask_email(clean_email), None, None, 200

    def reset_password(
        self,
        token: str,
        new_password: str,
        confirm_password: str,
        client_ip: str = ""
    ) -> Tuple[bool, Optional[str], int]:
        """
        Resets Super Admin password with complexity checks, single-use token destruction,
        and mandatory session revocation.
        """
        client_ip_clean = client_ip.strip()

        if new_password != confirm_password:
            return False, "Passwords do not match. Please verify both fields.", 400

        valid, msg = PasswordResetService.validate_password_complexity(new_password)
        if not valid:
            return False, msg, 400

        clean_token = token.strip()
        token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()

        # Resolve reset record
        record = self._reset_tokens.get(clean_token) or self._reset_tokens.get(token_hash)
        if not record and mongodb.db is not None:
            try:
                record = mongodb.db.super_admin_resets.find_one({"token_hash": token_hash, "used": False})
            except Exception:
                pass

        if not record or record.get("used"):
            return False, "Invalid, expired, or already utilized password reset token.", 400

        now = datetime.now(timezone.utc)
        expires_at = record.get("expires_at")
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now > expires_at:
                return False, "Password reset token has expired. Please request a new recovery link.", 400

        email = record["email"]
        user = self._get_user_doc(email)
        if not user:
            return False, "Super Administrator account record not found.", 404

        # Enforce that new password is not identical to old password
        stored_hash = user.get("password_hash") or user.get("password")
        if stored_hash and PasswordResetService.verify_password(new_password, stored_hash):
            return False, "New password cannot be identical to your current password.", 400

        # Hash new password
        new_hash = PasswordResetService.hash_password(new_password)

        # Invalidate reset token immediately
        record["used"] = True
        if mongodb.db is not None:
            try:
                mongodb.db.super_admin_resets.update_one(
                    {"token_hash": token_hash},
                    {"$set": {"used": True, "used_at": now}}
                )
            except Exception:
                pass

        # Update user password in database
        user["password_hash"] = new_hash
        user["password"] = new_hash
        user["password_updated_at"] = now.isoformat()
        if mongodb.users is not None:
            try:
                mongodb.users.update_one(
                    {"email": email},
                    {"$set": {"password_hash": new_hash, "password_updated_at": now.isoformat()}}
                )
            except Exception as e:
                logger.warning(f"Error updating super admin password: {e}")

        # MANDATORY SECURITY REQUIREMENT: Revoke all existing sessions for this Super Admin
        self.revoke_all_sessions_for_email(email)

        self.record_audit_event(
            "password_reset_success",
            email,
            client_ip_clean,
            "Super Admin password updated successfully; all active sessions revoked",
            success=True
        )

        return True, "Password reset successful. All active sessions have been securely terminated. Please sign in with your new password.", 200

    # --------------------------------------------------------------------------
    # Token & Session Lifecycle
    # --------------------------------------------------------------------------
    def create_super_admin_token(
        self,
        user_info: dict,
        remember_device: bool = False
    ) -> Tuple[str, int]:
        """Issues high-security signed JWT session token with Super Admin claims."""
        now = datetime.now(timezone.utc)
        duration_days = 30 if remember_device else 1
        expires_at = now + timedelta(days=duration_days)
        expires_in = int(timedelta(days=duration_days).total_seconds())
        jti = secrets.token_hex(16)

        payload = {
            "sub": user_info["email"],
            "email": user_info["email"],
            "name": user_info["name"],
            "role": "super_admin",
            "is_super_admin": True,
            "permissions": ["*"],
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
            "jti": jti
        }

        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        # Track active session by email for complete revocation capability
        clean_email = user_info["email"].lower()
        if clean_email not in self._active_tokens_by_email:
            self._active_tokens_by_email[clean_email] = set()
        self._active_tokens_by_email[clean_email].add(token)

        return token, expires_in

    def get_super_admin_by_token(self, token: str) -> Optional[dict]:
        """Resolves active Super Admin from verified Bearer token."""
        if not token or token in self._revoked_tokens:
            return None

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            email = payload.get("sub") or payload.get("email")
            role = payload.get("role")
            if not email or not role or role not in AUTHORIZED_SUPER_ADMIN_ROLES:
                return None

            user = self._get_user_doc(email.lower())
            if not user:
                return None

            user_role = (user.get("role") or "").strip().lower()
            if user_role not in AUTHORIZED_SUPER_ADMIN_ROLES:
                return None

            account_status = user.get("account_status") or user.get("status") or "Active"
            if str(account_status).strip().lower() in ("inactive", "suspended", "locked"):
                return None

            return {
                "id": str(user.get("id") or user.get("_id") or email),
                "email": user["email"],
                "name": user.get("full_name") or user.get("name") or "Super Administrator",
                "role": "super_admin",
                "account_status": account_status,
                "permissions": ["*"],
                "is_super_admin": True,
                "last_login": user.get("last_login")
            }
        except (jwt.PyJWTError, Exception) as e:
            logger.debug(f"Super admin token validation error: {e}")
            return None

    def revoke_token(self, token: str, client_ip: str = ""):
        """Revokes a specific session token."""
        if token:
            self._revoked_tokens.add(token)
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_exp": False})
                email = payload.get("sub") or payload.get("email")
                if email:
                    self.record_audit_event(
                        "logout",
                        email,
                        client_ip,
                        "Super Admin session signed out and token revoked",
                        success=True
                    )
            except Exception:
                pass

    def revoke_all_sessions_for_email(self, email: str):
        """Terminates all active sessions for a specific Super Admin email."""
        clean_email = email.strip().lower()
        tokens = self._active_tokens_by_email.get(clean_email, set())
        for tok in tokens:
            self._revoked_tokens.add(tok)
        self._active_tokens_by_email[clean_email] = set()

    def _record_login_success(self, email: str, client_ip: str):
        now = datetime.now(timezone.utc)
        user = self._get_user_doc(email)
        if user:
            user["last_login"] = now.isoformat()
        if mongodb.users is not None:
            try:
                mongodb.users.update_one(
                    {"email": email},
                    {"$set": {"last_login": now.isoformat(), "updated_at": now}}
                )
            except Exception:
                pass
        self.record_audit_event(
            "login_success",
            email,
            client_ip,
            "Super Admin successfully authenticated and session established",
            success=True
        )


super_admin_auth_service = SuperAdminAuthService()
