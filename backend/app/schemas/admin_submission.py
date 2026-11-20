"""
BugBash - Enterprise Admin Submissions Management Schemas
Pydantic models for monitoring candidate coding and MCQ submissions, test-case telemetry,
8-stage ML evaluation pipeline tracking, manual review actions, and evaluation history.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ==============================================================================
# 1. Summary Metrics & Dashboard Counters
# ==============================================================================
class SubmissionSummaryMetrics(BaseModel):
    total_submissions: int = Field(0, description="Total submissions recorded across assessments and practice")
    successful_submissions: int = Field(0, description="Accepted or passing submissions")
    failed_submissions: int = Field(0, description="Submissions failing test cases, timeout, or runtime")
    pending_evaluation: int = Field(0, description="Submissions currently queued or executing")
    manual_reviews_required: int = Field(0, description="Submissions flagged for human review")
    evaluation_errors: int = Field(0, description="Submissions with compilation or sandbox errors")


# ==============================================================================
# 2. Test-Case Execution Telemetry
# ==============================================================================
class TestCaseResultItem(BaseModel):
    case_id: int
    visibility: str = "public"  # "public", "hidden"
    status: str = "Passed"  # "Passed", "Failed", "Runtime Error", "Compilation Error", "Time Limit Exceeded", "Memory Limit Exceeded", "Pending"
    execution_time_ms: float = 0.0
    memory_kb: float = 0.0
    error_category: Optional[str] = None
    # Security: input_preview and expected_output_preview are strictly sanitized and never exposed for hidden test cases
    input_preview: Optional[str] = None
    expected_output_preview: Optional[str] = None
    actual_output_preview: Optional[str] = None


class ExecutionSummary(BaseModel):
    total_test_cases: int = 0
    passed_test_cases: int = 0
    failed_test_cases: int = 0
    execution_time_ms: float = 0.0
    memory_kb: float = 0.0
    compilation_status: str = "Success"  # "Success", "Compilation Error", "N/A"
    runtime_error: Optional[str] = None
    evaluation_status: str = "Accepted"


# ==============================================================================
# 3. Hybrid ML Analysis & 8-Stage Pipeline
# ==============================================================================
class MLPipelineStage(BaseModel):
    stage_number: int
    name: str
    status: str = "completed"  # "completed", "in_progress", "pending", "failed"
    completed_at: Optional[Any] = None
    details: Optional[str] = None


class MLAnalysisData(BaseModel):
    pipeline_stages: List[MLPipelineStage] = Field(default_factory=list)
    detected_algorithm: Optional[str] = None
    time_complexity: Optional[str] = None
    space_complexity: Optional[str] = None
    recognized_concepts: List[str] = Field(default_factory=list)
    confidence_score: Optional[float] = None
    ai_feedback: Optional[str] = None
    processing_status: str = "Completed"  # "Completed", "In Progress", "Pending", "Failed", "N/A"
    errors: List[str] = Field(default_factory=list)


# ==============================================================================
# 4. Manual Review & Score Adjustment
# ==============================================================================
class ManualReviewData(BaseModel):
    review_required: bool = False
    is_reviewed: bool = False
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[Any] = None
    review_notes: Optional[str] = None
    review_reason: Optional[str] = None
    original_score: Optional[float] = None
    adjusted_score: Optional[float] = None
    score_adjusted: bool = False
    re_evaluation_requested: bool = False
    re_evaluation_reason: Optional[str] = None


# ==============================================================================
# 5. Evaluation History Item
# ==============================================================================
class EvaluationHistoryItem(BaseModel):
    attempt_number: int = 1
    timestamp: Any = None
    engine_version: str = "BugBash-EvalEngine-v2.4"
    execution_status: str = "Accepted"
    ml_status: str = "Completed"
    score: float = 0.0
    action: str = "Automated Evaluation"
    actor: str = "System"
    notes: Optional[str] = None


# ==============================================================================
# 6. Listing & Detail Responses
# ==============================================================================
class SubmissionListItem(BaseModel):
    id: str
    submission_id: str
    candidate_id: str
    candidate_name: str
    candidate_email: str
    assessment_id: Optional[str] = None
    assessment_title: Optional[str] = None
    question_id: str
    question_title: str
    question_type: str = "coding"  # "coding", "mcq"
    language: Optional[str] = None
    submitted_at: Any = None
    passed_test_cases: int = 0
    total_test_cases: int = 0
    score: float = 0.0
    max_score: float = 100.0
    evaluation_status: str = "Accepted"  # "Accepted", "Wrong Answer", "Time Limit Exceeded", "Compilation Error", "Runtime Error", "Pending", "Evaluation Error"
    review_required: bool = False
    is_reviewed: bool = False
    has_code: bool = True


class SubmissionListResponse(BaseModel):
    summary: SubmissionSummaryMetrics
    submissions: List[SubmissionListItem]
    total: int
    page: int
    limit: int
    pages: int


class SubmissionDetailResponse(BaseModel):
    id: str
    submission_id: str
    submission_type: str = "coding"
    candidate_id: str
    candidate_name: str
    candidate_email: str
    candidate_avatar: Optional[str] = None
    assessment_id: Optional[str] = None
    assessment_title: Optional[str] = None
    question_id: str
    question_title: str
    question_type: str = "coding"
    difficulty: str = "Medium"
    allowed_languages: List[str] = Field(default_factory=list)
    language: Optional[str] = None
    code_preview: Optional[str] = None
    can_view_code: bool = True
    can_review: bool = True
    selected_option: Optional[str] = None
    submitted_at: Any = None
    score: float = 0.0
    max_score: float = 100.0
    evaluation_status: str = "Accepted"
    execution_summary: ExecutionSummary
    test_cases: List[TestCaseResultItem] = Field(default_factory=list)
    ml_analysis: MLAnalysisData
    manual_review: ManualReviewData
    evaluation_history: List[EvaluationHistoryItem] = Field(default_factory=list)


class SubmissionCodeResponse(BaseModel):
    submission_id: str
    language: Optional[str] = None
    code: str
    can_copy: bool = True


# ==============================================================================
# 7. Action Requests
# ==============================================================================
class ManualReviewRequest(BaseModel):
    review_notes: str = Field(..., min_length=3, max_length=2000, description="Internal administrator evaluation notes")
    review_reason: str = Field(..., min_length=3, max_length=500, description="Reason for reviewing or adjusting score")
    adjusted_score: Optional[float] = Field(None, ge=0, le=1000, description="Adjusted score if manual adjustment is applied")
    mark_as_reviewed: bool = Field(True, description="Whether to flag the submission as reviewed")


class ReevaluationRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Reason for triggering re-evaluation")
