from fastapi import APIRouter, HTTPException, Request, Header, status, Depends
from typing import Optional

from backend.app.schemas.admin_auth import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminUserInfo,
    AdminStatusResponse
)
from backend.app.services.admin_auth_service import admin_auth_service, AUTHORIZED_ADMIN_ROLES
from backend.app.services.user_service import user_service

router = APIRouter()


def get_current_admin(authorization: Optional[str] = Header(None)) -> dict:
    """
    Enforces administrator authentication across all administrative endpoints.
    Resolves administrator identity strictly from the verified JWT claim.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to the Admin Portal.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = authorization.split(" ", 1)[1].strip()
    admin = admin_auth_service.get_admin_by_token(token)

    if not admin:
        # Check if the token belongs to a candidate user
        candidate = user_service.get_user_by_token(token)
        if candidate and (candidate.get("role") or "").strip().lower() not in AUTHORIZED_ADMIN_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: Candidate accounts are not permitted in the Admin Portal."
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid administrative token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return admin


# ==============================================================================
# Admin Authentication Endpoints
# ==============================================================================
@router.post(
    "/login",
    response_model=AdminLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign in to BugBash Admin Portal",
    description="Authenticates administrator credentials, checks role privileges and account status, and issues an Admin session token."
)
async def admin_login(payload: AdminLoginRequest, request: Request):
    client_ip = request.client.host if request.client else ""

    success, admin_info, err_msg, status_code = admin_auth_service.authenticate_admin(
        email=payload.email,
        password=payload.password,
        client_ip=client_ip
    )

    if not success:
        raise HTTPException(
            status_code=status_code,
            detail=err_msg or "Authentication failed."
        )

    # Issue secure signed administrative token
    token, expires_in = admin_auth_service.create_admin_token(
        admin_info=admin_info,
        remember_me=payload.remember_me or False
    )

    return AdminLoginResponse(
        status="success",
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=AdminUserInfo(
            id=admin_info["id"],
            email=admin_info["email"],
            name=admin_info["name"],
            role=admin_info["role"],
            account_status=admin_info["account_status"],
            organization_name=admin_info["organization_name"],
            permissions=admin_info["permissions"],
            last_login=admin_info["last_login"]
        ),
        redirect_url="/admin/dashboard"
    )


@router.get(
    "/me",
    response_model=AdminUserInfo,
    status_code=status.HTTP_200_OK,
    summary="Get current administrator profile",
    description="Returns authenticated administrator details, assigned role, and permissions."
)
async def get_current_admin_profile(current_admin: dict = Depends(get_current_admin)):
    return AdminUserInfo(
        id=current_admin["id"],
        email=current_admin["email"],
        name=current_admin["name"],
        role=current_admin["role"],
        account_status=current_admin["account_status"],
        organization_name=current_admin["organization_name"],
        permissions=current_admin["permissions"],
        last_login=current_admin.get("last_login")
    )


@router.post(
    "/logout",
    response_model=AdminStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign out of Admin Portal",
    description="Revokes the active administrative session token."
)
async def admin_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        admin_auth_service.revoke_token(token)

    return AdminStatusResponse(
        status="success",
        message="Successfully signed out of the Admin Portal."
    )
