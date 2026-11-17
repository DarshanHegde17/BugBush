from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class AssessmentAttemptDetailResponse(BaseModel):
    attempt_id: str
    assessment_id: str
    assessment_title: str
    candidate_name: str
    candidate_email: str
    duration_minutes: int
    started_at: str
    expires_at: str
    remaining_seconds: int
    status: str  # In Progress, Completed, Expired
    total_questions: int
    allowed_languages: List[str]
    rules: List[str]
    warning_threshold_seconds: int = 300


class QuestionNavStatus(BaseModel):
    id: str
    order: int
    title: str
    difficulty: str
    points: int
    status: str  # Not Visited, Not Answered, Answered, Marked for Review, Answered and Marked for Review
    has_draft: bool = False
    saved_language: Optional[str] = None
    last_saved_at: Optional[str] = None


class SampleTestCase(BaseModel):
    input: str
    output: str
    explanation: Optional[str] = None


class QuestionDetailResponse(BaseModel):
    id: str
    order: int
    title: str
    difficulty: str
    category: str
    points: int
    description: str
    input_format: str
    output_format: str
    constraints: List[str]
    examples: List[Dict[str, str]]
    sample_test_cases: List[Dict[str, str]]
    starter_code: Dict[str, str]
    allowed_languages: List[str]
    draft_code: Optional[str] = None
    draft_language: Optional[str] = None
    current_status: Optional[str] = None


class CodeRunRequest(BaseModel):
    attempt_id: str
    question_id: str
    language: str
    code: str
    custom_input: Optional[str] = None


class SampleTestResult(BaseModel):
    test_case_index: int
    input: str
    expected_output: str
    actual_output: str
    passed: bool
    execution_time_ms: float
    error: Optional[str] = None


class CodeRunResponse(BaseModel):
    status: str  # success, compilation_error, runtime_error, time_limit_exceeded
    output: str
    stdout: str
    stderr: str
    execution_time_ms: float
    memory_kb: Optional[float] = None
    sample_tests: List[SampleTestResult] = []
    passed_count: int = 0
    total_count: int = 0


class CodeSubmissionRequest(BaseModel):
    attempt_id: str
    question_id: str
    language: str
    code: str


class CodeSubmissionResponse(BaseModel):
    submission_id: str
    question_id: str
    status: str  # Accepted, Wrong Answer, Compilation Error, Runtime Error, Time Limit Exceeded
    passed_test_cases: int
    total_test_cases: int
    score: int
    max_score: int
    execution_time_ms: float
    memory_kb: Optional[float] = None
    submitted_at: str
    feedback: str
    question_status: str


class DraftSaveRequest(BaseModel):
    question_id: str
    language: str
    code: str
    status: Optional[str] = None


class DraftSaveResponse(BaseModel):
    saved: bool = True
    timestamp: str
    status: str
    message: str = "Code draft autosaved successfully."


class FinalSubmitRequest(BaseModel):
    feedback: Optional[str] = None


class FinalSubmitResponse(BaseModel):
    completed: bool = True
    attempt_id: str
    submitted_at: str
    total_score: int
    max_score: int
    percentage: float
    questions_summary: List[Dict[str, Any]]
    message: str = "Examination submitted successfully."


class ProctorEventRequest(BaseModel):
    event_type: str
    details: Optional[str] = None
    timestamp: Optional[str] = None


class ProctorEventResponse(BaseModel):
    logged: bool = True
    recorded_at: str
    violation_count: int
