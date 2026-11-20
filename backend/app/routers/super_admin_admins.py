from fastapi import APIRouter, Depends, Query, Path, Body, Request, status, HTTPException
from typing import Optional, Dict, Any

from backend.app.routers.super_admin_auth import get_current_super_admin
from backend.app.schemas.super_admin_admins import (
    AdminListItem,
    AdminListResponse,
    CreateAdminRequest,
    CreateAdminResponse,
    UpdateAdminRequest,
    AdminActivityResponse,
    AdminStatusActionResponse
)
from backend.app.services.super_admin_admins_service import super_admin_admins_service

router = APIRouter()


# ==============================================================================
# Admin Listing & Query
# ==============================================================================
@router.get(
    "",
    response_model=AdminListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all administrators with filtering and search",
    description="Returns paginated list of administrators, supporting search by name/email, account status filter, and metrics."
)
async def list_admins(
    search: Optional[str] = Query(None, description="Search term for name or email"),
    status: Optional[str] = Query(None, description="Filter by status: Active, Pending, Suspended, Deactivated"),
    date_from: Optional[str] = Query(None, description="Start date filter"),
    date_to: Optional[str] = Query(None, description="End date filter"),
    sort_by: str = Query("created_at", description="Field to sort by: created_at, name, status, last_login"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    return super_admin_admins_service.list_admins(
        search=search,
        status_filter=status,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        limit=limit
    )


# ==============================================================================
# Create & Invite Admin
# ==============================================================================
@router.post(
    "/invite",
    response_model=CreateAdminResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and invite an administrator",
    description="Provisions administrator record with 'Pending Invitation' status, generates single-use token and 6-digit OTP."
)
async def create_and_invite_admin(
    payload: CreateAdminRequest,
    request: Request,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    client_ip = request.client.host if request.client else ""
    return super_admin_admins_service.create_and_invite_admin(
        payload=payload,
        super_admin_user=current_super_admin,
        client_ip=client_ip
    )


# ==============================================================================
# Single Admin Details
# ==============================================================================
@router.get(
    "/{admin_id}",
    response_model=AdminListItem,
    status_code=status.HTTP_200_OK,
    summary="Get single administrator profile",
    description="Retrieves complete information, scope, assigned permissions, and operational status for an administrator."
)
async def get_admin(
    admin_id: str = Path(..., description="Administrator ID or email"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    return super_admin_admins_service.get_admin(admin_id)


# ==============================================================================
# Update Admin Profile
# ==============================================================================
@router.put(
    "/{admin_id}",
    response_model=AdminListItem,
    status_code=status.HTTP_200_OK,
    summary="Update administrator profile details",
    description="Updates name, phone, organization, or notes. Email, role, and password cannot be modified here."
)
async def update_admin(
    admin_id: str = Path(..., description="Administrator ID or email"),
    payload: UpdateAdminRequest = Body(...),
    request: Request = None,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    client_ip = request.client.host if request and request.client else ""
    return super_admin_admins_service.update_admin(
        admin_id=admin_id,
        payload=payload,
        super_admin_user=current_super_admin,
        client_ip=client_ip
    )


# ==============================================================================
# Admin Lifecycle Actions: Suspend, Reactivate, Deactivate
# ==============================================================================
@router.post(
    "/{admin_id}/suspend",
    response_model=AdminStatusActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Suspend administrator account",
    description="Suspends the admin account, records reason, and immediately revokes all active JWT sessions."
)
async def suspend_admin(
    admin_id: str = Path(..., description="Administrator ID or email"),
    payload: Optional[Dict[str, Any]] = Body(None),
    request: Request = None,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    client_ip = request.client.host if request and request.client else ""
    reason = payload.get("reason") if payload else None
    return super_admin_admins_service.suspend_admin(
        admin_id=admin_id,
        reason=reason,
        super_admin_user=current_super_admin,
        client_ip=client_ip
    )


@router.post(
    "/{admin_id}/reactivate",
    response_model=AdminStatusActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Reactivate suspended administrator",
    description="Restores active status to a suspended administrator account."
)
async def reactivate_admin(
    admin_id: str = Path(..., description="Administrator ID or email"),
    request: Request = None,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    client_ip = request.client.host if request and request.client else ""
    return super_admin_admins_service.reactivate_admin(
        admin_id=admin_id,
        super_admin_user=current_super_admin,
        client_ip=client_ip
    )


@router.post(
    "/{admin_id}/deactivate",
    response_model=AdminStatusActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Deactivate administrator account",
    description="Sets account status to Deactivated and terminates active sessions."
)
async def deactivate_admin(
    admin_id: str = Path(..., description="Administrator ID or email"),
    request: Request = None,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    client_ip = request.client.host if request and request.client else ""
    return super_admin_admins_service.deactivate_admin(
        admin_id=admin_id,
        super_admin_user=current_super_admin,
        client_ip=client_ip
    )


# ==============================================================================
# Resend Invitation
# ==============================================================================
@router.post(
    "/{admin_id}/resend-invitation",
    response_model=CreateAdminResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend administrator invitation",
    description="Generates a fresh single-use invitation token and OTP for a pending administrator account."
)
async def resend_invitation(
    admin_id: str = Path(..., description="Administrator ID or email"),
    request: Request = None,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    client_ip = request.client.host if request and request.client else ""
    return super_admin_admins_service.resend_invitation(
        admin_id=admin_id,
        super_admin_user=current_super_admin,
        client_ip=client_ip
    )


# ==============================================================================
# Revoke Sessions
# ==============================================================================
@router.post(
    "/{admin_id}/revoke-sessions",
    response_model=AdminStatusActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Revoke all active sessions for administrator",
    description="Immediately revokes all active JWT tokens for this administrator, forcing immediate re-authentication."
)
async def revoke_sessions(
    admin_id: str = Path(..., description="Administrator ID or email"),
    request: Request = None,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    client_ip = request.client.host if request and request.client else ""
    return super_admin_admins_service.revoke_sessions(
        admin_id=admin_id,
        super_admin_user=current_super_admin,
        client_ip=client_ip
    )


# ==============================================================================
# Admin Activity Log
# ==============================================================================
@router.get(
    "/{admin_id}/activity",
    response_model=AdminActivityResponse,
    status_code=status.HTTP_200_OK,
    summary="Get administrator audit activity history",
    description="Returns audit trail entries and operational events for the specified administrator."
)
async def get_admin_activity(
    admin_id: str = Path(..., description="Administrator ID or email"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    return super_admin_admins_service.get_admin_activity(admin_id)
