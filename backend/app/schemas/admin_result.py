"""
BugBash - Enterprise Admin Results & Analytics Schemas
Pydantic schemas for assessment results directory, individual scorecards,
assessment telemetry & distributions, candidate performance trends,
question-level difficulty analysis, leaderboards, and report exports.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ==============================================================================
# 1. Summary Metrics & Dashboard Counters
# ==============================================================================
class ResultSummaryMetrics(BaseModel):
    total_evaluated_candidates: int = Field(0, description="Total distinct evaluated candidate accounts")
    total_assessments_completed: int = Field(0, description="Total finalized assessment evaluation records")
    average_score: float = Field(0.0, description="Mean score across all completed assessments")
    highest_score: float = Field(0.0, description="Highest score achieved")
    lowest_score: float = Field(0.0, description="Lowest score recorded")
    pass_rate: float = Field(0.0, description="Overall percentage of passing candidates")
    failure_rate: float = Field(0.0, description="Overall percentage of failing candidates")
    pending_results: int = Field(0, description="Assessments currently in progress or awaiting evaluation")


# ==============================================================================
# 2. Result Listing Items & Table Response
# ==============================================================================
class ResultListItem(BaseModel):
    id: str
    candidate_id: str
    candidate_name: str
    candidate_email: str
    candidate_avatar: Optional[str] = None
    assessment_id: str
    assessment_title: str
    total_marks: float = 100.0
    obtained_marks: float = 0.0
    percentage: float = 0.0
    grade: str = "Pass"
    pass_fail_status: str = "Pass"  # "Pass" or "Fail"
    completion_date: str = "N/A"
    evaluation_status: str = "Completed"


class ResultListResponse(BaseModel):
    summary: ResultSummaryMetrics
    results: List[ResultListItem]
    total: int
    page: int
    limit: int
    pages: int


# ==============================================================================
# 3. Individual Result Details & Question Breakdown
# ==============================================================================
class QuestionPerformanceItem(BaseModel):
    question_id: str
    title: str
    question_type: str = "coding"  # "coding" or "mcq"
    difficulty: str = "Medium"
    max_marks: float = 25.0
    marks_obtained: float = 0.0
    test_cases_passed: int = 0
    test_cases_failed: int = 0
    evaluation_status: str = "Accepted"


class EvaluationBreakdown(BaseModel):
    test_case_correctness: str = "100%"
    compilation_status: str = "Success"
    runtime_status: str = "Normal"
    mcq_correctness: Optional[str] = None
    ml_analysis_status: str = "Completed"
    manual_review_status: str = "Not Required"


class ResultDetailResponse(BaseModel):
    id: str
    candidate_id: str
    candidate_name: str
    candidate_email: str
    candidate_avatar: Optional[str] = None
    assessment_id: str
    assessment_title: str
    completion_date: str = "N/A"
    attempt_number: int = 1
    total_marks: float = 100.0
    obtained_marks: float = 0.0
    percentage: float = 0.0
    grade: str = "Pass"
    pass_fail_status: str = "Pass"
    feedback: Optional[str] = None
    questions: List[QuestionPerformanceItem] = Field(default_factory=list)
    evaluation_breakdown: EvaluationBreakdown


# ==============================================================================
# 4. Assessment Analytics & Distributions
# ==============================================================================
class AssessmentAnalyticsResponse(BaseModel):
    assessment_id: str
    assessment_title: str
    total_assigned: int = 0
    started: int = 0
    completed: int = 0
    not_participated: int = 0
    average_score: float = 0.0
    highest_score: float = 0.0
    lowest_score: float = 0.0
    pass_percentage: float = 0.0
    failure_percentage: float = 0.0
    completion_rate: float = 0.0
    score_distribution: Dict[str, int] = Field(default_factory=dict)
    pass_fail_distribution: Dict[str, int] = Field(default_factory=dict)
    question_averages: List[Dict[str, Any]] = Field(default_factory=list)
    difficulty_performance: Dict[str, Any] = Field(default_factory=dict)
    language_performance: Dict[str, Any] = Field(default_factory=dict)


# ==============================================================================
# 5. Candidate Performance Analytics & Trends
# ==============================================================================
class CandidatePerformanceResponse(BaseModel):
    candidate_id: str
    candidate_name: str
    candidate_email: str
    total_attempted: int = 0
    total_completed: int = 0
    average_score: float = 0.0
    highest_score: float = 0.0
    lowest_score: float = 0.0
    strongest_language: Optional[str] = None
    weakest_language: Optional[str] = None
    strongest_topics: List[str] = Field(default_factory=list)
    topics_needing_improvement: List[str] = Field(default_factory=list)
    performance_trend: List[Dict[str, Any]] = Field(default_factory=list)
    history: List[ResultListItem] = Field(default_factory=list)


# ==============================================================================
# 6. Question Performance Analytics
# ==============================================================================
class QuestionAnalyticsItem(BaseModel):
    question_id: str
    title: str
    question_type: str = "coding"
    difficulty: str = "Medium"
    attempt_count: int = 0
    average_score: float = 0.0
    max_points: float = 25.0
    pass_percentage: float = 0.0
    fail_percentage: float = 0.0
    average_execution_time_ms: float = 0.0
    health_indicator: str = "Healthy"  # "Healthy", "Too Easy", "Too Difficult", "Frequently Misunderstood"


# ==============================================================================
# 7. Rankings and Leaderboards
# ==============================================================================
class RankingItem(BaseModel):
    rank: int
    candidate_id: str
    candidate_name: str
    candidate_email: str
    assessment_id: Optional[str] = None
    assessment_title: Optional[str] = None
    score: float = 0.0
    percentage: float = 0.0
    grade: str = "Pass"
    completion_date: str = "N/A"


# ==============================================================================
# 8. Report Export Schemas
# ==============================================================================
class ExportReportRequest(BaseModel):
    report_type: str = Field(..., description="Report type: results, assessment, candidate, questions, rankings")
    format: str = Field("csv", description="Format: csv, json, pdf")
    assessment_id: Optional[str] = Field(None, description="Optional assessment ID scope")
    candidate_id: Optional[str] = Field(None, description="Optional candidate ID scope")
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Active search and filter parameters")


class ExportReportResponse(BaseModel):
    report_id: str
    download_url: str
    filename: str
    content_type: str
    generated_at: str
    row_count: int
