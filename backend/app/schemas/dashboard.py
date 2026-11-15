from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any


# ==============================================================================
# User Profile Schemas
# ==============================================================================
class UserProfileResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone_number: Optional[str] = None
    role: str = "candidate"
    is_verified: bool = True
    created_at: str
    college_name: Optional[str] = None
    degree_major: Optional[str] = None
    graduation_year: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Legal full name")
    phone_number: str = Field(..., min_length=7, max_length=25, description="Contact phone number")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Current account password")
    new_password: str = Field(..., min_length=8, description="New password meeting complexity criteria")
    confirm_password: str = Field(..., min_length=8, description="Password confirmation")


class SimpleStatusResponse(BaseModel):
    status: str = "success"
    message: str


# ==============================================================================
# Dashboard Summary & Cards
# ==============================================================================
class DashboardSummaryResponse(BaseModel):
    total_assessments: int
    completed_assessments: int
    pending_assessments: int
    average_score: float
    completion_rate: int
    streak_days: int
    upcoming_assessments: List["AssessmentItem"] = []
    recent_activity: List["ActivityItem"] = []


# ==============================================================================
# Assessment Schemas
# ==============================================================================
class AssessmentItem(BaseModel):
    id: str
    title: str
    description: str
    category: str
    difficulty: str  # Easy, Medium, Hard
    duration_minutes: int
    start_date: str
    deadline: str
    status: str  # Upcoming, Available, In Progress, Completed, Expired
    score: Optional[int] = None
    max_score: int = 100
    can_start: bool = False


# ==============================================================================
# Results & Reports Schemas
# ==============================================================================
class ResultMetricBreakdown(BaseModel):
    logic_correctness: int
    time_complexity: int
    space_efficiency: int
    code_quality: int
    test_cases_passed: str


class ResultItem(BaseModel):
    id: str
    assessment_id: str
    assessment_title: str
    score: int
    max_score: int = 100
    percentage: float
    completion_date: str
    result_status: str  # Passed, Distinction, Merit, Needs Improvement
    feedback: str
    metrics: Optional[ResultMetricBreakdown] = None


# ==============================================================================
# Recent Activity Schemas
# ==============================================================================
class ActivityItem(BaseModel):
    id: str
    type: str  # assessment_completed, practice_solved, exam_scheduled, profile_updated
    title: str
    description: str
    timestamp: str
    score: Optional[int] = None
    icon: Optional[str] = None


# ==============================================================================
# Practice Coding Schemas
# ==============================================================================
class PracticeProblemItem(BaseModel):
    id: str
    title: str
    slug: str
    difficulty: str  # Easy, Medium, Hard
    category: str
    languages: List[str]
    acceptance_rate: str
    tags: List[str]
    solved: bool = False


# Resolve circular reference for Pydantic
DashboardSummaryResponse.model_rebuild()
