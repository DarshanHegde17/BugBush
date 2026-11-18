from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


# ==============================================================================
# Practice Problem Models
# ==============================================================================
class PracticeProblemSummary(BaseModel):
    id: str
    title: str
    slug: str
    difficulty: str
    category: str
    languages: List[str]
    acceptance_rate: str
    tags: List[str]
    points: int = 25
    user_status: str = "Not Started"  # Not Started, Attempted, Solved
    solved: bool = False
    submissions_count: int = 0


class SampleTestCase(BaseModel):
    input: str
    output: str
    explanation: Optional[str] = ""


class PracticeProblemDetail(BaseModel):
    id: str
    title: str
    slug: str
    difficulty: str
    category: str
    languages: List[str]
    acceptance_rate: str
    tags: List[str]
    points: int = 25
    description: str
    input_format: str
    output_format: str
    constraints: List[str]
    sample_test_cases: List[SampleTestCase]
    starter_code: Dict[str, str]
    related_topics: List[str]
    user_status: str = "Not Started"
    solved: bool = False
    last_code: Optional[str] = None
    last_language: Optional[str] = None


# ==============================================================================
# Practice Statistics Models
# ==============================================================================
class PracticeCategoryStat(BaseModel):
    total: int
    solved: int


class PracticeStatisticsResponse(BaseModel):
    problems_solved: int
    problems_attempted: int
    easy_solved: int
    medium_solved: int
    hard_solved: int
    current_streak: int
    total_problems: int
    completion_rate: float
    category_breakdown: Dict[str, PracticeCategoryStat] = {}


# ==============================================================================
# Execution & Testing Models
# ==============================================================================
class PracticeExecuteRequest(BaseModel):
    problem_id: str
    language: str
    code: str
    custom_input: Optional[str] = None


class SampleRunResult(BaseModel):
    test_index: int
    input: str
    expected_output: str
    actual_output: str
    passed: bool
    execution_time_ms: float
    stderr: Optional[str] = ""


class PracticeExecuteResponse(BaseModel):
    status: str  # success, compilation_error, runtime_error, time_limit_exceeded
    stdout: str
    stderr: str
    execution_time_ms: float
    memory_kb: float
    passed_sample_cases: int
    total_sample_cases: int
    sample_results: List[SampleRunResult]
    message: Optional[str] = None


# ==============================================================================
# ML-Powered Learning Insights Models
# ==============================================================================
class AlternativeApproach(BaseModel):
    name: str
    description: str
    time_complexity: str
    space_complexity: str


class MLFeedbackInsights(BaseModel):
    recognized_approach: str
    algorithm_identified: str
    time_complexity: str
    time_complexity_reason: str
    space_complexity: str
    space_complexity_reason: str
    code_quality_score: int
    code_quality_feedback: List[str]
    optimization_tips: List[str]
    alternative_approaches: List[AlternativeApproach]
    confidence_score: float
    disclaimer: str
    next_recommended_problem: Optional[Dict[str, Any]] = None


# ==============================================================================
# Submission Models
# ==============================================================================
class PracticeSubmitRequest(BaseModel):
    problem_id: str
    language: str
    code: str


class PracticeSubmitResponse(BaseModel):
    submission_id: str
    problem_id: str
    status: str  # Accepted, Wrong Answer, Runtime Error, Time Limit Exceeded, Compilation Error
    passed_test_cases: int
    total_test_cases: int
    score: int
    max_score: int
    execution_time_ms: float
    memory_kb: float
    submitted_at: str
    message: str
    user_status: str  # Attempted or Solved
    ml_insights: MLFeedbackInsights


# ==============================================================================
# Recommendation & History Models
# ==============================================================================
class PracticeRecommendationItem(BaseModel):
    problem_id: str
    title: str
    difficulty: str
    category: str
    reason: str
    confidence: float
    tags: List[str]
    user_status: str
    points: int = 25


class PracticeHistoryItem(BaseModel):
    id: str
    problem_id: str
    problem_title: str
    language: str
    status: str
    passed_tests: str
    execution_time_ms: float
    timestamp: str
