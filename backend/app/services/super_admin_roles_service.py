import os
import re
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Set

from fastapi import HTTPException, status
from backend.app.database.mongodb import mongodb
from backend.app.services.user_service import user_service
from backend.app.services.admin_auth_service import (
    admin_auth_service,
    AUTHORIZED_ADMIN_ROLES,
    ROLE_PERMISSIONS
)
from backend.app.schemas.super_admin_roles import (
    PermissionItem,
    PermissionCategoryGroup,
    PermissionsCatalogResponse,
    RoleListItem,
    RoleListResponse,
    RoleDetailResponse,
    CreateRoleRequest,
    UpdateRoleRequest,
    RoleActionResponse,
    AdminPermissionsResponse
)

logger = logging.getLogger("bugbash.super_admin_roles")

# ==============================================================================
# Master Permission Catalog Definition (10 Modules, 32 Granular Permissions)
# ==============================================================================
PERMISSION_CATALOG: List[PermissionCategoryGroup] = [
    PermissionCategoryGroup(
        category_id="dashboard",
        category_name="Dashboard & Overview",
        description="Access to administrative telemetry, status summaries, and operational cards.",
        permissions=[
            PermissionItem(
                id="dashboard:view",
                name="View Dashboard",
                description="View administrative operational metrics, statistics, and recent activity feed.",
                category="Dashboard & Overview",
                category_id="dashboard",
                is_sensitive=False
            )
        ]
    ),
    PermissionCategoryGroup(
        category_id="questions",
        category_name="Question Bank",
        description="Management of challenge problem statements, coding test cases, and MCQs.",
        permissions=[
            PermissionItem(
                id="questions:view",
                name="View Questions",
                description="Browse, filter, and inspect coding challenges and question catalog.",
                category="Question Bank",
                category_id="questions",
                is_sensitive=False
            ),
            PermissionItem(
                id="questions:create",
                name="Create Questions",
                description="Author new coding challenges, constraints, starter code, and test cases.",
                category="Question Bank",
                category_id="questions",
                is_sensitive=False
            ),
            PermissionItem(
                id="questions:edit",
                name="Edit Questions",
                description="Modify existing question descriptions, test cases, and difficulty tiers.",
                category="Question Bank",
                category_id="questions",
                is_sensitive=False
            ),
            PermissionItem(
                id="questions:delete",
                name="Delete Questions",
                description="Permanently delete or purge questions from the catalog.",
                category="Question Bank",
                category_id="questions",
                is_sensitive=True
            ),
            PermissionItem(
                id="questions:import",
                name="Import Questions",
                description="Bulk import challenges from CSV, JSON, or external question archives.",
                category="Question Bank",
                category_id="questions",
                is_sensitive=False
            ),
            PermissionItem(
                id="questions:export",
                name="Export Questions",
                description="Export questions, problem specifications, and test suites.",
                category="Question Bank",
                category_id="questions",
                is_sensitive=False
            )
        ]
    ),
    PermissionCategoryGroup(
        category_id="assessments",
        category_name="Assessments",
        description="Lifecycle creation, scheduling, and distribution of testing assessments.",
        permissions=[
            PermissionItem(
                id="assessments:view",
                name="View Assessments",
                description="View active, draft, and completed assessment schedules.",
                category="Assessments",
                category_id="assessments",
                is_sensitive=False
            ),
            PermissionItem(
                id="assessments:create",
                name="Create Assessments",
                description="Design and configure new timed assessments and coding exams.",
                category="Assessments",
                category_id="assessments",
                is_sensitive=False
            ),
            PermissionItem(
                id="assessments:edit",
                name="Edit Assessments",
                description="Update assessment rules, durations, passing cutoffs, and question sets.",
                category="Assessments",
                category_id="assessments",
                is_sensitive=False
            ),
            PermissionItem(
                id="assessments:publish",
                name="Publish Assessments",
                description="Activate assessments, launch live examination sessions, and open access.",
                category="Assessments",
                category_id="assessments",
                is_sensitive=True
            ),
            PermissionItem(
                id="assessments:archive",
                name="Archive Assessments",
                description="Conclude, freeze, or archive past assessment records.",
                category="Assessments",
                category_id="assessments",
                is_sensitive=False
            ),
            PermissionItem(
                id="assessments:assign",
                name="Assign Assessments",
                description="Dispatch assessments to candidates, candidate cohorts, or college groups.",
                category="Assessments",
                category_id="assessments",
                is_sensitive=False
            )
        ]
    ),
    PermissionCategoryGroup(
        category_id="candidates",
        category_name="Candidates & Students",
        description="Candidate rosters, examination invites, and participant profile regulation.",
        permissions=[
            PermissionItem(
                id="candidates:view",
                name="View Candidates",
                description="Inspect registered candidate profiles, contact info, and assessments.",
                category="Candidates & Students",
                category_id="candidates",
                is_sensitive=False
            ),
            PermissionItem(
                id="candidates:invite",
                name="Invite Candidates",
                description="Send assessment invitation links and OTP credentials to candidates.",
                category="Candidates & Students",
                category_id="candidates",
                is_sensitive=False
            ),
            PermissionItem(
                id="candidates:edit",
                name="Edit Candidates",
                description="Update candidate biographical metadata, groups, and academic info.",
                category="Candidates & Students",
                category_id="candidates",
                is_sensitive=False
            ),
            PermissionItem(
                id="candidates:suspend",
                name="Suspend Candidates",
                description="Block, disqualify, or suspend candidate access for academic violations.",
                category="Candidates & Students",
                category_id="candidates",
                is_sensitive=True
            ),
            PermissionItem(
                id="candidates:import",
                name="Import Candidates",
                description="Bulk import student or candidate rosters via CSV files.",
                category="Candidates & Students",
                category_id="candidates",
                is_sensitive=False
            )
        ]
    ),
    PermissionCategoryGroup(
        category_id="submissions",
        category_name="Submissions & Code Review",
        description="Candidate code evaluation, test case execution inspect, and manual grading.",
        permissions=[
            PermissionItem(
                id="submissions:view",
                name="View Submissions",
                description="Read candidate source code submissions and execution metrics.",
                category="Submissions & Code Review",
                category_id="submissions",
                is_sensitive=False
            ),
            PermissionItem(
                id="submissions:review",
                name="Manual Review",
                description="Assign manual marks, override test scores, and submit evaluator remarks.",
                category="Submissions & Code Review",
                category_id="submissions",
                is_sensitive=True
            ),
            PermissionItem(
                id="submissions:evaluate",
                name="Trigger Re-evaluation",
                description="Re-run test-case harness executions for submitted solutions.",
                category="Submissions & Code Review",
                category_id="submissions",
                is_sensitive=False
            ),
            PermissionItem(
                id="submissions:export",
                name="Export Submissions",
                description="Download code archives and candidate submission traces.",
                category="Submissions & Code Review",
                category_id="submissions",
                is_sensitive=False
            )
        ]
    ),
    PermissionCategoryGroup(
        category_id="results",
        category_name="Results & Leaderboards",
        description="Assessment scoreboards, cut-off ranks, and official score publication.",
        permissions=[
            PermissionItem(
                id="results:view",
                name="View Results",
                description="Access scoreboards, pass/fail percentages, and candidate ranks.",
                category="Results & Leaderboards",
                category_id="results",
                is_sensitive=False
            ),
            PermissionItem(
                id="results:publish",
                name="Publish Results",
                description="Release official scores and assessment certificates to candidates.",
                category="Results & Leaderboards",
                category_id="results",
                is_sensitive=True
            ),
            PermissionItem(
                id="results:export",
                name="Export Results",
                description="Generate and export comprehensive candidate result spreadsheets (CSV/Excel).",
                category="Results & Leaderboards",
                category_id="results",
                is_sensitive=False
            )
        ]
    ),
    PermissionCategoryGroup(
        category_id="analytics",
        category_name="Reports & Analytics",
        description="Deep operational performance, question difficulty curves, and pass rates.",
        permissions=[
            PermissionItem(
                id="analytics:view",
                name="View Analytics",
                description="Inspect distribution charts, score histograms, and performance trends.",
                category="Reports & Analytics",
                category_id="analytics",
                is_sensitive=False
            ),
            PermissionItem(
                id="analytics:export",
                name="Export Analytics",
                description="Export statistical intelligence and assessment performance summaries.",
                category="Reports & Analytics",
                category_id="analytics",
                is_sensitive=False
            )
        ]
    ),
    PermissionCategoryGroup(
        category_id="ml_insights",
        category_name="ML Code Insights",
        description="Machine learning algorithm recognition, Big-O complexity, and AI feedback.",
        permissions=[
            PermissionItem(
                id="ml_insights:view",
                name="View ML Insights",
                description="Explore algorithm classification, time/space complexity graphs, and code quality.",
                category="ML Code Insights",
                category_id="ml_insights",
                is_sensitive=False
            ),
            PermissionItem(
                id="ml_insights:review",
                name="Review AI Corrections",
                description="Audit ML inference quality, provide human evaluation corrections, and fine-tune feedback.",
                category="ML Code Insights",
                category_id="ml_insights",
                is_sensitive=False
            )
        ]
    ),
    PermissionCategoryGroup(
        category_id="notifications",
        category_name="Notifications & Announcements",
        description="System announcements, email broadcasts, and candidate reminder schedules.",
        permissions=[
            PermissionItem(
                id="notifications:view",
                name="View Notifications",
                description="Browse notification logs, sent broadcasts, and delivery telemetry.",
                category="Notifications & Announcements",
                category_id="notifications",
                is_sensitive=False
            ),
            PermissionItem(
                id="notifications:create",
                name="Create Announcements",
                description="Compose draft announcements and assessment alerts.",
                category="Notifications & Announcements",
                category_id="notifications",
                is_sensitive=False
            ),
            PermissionItem(
                id="notifications:send",
                name="Broadcast Notifications",
                description="Dispatch email campaigns and live in-app notifications to candidate groups.",
                category="Notifications & Announcements",
                category_id="notifications",
                is_sensitive=True
            ),
            PermissionItem(
                id="notifications:templates",
                name="Manage Templates",
                description="Create and customize notification email and SMS message templates.",
                category="Notifications & Announcements",
                category_id="notifications",
                is_sensitive=False
            )
        ]
    ),
    PermissionCategoryGroup(
        category_id="settings",
        category_name="Administrative Settings",
        description="Platform workspace settings, appearance preferences, and local admin configurations.",
        permissions=[
            PermissionItem(
                id="settings:view",
                name="View Settings",
                description="View administrative profile, active sessions, and workspace parameters.",
                category="Administrative Settings",
                category_id="settings",
                is_sensitive=False
            ),
            PermissionItem(
                id="settings:manage",
                name="Manage Settings",
                description="Modify workspace preferences, appearance, notification alerts, and security settings.",
                category="Administrative Settings",
                category_id="settings",
                is_sensitive=False
            )
        ]
    )
]

