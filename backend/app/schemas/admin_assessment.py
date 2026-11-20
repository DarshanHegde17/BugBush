from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ==============================================================================
# Question & Section Schemas
# ==============================================================================
class AssessmentQuestionRef(BaseModel):
    question_id: str = Field(..., description="Unique ID of question from Question Bank")
    order: int = Field(1, description="Display order within assessment or section")
    section_id: Optional[str] = Field("sec-1", description="Associated section ID")
    custom_marks: Optional[int] = Field(None, description="Custom points assigned to this question")
    title: Optional[str] = Field(None, description="Cached question title")
    difficulty: Optional[str] = Field("Medium", description="Question difficulty")
    points: Optional[int] = Field(20, description="Base question marks")
    languages: Optional[List[str]] = Field(default_factory=list, description="Supported languages")
    category: Optional[str] = Field(None, description="Topic or category")
    question_type: Optional[str] = Field("coding", description="Type: coding or mcq")


class AssessmentSection(BaseModel):
    id: str = Field(..., description="Unique section identifier (e.g. sec-1)")
    name: str = Field(..., min_length=1, description="Section name (e.g. Python Programming, MCQ)")
    instructions: Optional[str] = Field("", description="Section-specific candidate instructions")
    duration_minutes: Optional[int] = Field(None, description="Section duration in minutes if section timer enabled")
    total_marks: Optional[int] = Field(0, description="Calculated marks for this section")
    question_ids: List[str] = Field(default_factory=list, description="List of question IDs in this section")
    navigation_rule: str = Field("free", description="'free' allows jumping; 'linear' enforces sequential answering")


# ==============================================================================
# Timer & Rules Schemas
# ==============================================================================
class AssessmentTimerConfig(BaseModel):
    mode: str = Field("total", description="Timer mode: 'total', 'section', or 'both'")
    total_timer_enabled: bool = Field(True, description="Enforce global assessment timer")
    total_duration_minutes: int = Field(60, ge=5, le=480, description="Total duration in minutes")
    section_timers_enabled: bool = Field(False, description="Enforce individual section countdowns")


class AssessmentRules(BaseModel):
    total_marks: int = Field(100, ge=1, description="Total possible score")
    passing_percentage: float = Field(60.0, ge=0.0, le=100.0, description="Minimum score percentage to pass")
    negative_marking: bool = Field(False, description="Whether incorrect answers deduct marks")
    negative_mark_value: float = Field(0.0, ge=0.0, description="Points deducted per incorrect answer")
    max_attempts: int = Field(1, ge=1, le=10, description="Maximum permitted candidate attempts")
    question_navigation: str = Field("free", description="'free' or 'linear'")
    random_question_order: bool = Field(False, description="Shuffle questions randomly per candidate")
    random_option_order: bool = Field(False, description="Shuffle MCQ options randomly per candidate")
    allow_change_answers: bool = Field(True, description="Allow candidate to revisit and modify responses")
    autosave: bool = Field(True, description="Automatically persist draft code/answers every 15s")
    submission_confirmation: bool = Field(True, description="Require candidate to confirm final submission")
    auto_submit_on_timeout: bool = Field(True, description="Automatically submit attempt when timer expires")
    result_visibility: str = Field("immediate", description="'immediate', 'after_deadline', or 'manual'")
    allow_candidate_review: bool = Field(True, description="Allow review of scorecard after completion")


class AssessmentSchedule(BaseModel):
    availability: str = Field("scheduled", description="'always', 'scheduled', or 'fixed_window'")
    start_date: Optional[str] = Field(None, description="Start date/time (ISO string or standard format)")
    end_date: Optional[str] = Field(None, description="End date/time / submission deadline")
    timezone: str = Field("UTC", description="Configured timezone")
    assignment_deadline: Optional[str] = Field(None, description="Candidate registration deadline")


# ==============================================================================
# Create & Update Schemas
# ==============================================================================
class AdminAssessmentCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=150, description="Assessment title")
    description: str = Field(..., min_length=10, description="Assessment overview / description")
    assessment_type: str = Field(
        "Coding Examination",
        description="Coding Examination, Technical Interview, MCQ Assessment, Mixed Assessment, Practice Assessment"
    )
    instructions: str = Field("Read all questions carefully before submitting.", description="Candidate instructions")
    difficulty: str = Field("Medium", description="Easy, Medium, Hard, Mixed")
    languages: List[str] = Field(
        default_factory=lambda: ["Python", "Java", "C++", "JavaScript", "SQL"],
        description="Allowed programming languages"
    )
    tags: List[str] = Field(default_factory=list, description="Categorization tags")
    sections: List[AssessmentSection] = Field(default_factory=list, description="Configured assessment sections")
    questions: List[AssessmentQuestionRef] = Field(default_factory=list, description="Ordered questions reference list")
    duration_minutes: Optional[int] = Field(None, ge=1, description="Overall duration in minutes")
    total_marks: Optional[int] = Field(None, ge=1, description="Overall total marks")
    timer_config: AssessmentTimerConfig = Field(default_factory=AssessmentTimerConfig)
    rules: AssessmentRules = Field(default_factory=AssessmentRules)
    schedule: AssessmentSchedule = Field(default_factory=AssessmentSchedule)
    assigned_candidates: List[str] = Field(default_factory=list, description="Assigned candidate emails or cohorts")


class AdminAssessmentUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=150)
    description: Optional[str] = None
    assessment_type: Optional[str] = None
    instructions: Optional[str] = None
    difficulty: Optional[str] = None
    languages: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    duration_minutes: Optional[int] = Field(None, ge=1, description="Updated duration in minutes")
    total_marks: Optional[int] = Field(None, ge=1, description="Updated total marks")
    sections: Optional[List[AssessmentSection]] = None
    questions: Optional[List[AssessmentQuestionRef]] = None
    timer_config: Optional[AssessmentTimerConfig] = None
    rules: Optional[AssessmentRules] = None
    schedule: Optional[AssessmentSchedule] = None
    assigned_candidates: Optional[List[str]] = None
    status: Optional[str] = None


# ==============================================================================
# List & Overview Responses
# ==============================================================================
class AdminAssessmentListItem(BaseModel):
    id: str
    title: str
    assessment_type: str
    difficulty: str
    category: Optional[str] = None
    total_questions: int
    duration_minutes: int
    total_marks: int
    assigned_candidates_count: int
    status: str  # Draft, Published, Scheduled, Active, Completed, Archived
    created_date: str
    updated_at: Optional[str] = None
    creator_name: Optional[str] = "BugBash Administrator"
    can_edit: bool = True
    can_publish: bool = True
    can_delete: bool = True


class AdminAssessmentListStatistics(BaseModel):
    total_assessments: int
    published_assessments: int
    draft_assessments: int
    scheduled_assessments: int
    active_assessments: int
    completed_assessments: int
    archived_assessments: int


class AdminAssessmentListResponse(BaseModel):
    assessments: List[AdminAssessmentListItem]
    statistics: AdminAssessmentListStatistics
    total_count: int


# ==============================================================================
# Automatic Question Generation Schemas
# ==============================================================================
class LanguageDifficultySpec(BaseModel):
    Easy: int = 0
    Medium: int = 0
    Hard: int = 0


class GenerateQuestionsRequest(BaseModel):
    specifications: Dict[str, Dict[str, int]] = Field(
        default_factory=dict,
        description="Mapping of language to counts per difficulty, e.g. {'Python': {'Easy': 2, 'Medium': 3, 'Hard': 1}}"
    )
    mcq_count: int = Field(0, ge=0, description="Number of MCQ questions to include")
    total_marks: Optional[int] = Field(None, description="Optional target total marks")


class GenerateQuestionsResponse(BaseModel):
    success: bool
    message: str
    selected_questions: List[dict]
    total_selected: int
    total_marks: int


# ==============================================================================
# Question Bank Catalog Item Schema
# ==============================================================================
class QuestionBankCatalogItem(BaseModel):
    id: str
    title: str
    difficulty: str
    category: str
    languages: List[str]
    question_type: str  # coding or mcq
    points: int
    tags: List[str]
    description_snippet: str
    options: Optional[List[str]] = None


# ==============================================================================
# Candidate Assignment & Statistics Schemas
# ==============================================================================
class AssignCandidatesRequest(BaseModel):
    candidate_emails: List[str] = Field(..., min_length=1, description="List of candidate emails to assign")
    cohort_names: Optional[List[str]] = Field(default_factory=list, description="Optional cohort or batch labels")
    deadline: Optional[str] = Field(None, description="Custom candidate deadline")


class CandidateAssignmentStatusItem(BaseModel):
    email: str
    name: str
    status: str  # Not Started, In Progress, Submitted, Evaluated
    score: Optional[int] = None
    max_score: int
    attempt_count: int
    started_at: Optional[str] = None
    submitted_at: Optional[str] = None


class AssessmentStatisticsResponse(BaseModel):
    assessment_id: str
    title: str
    status: str
    assigned_count: int
    attempts_started: int
    submissions_completed: int
    completion_rate: float
    average_score: float
    pass_percentage: float
    score_distribution: Dict[str, int]
