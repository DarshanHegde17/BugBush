from fastapi import APIRouter, Depends, Query, status
from typing import Optional

from backend.app.routers.super_admin_auth import get_current_super_admin
from backend.app.schemas.super_admin_dashboard import (
    SuperAdminStatsResponse,
    UserAnalyticsResponse,
    AssessmentAnalyticsResponse,
    SubmissionAnalyticsResponse,
    MLAnalyticsResponse,
    DashboardAnalyticsResponse,
    PlatformHealthResponse,
    PlatformActivityResponse
)
from backend.app.services.super_admin_dashboard_service import super_admin_dashboard_service

dashboard_router = APIRouter()
platform_router = APIRouter()


# ==============================================================================
# Dashboard Summary & Analytics Endpoints
# ==============================================================================
@dashboard_router.get(
    "/statistics",
    response_model=SuperAdminStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Super Admin Platform Overview Statistics",
    description="Returns live system-wide operational metrics: total users, active users, total admins, submissions, evaluations, and health."
)
async def get_dashboard_statistics(current_super_admin: dict = Depends(get_current_super_admin)):
    data = super_admin_dashboard_service.get_statistics()
    return SuperAdminStatsResponse(**data)


@dashboard_router.get(
    "/analytics",
    response_model=DashboardAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Unified Platform Analytics",
    description="Aggregates user, assessment, submission, and ML intelligence across requested date range."
)
async def get_dashboard_analytics(
    range: str = Query("30d", description="Time window: today, 7d, 30d, 90d, custom"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    data = super_admin_dashboard_service.get_dashboard_analytics(range_str=range)
    return DashboardAnalyticsResponse(**data)


@dashboard_router.get(
    "/user-analytics",
    response_model=UserAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Growth and Account Distribution Analytics",
    description="Returns registration curves, monthly trends, and role distributions."
)
async def get_user_analytics(
    range: str = Query("30d", description="Time window: today, 7d, 30d, 90d, custom"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    data = super_admin_dashboard_service.get_user_analytics(range_str=range)
    return UserAnalyticsResponse(**data)


@dashboard_router.get(
    "/assessment-analytics",
    response_model=AssessmentAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Assessment Lifecycle Analytics",
    description="Returns assessment creation velocity, status distributions, and category breakdowns."
)
async def get_assessment_analytics(
    range: str = Query("30d", description="Time window: today, 7d, 30d, 90d, custom"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    data = super_admin_dashboard_service.get_assessment_analytics(range_str=range)
    return AssessmentAnalyticsResponse(**data)


@dashboard_router.get(
    "/submission-analytics",
    response_model=SubmissionAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Coding & Assessment Submission Analytics",
    description="Returns daily submissions, evaluation outcomes, and programming language distributions."
)
async def get_submission_analytics(
    range: str = Query("30d", description="Time window: today, 7d, 30d, 90d, custom"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    data = super_admin_dashboard_service.get_submission_analytics(range_str=range)
    return SubmissionAnalyticsResponse(**data)


@dashboard_router.get(
    "/ml-analytics",
    response_model=MLAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get ML Code Analysis and Algorithm Analytics",
    description="Returns ML evaluation volume, algorithm classification counts, and inference latency."
)
async def get_ml_analytics(
    range: str = Query("30d", description="Time window: today, 7d, 30d, 90d, custom"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    data = super_admin_dashboard_service.get_ml_analytics(range_str=range)
    return MLAnalyticsResponse(**data)


# ==============================================================================
# Platform Health & Activity Endpoints
# ==============================================================================
@platform_router.get(
    "/health",
    response_model=PlatformHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Platform Infrastructure Health Overview",
    description="Probes FastAPI, MongoDB, Redis, Celery, sandbox runner, ML engine, and email relay."
)
async def get_platform_health(current_super_admin: dict = Depends(get_current_super_admin)):
    data = super_admin_dashboard_service.get_platform_health()
    return PlatformHealthResponse(**data)


@platform_router.get(
    "/activity",
    response_model=PlatformActivityResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Recent Platform Activity Stream",
    description="Returns chronological feed of administrative events, registrations, publications, and security alerts."
)
async def get_platform_activity(
    category: Optional[str] = Query(None, description="Optional filter: all, auth, admin, assessments, submissions, security"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    data = super_admin_dashboard_service.get_platform_activity(category=category, page=page, limit=limit)
    return PlatformActivityResponse(**data)
