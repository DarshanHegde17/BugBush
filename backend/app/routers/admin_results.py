"""
BugBash - Enterprise Admin Results & Analytics Router
API endpoints for assessment results telemetry, candidate scorecards,
score distributions, question difficulty metrics, rankings, and report exports.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response

from backend.app.routers.admin_auth import get_current_admin
from backend.app.schemas.admin_result import (
    ResultSummaryMetrics,
    ResultListResponse,
    ResultDetailResponse,
    AssessmentAnalyticsResponse,
    CandidatePerformanceResponse,
    QuestionAnalyticsItem,
    RankingItem,
    ExportReportRequest,
    ExportReportResponse
)
from backend.app.services.admin_result_service import admin_result_service

router = APIRouter()


# ==============================================================================
# 1. Summary Statistics & Overview Counters
# ==============================================================================
@router.get(
    "/statistics",
    response_model=ResultSummaryMetrics,
    status_code=status.HTTP_200_OK,
    summary="Get overall results summary metrics and dashboard counters"
)
async def get_results_statistics(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_result_service.get_statistics()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 2. Results Directory & Searchable Listing
# ==============================================================================
@router.get(
    "",
    response_model=ResultListResponse,
    status_code=status.HTTP_200_OK,
    summary="List candidate assessment results with multi-filtering, sorting, and pagination"
)
async def list_results(
    search: Optional[str] = Query(None, description="Search by candidate name, email, or assessment title"),
    assessment_id: Optional[str] = Query(None, description="Filter by assessment ID"),
    candidate: Optional[str] = Query(None, description="Filter by candidate ID or email"),
    language: Optional[str] = Query(None, description="Filter by programming language"),
    difficulty: Optional[str] = Query(None, description="Filter by question difficulty"),
    pass_fail: Optional[str] = Query(None, description="Filter by pass or fail status"),
    min_score: Optional[float] = Query(None, description="Minimum score achieved"),
    max_score: Optional[float] = Query(None, description="Maximum score achieved"),
    date_range: Optional[str] = Query(None, description="Filter by date range preset"),
    sort_by: str = Query("completion_date", description="Field to sort by: completion_date, percentage, score, candidate_name"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_result_service.get_results_list(
            page=page,
            limit=limit,
            search=search,
            assessment_id=assessment_id,
            candidate=candidate,
            language=language,
            difficulty=difficulty,
            pass_fail=pass_fail,
            min_score=min_score,
            max_score=max_score,
            date_range=date_range,
            sort_by=sort_by,
            sort_order=sort_order
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 3. Question Performance Analytics & Health Indicators
# ==============================================================================
@router.get(
    "/question-analytics",
    response_model=List[QuestionAnalyticsItem],
    status_code=status.HTTP_200_OK,
    summary="Get question-level attempt metrics, pass/fail ratios, and health indicators"
)
async def get_question_analytics(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_result_service.get_question_analytics(admin_user=current_admin)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 4. Assessment Rankings & Leaderboards
# ==============================================================================
@router.get(
    "/rankings",
    response_model=List[RankingItem],
    status_code=status.HTTP_200_OK,
    summary="Get candidate leaderboard rankings overall or scoped by assessment"
)
async def get_rankings(
    assessment_id: Optional[str] = Query(None, description="Optional assessment ID filter"),
    limit: int = Query(50, ge=1, le=200, description="Number of top candidates to return"),
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_result_service.get_rankings(
            assessment_id=assessment_id,
            limit=limit,
            admin_user=current_admin
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 5. Export Report Generation
# ==============================================================================
@router.post(
    "/export",
    response_model=ExportReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate and cache export reports in CSV format"
)
async def export_report(
    payload: ExportReportRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_result_service.export_report(
            report_type=payload.report_type,
            export_format=payload.format,
            assessment_id=payload.assessment_id,
            candidate_id=payload.candidate_id,
            filters=payload.filters,
            admin_user=current_admin
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 6. Report File Download
# ==============================================================================
@router.get(
    "/reports/{report_id}",
    status_code=status.HTTP_200_OK,
    summary="Download generated report file by report ID"
)
async def download_report(
    report_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        rpt = admin_result_service.get_report(report_id, current_admin)
        return Response(
            content=rpt["content"],
            media_type=rpt.get("content_type", "text/csv"),
            headers={"Content-Disposition": f'attachment; filename="{rpt.get("filename", "report.csv")}"'}
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found or expired")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 7. Assessment-Specific Results List & Analytics
# ==============================================================================
@router.get(
    "/assessment/{assessment_id}",
    status_code=status.HTTP_200_OK,
    summary="List all candidate results for a specific assessment"
)
async def get_assessment_results(
    assessment_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_result_service.get_results_list(
            page=page,
            limit=limit,
            assessment_id=assessment_id
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/assessment/{assessment_id}/analytics",
    response_model=AssessmentAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get comprehensive assessment telemetry, score distributions, and question averages"
)
async def get_assessment_analytics(
    assessment_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_result_service.get_assessment_analytics(assessment_id, current_admin)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 8. Candidate Performance Analytics & Trends
# ==============================================================================
@router.get(
    "/candidate/{candidate_id}/performance",
    response_model=CandidatePerformanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get candidate historical performance trend, strengths, and weaknesses"
)
async def get_candidate_performance(
    candidate_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_result_service.get_candidate_performance(candidate_id, current_admin)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 9. Individual Result Details & Scorecard (Dynamic path last)
# ==============================================================================
@router.get(
    "/{result_id}",
    response_model=ResultDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get comprehensive scorecard and question-level breakdown for a result"
)
async def get_result_details(
    result_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_result_service.get_result_details(result_id, current_admin)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
