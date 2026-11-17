from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List

from backend.app.routers.users import get_current_user
from backend.app.services.exam_service import exam_service
from backend.app.schemas.exam import (
    AssessmentAttemptDetailResponse,
    QuestionNavStatus,
    QuestionDetailResponse,
    CodeRunRequest,
    CodeRunResponse,
    CodeSubmissionRequest,
    CodeSubmissionResponse,
    DraftSaveRequest,
    DraftSaveResponse,
    FinalSubmitRequest,
    FinalSubmitResponse,
    ProctorEventRequest,
    ProctorEventResponse
)

# 1. Assessment Attempts Router (/api/v1/assessment-attempts)
attempts_router = APIRouter(prefix="/api/v1/assessment-attempts", tags=["Assessment Examination"])

@attempts_router.get(
    "/{attempt_id}",
    response_model=AssessmentAttemptDetailResponse,
    summary="Get assessment attempt session metadata",
    description="Returns server-authoritative timer, duration, schedule, and assessment metadata."
)
async def get_assessment_attempt(
    attempt_id: str,
    current_user: dict = Depends(get_current_user)
):
    success, data, err = exam_service.get_or_create_attempt_session(attempt_id, current_user["email"])
    if not success or not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in (err or "").lower() else status.HTTP_403_FORBIDDEN,
            detail=err or "Unable to retrieve assessment session."
        )
    return data


@attempts_router.get(
    "/{attempt_id}/questions",
    response_model=List[QuestionNavStatus],
    summary="Get question statuses for left navigation panel",
    description="Returns list of questions with their statuses (Not Visited, Answered, Marked for Review, etc.)."
)
async def get_attempt_questions(
    attempt_id: str,
    current_user: dict = Depends(get_current_user)
):
    success, data, err = exam_service.get_attempt_questions(attempt_id, current_user["email"])
    if not success or data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in (err or "").lower() else status.HTTP_403_FORBIDDEN,
            detail=err or "Unable to retrieve question list."
        )
    return data


@attempts_router.put(
    "/{attempt_id}/draft",
    response_model=DraftSaveResponse,
    summary="Auto-save code draft",
    description="Saves candidate's latest code and programming language per question. Enforces attempt ownership."
)
async def save_attempt_draft(
    attempt_id: str,
    payload: DraftSaveRequest,
    current_user: dict = Depends(get_current_user)
):
    success, res, err = exam_service.save_draft(
        attempt_id=attempt_id,
        question_id=payload.question_id,
        language=payload.language,
        code=payload.code,
        user_email=current_user["email"],
        status=payload.status
    )
    if not success or not res:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err or "Failed to autosave draft."
        )
    return res


@attempts_router.post(
    "/{attempt_id}/final-submit",
    response_model=FinalSubmitResponse,
    summary="Final assessment submission",
    description="Finalizes and locks assessment attempt, computes final score, and closes exam session."
)
async def final_submit_attempt(
    attempt_id: str,
    payload: Optional[FinalSubmitRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    feedback = payload.feedback if payload else None
    success, summary, err = exam_service.final_submit_attempt(
        attempt_id=attempt_id,
        user_email=current_user["email"],
        feedback=feedback
    )
    if not success or not summary:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err or "Unable to finalize assessment submission."
        )
    return summary


@attempts_router.post(
    "/{attempt_id}/events",
    response_model=ProctorEventResponse,
    summary="Record proctoring telemetry event",
    description="Logs fullscreen exits, tab switches, blur events, and copy/paste monitoring."
)
async def log_proctor_event(
    attempt_id: str,
    payload: ProctorEventRequest,
    current_user: dict = Depends(get_current_user)
):
    from datetime import datetime, timezone
    success, count, err = exam_service.log_proctor_event(
        attempt_id=attempt_id,
        user_email=current_user["email"],
        event_type=payload.event_type,
        details=payload.details
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err or "Failed to log proctor event.")
    return {
        "logged": True,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "violation_count": count
    }


# 2. Questions Router (/api/v1/questions)
questions_router = APIRouter(prefix="/api/v1/questions", tags=["Assessment Questions"])

@questions_router.get(
    "/{question_id}",
    response_model=QuestionDetailResponse,
    summary="Get question description & starter code",
    description="Returns problem description, input/output formats, constraints, examples, and starter templates. Never reveals hidden test cases."
)
async def get_question_detail(
    question_id: str,
    attempt_id: str = Query(..., description="Active examination attempt ID"),
    current_user: dict = Depends(get_current_user)
):
    success, data, err = exam_service.get_question_detail(
        question_id=question_id,
        attempt_id=attempt_id,
        user_email=current_user["email"]
    )
    if not success or not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in (err or "").lower() else status.HTTP_400_BAD_REQUEST,
            detail=err or "Question not found."
        )
    return data


# 3. Executions Router (/api/v1/executions)
executions_router = APIRouter(prefix="/api/v1/executions", tags=["Code Execution Sandbox"])

@executions_router.post(
    "/run",
    response_model=CodeRunResponse,
    summary="Run code against sample test cases",
    description="Executes candidate code inside isolated subprocess sandbox against sample test cases or custom input."
)
async def run_code(
    payload: CodeRunRequest,
    current_user: dict = Depends(get_current_user)
):
    success, res, err = exam_service.run_code(
        attempt_id=payload.attempt_id,
        question_id=payload.question_id,
        language=payload.language,
        code=payload.code,
        user_email=current_user["email"],
        custom_input=payload.custom_input
    )
    if not success or not res:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err or "Failed to execute code."
        )
    return res


# 4. Submissions Router (/api/v1/submissions)
submissions_router = APIRouter(prefix="/api/v1/submissions", tags=["Official Evaluation Pipeline"])

@submissions_router.post(
    "",
    response_model=CodeSubmissionResponse,
    summary="Submit code for official evaluation",
    description="Runs official evaluation pipeline against both sample and hidden test cases. Saves submission and updates status."
)
async def submit_code(
    payload: CodeSubmissionRequest,
    current_user: dict = Depends(get_current_user)
):
    success, res, err = exam_service.submit_code(
        attempt_id=payload.attempt_id,
        question_id=payload.question_id,
        language=payload.language,
        code=payload.code,
        user_email=current_user["email"]
    )
    if not success or not res:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err or "Failed to submit code."
        )
    return res
