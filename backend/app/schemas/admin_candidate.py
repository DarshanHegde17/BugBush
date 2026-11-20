"""
BugBash - Enterprise Admin Candidate & Student Management Schemas
Pydantic schemas for candidate listings, profile management, suspension lifecycle,
candidate groups, CSV bulk imports, invitations, and assessment assignments.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


# ==============================================================================
# 1. Candidate List & Summary Schemas
# ==============================================================================
class CandidateSummaryMetrics(BaseModel):
    total_candidates: int = Field(0, description="Total registered candidate accounts")
    active_candidates: int = Field(0, description="Active, non-suspended candidates")
    verified_candidates: int = Field(0, description="Email-verified candidates")
    assessment_participants: int = Field(0, description="Candidates with at least 1 assessment attempt")
    pending_invitations: int = Field(0, description="Pending candidate invitations")
    suspended_candidates: int = Field(0, description="Accounts suspended by administrators")


class CandidateListItem(BaseModel):
    id: str
    full_name: str
    email: str
    phone_number: Optional[str] = None
    account_status: str = "Active"  # Active, Suspended, Pending Verification
    is_verified: bool = False
    is_suspended: bool = False
    suspension_reason: Optional[str] = None
    assigned_assessments_count: int = 0
    completed_assessments_count: int = 0
    average_score: float = 0.0
    highest_score: Optional[float] = None
    college_name: Optional[str] = None
    degree_major: Optional[str] = None
    created_at: Any = None
    groups: List[str] = Field(default_factory=list)
    avatar_url: Optional[str] = None


class CandidateListResponse(BaseModel):
    summary: CandidateSummaryMetrics
    candidates: List[CandidateListItem]
    total: int
    page: int
    limit: int
    pages: int


# ==============================================================================
# 2. Candidate Detail & Profile Schemas
# ==============================================================================
class CandidateAssessmentRef(BaseModel):
    id: str
    title: str
    category: Optional[str] = None
    difficulty: Optional[str] = None
    duration_minutes: int = 60
    assigned_at: Optional[Any] = None
    deadline: Optional[Any] = None
    status: str = "Assigned"  # Assigned, In Progress, Completed, Missed
    score: Optional[float] = None
    max_score: Optional[float] = 100
    percentage: Optional[float] = None


class CandidateAssessmentsBreakdown(BaseModel):
    assigned: List[CandidateAssessmentRef] = Field(default_factory=list)
    upcoming: List[CandidateAssessmentRef] = Field(default_factory=list)
    in_progress: List[CandidateAssessmentRef] = Field(default_factory=list)
    completed: List[CandidateAssessmentRef] = Field(default_factory=list)
    missed: List[CandidateAssessmentRef] = Field(default_factory=list)


class CandidatePerformanceStats(BaseModel):
    total_attempts: int = 0
    average_score: float = 0.0
    highest_score: float = 0.0
    completion_rate: float = 0.0
    passed_assessments: int = 0
    failed_assessments: int = 0
    recent_results: List[Dict[str, Any]] = Field(default_factory=list)


class CandidateDetailResponse(BaseModel):
    id: str
    full_name: str
    email: str
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None
    account_status: str = "Active"
    is_verified: bool = False
    is_suspended: bool = False
    suspension_reason: Optional[str] = None
    suspension_date: Optional[Any] = None
    college_name: Optional[str] = None
    degree_major: Optional[str] = None
    graduation_year: Optional[str] = None
    bio: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    groups: List[str] = Field(default_factory=list)
    created_at: Any = None
    updated_at: Any = None
    assessments: CandidateAssessmentsBreakdown
    performance: CandidatePerformanceStats
    activity: List[Dict[str, Any]] = Field(default_factory=list)


class CandidateUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone_number: Optional[str] = Field(None, max_length=30)
    college_name: Optional[str] = Field(None, max_length=150)
    degree_major: Optional[str] = Field(None, max_length=150)
    graduation_year: Optional[str] = Field(None, max_length=10)
    bio: Optional[str] = Field(None, max_length=500)
    tags: Optional[List[str]] = None
    group_ids: Optional[List[str]] = None


class SuspendCandidateRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Reason for administrative suspension")


# ==============================================================================
# 3. Candidate Group Schemas
# ==============================================================================
class CandidateGroupItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    member_count: int = 0
    assigned_assessments_count: int = 0
    average_score: float = 0.0
    created_at: Any = None
    updated_at: Any = None
    created_by: Optional[str] = None


class CandidateGroupCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Group name, e.g. 'Python Batch A'")
    description: Optional[str] = Field(None, max_length=300)
    tags: Optional[List[str]] = Field(default_factory=list)
    initial_candidate_ids: Optional[List[str]] = Field(default_factory=list)


class CandidateGroupUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class CandidateGroupMembersRequest(BaseModel):
    candidate_ids_or_emails: List[str] = Field(..., min_length=1, description="List of candidate IDs or emails to add")


class AssignAssessmentToGroupRequest(BaseModel):
    assessment_id: str = Field(..., description="Target assessment ID to assign")
    deadline: Optional[str] = Field(None, description="Optional deadline ISO string")


# ==============================================================================
# 4. Candidate Import Schemas (CSV Bulk Upload)
# ==============================================================================
class CandidateImportRow(BaseModel):
    full_name: str
    email: EmailStr
    phone_number: Optional[str] = None
    group_name: Optional[str] = None


class CandidateImportRequest(BaseModel):
    rows: List[CandidateImportRow] = Field(..., min_length=1, description="Parsed CSV candidate records")
    send_invitations: bool = Field(True, description="Whether to dispatch account activation invites")
    assessment_id: Optional[str] = Field(None, description="Optional assessment to auto-assign")


class CandidateImportResult(BaseModel):
    total_rows: int
    successful_count: int
    duplicate_count: int
    failed_count: int
    imported_candidates: List[Dict[str, Any]]
    errors: List[Dict[str, Any]]


# ==============================================================================
# 5. Candidate Invitation Schemas
# ==============================================================================
class CandidateInvitationCreateRequest(BaseModel):
    emails: List[EmailStr] = Field(..., min_length=1, description="Target email addresses to invite")
    assessment_id: Optional[str] = Field(None, description="Optional assessment to attach to invitation")
    group_ids: Optional[List[str]] = Field(default_factory=list, description="Optional groups to add candidates to")
    expiry_days: Optional[int] = Field(7, ge=1, le=60, description="Invitation validity duration in days")
    custom_message: Optional[str] = Field(None, max_length=500)


class CandidateInvitationItem(BaseModel):
    id: str
    email: str
    status: str  # Pending, Accepted, Expired, Cancelled
    assessment_id: Optional[str] = None
    assessment_title: Optional[str] = None
    group_names: List[str] = Field(default_factory=list)
    invited_by: str
    created_at: Any
    expires_at: Any
    accepted_at: Optional[Any] = None


# ==============================================================================
# 6. Direct Assessment Assignment Schemas
# ==============================================================================
class CandidateAssignAssessmentRequest(BaseModel):
    assessment_id: str = Field(..., description="Assessment ID to assign")
    deadline: Optional[str] = Field(None, description="Optional assignment deadline")
