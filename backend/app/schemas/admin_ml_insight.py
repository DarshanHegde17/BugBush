"""
BugBash - Enterprise Admin ML Insights Schemas
Pydantic schemas for ML evaluation pipeline telemetry, code logic recognition,
alternative approaches, complexity estimations, code quality & optimization,
AI feedback, algorithm analytics, model performance, and human reviewer corrections.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ==============================================================================
# 1. Summary Metrics & Pipeline Overview
# ==============================================================================
class MLSummaryMetrics(BaseModel):
    total_code_analyses: int = Field(0, description="Total code submissions evaluated by ML pipeline")
    successfully_analyzed: int = Field(0, description="Submissions successfully processed through all ML stages")
    pending_analyses: int = Field(0, description="Submissions currently in queue or being processed")
    average_confidence: float = Field(0.0, description="Mean prediction confidence score (0-100%)")
    optimizations_detected: int = Field(0, description="Total code optimization suggestions generated")
    analysis_failures: int = Field(0, description="Analyses that failed due to syntax errors or timeouts")


class PipelineStageItem(BaseModel):
    stage_number: int
    name: str
    status: str = "completed"  # "completed", "in_progress", "pending", "failed"
    execution_time_ms: float = 0.0
    details: str = ""


class MLPipelineOverviewResponse(BaseModel):
    stages: List[PipelineStageItem]
    pipeline_version: str = "BugBash-ML-Pipeline-v3.2"
    active_workers: int = 4
    queue_latency_ms: float = 18.5


# ==============================================================================
# 2. Code Analysis Detail Schemas
# ==============================================================================
class AlternativeApproachItem(BaseModel):
    approach_name: str
    description: str
    time_complexity: str
    space_complexity: str
    is_detected_approach: bool = False
    tradeoffs: str = ""


class ComplexityEstimate(BaseModel):
    notation: str = "O(n)"
    confidence: float = 0.95
    code_evidence: List[str] = Field(default_factory=list)
    explanation: str = ""
    auxiliary_memory: Optional[str] = None


class CodeQualityMetrics(BaseModel):
    readability_score: int = 85
    maintainability_rating: str = "A"
    repeated_logic_detected: bool = False
    unnecessary_loops: int = 0
    inefficient_data_structures: List[str] = Field(default_factory=list)
    redundant_operations: int = 0
    bottlenecks: List[str] = Field(default_factory=list)


class OptimizationSuggestion(BaseModel):
    current_approach: str
    suggested_improvement: str
    reason: str
    expected_benefit: str
    estimated_complexity_change: str = ""


class AIFeedbackPayload(BaseModel):
    candidate_strengths: List[str] = Field(default_factory=list)
    logical_mistakes: List[str] = Field(default_factory=list)
    performance_opportunities: List[str] = Field(default_factory=list)
    alternative_approaches: List[str] = Field(default_factory=list)
    recommended_study_topics: List[str] = Field(default_factory=list)
    suggested_practice_questions: List[str] = Field(default_factory=list)
    disclaimer: str = "AI-generated pedagogical feedback for educational review. Not guaranteed correct."


class ReviewerCorrection(BaseModel):
    corrected_by: str
    corrected_at: str
    corrected_algorithm: Optional[str] = None
    corrected_approach: Optional[str] = None
    corrected_time_complexity: Optional[str] = None
    corrected_space_complexity: Optional[str] = None
    misleading_feedback_flag: bool = False
    notes: str = ""
    submitted_to_dataset: bool = False


class MLAnalysisDetailResponse(BaseModel):
    analysis_id: str
    submission_id: str
    candidate_id: str
    candidate_name: str
    candidate_email: str
    assessment_id: str
    assessment_title: str
    question_id: str
    question_title: str
    question_category: str = "Algorithms"
    language: str = "python"
    code_snippet: str = ""
    
    # 4. Code Logic Recognition
    detected_algorithm: Optional[str] = None
    algorithm_confidence: float = 0.0
    detected_concepts: List[str] = Field(default_factory=list)
    control_flow: str = "Linear with conditional branch"
    data_structures_used: List[str] = Field(default_factory=list)
    loop_structures: List[str] = Field(default_factory=list)
    recursion_patterns: Optional[str] = None
    function_calls: List[str] = Field(default_factory=list)
    solution_approach: str = "Single-Pass Hash Map"

    # 5. Approaches & Complexity
    alternative_approaches: List[AlternativeApproachItem] = Field(default_factory=list)
    time_complexity: ComplexityEstimate
    space_complexity: ComplexityEstimate

    # 7. Quality & Optimizations
    code_quality: CodeQualityMetrics
    optimizations: List[OptimizationSuggestion] = Field(default_factory=list)

    # 8. AI Feedback
    ai_feedback: AIFeedbackPayload

    # Status & Audit
    status: str = "Completed"
    pipeline_stages: List[PipelineStageItem] = Field(default_factory=list)
    timestamp: str = ""
    corrections: Optional[ReviewerCorrection] = None


class MLAnalysisListItem(BaseModel):
    analysis_id: str
    submission_id: str
    candidate_name: str
    candidate_email: str
    assessment_title: str
    question_title: str
    language: str
    detected_algorithm: Optional[str] = None
    algorithm_confidence: float = 0.0
    solution_approach: str = ""
    time_complexity: str = "O(n)"
    space_complexity: str = "O(n)"
    status: str = "Completed"
    timestamp: str = ""
    has_corrections: bool = False


class MLAnalysisListResponse(BaseModel):
    summary: MLSummaryMetrics
    analyses: List[MLAnalysisListItem]
    total: int
    page: int
    limit: int
    pages: int


# ==============================================================================
# 3. Algorithm Analytics Schemas
# ==============================================================================
class AlgorithmFrequencyItem(BaseModel):
    algorithm: str
    count: int
    percentage: float
    average_confidence: float


class ApproachDistributionItem(BaseModel):
    approach: str
    count: int
    percentage: float


class CommonMistakeItem(BaseModel):
    mistake_pattern: str
    frequency: int
    severity: str  # "High", "Medium", "Low"
    affected_concept: str
    example_remediation: str


class OptimizationTopicItem(BaseModel):
    topic: str
    optimizations_count: int
    prevalent_inefficiency: str


class AlgorithmAnalyticsResponse(BaseModel):
    frequent_algorithms: List[AlgorithmFrequencyItem]
    common_approaches: List[ApproachDistributionItem]
    language_distribution: Dict[str, int]
    time_complexity_distribution: Dict[str, int]
    space_complexity_distribution: Dict[str, int]
    common_coding_mistakes: List[CommonMistakeItem]
    optimization_by_topic: List[OptimizationTopicItem]


# ==============================================================================
# 4. ML Model Performance Schemas
# ==============================================================================
class MLModelVersionItem(BaseModel):
    model_id: str
    name: str
    version: str
    task: str  # "AST Pattern Classification", "Complexity Estimation", "Feedback Generation"
    deployment_status: str  # "Active", "Staging", "Deprecated"
    total_analyses: int = 0
    successful_analyses: int = 0
    failed_analyses: int = 0
    avg_latency_ms: float = 0.0
    confidence_distribution: Dict[str, int] = Field(default_factory=dict)
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    accuracy: Optional[float] = None
    human_agreement_rate: Optional[float] = None
    last_deployed: str = ""


class MLModelPerformanceResponse(BaseModel):
    models: List[MLModelVersionItem]
    overall_human_agreement: float = 93.4
    total_reviewer_corrections: int = 12
    last_validation_run: str = ""


# ==============================================================================
# 5. Human Review & Correction Requests
# ==============================================================================
class ReviewCommentRequest(BaseModel):
    comments: str = Field(..., min_length=2, max_length=1000)
    rating: Optional[str] = "Accurate"  # "Accurate", "Partially Accurate", "Inaccurate"


class CorrectionSubmissionRequest(BaseModel):
    corrected_algorithm: Optional[str] = None
    corrected_approach: Optional[str] = None
    corrected_time_complexity: Optional[str] = None
    corrected_space_complexity: Optional[str] = None
    misleading_feedback_flag: bool = False
    correction_notes: str = Field(..., min_length=3, max_length=1500)
    submit_to_dataset: bool = True
