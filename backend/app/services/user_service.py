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


import os
import re
import secrets
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple, List, Any

import jwt
from backend.app.services.password_reset_service import PasswordResetService

logger = logging.getLogger("bugbash.auth.user_service")

# Phone regex accepting standard international / domestic formats: +1 (555) 000-0000, 9876543210, etc.
PHONE_REGEX = re.compile(r'^[+]?[\d\s\-\(\)\.]{7,25}$')

JWT_SECRET = os.environ.get("JWT_SECRET", "bugbash-super-secure-jwt-secret-key-2026-auth-06")
JWT_ALGORITHM = "HS256"


class UserService:
    """
    Core User Management Service for BugBash:
    - Individual candidate registration & authentication
    - JWT token generation & validation
    - Unique email constraint enforcement
    - PBKDF2-HMAC-SHA256 salted password hashing
    - Cryptographic 6-digit OTP generation and verification
    - Account activation upon successful email verification
    - Dynamic per-user assessments, results, and activity tracking
    - Zero plain password or sensitive credential logging
    """

    def __init__(self, otp_expiry_minutes: int = 10, resend_cooldown_seconds: int = 30):
        self.otp_expiry = timedelta(minutes=otp_expiry_minutes)
        self.resend_cooldown = timedelta(seconds=resend_cooldown_seconds)

        # User Store: { email_lower: { full_name, email, phone_number, password_hash, is_verified, role, created_at, id } }
        self._users: Dict[str, dict] = {
            "demo@bugbash.com": {
                "id": "usr_demo_01",
                "full_name": "Demo Candidate",
                "email": "demo@bugbash.com",
                "phone_number": "+1 (555) 123-4567",
                "password_hash": PasswordResetService.hash_password("DemoPassword123!"),
                "is_verified": True,
                "role": "candidate",
                "college_name": "BugBash Institute of Engineering",
                "degree_major": "Computer Science & Engineering",
                "graduation_year": "2026",
                "created_at": datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc)
            }
        }

        # OTP Store: { verification_token: { email, otp, expires_at, attempts, last_sent_at } }
        self._otps: Dict[str, dict] = {}

        # Reverse lookup: { email_lower: verification_token }
        self._email_to_token: Dict[str, str] = {}

        # User Assessments Store: { email_lower: List[dict] }
        self._user_assessments: Dict[str, List[dict]] = {}

        # User Results Store: { email_lower: List[dict] }
        self._user_results: Dict[str, List[dict]] = {}

        # User Activity Store: { email_lower: List[dict] }
        self._user_activity: Dict[str, List[dict]] = {}

        # Global Practice Problems Catalog
        self._practice_problems: List[dict] = [
            {
                "id": "prob-01",
                "title": "Two Sum - Optimized Hash Map",
                "slug": "two-sum-hash-map",
                "difficulty": "Easy",
                "category": "Arrays & Hash Table",
                "languages": ["Python", "C++", "Java", "JavaScript", "Go"],
                "acceptance_rate": "84%",
                "tags": ["Array", "Hash Table", "Algorithms"],
                "solved": True
            },
            {
                "id": "prob-02",
                "title": "Valid Parentheses & Delimiter Matching",
                "slug": "valid-parentheses",
                "difficulty": "Easy",
                "category": "Stack & Strings",
                "languages": ["Python", "C++", "Java", "JavaScript"],
                "acceptance_rate": "79%",
                "tags": ["Stack", "String", "Data Structures"],
                "solved": True
            },
            {
                "id": "prob-03",
                "title": "Longest Substring Without Repeating Characters",
                "slug": "longest-substring-non-repeating",
                "difficulty": "Medium",
                "category": "Sliding Window",
                "languages": ["Python", "C++", "Java", "JavaScript", "Go"],
                "acceptance_rate": "62%",
                "tags": ["Sliding Window", "Hash Table", "String"],
                "solved": False
            },
            {
                "id": "prob-04",
                "title": "Merge K Sorted Linked Lists",
                "slug": "merge-k-sorted-lists",
                "difficulty": "Hard",
                "category": "Heap & Priority Queue",
                "languages": ["Python", "C++", "Java"],
                "acceptance_rate": "48%",
                "tags": ["Linked List", "Divide & Conquer", "Heap"],
                "solved": False
            },
            {
                "id": "prob-05",
                "title": "Coin Change - Minimum Denominations",
                "slug": "coin-change-dp",
                "difficulty": "Medium",
                "category": "Dynamic Programming",
                "languages": ["Python", "C++", "Java", "JavaScript", "Go"],
                "acceptance_rate": "55%",
                "tags": ["Dynamic Programming", "Memoization"],
                "solved": False
            },
            {
                "id": "prob-06",
                "title": "Search in Rotated Sorted Array",
                "slug": "search-rotated-array",
                "difficulty": "Medium",
                "category": "Binary Search",
                "languages": ["Python", "C++", "Java", "JavaScript"],
                "acceptance_rate": "68%",
                "tags": ["Binary Search", "Array"],
                "solved": False
            },
            {
                "id": "prob-07",
                "title": "Course Schedule & Dependency Cycle Check",
                "slug": "course-schedule-cycle",
                "difficulty": "Medium",
                "category": "Graph Algorithms",
                "languages": ["Python", "C++", "Java", "Go"],
                "acceptance_rate": "58%",
                "tags": ["Graph", "Topological Sort", "DFS"],
                "solved": False
            },
            {
                "id": "prob-08",
                "title": "Trapping Rain Water - Peak Elevation",
                "slug": "trapping-rain-water",
                "difficulty": "Hard",
                "category": "Two Pointers",
                "languages": ["Python", "C++", "Java"],
                "acceptance_rate": "42%",
                "tags": ["Two Pointers", "Dynamic Programming", "Stack"],
                "solved": False
            },
            {
                "id": "prob-09",
                "title": "Reverse a Singly Linked List",
                "slug": "reverse-linked-list",
                "difficulty": "Easy",
                "category": "Linked List",
                "languages": ["Python", "C++", "Java", "JavaScript", "Go"],
                "acceptance_rate": "91%",
                "tags": ["Linked List", "Recursion"],
                "solved": True
            },
            {
                "id": "prob-10",
                "title": "Binary Tree Maximum Path Sum",
                "slug": "binary-tree-max-path",
                "difficulty": "Hard",
                "category": "Trees & Recursion",
                "languages": ["Python", "C++", "Java", "Go"],
                "acceptance_rate": "39%",
                "tags": ["Tree", "DFS", "Binary Tree"],
                "solved": False
            },
            {
                "id": "prob-11",
                "title": "Climbing Stairs - Step Permutations",
                "slug": "climbing-stairs",
                "difficulty": "Easy",
                "category": "Dynamic Programming",
                "languages": ["Python", "C++", "Java", "JavaScript", "Go"],
                "acceptance_rate": "86%",
                "tags": ["Dynamic Programming", "Math"],
                "solved": False
            },
            {
                "id": "prob-12",
                "title": "LRU Cache Memory Policy",
                "slug": "lru-cache-design",
                "difficulty": "Medium",
                "category": "System Design",
                "languages": ["Python", "C++", "Java", "Go"],
                "acceptance_rate": "51%",
                "tags": ["Design", "Hash Table", "Doubly Linked List"],
                "solved": False
            }
        ]

        # Initialize demo data
        self._init_user_dashboard_data("demo@bugbash.com")

    def _init_user_dashboard_data(self, email: str):
        """Initializes personalized assessments, results, and activity for a user."""
        email_clean = email.strip().lower()
        if email_clean in self._user_assessments:
            return

        self._user_assessments[email_clean] = [
            {
                "id": "asmt-101",
                "title": "Data Structures & Algorithmic Logic Test",
                "description": "Evaluate binary search trees, hash collisions, dynamic arrays, and recursion complexity.",
                "instructions": "This proctored assessment tests your understanding of core algorithmic principles. Ensure stable internet connection and webcam access.",
                "category": "Algorithms & Logic",
                "difficulty": "Medium",
                "questions_count": 3,
                "duration_minutes": 60,
                "start_date": "Nov 15, 2026 - 00:00 UTC",
                "deadline": "Nov 30, 2026 - 23:59 UTC",
                "status": "Available",
                "creator_name": "Department of Computer Science",
                "score": None,
                "max_score": 100,
                "can_start": True,
                "allowed_attempts": 1,
                "attempts_used": 0,
                "allowed_languages": ["Python", "C++", "Java", "JavaScript", "Go"],
                "rules": [
                    "Full-screen lockdown mode will be enforced throughout the duration.",
                    "Audio and video telemetry monitoring is active.",
                    "Code execution is sandboxed in a secure cloud runner.",
                    "No external IDEs, AI assistants, or unauthorized tabs permitted."
                ],
                "questions": [
                    {"order": 1, "title": "Optimized Two-Sum with Hash Map", "difficulty": "Easy", "points": 25},
                    {"order": 2, "title": "Longest Substring Without Repeating Characters", "difficulty": "Medium", "points": 35},
                    {"order": 3, "title": "Binary Tree Level Order Traversal", "difficulty": "Medium", "points": 40}
                ]
            },
            {
                "id": "asmt-102",
                "title": "Semester Examination: Advanced Dynamic Programming",
                "description": "Proctored university semester exam covering memoization tables, DAG shortest paths, and knapsack variations.",
                "instructions": "Official university semester assessment. All code submissions will undergo automated structural and Big-O efficiency analysis.",
                "category": "Core Computer Science",
                "difficulty": "Hard",
                "questions_count": 4,
                "duration_minutes": 90,
                "start_date": "Dec 05, 2026 - 10:00 UTC",
                "deadline": "Dec 05, 2026 - 12:00 UTC",
                "status": "Upcoming",
                "creator_name": "University Examination Board",
                "score": None,
                "max_score": 100,
                "can_start": False,
                "allowed_attempts": 1,
                "attempts_used": 0,
                "allowed_languages": ["Python", "C++", "Java"],
                "rules": [
                    "Only registered students with verified college credentials may access.",
                    "Examination window is strictly fixed to 10:00 - 12:00 UTC on Dec 05, 2026.",
                    "Plagiarism detection algorithm compares AST tokens against campus cohort."
                ],
                "questions": [
                    {"order": 1, "title": "Coin Change - Minimum Denominations", "difficulty": "Medium", "points": 20},
                    {"order": 2, "title": "0/1 Knapsack with Custom Weight Constraints", "difficulty": "Medium", "points": 25},
                    {"order": 3, "title": "Longest Common Subsequence Matrix", "difficulty": "Hard", "points": 25},
                    {"order": 4, "title": "Matrix Chain Multiplication Optimization", "difficulty": "Hard", "points": 30}
                ]
            },
            {
                "id": "asmt-103",
                "title": "Object-Oriented Design & Clean Code Evaluation",
                "description": "Refactor monolithic methods, implement design patterns, and adhere to SOLID principles in code.",
                "instructions": "You have an ongoing assessment session in progress. You may resume where you left off.",
                "category": "Software Engineering",
                "difficulty": "Easy",
                "questions_count": 2,
                "duration_minutes": 45,
                "start_date": "Nov 14, 2026 - 10:00 UTC",
                "deadline": "Nov 25, 2026 - 18:00 UTC",
                "status": "In Progress",
                "creator_name": "Software Engineering Faculty",
                "score": None,
                "max_score": 100,
                "can_start": True,
                "allowed_attempts": 1,
                "attempts_used": 1,
                "allowed_languages": ["Python", "Java", "C++"],
                "rules": [
                    "Resume your existing examination session before the submission deadline.",
                    "Your latest code snapshot has been preserved."
                ],
                "questions": [
                    {"order": 1, "title": "Factory Pattern & Polymorphic Vehicles", "difficulty": "Easy", "points": 40},
                    {"order": 2, "title": "LRU Cache Memory Policy", "difficulty": "Medium", "points": 60}
                ]
            },
            {
                "id": "asmt-104",
                "title": "Campus Placement Algorithmic Screening Benchmark",
                "description": "Comprehensive engineering placement test across graph theory, dynamic programming, and systems logic.",
                "instructions": "Tier-1 engineering placement qualifying test. High performance benchmark unlocks corporate hiring partner referrals.",
                "category": "Placement & Hiring",
                "difficulty": "Hard",
                "questions_count": 3,
                "duration_minutes": 120,
                "start_date": "Nov 18, 2026 - 09:00 UTC",
                "deadline": "Dec 12, 2026 - 23:59 UTC",
                "status": "Available",
                "creator_name": "BugBash Placement Cell",
                "score": None,
                "max_score": 100,
                "can_start": True,
                "allowed_attempts": 1,
                "attempts_used": 0,
                "allowed_languages": ["Python", "C++", "Java", "Go"],
                "rules": [
                    "Camera, microphone, and secondary screen detection enabled.",
                    "Candidate scores rank on national placement leaderboard."
                ],
                "questions": [
                    {"order": 1, "title": "Search in Rotated Sorted Array", "difficulty": "Medium", "points": 30},
                    {"order": 2, "title": "Course Schedule & Dependency Cycle Check", "difficulty": "Medium", "points": 30},
                    {"order": 3, "title": "Trapping Rain Water - Peak Elevation", "difficulty": "Hard", "points": 40}
                ]
            },
            {
                "id": "asmt-105",
                "title": "Syntax & Computational Complexity Quiz",
                "description": "Comprehensive diagnostic covering Big-O space/time notation, loop invariants, and asymptotic bounds.",
                "instructions": "Assessment completed. You may view your scorecard and AI evaluation feedback.",
                "category": "Core Computer Science",
                "difficulty": "Easy",
                "questions_count": 3,
                "duration_minutes": 30,
                "start_date": "Nov 08, 2026 - 00:00 UTC",
                "deadline": "Completed on Nov 10, 2026",
                "status": "Completed",
                "creator_name": "CS Department Academic Staff",
                "score": 94,
                "max_score": 100,
                "can_start": False,
                "allowed_attempts": 1,
                "attempts_used": 1,
                "allowed_languages": ["Python", "JavaScript"],
                "rules": ["Single-attempt diagnostic quiz."],
                "questions": [
                    {"order": 1, "title": "Asymptotic Analysis & Master Theorem", "difficulty": "Easy", "points": 30},
                    {"order": 2, "title": "Space-Time Tradeoff in Hash Maps", "difficulty": "Easy", "points": 30},
                    {"order": 3, "title": "Amortized Complexity of Dynamic Vectors", "difficulty": "Easy", "points": 40}
                ]
            },
            {
                "id": "asmt-106",
                "title": "Recursion, Trees & Graph Traversals Assessment",
                "description": "In-depth problem set on BFS, DFS, Dijkstra, topological sort, and balanced BST verification.",
                "instructions": "Assessment completed with verified merit certificate.",
                "category": "Data Structures",
                "difficulty": "Medium",
                "questions_count": 3,
                "duration_minutes": 75,
                "start_date": "Nov 01, 2026 - 00:00 UTC",
                "deadline": "Completed on Nov 04, 2026",
                "status": "Completed",
                "creator_name": "Algorithms Evaluation Board",
                "score": 88,
                "max_score": 100,
                "can_start": False,
                "allowed_attempts": 1,
                "attempts_used": 1,
                "allowed_languages": ["Python", "C++", "Java"],
                "rules": ["Single-attempt proctored test."],
                "questions": [
                    {"order": 1, "title": "Binary Tree Maximum Path Sum", "difficulty": "Hard", "points": 35},
                    {"order": 2, "title": "Shortest Path in Weighted DAG", "difficulty": "Medium", "points": 35},
                    {"order": 3, "title": "Detect Cycle in Directed Graph", "difficulty": "Medium", "points": 30}
                ]
            },
            {
                "id": "asmt-107",
                "title": "Midterm Diagnostic: Pointers & Low-Level Memory",
                "description": "Diagnostic test on dynamic memory allocation, pointer arithmetic, and cache lines.",
                "instructions": "The deadline for this assessment expired on October 25, 2026. Submissions are no longer accepted.",
                "category": "Core Computer Science",
                "difficulty": "Medium",
                "questions_count": 3,
                "duration_minutes": 60,
                "start_date": "Oct 15, 2026 - 00:00 UTC",
                "deadline": "Expired on Oct 25, 2026",
                "status": "Expired",
                "creator_name": "Department of Computer Science",
                "score": None,
                "max_score": 100,
                "can_start": False,
                "allowed_attempts": 1,
                "attempts_used": 0,
                "allowed_languages": ["C", "C++"],
                "rules": ["Past examination session."],
                "questions": [
                    {"order": 1, "title": "Memory Leak Detection & Valgrind Analysis", "difficulty": "Medium", "points": 30},
                    {"order": 2, "title": "Custom Malloc Implementation", "difficulty": "Hard", "points": 40},
                    {"order": 3, "title": "Dangling Pointer Mitigation", "difficulty": "Easy", "points": 30}
                ]
            }
        ]

        self._user_results[email_clean] = [
            {
                "id": "res-201",
                "assessment_id": "asmt-105",
                "assessment_title": "Syntax & Computational Complexity Quiz",
                "score": 94,
                "max_score": 100,
                "percentage": 94.0,
                "completion_date": "Nov 10, 2026",
                "result_status": "Distinction",
                "feedback": "Exceptional algorithmic efficiency and clean structure. Passed all 24/24 edge and stress cases.",
                "metrics": {
                    "logic_correctness": 96,
                    "time_complexity": 92,
                    "space_efficiency": 95,
                    "code_quality": 93,
                    "test_cases_passed": "24 / 24 Passed (100%)"
                }
            },
            {
                "id": "res-202",
                "assessment_id": "asmt-106",
                "assessment_title": "Recursion, Trees & Graph Traversals Assessment",
                "score": 88,
                "max_score": 100,
                "percentage": 88.0,
                "completion_date": "Nov 04, 2026",
                "result_status": "Merit",
                "feedback": "Strong recursive decomposition and clean tree traversals. Minor suboptimal auxiliary space in DFS branch.",
                "metrics": {
                    "logic_correctness": 90,
                    "time_complexity": 85,
                    "space_efficiency": 86,
                    "code_quality": 91,
                    "test_cases_passed": "18 / 20 Passed (90%)"
                }
            }
        ]

        self._user_activity[email_clean] = [
            {
                "id": "act-301",
                "type": "assessment_completed",
                "title": "Completed Syntax & Complexity Quiz",
                "description": "Scored 94% (Distinction) with 24/24 test cases passing.",
                "timestamp": "2 days ago",
                "score": 94,
                "icon": "award"
            },
            {
                "id": "act-302",
                "type": "practice_solved",
                "title": "Solved 'Two Sum - Optimized Hash Map'",
                "description": "Executed in Python 3 with O(N) runtime and O(N) space.",
                "timestamp": "3 days ago",
                "icon": "code"
            },
            {
                "id": "act-303",
                "type": "practice_solved",
                "title": "Solved 'Valid Parentheses & Delimiter Matching'",
                "description": "Executed in C++ using std::stack with O(1) auxiliary space.",
                "timestamp": "5 days ago",
                "icon": "code"
            },
            {
                "id": "act-304",
                "type": "assessment_completed",
                "title": "Completed Trees & Graphs Assessment",
                "description": "Achieved 88% Merit and unlocked verified resume badge.",
                "timestamp": "Nov 04, 2026",
                "score": 88,
                "icon": "check-circle"
            }
        ]

    # ==========================================================================
    # Authentication & JWT Session Management
    # ==========================================================================
    def authenticate_user(self, email: str, password: str) -> Tuple[bool, Optional[dict], Optional[str]]:
        """
        Validates user credentials against salted hash.
        Returns: (success, user_dict, error_message)
        """
        clean_email = email.strip().lower()
        if clean_email not in self._users:
            return False, None, "Invalid email or password. Please verify your credentials."

        user = self._users[clean_email]
        if not PasswordResetService.verify_password(password, user["password_hash"]):
            return False, None, "Invalid email or password. Please verify your credentials."

        if not user.get("is_verified", False):
            return False, user, "Your account email is not verified. Please verify your email first."

        # Ensure user dashboard data is populated
        self._init_user_dashboard_data(clean_email)

        return True, user, None

    def create_access_token(self, user: dict, remember_me: bool = False) -> str:
        """Issues an authoritative HMAC-SHA256 signed JWT for the authenticated session."""
        now = datetime.now(timezone.utc)
        delta = timedelta(days=7) if remember_me else timedelta(hours=24)
        payload = {
            "sub": user["email"],
            "user_id": user.get("id", user["email"]),
            "name": user.get("full_name", ""),
            "role": user.get("role", "candidate"),
            "iat": int(now.timestamp()),
            "exp": int((now + delta).timestamp())
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    def get_user_by_token(self, token: str) -> Optional[dict]:
        """Resolves authenticated user from Bearer JWT without trusting frontend inputs."""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            email = payload.get("sub")
            if not email:
                return None
            user = self._users.get(email.lower())
            if user:
                self._init_user_dashboard_data(email.lower())
            return user
        except (jwt.PyJWTError, Exception):
            return None

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

    # ==========================================================================
    # User Profile & Security Management
    # ==========================================================================
    def get_user_profile(self, email: str) -> Optional[dict]:
        """Retrieves user profile information."""
        user = self._users.get(email.strip().lower())
        if not user:
            return None
        created_at_val = user.get("created_at")
        if isinstance(created_at_val, datetime):
            created_str = created_at_val.strftime("%B %d, %Y")
        else:
            created_str = str(created_at_val or "Recently")

        return {
            "id": user.get("id", user["email"]),
            "full_name": user.get("full_name", ""),
            "email": user["email"],
            "phone_number": user.get("phone_number", ""),
            "role": user.get("role", "candidate"),
            "is_verified": user.get("is_verified", True),
            "created_at": created_str,
            "college_name": user.get("college_name", "BugBash Academy"),
            "degree_major": user.get("degree_major", "Computer Science"),
            "graduation_year": user.get("graduation_year", "2026")
        }

    def update_user_profile(self, email: str, full_name: str, phone_number: str) -> Tuple[bool, Optional[dict], Optional[str]]:
        """Updates permitted user profile fields (name, phone)."""
        clean_email = email.strip().lower()
        if clean_email not in self._users:
            return False, None, "User account not found."

        clean_name = full_name.strip()
        clean_phone = phone_number.strip()

        if len(clean_name) < 2:
            return False, None, "Full name must be at least 2 characters."

        if not PHONE_REGEX.match(clean_phone):
            return False, None, "Please provide a valid phone number."

        user = self._users[clean_email]
        user["full_name"] = clean_name
        user["phone_number"] = clean_phone
        user["updated_at"] = datetime.now(timezone.utc)

        # Log activity
        if clean_email in self._user_activity:
            self._user_activity[clean_email].insert(0, {
                "id": f"act-{secrets.token_hex(4)}",
                "type": "profile_updated",
                "title": "Profile Details Updated",
                "description": f"Updated name to {clean_name} and phone number.",
                "timestamp": "Just now",
                "icon": "user"
            })

        return True, self.get_user_profile(clean_email), None

    def change_password(self, email: str, current_password: str, new_password: str) -> Tuple[bool, Optional[str]]:
        """Safely changes user password verifying current password and new complexity."""
        clean_email = email.strip().lower()
        if clean_email not in self._users:
            return False, "User account not found."

        user = self._users[clean_email]
        if not PasswordResetService.verify_password(current_password, user["password_hash"]):
            return False, "Current password is incorrect."

        is_complex, err = PasswordResetService.validate_password_complexity(new_password)
        if not is_complex:
            return False, err or "New password does not meet complexity requirements."

        user["password_hash"] = PasswordResetService.hash_password(new_password)
        user["password_updated_at"] = datetime.now(timezone.utc)

        # Log security activity
        if clean_email in self._user_activity:
            self._user_activity[clean_email].insert(0, {
                "id": f"act-{secrets.token_hex(4)}",
                "type": "password_changed",
                "title": "Account Password Changed",
                "description": "Password was successfully updated with high entropy.",
                "timestamp": "Just now",
                "icon": "shield"
            })

        return True, "Your password has been changed successfully."

    # ==========================================================================
    # User-Isolated Dashboard, Assessments, Results & Activity
    # ==========================================================================
    # User Assessments, Statistics & Examination Lifecycle
    # ==========================================================================
    def get_user_assessments(
        self,
        email: str,
        status: Optional[str] = None,
        difficulty: Optional[str] = None,
        category: Optional[str] = None,
        query: Optional[str] = None
    ) -> List[dict]:
        """Returns assessments assigned to or available for this user with dynamic filters."""
        clean_email = email.strip().lower()
        self._init_user_dashboard_data(clean_email)
        assessments = self._user_assessments.get(clean_email, [])

        q = (query or "").strip().lower()
        st = (status or "").strip().lower()
        diff = (difficulty or "").strip().lower()
        cat = (category or "").strip().lower()

        results = []
        for a in assessments:
            if st and st != "all" and a.get("status", "").lower() != st:
                continue
            if diff and diff != "all" and a.get("difficulty", "").lower() != diff:
                continue
            if cat and cat != "all" and a.get("category", "").lower() != cat:
                continue
            if q:
                match_title = q in a.get("title", "").lower()
                match_desc = q in a.get("description", "").lower()
                match_cat = q in a.get("category", "").lower()
                match_creator = q in a.get("creator_name", "").lower()
                if not (match_title or match_desc or match_cat or match_creator):
                    continue
            results.append(a)

        return results

    def get_user_assessment_statistics(self, email: str) -> dict:
        """Returns verified counts across all 5 assessment lifecycle statuses."""
        clean_email = email.strip().lower()
        self._init_user_dashboard_data(clean_email)
        assessments = self._user_assessments.get(clean_email, [])

        total = len(assessments)
        available = sum(1 for a in assessments if a.get("status") == "Available")
        upcoming = sum(1 for a in assessments if a.get("status") == "Upcoming")
        in_progress = sum(1 for a in assessments if a.get("status") == "In Progress")
        completed = sum(1 for a in assessments if a.get("status") == "Completed")
        expired = sum(1 for a in assessments if a.get("status") == "Expired")

        return {
            "total_assessments": total,
            "available_assessments": available,
            "upcoming_assessments": upcoming,
            "in_progress_assessments": in_progress,
            "completed_assessments": completed,
            "expired_assessments": expired
        }

    def get_assessment_details(self, email: str, assessment_id: str) -> Tuple[bool, Optional[dict], Optional[str]]:
        """Returns full structured detail, syllabus, rules, and questions breakdown for an assessment."""
        clean_email = email.strip().lower()
        self._init_user_dashboard_data(clean_email)
        assessments = self._user_assessments.get(clean_email, [])
        for a in assessments:
            if a.get("id") == assessment_id:
                data = dict(a)
                data["total_questions"] = data.get("questions_count", len(data.get("questions", [])))
                data["start_time"] = data.get("start_date")
                data["end_time"] = data.get("deadline")
                data["max_marks"] = data.get("max_score", 100)
                return True, data, None
        return False, None, "Assessment not found or not assigned to your account."

    def start_assessment_attempt(self, email: str, assessment_id: str) -> Tuple[bool, Optional[dict], Optional[str]]:
        """
        Validates schedule, permissions, and attempt limits before starting an assessment session.
        Returns: (success, attempt_info, error_message)
        """
        clean_email = email.strip().lower()
        self._init_user_dashboard_data(clean_email)
        assessments = self._user_assessments.get(clean_email, [])

        target = None
        for a in assessments:
            if a.get("id") == assessment_id:
                target = a
                break

        if not target:
            return False, None, "Assessment not found or not assigned to your account."

        status = target.get("status")
        if status == "Upcoming":
            return False, None, f"This assessment has not opened yet. It is scheduled to start on {target.get('start_date')}."

        if status == "Expired":
            return False, None, f"This assessment has expired. The submission deadline was on {target.get('deadline')}."

        attempts_used = target.get("attempts_used", 0)
        allowed_attempts = target.get("allowed_attempts", 1)

        if status == "Completed" and attempts_used >= allowed_attempts:
            return False, None, f"You have already exhausted all {allowed_attempts} allowed attempt(s) for this assessment."

        import uuid
        attempt_id = f"att_{uuid.uuid4().hex[:12]}"

        if not hasattr(self, "_assessment_attempts"):
            self._assessment_attempts = {}

        target["attempts_used"] = attempts_used + 1
        target["status"] = "In Progress"

        exam_url = f"/user/assessment/exam/{attempt_id}"

        attempt_record = {
            "attempt_id": attempt_id,
            "assessment_id": assessment_id,
            "user_email": clean_email,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "status": "In Progress",
            "exam_url": exam_url
        }
        self._assessment_attempts[attempt_id] = attempt_record

        return True, {
            "attempt_id": attempt_id,
            "assessment_id": assessment_id,
            "status": "In Progress",
            "exam_url": exam_url,
            "message": "Assessment attempt initialized securely. Launching examination workspace..."
        }, None

    def get_user_results(self, email: str) -> List[dict]:
        """Returns assessment results belonging strictly to this authenticated user."""
        clean_email = email.strip().lower()
        self._init_user_dashboard_data(clean_email)
        return self._user_results.get(clean_email, [])

    def get_user_activity(self, email: str) -> List[dict]:
        """Returns recent activity history for this user."""
        clean_email = email.strip().lower()
        self._init_user_dashboard_data(clean_email)
        return self._user_activity.get(clean_email, [])

    def get_user_dashboard_summary(self, email: str) -> dict:
        """Calculates live summary statistics for the user dashboard."""
        clean_email = email.strip().lower()
        self._init_user_dashboard_data(clean_email)

        assessments = self._user_assessments.get(clean_email, [])
        results = self._user_results.get(clean_email, [])
        activity = self._user_activity.get(clean_email, [])

        total = len(assessments)
        completed = len([a for a in assessments if a.get("status") == "Completed"])
        pending = len([a for a in assessments if a.get("status") in ("Available", "In Progress", "Upcoming")])

        # Average score computed dynamically from completed results
        scores = [r["percentage"] for r in results if "percentage" in r]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        completion_rate = int(round((completed / total) * 100)) if total > 0 else 0

        # Filter upcoming/available for overview quick view
        upcoming = [a for a in assessments if a.get("status") in ("Available", "In Progress", "Upcoming")][:3]

        return {
            "total_assessments": total,
            "completed_assessments": completed,
            "pending_assessments": pending,
            "average_score": avg_score,
            "completion_rate": completion_rate,
            "streak_days": 4,
            "upcoming_assessments": upcoming,
            "recent_activity": activity[:5]
        }

    # ==========================================================================
    # Practice Coding Catalog
    # ==========================================================================
    def get_practice_problems(
        self,
        difficulty: Optional[str] = None,
        language: Optional[str] = None,
        query: Optional[str] = None
    ) -> List[dict]:
        """Returns practice coding challenges filtered by difficulty, language, and search query."""
        results = []
        q = (query or "").strip().lower()
        diff = (difficulty or "").strip().lower()
        lang = (language or "").strip().lower()

        for p in self._practice_problems:
            # Filter difficulty
            if diff and diff != "all" and p["difficulty"].lower() != diff:
                continue

            # Filter language
            if lang and lang != "all" and not any(l.lower() == lang for l in p["languages"]):
                continue

            # Filter search query
            if q:
                match_title = q in p["title"].lower()
                match_category = q in p["category"].lower()
                match_tags = any(q in t.lower() for t in p["tags"])
                if not (match_title or match_category or match_tags):
                    continue

            results.append(p)

        return results


# Global singleton instance
user_service = UserService()

