import re
import secrets
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple, List

from backend.app.services.password_reset_service import PasswordResetService

logger = logging.getLogger("bugbash.auth.user_service")

# Phone regex accepting standard international / domestic formats: +1 (555) 000-0000, 9876543210, etc.
PHONE_REGEX = re.compile(r'^[+]?[\d\s\-\(\)\.]{7,25}$')


class UserService:
    """
    Core User Management Service for BugBash:
    - Individual candidate registration
    - Unique email constraint enforcement
    - PBKDF2-HMAC-SHA256 salted password hashing
    - Cryptographic 6-digit OTP generation and verification
    - Account activation upon successful email verification
    - Zero plain password or sensitive credential logging
    """

    def __init__(self, otp_expiry_minutes: int = 10, resend_cooldown_seconds: int = 30):
        self.otp_expiry = timedelta(minutes=otp_expiry_minutes)
        self.resend_cooldown = timedelta(seconds=resend_cooldown_seconds)

        # User Store: { email_lower: { full_name, email, phone_number, password_hash, is_verified, role, created_at } }
        self._users: Dict[str, dict] = {
            "demo@bugbash.com": {
                "full_name": "Demo Candidate",
                "email": "demo@bugbash.com",
                "phone_number": "+15551234567",
                "password_hash": PasswordResetService.hash_password("DemoPassword123!"),
                "is_verified": True,
                "role": "candidate",
                "created_at": datetime.now(timezone.utc)
            }
        }

        # OTP Store: { verification_token: { email, otp, expires_at, attempts, last_sent_at } }
        self._otps: Dict[str, dict] = {}

        # Reverse lookup: { email_lower: verification_token }
        self._email_to_token: Dict[str, str] = {}

    def register_user(
        self,
        full_name: str,
        email: str,
        phone_number: str,
        password: str
    ) -> Tuple[bool, Optional[dict], Optional[str], Optional[str], Optional[str]]:
        """
        Registers a new individual candidate account.
        Returns: (success, user_dict, verification_token, otp, error_message)
        """
        clean_name = full_name.strip()
        clean_email = email.strip().lower()
        clean_phone = phone_number.strip()

        # 1. Validation
        if len(clean_name) < 2:
            return False, None, None, None, "Please provide your full legal name (at least 2 characters)."

        if not PHONE_REGEX.match(clean_phone):
            return False, None, None, None, "Please enter a valid phone number (7 to 20 digits)."

        # Complexity validation
        is_complex, complexity_err = PasswordResetService.validate_password_complexity(password)
        if not is_complex:
            return False, None, None, None, complexity_err or "Password does not meet complexity requirements."

        # 2. Email uniqueness check
        if clean_email in self._users:
            existing = self._users[clean_email]
            if existing.get("is_verified", False):
                return False, None, None, None, "An account with this email address already exists. Please sign in instead."
            else:
                # User exists but is unverified: update details, refresh password, and issue fresh OTP
                hashed_pw = PasswordResetService.hash_password(password)
                existing["full_name"] = clean_name
                existing["phone_number"] = clean_phone
                existing["password_hash"] = hashed_pw
                existing["updated_at"] = datetime.now(timezone.utc)
                
                # Issue new OTP
                token, otp = self._create_otp_for_email(clean_email)
                masked_email = clean_email[0] + "***@" + clean_email.split("@")[-1]
                logger.info(f"Unverified user {masked_email} re-registered. Fresh OTP dispatched.")
                return True, existing, token, otp, None

        # 3. Securely hash password (never plaintext)
        hashed_password = PasswordResetService.hash_password(password)

        # 4. Create user record in pending verification state
        user_record = {
            "full_name": clean_name,
            "email": clean_email,
            "phone_number": clean_phone,
            "password_hash": hashed_password,
            "is_verified": False,
            "role": "candidate",
            "created_at": datetime.now(timezone.utc)
        }
        self._users[clean_email] = user_record

        # 5. Generate secure 6-digit OTP and context token
        token, otp = self._create_otp_for_email(clean_email)

        masked_email = clean_email[0] + "***@" + clean_email.split("@")[-1]
        logger.info(f"New candidate registered: {masked_email}. Status: Pending OTP Verification.")

        return True, user_record, token, otp, None

    def _create_otp_for_email(self, email: str) -> Tuple[str, str]:
        """Internal helper to generate a 6-digit OTP and 32-byte context token."""
        # Generate 6-digit cryptographic numeric OTP (100000 - 999999)
        otp = f"{secrets.randbelow(900000) + 100000}"
        token = secrets.token_urlsafe(32)

        now = datetime.now(timezone.utc)
        expires_at = now + self.otp_expiry

        # Invalidate previous token for this email if any
        if email in self._email_to_token:
            old_token = self._email_to_token[email]
            self._otps.pop(old_token, None)

        self._otps[token] = {
            "email": email,
            "otp": otp,
            "created_at": now,
            "expires_at": expires_at,
            "last_sent_at": now,
            "attempts": 0
        }
        self._email_to_token[email] = token

        return token, otp

    def verify_email_otp(
        self,
        token: Optional[str],
        otp: str,
        email: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates OTP and activates user account.
        Returns: (success, error_message)
        """
        clean_otp = otp.strip()
        otp_record = None
        matched_token = None

        if token and token in self._otps:
            otp_record = self._otps[token]
            matched_token = token
        elif email:
            normalized_email = email.strip().lower()
            if normalized_email in self._email_to_token:
                matched_token = self._email_to_token[normalized_email]
                otp_record = self._otps.get(matched_token)

        if not otp_record:
            return False, "Invalid or missing verification session. Please request a new verification code."

        now = datetime.now(timezone.utc)

        # Check expiration
        if now > otp_record["expires_at"]:
            return False, "Verification code has expired. Please request a new one."

        # Brute-force protection: max 5 failed attempts per OTP
        if otp_record["attempts"] >= 5:
            self._otps.pop(matched_token, None)
            return False, "Too many failed attempts. This verification code has been revoked. Please request a new one."

        otp_record["attempts"] += 1

        # Check OTP match using constant-time comparison
        if not secrets.compare_digest(otp_record["otp"], clean_otp):
            remaining = 5 - otp_record["attempts"]
            return False, f"Incorrect verification code. {remaining} attempt(s) remaining."

        # Activate user account
        user_email = otp_record["email"]
        if user_email in self._users:
            self._users[user_email]["is_verified"] = True
            self._users[user_email]["verified_at"] = now

        # Invalidate OTP record immediately upon activation
        self._otps.pop(matched_token, None)
        self._email_to_token.pop(user_email, None)

        masked_email = user_email[0] + "***@" + user_email.split("@")[-1]
        logger.info(f"User account activated successfully for {masked_email}.")

        return True, None

    def resend_otp(self, token: Optional[str], email: Optional[str]) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Generates and dispatches a fresh 6-digit OTP with cooldown rate-limiting.
        Returns: (success, new_otp, error_message)
        """
        clean_email = None
        if token and token in self._otps:
            clean_email = self._otps[token]["email"]
        elif email:
            clean_email = email.strip().lower()

        if not clean_email or clean_email not in self._users:
            return False, None, "Account not found for OTP dispatch."

        now = datetime.now(timezone.utc)

        # Check cooldown
        if clean_email in self._email_to_token:
            current_token = self._email_to_token[clean_email]
            record = self._otps.get(current_token)
            if record and (now - record["last_sent_at"]) < self.resend_cooldown:
                remaining_sec = int((self.resend_cooldown - (now - record["last_sent_at"])).total_seconds())
                return False, None, f"Please wait {remaining_sec} seconds before requesting another code."

        # Generate new OTP
        new_token, new_otp = self._create_otp_for_email(clean_email)
        masked_email = clean_email[0] + "***@" + clean_email.split("@")[-1]
        logger.info(f"New OTP dispatched to {masked_email}.")

        return True, new_otp, None


# Global singleton instance
user_service = UserService()

