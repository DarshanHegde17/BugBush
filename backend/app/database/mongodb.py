import os
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection
from pymongo.database import Database

logger = logging.getLogger("bugbash.database.mongodb")

MONGO_URI = (
    os.environ.get("MONGO_URI") or 
    os.environ.get("MONGODB_URI") or 
    os.environ.get("MONGODB_URL") or 
    "mongodb://localhost:27017"
)
MONGO_DB_NAME = os.environ.get("MONGO_DB_NAME", "bugbash")


class MongoDB:
    """
    MongoDB Database Connection and Collection Manager for BugBash.
    Provides persistent storage across server restarts, compatible with MongoDB Compass.
    """

    def __init__(self, uri: str = MONGO_URI, db_name: str = MONGO_DB_NAME):
        self.uri = uri
        self.db_name = db_name
        self.client: Optional[MongoClient] = None
        self.db: Optional[Database] = None
        self.is_connected = False
        self._connect()

    def _connect(self):
        """Establishes connection to MongoDB instance."""
        try:
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=3000)
            # Verify connectivity
            self.client.admin.command('ping')
            self.db = self.client[self.db_name]
            self.is_connected = True
            logger.info(f"Connected to MongoDB '{self.db_name}' successfully at {self.uri}")
            self._ensure_indexes()
            self._seed_default_users()
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}. Checking fallback mode.")
            self.is_connected = False

    def _ensure_indexes(self):
        """Ensures performant indexes and unique constraints on collections."""
        if not self.is_connected or self.db is None:
            return

        try:
            # Users: unique index on lowercased email (support existing sparse index)
            try:
                self.db.users.create_index([("email", ASCENDING)], unique=True, sparse=True, background=True)
            except Exception as e:
                logger.debug(f"Users index: {e}")
            
            # OTPs: index on token and email
            try:
                self.db.otps.create_index([("token", ASCENDING)], unique=True, sparse=True, background=True)
                self.db.otps.create_index([("email", ASCENDING)], background=True)
            except Exception as e:
                logger.debug(f"OTPs index: {e}")
            
            # Password Resets: index on token_hash
            try:
                self.db.password_resets.create_index([("token_hash", ASCENDING)], unique=True, background=True)
                self.db.password_resets.create_index([("email", ASCENDING)], background=True)
            except Exception as e:
                logger.debug(f"Password resets index: {e}")

            # Assessments: indexed by user_email and assessment id
            try:
                self.db.assessments.create_index([("user_email", ASCENDING), ("id", ASCENDING)], background=True)
            except Exception as e:
                logger.debug(f"Assessments index: {e}")
            
            # Assessment Attempts: unique index on attempt_id, index on user_email
            try:
                self.db.assessment_attempts.create_index([("attempt_id", ASCENDING)], unique=True, background=True)
                self.db.assessment_attempts.create_index([("user_email", ASCENDING)], background=True)
            except Exception as e:
                logger.debug(f"Attempts index: {e}")

            # Results & Activity: index on user_email
            try:
                self.db.results.create_index([("user_email", ASCENDING)], background=True)
                self.db.activity.create_index([("user_email", ASCENDING)], background=True)
            except Exception as e:
                logger.debug(f"Results/Activity index: {e}")

            # Candidate Groups & Invitations
            try:
                self.db.candidate_groups.create_index([("id", ASCENDING)], unique=True, background=True)
                self.db.candidate_invitations.create_index([("token", ASCENDING)], unique=True, sparse=True, background=True)
                self.db.candidate_invitations.create_index([("email", ASCENDING)], background=True)
            except Exception as e:
                logger.debug(f"Candidate groups/invitations index: {e}")

        except Exception as e:
            logger.warning(f"Error creating MongoDB indexes: {e}")

    def _seed_default_users(self):
        """Seeds default candidate accounts if missing."""
        if not self.is_connected or self.db is None:
            return

        try:
            existing = self.db.users.find_one({"email": "demo@bugbash.com"})
            if not existing:
                from backend.app.services.password_reset_service import PasswordResetService
                demo_doc = {
                    "id": "usr_demo_01",
                    "full_name": "Demo Candidate",
                    "name": "Demo Candidate",
                    "email": "demo@bugbash.com",
                    "phone_number": "+1 (555) 123-4567",
                    "password_hash": PasswordResetService.hash_password("DemoPassword123!"),
                    "password": PasswordResetService.hash_password("DemoPassword123!"),
                    "is_verified": True,
                    "role": "candidate",
                    "college_name": "BugBash Institute of Engineering",
                    "degree_major": "Computer Science & Engineering",
                    "graduation_year": "2026",
                    "created_at": datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                self.db.users.insert_one(demo_doc)
                logger.info("Default candidate 'demo@bugbash.com' seeded into MongoDB.")
        except Exception as e:
            logger.warning(f"Error seeding demo candidate: {e}")

    # --------------------------------------------------------------------------
    # Collection Accessors
    # --------------------------------------------------------------------------
    @property
    def users(self) -> Optional[Collection]:
        return self.db.users if (self.is_connected and self.db is not None) else None

    @property
    def otps(self) -> Optional[Collection]:
        return self.db.otps if (self.is_connected and self.db is not None) else None

    @property
    def password_resets(self) -> Optional[Collection]:
        return self.db.password_resets if (self.is_connected and self.db is not None) else None

    @property
    def assessments(self) -> Optional[Collection]:
        return self.db.assessments if (self.is_connected and self.db is not None) else None

    @property
    def assessment_attempts(self) -> Optional[Collection]:
        return self.db.assessment_attempts if (self.is_connected and self.db is not None) else None

    @property
    def results(self) -> Optional[Collection]:
        return self.db.results if (self.is_connected and self.db is not None) else None

    @property
    def activity(self) -> Optional[Collection]:
        return self.db.activity if (self.is_connected and self.db is not None) else None

    @property
    def practice_problems(self) -> Optional[Collection]:
        return self.db.practice_problems if (self.is_connected and self.db is not None) else None

    @property
    def admin_audit_logs(self) -> Optional[Collection]:
        return self.db.admin_audit_logs if (self.is_connected and self.db is not None) else None

    @property
    def candidate_groups(self) -> Optional[Collection]:
        return self.db.candidate_groups if (self.is_connected and self.db is not None) else None

    @property
    def candidate_invitations(self) -> Optional[Collection]:
        return self.db.candidate_invitations if (self.is_connected and self.db is not None) else None

    def __getattr__(self, name: str) -> Optional[Collection]:
        if self.is_connected and self.db is not None:
            return self.db[name]
        return None

    def __getitem__(self, name: str) -> Optional[Collection]:
        if self.is_connected and self.db is not None:
            return self.db[name]
        return None


# Global singleton instance
mongodb = MongoDB()
