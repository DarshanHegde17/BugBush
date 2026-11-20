"""
BugBash - Enterprise Admin ML Insights Router
API endpoints for ML code logic recognition, multi-approach detection,
Big-O complexity estimation, code optimization, model performance, and human reviewer corrections.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from backend.app.routers.admin_auth import get_current_admin
from backend.app.schemas.admin_ml_insight import (
    MLSummaryMetrics,
    MLPipelineOverviewResponse,
    MLAnalysisListResponse,
    MLAnalysisDetailResponse,
    AlgorithmAnalyticsResponse,
    MLModelPerformanceResponse,
    ReviewCommentRequest,
    CorrectionSubmissionRequest
)
from backend.app.services.admin_ml_insight_service import admin_ml_insight_service

router = APIRouter()


# ==============================================================================
# 1. Summary Statistics & Pipeline Overview
# ==============================================================================
@router.get(
    "/statistics",
    response_model=MLSummaryMetrics,
    status_code=status.HTTP_200_OK,
    summary="Get overall ML analyses statistics and overview counters"
)
async def get_ml_statistics(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_ml_insight_service.get_statistics()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/pipeline",
    response_model=MLPipelineOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get operational telemetry for the 10-stage ML code evaluation pipeline"
)
async def get_pipeline_telemetry(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_ml_insight_service.get_pipeline_overview()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 2. Algorithm, Complexity, Optimization & Feedback Analytics
# ==============================================================================
@router.get(
    "/algorithms",
    response_model=AlgorithmAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get aggregate algorithm frequencies, approaches, languages, and complexity distributions"
)
async def get_algorithm_analytics(
    assessment_id: Optional[str] = Query(None, description="Optional assessment ID filter"),
    language: Optional[str] = Query(None, description="Optional programming language filter"),
    difficulty: Optional[str] = Query(None, description="Optional difficulty tier"),
    date_range: Optional[str] = Query(None, description="Optional date range filter"),
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_ml_insight_service.get_algorithm_analytics(
            assessment_id=assessment_id,
            language=language,
            difficulty=difficulty,
            date_range=date_range,
            admin_user=current_admin
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/complexity",
    status_code=status.HTTP_200_OK,
    summary="Get Time and Space Big-O complexity estimation distributions"
)
async def get_complexity_analytics(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_ml_insight_service.get_complexity_analytics()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/optimization",
    status_code=status.HTTP_200_OK,
    summary="Get code quality bottlenecks and optimization opportunities"
)
async def get_optimization_analytics(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_ml_insight_service.get_optimization_analytics()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/feedback",
    status_code=status.HTTP_200_OK,
    summary="Get pedagogical AI feedback trends and learning gap statistics"
)
async def get_feedback_analytics(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_ml_insight_service.get_feedback_analytics()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 3. Model Registry & Performance Metrics
# ==============================================================================
@router.get(
    "/models",
    response_model=MLModelPerformanceResponse,
    status_code=status.HTTP_200_OK,
    summary="List deployed and historical ML model versions"
)
async def get_ml_models(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_ml_insight_service.get_models_performance()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/models/performance",
    response_model=MLModelPerformanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get ML model validation benchmarks (Precision, Recall, F1, Accuracy, human review agreement)"
)
async def get_models_performance(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_ml_insight_service.get_models_performance()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 4. Searchable Code Analyses Listing
# ==============================================================================
@router.get(
    "/analyses",
    response_model=MLAnalysisListResponse,
    status_code=status.HTTP_200_OK,
    summary="Search and list analyzed submissions with multi-filtering and pagination"
)
async def list_analyses(
    search: Optional[str] = Query(None, description="Search candidate, assessment, question, or algorithm"),
    language: Optional[str] = Query(None, description="Filter by programming language"),
    algorithm: Optional[str] = Query(None, description="Filter by recognized algorithm"),
    approach: Optional[str] = Query(None, description="Filter by solution approach"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: Completed, Pending, Failed"),
    sort_by: str = Query("timestamp", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(15, ge=1, le=100, description="Items per page"),
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_ml_insight_service.get_analyses_list(
            search=search,
            language=language,
            algorithm=algorithm,
            approach=approach,
            status=status_filter,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 5. Analysis Detail, Human Review & Corrections
# ==============================================================================
@router.get(
    "/analyses/{analysis_id}",
    response_model=MLAnalysisDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get complete deep-dive code analysis, AST features, approaches, and Big-O evidence"
)
async def get_analysis_detail(
    analysis_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_ml_insight_service.get_analysis_details(analysis_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/analyses/{analysis_id}/review",
    status_code=status.HTTP_200_OK,
    summary="Submit review feedback and quality rating on an ML analysis"
)
async def submit_analysis_review(
    analysis_id: str,
    payload: ReviewCommentRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        return admin_ml_insight_service.submit_review(analysis_id, data, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/analyses/{analysis_id}/corrections",
    status_code=status.HTTP_200_OK,
    summary="Submit human corrections for incorrect algorithm recognition or complexity estimates"
)
async def submit_analysis_correction(
    analysis_id: str,
    payload: CorrectionSubmissionRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        return admin_ml_insight_service.submit_correction(analysis_id, data, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
