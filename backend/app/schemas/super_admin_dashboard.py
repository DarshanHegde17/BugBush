from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ==============================================================================
# 1. Summary Statistics Schema
# ==============================================================================
class SuperAdminStatsResponse(BaseModel):
    status: str = "success"
    total_registered_users: int = Field(..., description="Total users registered on BugBash")
    total_active_users: int = Field(..., description="Currently active users")
    total_admins: int = Field(..., description="Total administrators across all scopes")
    active_assessments: int = Field(..., description="Assessments currently published and accepting attempts")
    total_submissions: int = Field(..., description="Total coding and MCQ submissions processed")
    completed_evaluations: int = Field(..., description="Evaluations completed and scores assigned")
    pending_ml_analyses: int = Field(..., description="Submissions queued for ML code analysis")
    suspended_accounts: int = Field(..., description="Deactivated or locked candidate/admin accounts")
    system_status: str = Field("Healthy", description="Overall platform infrastructure health status")
    timestamp: str = Field(..., description="Time metrics were computed")


# ==============================================================================
# 2. Analytics Schemas
# ==============================================================================
class UserAnalyticsResponse(BaseModel):
    status: str = "success"
    range: str
    active_users: int
    suspended_accounts: int
    total_registrations_in_range: int
    daily_registrations: List[Dict[str, Any]]
    monthly_registrations: List[Dict[str, Any]]
    roles_breakdown: Dict[str, int]


class AssessmentAnalyticsResponse(BaseModel):
    status: str = "success"
    range: str
    assessments_created: int
    published_assessments: int
    completed_assessments: int
    active_assessments: int
    category_distribution: Dict[str, int]
    trend: List[Dict[str, Any]]


class SubmissionAnalyticsResponse(BaseModel):
    status: str = "success"
    range: str
    total_submissions_in_range: int
    successful_submissions: int
    failed_submissions: int
    pending_evaluations: int
    daily_submissions: List[Dict[str, Any]]
    language_breakdown: Dict[str, int]


class MLAnalyticsResponse(BaseModel):
    status: str = "success"
    range: str
    total_code_analyses: int
    analysis_success_rate: float
    pending_ml_jobs: int
    ml_processing_time_avg_ms: float
    algorithm_distribution: Dict[str, int]
    trend: List[Dict[str, Any]]


class DashboardAnalyticsResponse(BaseModel):
    status: str = "success"
    range: str
    users: UserAnalyticsResponse
    assessments: AssessmentAnalyticsResponse
    submissions: SubmissionAnalyticsResponse
    ml: MLAnalyticsResponse


# ==============================================================================
# 3. Platform Health Schemas
# ==============================================================================
class PlatformHealthServiceStatus(BaseModel):
    name: str
    status: str = "Healthy"  # Healthy, Degraded, Unavailable, Unknown
    latency_ms: Optional[float] = None
    details: str
    last_check: str
    worker_count: Optional[int] = None
    queue_size: Optional[int] = None


class PlatformHealthResponse(BaseModel):
    status: str = "success"
    overall_status: str  # Healthy, Degraded, Unavailable
    last_health_check: str
    services: List[PlatformHealthServiceStatus]
    recent_incidents: List[Dict[str, Any]] = []


# ==============================================================================
# 4. Recent Platform Activity Schemas
# ==============================================================================
class PlatformActivityItem(BaseModel):
    id: str
    event_type: str
    title: str
    description: str
    timestamp: str
    actor: str
    status: str = "success"  # success, warning, error, info
    category: str


class PlatformActivityResponse(BaseModel):
    status: str = "success"
    total: int
    page: int = 1
    limit: int = 20
    activities: List[PlatformActivityItem]
