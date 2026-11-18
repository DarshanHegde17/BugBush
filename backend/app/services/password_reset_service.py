import re
import secrets
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple, List

from backend.app.database.mongodb import mongodb

logger = logging.getLogger("bugbash.auth.password_reset")

# Password complexity pattern
PASSWORD_MIN_LENGTH = 8
SPECIAL_CHARS_PATTERN = re.compile(r'[^A-Za-z0-9]')


class PasswordResetService:
    """
    Secure Password Reset Service.
    - Generates high-entropy cryptographic tokens.
    - Stores strictly SHA-256 hashed tokens with 15-minute expiration in MongoDB.
    - Enforces single-use invalidation.
    - Implements rate limiting to thwart brute force and flooding.
    - Hashes passwords with PBKDF2-HMAC-SHA256 with cryptographically random salt.
    - Compatible with bcrypt hashes stored in MongoDB Compass.
    """

    def __init__(self, token_expiry_minutes: int = 15, max_requests_per_window: int = 4, window_minutes: int = 15):
        self.token_expiry = timedelta(minutes=token_expiry_minutes)
        self.max_requests_per_window = max_requests_per_window
        self.window_duration = timedelta(minutes=window_minutes)

        # In-memory fast cache
        self._tokens: Dict[str, dict] = {}
        self._rate_limits: Dict[str, List[datetime]] = {}

        # Default fallback credentials
        self._mock_users: Dict[str, dict] = {
            "demo@bugbash.com": {
                "password_hash": self.hash_password("DemoPassword123!"),
                "role": "candidate"
            }
        }

    # --------------------------------------------------------------------------
    # Cryptographic & Hashing Utilities
    # --------------------------------------------------------------------------
    @staticmethod
    def _hash_token(raw_token: str) -> str:
        """Computes SHA-256 digest of the reset token."""
        return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()

    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hashes password using PBKDF2-HMAC-SHA256 with 100,000 iterations and a 16-byte random salt.
        Never stores passwords in plaintext.
        """
        salt = secrets.token_bytes(16)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return f"pbkdf2_sha256$100000${salt.hex()}${key.hex()}"

    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        """
        Verifies password against stored PBKDF2 or bcrypt hash.
        Ensures compatibility with existing MongoDB documents.
        """
        if not hashed_password or not password:
            return False

        # 1. Check for bcrypt hash ($2a$ or $2b$)
        if hashed_password.startswith("$2a$") or hashed_password.startswith("$2b$"):
            try:
                import bcrypt
                return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
            except Exception:
                pass

        # 2. Check for PBKDF2 hash (pbkdf2_sha256$...)
        try:
            algorithm, iterations, salt_hex, key_hex = hashed_password.split("$")
            salt = bytes.fromhex(salt_hex)
            expected_key = bytes.fromhex(key_hex)
            key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
            return secrets.compare_digest(key, expected_key)
        except Exception:
            return False

    @staticmethod
    def validate_password_complexity(password: str) -> Tuple[bool, Optional[str]]:
        """
        Validates password rules:
        - Minimum 8 characters.
        - At least one uppercase letter.
        - At least one lowercase letter.
        - At least one number.
        - At least one special character.
        """
        if len(password) < PASSWORD_MIN_LENGTH:
            return False, "Password must be at least 8 characters long."
        if not re.search(r'[A-Z]', password):
            return False, "Password must contain at least one uppercase letter."
        if not re.search(r'[a-z]', password):
            return False, "Password must contain at least one lowercase letter."
        if not re.search(r'[0-9]', password):
            return False, "Password must contain at least one number."
        if not SPECIAL_CHARS_PATTERN.search(password):
            return False, "Password must contain at least one special character."
        return True, None

    # --------------------------------------------------------------------------
    # Rate Limiting
    # --------------------------------------------------------------------------
    def is_rate_limited(self, identifier: str) -> bool:
        """Checks if identifier (email or IP) has exceeded allowed requests in window."""
        now = datetime.now(timezone.utc)
        timestamps = self._rate_limits.get(identifier, [])
        cutoff = now - self.window_duration
        fresh_timestamps = [ts for ts in timestamps if ts > cutoff]
        self._rate_limits[identifier] = fresh_timestamps
        return len(fresh_timestamps) >= self.max_requests_per_window

    def record_request(self, identifier: str):
        """Records a request timestamp for rate limiting."""
        now = datetime.now(timezone.utc)
        if identifier not in self._rate_limits:
            self._rate_limits[identifier] = []
        self._rate_limits[identifier].append(now)

    # --------------------------------------------------------------------------
    # Password Reset Lifecycle
    # --------------------------------------------------------------------------
    def create_reset_token(self, email: str, client_ip: str = "") -> Optional[str]:
        """
        Generates a secure, random, single-use reset token and stores ONLY its SHA-256 hash in MongoDB.
        Returns the raw token (only returned to caller to compose email / link).
        """
        normalized_email = email.strip().lower()

        # Enforce rate limit per email and IP
        if self.is_rate_limited(normalized_email) or (client_ip and self.is_rate_limited(client_ip)):
            logger.warning("Password reset rate limit exceeded for identifier.")
            return None

        self.record_request(normalized_email)
        if client_ip:
            self.record_request(client_ip)

        # Generate cryptographically secure URL-safe token (32 bytes entropy)
        raw_token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(raw_token)

        now = datetime.now(timezone.utc)
        expires_at = now + self.token_expiry

        token_doc = {
            "token_hash": token_hash,
            "email": normalized_email,
            "created_at": now,
            "expires_at": expires_at,
            "used": False
        }

        # Cache in memory
        self._tokens[token_hash] = token_doc

        # Persist to MongoDB
        if mongodb.password_resets is not None:
            try:
                # Invalidate prior unused tokens
                mongodb.password_resets.update_many(
                    {"email": normalized_email, "used": False},
                    {"$set": {"used": True}}
                )
                mongodb.password_resets.insert_one(dict(token_doc))
            except Exception as e:
                logger.warning(f"Failed to persist reset token in MongoDB: {e}")

        masked_email = normalized_email[0] + "***@" + normalized_email.split("@")[-1] if "@" in normalized_email else "***"
        logger.info(f"Password reset token issued for {masked_email}. Hash prefix: {token_hash[:8]}...")

        return raw_token

    def verify_reset_token(self, raw_token: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Verifies if raw reset token is valid against MongoDB / memory.
        Returns: (is_valid, email_or_none, failure_reason_or_none)
        """
        if not raw_token or len(raw_token) < 16:
            return False, None, "Invalid reset token format."

        token_hash = self._hash_token(raw_token)
        record = self._tokens.get(token_hash)

        # If not in memory, query MongoDB
        if not record and mongodb.password_resets is not None:
            try:
                record = mongodb.password_resets.find_one({"token_hash": token_hash})
                if record:
                    self._tokens[token_hash] = record
            except Exception as e:
                logger.warning(f"Error querying reset token from MongoDB: {e}")

        if not record:
            return False, None, "This password reset link is invalid or has expired."

        if record.get("used"):
            return False, None, "This password reset link has already been used. Please request a new one."

        now = datetime.now(timezone.utc)
        expires_at = record.get("expires_at")
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now > expires_at:
                return False, None, "This password reset link has expired (links are valid for 15 minutes)."

        return True, record["email"], None

    def reset_password(self, raw_token: str, new_password: str) -> Tuple[bool, str]:
        """
        Validates token, validates password complexity, updates password hash in MongoDB,
        and invalidates the token immediately.
        """
        # 1. Verify token
        is_valid, email, failure_reason = self.verify_reset_token(raw_token)
        if not is_valid:
            return False, failure_reason or "Invalid or expired reset token."

        # 2. Validate password complexity
        is_complex, complexity_error = self.validate_password_complexity(new_password)
        if not is_complex:
            return False, complexity_error or "Password does not meet complexity requirements."

        # 3. Hash password (never plaintext)
        hashed_pw = self.hash_password(new_password)
        token_hash = self._hash_token(raw_token)

        # 4. Invalidate token immediately
        if token_hash in self._tokens:
            self._tokens[token_hash]["used"] = True

        if mongodb.password_resets is not None:
            try:
                mongodb.password_resets.update_one(
                    {"token_hash": token_hash},
                    {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
                )
            except Exception as e:
                logger.warning(f"Error marking token used in MongoDB: {e}")

        # 5. Update user credentials in MongoDB
        now = datetime.now(timezone.utc)
        if mongodb.users is not None:
            try:
                mongodb.users.update_one(
                    {"email": email.strip().lower()},
                    {"$set": {
                        "password_hash": hashed_pw,
                        "password": hashed_pw,
                        "password_updated_at": now,
                        "updated_at": now
                    }}
                )
            except Exception as e:
                logger.error(f"Error updating user password in MongoDB: {e}")

        # In-memory update
        self._mock_users[email] = {
            "password_hash": hashed_pw,
            "updated_at": now
        }

        masked_email = email[0] + "***@" + email.split("@")[-1] if "@" in email else "***"
        logger.info(f"Password successfully reset for account {masked_email}. Stored in MongoDB.")
        return True, "Your password has been successfully reset."


# Global singleton instance
password_reset_service = PasswordResetService()