# Quick map of all valid permission IDs
ALL_VALID_PERMISSIONS: Set[str] = {
    p.id for cat in PERMISSION_CATALOG for p in cat.permissions
}


# ==============================================================================
# SuperAdminRolesService
# ==============================================================================
class SuperAdminRolesService:
    """
    Central enterprise governance engine for Administrative Roles & Permissions:
    - Granular permission registry across 10 modules
    - Pre-configured system default roles (Question Manager, Assessment Manager, etc.)
    - Custom role creation, dynamic permission assignment, and lifecycle management
    - Real-time role reassignment with immediate session revocation
    - Super Administrator root clearance protection
    """

    def __init__(self):
        # Default Roles Store
        self._roles: Dict[str, dict] = {}
        self._audit_logs: List[dict] = []
        self._initialize_default_roles()

    def _slugify(self, text: str) -> str:
        s = text.strip().lower()
        s = re.sub(r'[^a-z0-9]+', '_', s)
        return s.strip('_')

    def _initialize_default_roles(self):
        """Initializes default pre-configured system roles."""
        defaults = [
            {
                "id": "role_super_admin",
                "name": "Super Administrator",
                "slug": "super_admin",
                "description": "Root platform control center with unrestricted access across all systems, security governance, and infrastructure.",
                "is_system": True,
                "is_deletable": False,
                "permissions": ["*"],
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "role_question_manager",
                "name": "Question Manager",
                "slug": "question_manager",
                "description": "Manages challenge question bank, problem statements, test suites, and test case imports/exports.",
                "is_system": True,
                "is_deletable": False,
                "permissions": [
                    "dashboard:view",
                    "questions:view",
                    "questions:create",
                    "questions:edit",
                    "questions:delete",
                    "questions:import",
                    "questions:export"
                ],
                "created_at": "2026-01-10T00:00:00Z"
            },
            {
                "id": "role_assessment_manager",
                "name": "Assessment Manager",
                "slug": "assessment_manager",
                "description": "Designs, schedules, publishes, and assigns assessment contests and coding examinations.",
                "is_system": True,
                "is_deletable": False,
                "permissions": [
                    "dashboard:view",
                    "assessments:view",
                    "assessments:create",
                    "assessments:edit",
                    "assessments:publish",
                    "assessments:archive",
                    "assessments:assign",
                    "questions:view"
                ],
                "created_at": "2026-01-10T00:00:00Z"
            },
            {
                "id": "role_evaluator",
                "name": "Evaluator",
                "slug": "evaluator",
                "description": "Reviews candidate code submissions, scores test cases, performs manual grading, and validates results.",
                "is_system": True,
                "is_deletable": False,
                "permissions": [
                    "dashboard:view",
                    "submissions:view",
                    "submissions:review",
                    "submissions:evaluate",
                    "submissions:export",
                    "results:view"
                ],
                "created_at": "2026-01-10T00:00:00Z"
            },
            {
                "id": "role_analytics_manager",
                "name": "Analytics Manager",
                "slug": "analytics_manager",
                "description": "Accesses candidate performance distributions, score analytics, difficulty curves, and ML code insights.",
                "is_system": True,
                "is_deletable": False,
                "permissions": [
                    "dashboard:view",
                    "results:view",
                    "results:export",
                    "analytics:view",
                    "analytics:export",
                    "ml_insights:view"
                ],
                "created_at": "2026-01-10T00:00:00Z"
            },
            {
                "id": "role_candidate_manager",
                "name": "Candidate Manager",
                "slug": "candidate_manager",
                "description": "Governs candidate rosters, sends assessment invitations, and organizes candidate groups.",
                "is_system": True,
                "is_deletable": False,
                "permissions": [
                    "dashboard:view",
                    "candidates:view",
                    "candidates:invite",
                    "candidates:edit",
                    "candidates:suspend",
                    "candidates:import",
                    "assessments:view",
                    "assessments:assign"
                ],
                "created_at": "2026-01-10T00:00:00Z"
            },
            {
                "id": "role_notification_manager",
                "name": "Notification Manager",
                "slug": "notification_manager",
                "description": "Creates announcements, sends deadline reminder broadcasts, and configures notification templates.",
                "is_system": True,
                "is_deletable": False,
                "permissions": [
                    "dashboard:view",
                    "notifications:view",
                    "notifications:create",
                    "notifications:send",
                    "notifications:templates",
                    "candidates:view"
                ],
                "created_at": "2026-01-10T00:00:00Z"
            },
            {
                "id": "role_admin",
                "name": "General Administrator",
                "slug": "admin",
                "description": "Standard administrative operations across questions, assessments, candidates, and submissions.",
                "is_system": True,
                "is_deletable": False,
                "permissions": [
                    "dashboard:view",
                    "questions:view",
                    "questions:create",
                    "questions:edit",
                    "assessments:view",
                    "assessments:create",
                    "assessments:edit",
                    "candidates:view",
                    "candidates:invite",
                    "submissions:view",
                    "results:view",
                    "settings:view"
                ],
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "role_organization_admin",
                "name": "Organization Administrator",
                "slug": "organization_admin",
                "description": "Full tenant oversight of enterprise assessments, organizational users, reports, and settings.",
                "is_system": True,
                "is_deletable": False,
                "permissions": [
                    "dashboard:view",
                    "assessments:view",
                    "assessments:create",
                    "assessments:edit",
                    "assessments:publish",
                    "assessments:assign",
                    "candidates:view",
                    "candidates:invite",
                    "candidates:edit",
                    "results:view",
                    "results:export",
                    "analytics:view",
                    "settings:view",
                    "settings:manage"
                ],
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "role_college_admin",
                "name": "College Administrator",
                "slug": "college_admin",
                "description": "Academic cohort scheduling, student candidate enrollment, and examination result audits.",
                "is_system": True,
                "is_deletable": False,
                "permissions": [
                    "dashboard:view",
                    "assessments:view",
                    "assessments:assign",
                    "candidates:view",
                    "candidates:invite",
                    "candidates:import",
                    "results:view",
                    "results:export"
                ],
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "role_company_admin",
                "name": "Company Administrator",
                "slug": "company_admin",
                "description": "Technical interview assessments, candidate coding evaluations, and hiring analytics.",
                "is_system": True,
                "is_deletable": False,
                "permissions": [
                    "dashboard:view",
                    "assessments:view",
                    "assessments:create",
                    "candidates:view",
                    "candidates:invite",
                    "submissions:view",
                    "submissions:review",
                    "results:view"
                ],
                "created_at": "2026-01-01T00:00:00Z"
            }
        ]

        for r in defaults:
            self._roles[r["slug"]] = dict(r)
            self._roles[r["id"]] = self._roles[r["slug"]]

            # Update global ROLE_PERMISSIONS dictionary so all system components stay synced
            if r["slug"] not in ROLE_PERMISSIONS:
                ROLE_PERMISSIONS[r["slug"]] = list(r["permissions"])
            if r["slug"] not in AUTHORIZED_ADMIN_ROLES:
                AUTHORIZED_ADMIN_ROLES.add(r["slug"])

    def record_audit(
        self,
        event_type: str,
        title: str,
        details: str,
        actor: str = "Super Admin",
        affected_id: Optional[str] = None
    ):
        entry = {
            "id": f"role_aud_{secrets.token_hex(6)}",
            "event_type": event_type,
            "title": title,
            "details": details,
            "actor": actor,
            "affected_id": affected_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self._audit_logs.insert(0, entry)
        if mongodb.db is not None:
            try:
                mongodb.db.admin_audit_logs.insert_one(dict(entry))
            except Exception as e:
                logger.warning(f"Error persisting role audit: {e}")

    # ==========================================================================
    # 1. Permissions Catalog
    # ==========================================================================
    def get_permissions_catalog(self) -> PermissionsCatalogResponse:
        total_p = sum(len(cat.permissions) for cat in PERMISSION_CATALOG)
        return PermissionsCatalogResponse(
            status="success",
            total_permissions=total_p,
            total_categories=len(PERMISSION_CATALOG),
            categories=PERMISSION_CATALOG
        )

    # ==========================================================================
    # 2. Roles Directory & Listing
    # ==========================================================================
    def _count_admins_per_role(self) -> Dict[str, int]:
        """Counts active admins assigned to each role slug."""
        counts: Dict[str, int] = {}
        seen_emails = set()

        def register_user(u):
            em = (u.get("email") or "").strip().lower()
            if em and em not in seen_emails:
                seen_emails.add(em)
                role = (u.get("role") or "admin").strip().lower()
                counts[role] = counts.get(role, 0) + 1

        # Check in memory
        if hasattr(user_service, "_users"):
            for em, u in user_service._users.items():
                register_user(u)

        # Check in MongoDB
        if mongodb.users is not None:
            try:
                for doc in mongodb.users.find({}, {"email": 1, "role": 1}):
                    register_user(doc)
            except Exception as e:
                logger.warning(f"Error querying users for role counts: {e}")

        return counts

    def list_roles(
        self,
        search: Optional[str] = None,
        filter_type: Optional[str] = None
    ) -> RoleListResponse:
        """Returns list of all available roles with assigned admin counts."""
        admin_counts = self._count_admins_per_role()

        # Deduplicate internal alias references (id vs slug)
        unique_roles: Dict[str, dict] = {}
        for k, v in self._roles.items():
            slug = v.get("slug") or k
            if slug not in unique_roles:
                unique_roles[slug] = v

        items: List[RoleListItem] = []
        for slug, r in unique_roles.items():
            perms = r.get("permissions", [])
            assigned = admin_counts.get(slug, 0)

            # Sample permissions
            sample = [p for p in perms if p != "*"][:3]
            if "*" in perms:
                sample = ["* (Root Unrestricted)"]

            created = r.get("created_at") or "2026-01-01T00:00:00Z"
            if isinstance(created, datetime):
                created_str = created.strftime("%b %d, %Y")
            elif isinstance(created, str):
                created_str = created[:10]
            else:
                created_str = "Jan 01, 2026"

            items.append(RoleListItem(
                id=r.get("id") or f"role_{slug}",
                name=r.get("name") or slug.title(),
                slug=slug,
                description=r.get("description") or "",
                is_system=bool(r.get("is_system", False)),
                is_deletable=bool(r.get("is_deletable", True)),
                permissions_count=len(perms),
                assigned_admins_count=assigned,
                sample_permissions=sample,
                created_at=created_str,
                updated_at=r.get("updated_at")
            ))

        # Filtering
        if filter_type == "system":
            items = [r for r in items if r.is_system]
        elif filter_type == "custom":
            items = [r for r in items if not r.is_system]

        if search:
            q = search.strip().lower()
            items = [
                r for r in items
                if q in r.name.lower() or q in r.description.lower() or q in r.slug.lower()
            ]

        # Sort: System roles first, then alphabetically
        items.sort(key=lambda x: (not x.is_system, x.name.lower()))

        system_count = sum(1 for r in unique_roles.values() if r.get("is_system"))
        custom_count = len(unique_roles) - system_count
        total_assigned = sum(admin_counts.values())

        return RoleListResponse(
            status="success",
            total_roles=len(items),
            system_roles_count=system_count,
            custom_roles_count=custom_count,
            total_assigned_admins=total_assigned,
            roles=items
        )

    # ==========================================================================
    # 3. Retrieve Single Role Details
    # ==========================================================================
    def get_role(self, role_id_or_slug: str) -> RoleDetailResponse:
        clean_key = role_id_or_slug.strip().lower()
        role_doc = self._roles.get(clean_key)

        if not role_doc:
            # Try searching by ID
            for r in self._roles.values():
                if r.get("id") == role_id_or_slug or r.get("slug") == clean_key:
                    role_doc = r
                    break

        if not role_doc and mongodb.db is not None:
            try:
                role_doc = mongodb.db.admin_roles.find_one({
                    "$or": [{"id": role_id_or_slug}, {"slug": clean_key}]
                })
            except Exception as e:
                logger.warning(f"Error finding role in MongoDB: {e}")

        if not role_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role '{role_id_or_slug}' not found."
            )

        slug = role_doc.get("slug")

        # Find all assigned admins
        assigned_admins: List[Dict[str, Any]] = []
        seen_emails = set()

        def check_admin(u):
            em = (u.get("email") or "").strip().lower()
            if em and em not in seen_emails and (u.get("role") or "").strip().lower() == slug:
                seen_emails.add(em)
                assigned_admins.append({
                    "id": str(u.get("id") or u.get("_id") or em),
                    "name": u.get("name") or u.get("full_name") or em,
                    "email": em,
                    "organization_name": u.get("organization_name") or "BugBash Operations",
                    "account_status": u.get("account_status") or "Active"
                })

        if hasattr(user_service, "_users"):
            for em, u in user_service._users.items():
                check_admin(u)

        if mongodb.users is not None:
            try:
                for doc in mongodb.users.find({"role": slug}):
                    check_admin(doc)
            except Exception as e:
                logger.warning(f"Error querying admins for role '{slug}': {e}")

        return RoleDetailResponse(
            status="success",
            id=role_doc.get("id") or f"role_{slug}",
            name=role_doc.get("name") or slug.title(),
            slug=slug,
            description=role_doc.get("description") or "",
            is_system=bool(role_doc.get("is_system", False)),
            is_deletable=bool(role_doc.get("is_deletable", True)),
            permissions=role_doc.get("permissions", []),
            assigned_admins=assigned_admins,
            created_at=str(role_doc.get("created_at") or "2026-01-01T00:00:00Z"),
            updated_at=role_doc.get("updated_at")
        )

    # ==========================================================================
    # 4. Create Custom Role
    # ==========================================================================
    def create_role(self, payload: CreateRoleRequest, actor_email: str) -> RoleDetailResponse:
        slug = self._slugify(payload.name)
        if not slug:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role name provided."
            )

        # Check duplicate
        if slug in self._roles or any(r.get("name", "").lower() == payload.name.strip().lower() for r in self._roles.values()):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A role with name '{payload.name}' already exists. Role names must be unique."
            )

        # Filter valid permissions
        cleaned_perms: List[str] = []
        for p in payload.permissions:
            p_clean = p.strip()
            if p_clean in ALL_VALID_PERMISSIONS or p_clean == "*":
                if p_clean not in cleaned_perms:
                    cleaned_perms.append(p_clean)

        if not cleaned_perms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one valid permission must be selected for the role."
            )

        role_id = f"role_{slug}_{secrets.token_hex(4)}"
        now_str = datetime.now(timezone.utc).isoformat()

        role_doc = {
            "id": role_id,
            "name": payload.name.strip(),
            "slug": slug,
            "description": payload.description.strip(),
            "is_system": False,
            "is_deletable": True,
            "permissions": cleaned_perms,
            "created_at": now_str,
            "updated_at": now_str,
            "created_by": actor_email
        }

        # Store in memory
        self._roles[slug] = role_doc
        self._roles[role_id] = role_doc

        # Register in system authorization dicts
        ROLE_PERMISSIONS[slug] = list(cleaned_perms)
        AUTHORIZED_ADMIN_ROLES.add(slug)

        # Store in MongoDB
        if mongodb.db is not None:
            try:
                mongodb.db.admin_roles.insert_one(dict(role_doc))
            except Exception as e:
                logger.warning(f"Error persisting custom role in MongoDB: {e}")

        # Audit log
        self.record_audit(
            event_type="role_created",
            title="Custom Role Created",
            details=f"Super Admin created custom role '{payload.name}' with {len(cleaned_perms)} permissions.",
            actor=actor_email,
            affected_id=role_id
        )

        return self.get_role(slug)

    # ==========================================================================
    # 5. Update Role
    # ==========================================================================
    def update_role(
        self,
        role_id: str,
        payload: UpdateRoleRequest,
        actor_email: str
    ) -> RoleDetailResponse:
        current_detail = self.get_role(role_id)
        slug = current_detail.slug
        role_doc = self._roles.get(slug)

        if not role_doc:
            raise HTTPException(status_code=404, detail="Role not found.")

        # Super Admin role cannot have its permissions restricted
        if slug == "super_admin":
            if payload.permissions is not None and "*" not in payload.permissions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Super Administrator role must retain root wildcard '*' permissions."
                )

        updates: Dict[str, Any] = {}
        if payload.name and payload.name.strip():
            if not role_doc.get("is_system"):
                # Check for duplicate name if renaming
                new_slug = self._slugify(payload.name)
                if new_slug != slug and new_slug in self._roles:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"A role with name '{payload.name}' already exists."
                    )
                updates["name"] = payload.name.strip()

        if payload.description and payload.description.strip():
            updates["description"] = payload.description.strip()

        perms_changed = False
        if payload.permissions is not None:
            cleaned_perms: List[str] = []
            for p in payload.permissions:
                p_clean = p.strip()
                if p_clean in ALL_VALID_PERMISSIONS or p_clean == "*":
                    if p_clean not in cleaned_perms:
                        cleaned_perms.append(p_clean)

            if not cleaned_perms and slug != "super_admin":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A role must contain at least one valid permission."
                )

            updates["permissions"] = cleaned_perms
            perms_changed = True

        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        role_doc.update(updates)

        # Update ROLE_PERMISSIONS cache
        if perms_changed:
            ROLE_PERMISSIONS[slug] = list(role_doc["permissions"])

            # Propagate permission update to all assigned administrators in memory & DB
            if hasattr(user_service, "_users"):
                for em, u in user_service._users.items():
                    if (u.get("role") or "").strip().lower() == slug:
                        u["permissions"] = list(role_doc["permissions"])
                        # Invalidate active session tokens so fresh permissions are loaded
                        admin_auth_service.revoke_user_sessions(em)

            if mongodb.users is not None:
                try:
                    mongodb.users.update_many(
                        {"role": slug},
                        {"$set": {"permissions": list(role_doc["permissions"])}}
                    )
                except Exception as e:
                    logger.warning(f"Error propagating role permissions to MongoDB: {e}")

        # Update in MongoDB
        if mongodb.db is not None:
            try:
                mongodb.db.admin_roles.update_one(
                    {"slug": slug},
                    {"$set": updates}
                )
            except Exception as e:
                logger.warning(f"Error updating role in MongoDB: {e}")

        # Audit
        self.record_audit(
            event_type="role_updated",
            title="Role Modified",
            details=f"Super Admin updated role '{role_doc.get('name', slug)}'. Permissions changed: {perms_changed}.",
            actor=actor_email,
            affected_id=slug
        )

        return self.get_role(slug)

    # ==========================================================================
    # 6. Delete Role
    # ==========================================================================
    def delete_role(self, role_id: str, actor_email: str) -> RoleActionResponse:
        current_detail = self.get_role(role_id)
        slug = current_detail.slug

        if current_detail.is_system or slug in ("super_admin", "admin"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"System role '{current_detail.name}' is integral to platform operations and cannot be deleted."
            )

        # Check if active admins are currently assigned
        if current_detail.assigned_admins:
            count = len(current_detail.assigned_admins)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete role '{current_detail.name}': {count} administrator(s) are currently assigned to this role. Please reassign them before deletion."
            )

        # Remove from memory
        r_id = current_detail.id
        if slug in self._roles:
            del self._roles[slug]
        if r_id in self._roles:
            del self._roles[r_id]

        if slug in ROLE_PERMISSIONS:
            del ROLE_PERMISSIONS[slug]
        AUTHORIZED_ADMIN_ROLES.discard(slug)

        # Remove from MongoDB
        if mongodb.db is not None:
            try:
                mongodb.db.admin_roles.delete_one({"slug": slug})
            except Exception as e:
                logger.warning(f"Error deleting role from MongoDB: {e}")

        # Audit
        self.record_audit(
            event_type="role_deleted",
            title="Custom Role Deleted",
            details=f"Super Admin deleted custom role '{current_detail.name}' ({slug}).",
            actor=actor_email,
            affected_id=slug
        )

        return RoleActionResponse(
            status="success",
            message=f"Custom role '{current_detail.name}' has been permanently removed.",
            role_id=current_detail.id
        )

    # ==========================================================================
    # 7. Role Assignment to Administrators
    # ==========================================================================
    def assign_role_to_admin(
        self,
        admin_id: str,
        role_id_or_slug: str,
        actor_email: str
    ) -> AdminPermissionsResponse:
        """
        Assigns a defined role and its associated permissions to an administrator.
        Enforces Super Admin safety: prevents demoting the last remaining active Super Admin.
        """
        # Resolve role
        role_detail = self.get_role(role_id_or_slug)
        target_slug = role_detail.slug

        # Resolve admin
        clean_id = admin_id.strip()
        user_doc = None
        user_email = ""

        if hasattr(user_service, "_users"):
            for em, u in user_service._users.items():
                if str(u.get("id") or u.get("_id")) == clean_id or em.lower() == clean_id.lower():
                    user_doc = u
                    user_email = em
                    break

        from backend.app.services.super_admin_auth_service import super_admin_auth_service
        if not user_doc and hasattr(super_admin_auth_service, "_provisioned_users"):
            for em, u in super_admin_auth_service._provisioned_users.items():
                if str(u.get("id") or u.get("_id")) == clean_id or em.lower() == clean_id.lower():
                    user_doc = u
                    user_email = em
                    break

        if not user_doc and mongodb.users is not None:
            try:
                user_doc = mongodb.users.find_one({
                    "$or": [{"id": clean_id}, {"_id": clean_id}, {"email": clean_id.lower()}]
                })
                if user_doc:
                    user_email = user_doc.get("email")
            except Exception as e:
                logger.warning(f"Error finding user in MongoDB: {e}")

        if not user_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Administrator '{admin_id}' not found."
            )

        current_role = (user_doc.get("role") or "").strip().lower()

        # Super Admin Safety Check:
        # Prevent removing or demoting the last active Super Admin account!
        if current_role == "super_admin" and target_slug != "super_admin":
            super_admin_emails = set()
            if hasattr(super_admin_auth_service, "_provisioned_users"):
                for em, u in super_admin_auth_service._provisioned_users.items():
                    if (u.get("role") or "").strip().lower() == "super_admin" and (u.get("account_status") or "Active").lower() == "active":
                        super_admin_emails.add(em.lower())
            if hasattr(user_service, "_users"):
                for em, u in user_service._users.items():
                    if (u.get("role") or "").strip().lower() == "super_admin" and (u.get("account_status") or "Active").lower() == "active":
                        super_admin_emails.add(em.lower())
            if mongodb.users is not None:
                try:
                    for doc in mongodb.users.find({"role": "super_admin", "account_status": {"$in": ["Active", "active"]}}, {"email": 1}):
                        em = doc.get("email")
                        if em:
                            super_admin_emails.add(em.lower())
                except Exception:
                    pass

            if len(super_admin_emails) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot change role: This is the last authorized Super Administrator account on the platform."
                )

        new_permissions = list(role_detail.permissions)

        # Update in memory
        updates = {
            "role": target_slug,
            "permissions": new_permissions,
            "role_assigned_at": datetime.now(timezone.utc).isoformat(),
            "role_assigned_by": actor_email
        }

        if hasattr(user_service, "_users") and user_email in user_service._users:
            user_service._users[user_email].update(updates)

        # Update in MongoDB
        if mongodb.users is not None:
            try:
                mongodb.users.update_one(
                    {"email": user_email},
                    {"$set": updates}
                )
            except Exception as e:
                logger.warning(f"Error updating admin role in MongoDB: {e}")

        # Invalidate active session tokens so new claims are forced
        admin_auth_service.revoke_user_sessions(user_email)

        # Audit
        self.record_audit(
            event_type="role_assigned",
            title="Administrator Role Reassigned",
            details=f"Super Admin reassigned {user_email} from '{current_role}' to '{role_detail.name}' ({target_slug}).",
            actor=actor_email,
            affected_id=user_email
        )

        return AdminPermissionsResponse(
            status="success",
            admin_id=str(user_doc.get("id") or user_doc.get("_id") or user_email),
            email=user_email,
            name=user_doc.get("name") or user_doc.get("full_name") or user_email,
            role_slug=target_slug,
            role_name=role_detail.name,
            permissions=new_permissions
        )

    # ==========================================================================
    # 8. Remove / Reset Role
    # ==========================================================================
    def remove_role_from_admin(self, admin_id: str, actor_email: str) -> AdminPermissionsResponse:
        """Resets admin to default base 'admin' role."""
        return self.assign_role_to_admin(admin_id, "admin", actor_email)

    # ==========================================================================
    # 9. Get Effective Permissions for an Admin
    # ==========================================================================
    def get_admin_permissions(self, admin_id: str) -> AdminPermissionsResponse:
        clean_id = admin_id.strip()
        user_doc = None
        user_email = ""

        if hasattr(user_service, "_users"):
            for em, u in user_service._users.items():
                if str(u.get("id") or u.get("_id")) == clean_id or em.lower() == clean_id.lower():
                    user_doc = u
                    user_email = em
                    break

        if not user_doc and mongodb.users is not None:
            try:
                user_doc = mongodb.users.find_one({
                    "$or": [{"id": clean_id}, {"_id": clean_id}, {"email": clean_id.lower()}]
                })
                if user_doc:
                    user_email = user_doc.get("email")
            except Exception as e:
                logger.warning(f"Error finding user in MongoDB: {e}")

        if not user_doc:
            raise HTTPException(status_code=404, detail=f"Administrator '{admin_id}' not found.")

        role_slug = (user_doc.get("role") or "admin").strip().lower()
        role_doc = self._roles.get(role_slug)
        role_name = role_doc.get("name") if role_doc else role_slug.title()

        effective_perms = user_doc.get("permissions")
        if not effective_perms:
            effective_perms = role_doc.get("permissions", []) if role_doc else ROLE_PERMISSIONS.get(role_slug, ["assessments:manage"])

        return AdminPermissionsResponse(
            status="success",
            admin_id=str(user_doc.get("id") or user_doc.get("_id") or user_email),
            email=user_email,
            name=user_doc.get("name") or user_doc.get("full_name") or user_email,
            role_slug=role_slug,
            role_name=role_name,
            permissions=effective_perms
        )


super_admin_roles_service = SuperAdminRolesService()
