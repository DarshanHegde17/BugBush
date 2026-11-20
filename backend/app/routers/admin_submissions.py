"""
BugBash - Enterprise Admin Submissions Management Router
API endpoints for monitoring candidate submissions, test-case telemetry,
8-stage ML evaluation pipeline tracking, manual review, and re-evaluation.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from backend.app.routers.admin_auth import get_current_admin
from backend.app.schemas.admin_submission import (
    SubmissionSummaryMetrics,
    SubmissionListResponse,
    SubmissionDetailResponse,
    SubmissionCodeResponse,
    ManualReviewRequest,
    ReevaluationRequest
)
from backend.app.services.admin_submission_service import admin_submission_service

router = APIRouter()


# ==============================================================================
# 1. Submissions Dashboard Summary & Statistics (Static route first)
# ==============================================================================
@router.get(
    "/statistics",
    response_model=SubmissionSummaryMetrics,
    status_code=status.HTTP_200_OK,
    summary="Get overall submissions summary metrics and dashboard counters"
)
async def get_submissions_statistics(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_submission_service.get_statistics()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 2. Submissions Directory & Searchable Listing
# ==============================================================================
@router.get(
    "",
    response_model=SubmissionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List candidate submissions with multi-filtering, sorting, and pagination"
)
async def list_submissions(
    search: Optional[str] = Query(None, description="Search by submission ID, candidate, assessment, or question"),
    assessment_id: Optional[str] = Query(None, description="Filter by assessment ID"),
    candidate: Optional[str] = Query(None, description="Filter by candidate ID or email"),
    language: Optional[str] = Query(None, description="Filter by programming language"),
    question_type: Optional[str] = Query(None, description="Filter by question type: coding, mcq"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: Successful, Failed, Pending, Error, Accepted, etc."),
    review_filter: Optional[str] = Query(None, description="Filter by review status: pending_review, reviewed"),
    start_date: Optional[str] = Query(None, description="Filter submissions on or after ISO date"),
    end_date: Optional[str] = Query(None, description="Filter submissions on or before ISO date"),
    sort_by: str = Query("submitted_at", description="Field to sort by: submitted_at, score, evaluation_status"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(15, ge=1, le=100, description="Items per page"),
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_submission_service.get_submissions_list(
            search=search,
            assessment_id=assessment_id,
            candidate=candidate,
            language=language,
            question_type=question_type,
            status=status_filter,
            review_filter=review_filter,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 3. Submission Details & Specific Telemetry Sub-Routes
# ==============================================================================
@router.get(
    "/{submission_id}",
    response_model=SubmissionDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get detailed submission specifications, execution summary, and ML analysis"
)
async def get_submission(
    submission_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_submission_service.get_submission_details(submission_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{submission_id}/code",
    response_model=SubmissionCodeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get submitted source code with syntax language and copy permissions"
)
async def get_submission_code(
    submission_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_submission_service.get_submission_code(submission_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{submission_id}/execution-results",
    status_code=status.HTTP_200_OK,
    summary="Get sanitized test-case results and execution summary"
)
async def get_execution_results(
    submission_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_submission_service.get_execution_results(submission_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{submission_id}/ml-analysis",
    status_code=status.HTTP_200_OK,
    summary="Get the 8-stage ML evaluation pipeline progress and algorithmic insights"
)
async def get_ml_analysis(
    submission_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_submission_service.get_ml_analysis(submission_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{submission_id}/evaluation-history",
    status_code=status.HTTP_200_OK,
    summary="Get immutable chronological evaluation and review history"
)
async def get_evaluation_history(
    submission_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_submission_service.get_evaluation_history(submission_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 4. Manual Review & Score Adjustment Action
# ==============================================================================
@router.post(
    "/{submission_id}/review",
    status_code=status.HTTP_200_OK,
    summary="Submit administrator manual review and optional score adjustment"
)
async def submit_manual_review(
    submission_id: str,
    payload: ManualReviewRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_submission_service.review_submission(
            submission_id=submission_id,
            review_notes=payload.review_notes,
            review_reason=payload.review_reason,
            adjusted_score=payload.adjusted_score,
            mark_as_reviewed=payload.mark_as_reviewed,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 5. Re-Evaluation Request Action
# ==============================================================================
@router.post(
    "/{submission_id}/request-reevaluation",
    status_code=status.HTTP_200_OK,
    summary="Request automated sandbox re-evaluation for a submission"
)
async def request_reevaluation(
    submission_id: str,
    payload: ReevaluationRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_submission_service.request_reevaluation(
            submission_id=submission_id,
            reason=payload.reason,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
