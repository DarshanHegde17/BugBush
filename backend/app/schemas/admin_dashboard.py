from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ==============================================================================
# Admin Dashboard Schemas
# ==============================================================================
class AdminDashboardStatistics(BaseModel):
    total_questions: int = Field(..., description="Total questions across question bank and assessments")
    total_assessments: int = Field(..., description="Total assessments configured on the platform")
    active_assessments: int = Field(..., description="Currently active or open examinations")
    registered_users: int = Field(..., description="Total registered candidates, students, and users")
    completed_submissions: int = Field(..., description="Evaluated examination and practice submissions")
    pending_evaluations: int = Field(..., description="In-progress or pending review submissions")
    completion_rate: float = Field(78.5, description="Platform assessment completion percentage")
    average_score: float = Field(71.2, description="Average candidate benchmark score")


class AnalyticsParticipationData(BaseModel):
    timeline_labels: List[str]
    participation_counts: List[int]
    completion_counts: List[int]


class AnalyticsLanguageUsage(BaseModel):
    languages: List[str]
    counts: List[int]
    percentages: List[float]


class AnalyticsPassFail(BaseModel):
    passed_count: int
    failed_count: int
    pass_percentage: float
    fail_percentage: float


class AnalyticsDifficultyDistribution(BaseModel):
    easy_count: int
    medium_count: int
    hard_count: int


class AdminDashboardAnalytics(BaseModel):
    participation: AnalyticsParticipationData
    language_usage: AnalyticsLanguageUsage
    pass_fail: AnalyticsPassFail
    difficulty_distribution: AnalyticsDifficultyDistribution
    average_completion_time_minutes: int = 48
    completion_rate_percentage: float = 78.5


class RecentActivityItem(BaseModel):
    id: str
    type: str  # assessment_created, question_added, submission_completed, user_registered, proctor_alert
    title: str
    description: str
    timestamp: str
    time_ago: str
    actor: str
    status_badge: Optional[str] = None
    icon: str = "activity"


class AdminRecentActivityResponse(BaseModel):
    activities: List[RecentActivityItem]
    total_count: int


class AdminPermissionsResponse(BaseModel):
    role: str
    permissions: List[str]
    modules_accessible: List[str]
    is_super_admin: bool


class AdminChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Current admin password")
    new_password: str = Field(..., min_length=8, description="New password meeting complexity criteria")
    confirm_password: str = Field(..., min_length=8, description="Confirmation password")
