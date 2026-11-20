"""
BugBash - Enterprise Admin Profile & Settings Router
API endpoints for administrator personal profile details, password updates,
active session management, security activity telemetry, appearance preferences,
and personal notification preferences.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header

from backend.app.routers.admin_auth import get_current_admin
from backend.app.schemas.admin_profile import (
    AdminProfileResponse,
    UpdateAdminProfileRequest,
    AdminProfilePhotoRequest,
    AdminChangePasswordRequest,
    AdminSessionsResponse,
    AdminSecurityActivityResponse,
    AdminPreferencesModel,
    AdminNotificationPreferencesModel
)
from backend.app.services.admin_profile_service import admin_profile_service

router = APIRouter()
security_router = APIRouter()
preferences_router = APIRouter()
notification_prefs_router = APIRouter()


# ==============================================================================
# 1. Administrator Profile Management (/api/v1/admin/profile)
# ==============================================================================
@router.get(
    "",
    response_model=AdminProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current administrator profile details"
)
async def get_admin_profile(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_profile_service.get_profile(current_admin["email"])
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put(
    "",
    response_model=AdminProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Update permitted administrator profile information"
)
async def update_admin_profile(
    payload: UpdateAdminProfileRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
        return admin_profile_service.update_profile(current_admin["email"], data)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/photo",
    status_code=status.HTTP_200_OK,
    summary="Upload or update administrator profile photo"
)
async def update_admin_photo(
    payload: AdminProfilePhotoRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_profile_service.update_profile_photo(current_admin["email"], payload.photo_data)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change administrator password with current password verification"
)
async def change_admin_password(
    payload: AdminChangePasswordRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
    current_admin: dict = Depends(get_current_admin)
):
    try:
        token = authorization.split(" ", 1)[1].strip() if authorization and " " in authorization else None
        return admin_profile_service.change_password(
            email=current_admin["email"],
            current_password=payload.current_password,
            new_password=payload.new_password,
            confirm_password=payload.confirm_password,
            revoke_other_sessions=payload.revoke_other_sessions,
            current_token=token
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 2. Active Sessions & Security Telemetry (/api/v1/admin/security)
# ==============================================================================
@security_router.get(
    "/sessions",
    response_model=AdminSessionsResponse,
    status_code=status.HTTP_200_OK,
    summary="List active device sessions for the authenticated administrator"
)
async def get_active_sessions(
    request: Request,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        client_ip = request.client.host if request.client else "127.0.0.1"
        user_agent = request.headers.get("user-agent", "Browser")
        return admin_profile_service.get_sessions(current_admin["email"], request_ip=client_ip, user_agent=user_agent)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@security_router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke an individual active session"
)
async def revoke_active_session(
    session_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_profile_service.revoke_session(current_admin["email"], session_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@security_router.post(
    "/logout-other-sessions",
    status_code=status.HTTP_200_OK,
    summary="Revoke all active sessions except the current session"
)
async def logout_other_sessions(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_profile_service.revoke_other_sessions(current_admin["email"])
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@security_router.get(
    "/activity",
    response_model=AdminSecurityActivityResponse,
    status_code=status.HTTP_200_OK,
    summary="Get recent login activity and security audit history"
)
async def get_security_activity(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_profile_service.get_security_activity(current_admin["email"])
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 3. Appearance & Regional Preferences (/api/v1/admin/preferences)
# ==============================================================================
@preferences_router.get(
    "",
    response_model=AdminPreferencesModel,
    status_code=status.HTTP_200_OK,
    summary="Get current administrator dashboard and appearance preferences"
)
async def get_admin_preferences(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_profile_service.get_preferences(current_admin["email"])
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@preferences_router.put(
    "",
    response_model=AdminPreferencesModel,
    status_code=status.HTTP_200_OK,
    summary="Update administrator dashboard and appearance preferences"
)
async def update_admin_preferences(
    payload: AdminPreferencesModel,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        return admin_profile_service.update_preferences(current_admin["email"], data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 4. Personal Notification Preferences (/api/v1/admin/notification-preferences)
# ==============================================================================
@notification_prefs_router.get(
    "",
    response_model=AdminNotificationPreferencesModel,
    status_code=status.HTTP_200_OK,
    summary="Get administrator personal notification preferences"
)
async def get_admin_notification_preferences(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_profile_service.get_notification_preferences(current_admin["email"])
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@notification_prefs_router.put(
    "",
    response_model=AdminNotificationPreferencesModel,
    status_code=status.HTTP_200_OK,
    summary="Update administrator personal notification preferences"
)
async def update_admin_notification_preferences(
    payload: AdminNotificationPreferencesModel,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        return admin_profile_service.update_notification_preferences(current_admin["email"], data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
