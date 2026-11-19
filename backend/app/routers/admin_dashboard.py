from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Optional

from backend.app.schemas.admin_dashboard import (
    AdminDashboardStatistics,
    AdminDashboardAnalytics,
    AdminRecentActivityResponse,
    AdminPermissionsResponse,
    AdminChangePasswordRequest
)
from backend.app.schemas.admin_auth import AdminStatusResponse
from backend.app.routers.admin_auth import get_current_admin
from backend.app.services.admin_dashboard_service import admin_dashboard_service

router = APIRouter()


# ==============================================================================
# 1. Admin Dashboard Overview Statistics
# ==============================================================================
@router.get(
    "/dashboard/statistics",
    response_model=AdminDashboardStatistics,
    status_code=status.HTTP_200_OK,
    summary="Get live operational overview statistics",
    description="Returns aggregate counts: total questions, total assessments, active assessments, registered users, completed submissions, and pending evaluations."
)
async def get_overview_statistics(current_admin: dict = Depends(get_current_admin)):
    return admin_dashboard_service.get_dashboard_statistics(current_admin)


# ==============================================================================
# 2. Visual Analytics Data for Chart.js
# ==============================================================================
@router.get(
    "/dashboard/analytics",
    response_model=AdminDashboardAnalytics,
    status_code=status.HTTP_200_OK,
    summary="Get visual statistical analytics for admin charts",
    description="Returns participation trends, programming language usage, pass/fail ratios, and question difficulty distribution."
)
async def get_dashboard_analytics(current_admin: dict = Depends(get_current_admin)):
    return admin_dashboard_service.get_dashboard_analytics(current_admin)


# ==============================================================================
# 3. Recent Activity & Audit Logs Feed
# ==============================================================================
@router.get(
    "/dashboard/recent-activity",
    response_model=AdminRecentActivityResponse,
    status_code=status.HTTP_200_OK,
    summary="Get recent platform activity feed",
    description="Returns recently created assessments, new questions, candidate submissions, and audit events."
)
async def get_recent_activity(
    limit: int = Query(15, ge=1, le=50),
    current_admin: dict = Depends(get_current_admin)
):
    return admin_dashboard_service.get_recent_activity(current_admin, limit=limit)


# ==============================================================================
# 4. Admin Permissions & Scoped Module Access
# ==============================================================================
@router.get(
    "/permissions",
    response_model=AdminPermissionsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get administrator permissions and accessible modules",
    description="Returns permissions granted to the administrator role by the Super Admin."
)
async def get_permissions(current_admin: dict = Depends(get_current_admin)):
    return admin_dashboard_service.get_admin_permissions(current_admin)


# ==============================================================================
# 5. Administrator Profile Password Update
# ==============================================================================
@router.post(
    "/change-password",
    response_model=AdminStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Change administrator account password",
    description="Securely updates the administrator's password after validating current password and new complexity."
)
async def change_admin_password(
    payload: AdminChangePasswordRequest,
    current_admin: dict = Depends(get_current_admin)
):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match."
        )

    success, msg = admin_dashboard_service.change_admin_password(
        email=current_admin["email"],
        current_password=payload.current_password,
        new_password=payload.new_password
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg or "Unable to update administrator password."
        )

    return AdminStatusResponse(
        status="success",
        message=msg
    )
