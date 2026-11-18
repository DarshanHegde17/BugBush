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
    account_status: str = "Active"
    created_at: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    college_name: Optional[str] = None
    degree_major: Optional[str] = None
    graduation_year: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Legal full name")
    phone_number: str = Field(..., min_length=7, max_length=25, description="Contact phone number")
    bio: Optional[str] = Field(None, max_length=500, description="Short candidate biography")
    college_name: Optional[str] = None
    degree_major: Optional[str] = None
    graduation_year: Optional[str] = None


class ProfilePictureRequest(BaseModel):
    avatar_data: str = Field(..., description="Base64 encoded image or avatar data URI")


class UserAppearancePreferences(BaseModel):
    theme: str = "dark"  # dark, light, system
    font_size: str = "medium"
    high_contrast: bool = False


class UserNotificationPreferences(BaseModel):
    assessment_notifications: bool = True
    deadline_reminders: bool = True
    result_notifications: bool = True
    practice_recommendations: bool = True
    security_alerts: bool = True  # Always True by policy


class UserLearningPreferences(BaseModel):
    preferred_languages: List[str] = ["Python", "JavaScript", "C++"]
    preferred_difficulty: str = "Medium"
    learning_interests: List[str] = ["Data Structures", "Algorithms", "System Design"]
    practice_topics: List[str] = ["Dynamic Programming", "Sliding Window", "Graph Algorithms"]


class UserPreferencesModel(BaseModel):
    appearance: UserAppearancePreferences = Field(default_factory=UserAppearancePreferences)
    notifications: UserNotificationPreferences = Field(default_factory=UserNotificationPreferences)
    learning: UserLearningPreferences = Field(default_factory=UserLearningPreferences)


class ActiveSessionItem(BaseModel):
    session_id: str
    device: str
    browser: str
    os_name: str
    ip_address: str
    is_current: bool = False
    last_active: str
    location: str = "Local Network"


class SessionsResponse(BaseModel):
    sessions: List[ActiveSessionItem]
    current_session_id: str


class AccountDeletionRequest(BaseModel):
    confirm_password: str = Field(..., min_length=1, description="Current password for verification")
    reason: Optional[str] = None
    confirmation_phrase: str = Field(..., description="Must match 'DELETE MY ACCOUNT'")


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
class AssessmentQuestionPreview(BaseModel):
    order: int
    title: str
    difficulty: str
    points: int


class AssessmentItem(BaseModel):
    id: str
    title: str
    description: str
    category: str
    difficulty: str  # Easy, Medium, Hard
    questions_count: int = 3
    duration_minutes: int
    start_date: str
    deadline: str
    status: str  # Upcoming, Available, In Progress, Completed, Expired
    creator_name: Optional[str] = "BugBash Academic Assessment Board"
    score: Optional[int] = None
    max_score: int = 100
    can_start: bool = False


class AssessmentDetailResponse(BaseModel):
    id: str
    title: str
    description: str
    instructions: str = ""
    category: str
    difficulty: str
    questions_count: int = 3
    total_questions: Optional[int] = 3
    questions: List[AssessmentQuestionPreview] = []
    max_marks: int = 100
    duration: Optional[str] = "90 mins"
    duration_minutes: int = 90
    allowed_languages: List[str] = ["Python", "C++", "Java", "JavaScript", "Go"]
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    deadline: Optional[str] = None
    end_time: Optional[str] = None
    rules: List[str] = []
    allowed_attempts: int = 1
    attempts_used: int = 0
    status: str
    creator_name: str = "BugBash Academic Assessment Board"
    is_eligible: bool = True
    eligibility_reason: Optional[str] = None


class AssessmentStatisticsResponse(BaseModel):
    total_assessments: int
    available_assessments: int
    upcoming_assessments: int
    in_progress_assessments: int
    completed_assessments: int
    expired_assessments: int


class StartAssessmentResponse(BaseModel):
    status: str = "success"
    attempt_id: str
    assessment_id: str
    exam_url: str
    message: str = "Assessment environment initialized successfully."


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
