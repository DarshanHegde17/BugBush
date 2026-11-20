from fastapi import APIRouter, HTTPException, Request, Header, status, Depends
from typing import Optional

from backend.app.schemas.super_admin_auth import (
    SuperAdminLoginRequest,
    SuperAdminLoginResponse,
    SuperAdminUserInfo,
    SuperAdminVerifyOtpRequest,
    SuperAdminResendOtpRequest,
    SuperAdminOtpResponse,
    SuperAdminForgotPasswordRequest,
    SuperAdminForgotPasswordResponse,
    SuperAdminResetPasswordRequest,
    SuperAdminStatusResponse
)
from backend.app.services.super_admin_auth_service import super_admin_auth_service, AUTHORIZED_SUPER_ADMIN_ROLES
from backend.app.services.user_service import user_service

router = APIRouter()


def get_current_super_admin(authorization: Optional[str] = Header(None)) -> dict:
    """
    Enforces Super Administrator authentication across all Super Admin endpoints.
    Strictly verifies that the JWT claim has role == 'super_admin'.
    Rejects ordinary admins and candidates with 403 Forbidden.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to the Super Admin Portal.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = authorization.split(" ", 1)[1].strip()
    super_admin = super_admin_auth_service.get_super_admin_by_token(token)

    if not super_admin:
        # Check if this token belongs to an ordinary admin or candidate attempting unauthorized access
        user = user_service.get_user_by_token(token)
        if user and (user.get("role") or "").strip().lower() not in AUTHORIZED_SUPER_ADMIN_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted: Insufficient administrative privileges for Super Admin Control Center."
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid Super Administrator token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return super_admin


# ==============================================================================
# Super Admin Authentication Endpoints
# ==============================================================================
@router.post(
    "/login",
    response_model=SuperAdminLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign in to Super Admin Control Center",
    description="Authenticates Super Administrator credentials, enforces role boundaries, and initiates MFA challenge or session issuance."
)
async def super_admin_login(payload: SuperAdminLoginRequest, request: Request):
    client_ip = request.client.host if request.client else ""

    success, user_info, auth_meta, err_msg, status_code = super_admin_auth_service.authenticate_super_admin(
        email=payload.email,
        password=payload.password,
        client_ip=client_ip,
        require_mfa=payload.require_mfa
    )

    if not success:
        raise HTTPException(
            status_code=status_code,
            detail=err_msg or "Authentication failed."
        )

    if auth_meta.get("require_otp"):
        return SuperAdminLoginResponse(
            status="mfa_required",
            require_otp=True,
            temp_token=auth_meta.get("temp_token"),
            masked_email=auth_meta.get("masked_email"),
            message=auth_meta.get("message"),
            redirect_url="/super-admin/verify-otp"
        )

    return SuperAdminLoginResponse(
        status="success",
        require_otp=False,
        access_token=auth_meta.get("access_token"),
        token_type="bearer",
        expires_in=auth_meta.get("expires_in"),
        user=SuperAdminUserInfo(**user_info),
        redirect_url="/super-admin/dashboard"
    )


@router.post(
    "/verify-otp",
    response_model=SuperAdminOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify Super Admin 6-Digit OTP",
    description="Verifies the MFA or login OTP, invalidates single-use code, and returns authenticated session token."
)
async def super_admin_verify_otp(payload: SuperAdminVerifyOtpRequest, request: Request):
    client_ip = request.client.host if request.client else ""
    identifier = payload.temp_token or payload.email or ""

    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification context missing. Please provide temp_token or email."
        )

    success, user_info, token, expires_in, err_msg, status_code = super_admin_auth_service.verify_otp(
        identifier=identifier,
        otp=payload.otp,
        remember_device=payload.remember_device or False,
        client_ip=client_ip
    )

    if not success:
        raise HTTPException(
            status_code=status_code,
            detail=err_msg or "OTP verification failed."
        )

    return SuperAdminOtpResponse(
        status="success",
        message="MFA challenge successfully verified. Redirecting to Super Admin Dashboard.",
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=SuperAdminUserInfo(**user_info),
        redirect_url="/super-admin/dashboard"
    )


@router.post(
    "/resend-otp",
    response_model=SuperAdminOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend Super Admin OTP",
    description="Dispatches a refreshed 6-digit OTP subject to 60-second rate limiting cooldown."
)
async def super_admin_resend_otp(payload: SuperAdminResendOtpRequest, request: Request):
    client_ip = request.client.host if request.client else ""
    identifier = payload.temp_token or payload.email or ""

    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification context missing. Please provide temp_token or email."
        )

    success, new_temp_token, new_otp, err_msg, status_code = super_admin_auth_service.resend_otp(
        identifier=identifier,
        client_ip=client_ip
    )

    if not success:
        raise HTTPException(
            status_code=status_code,
            detail=err_msg or "Failed to resend OTP."
        )

    return SuperAdminOtpResponse(
        status="success",
        message="A new 6-digit verification code has been dispatched to your registered address.",
        dev_otp=new_otp
    )


@router.post(
    "/forgot-password",
    response_model=SuperAdminForgotPasswordResponse,
    status_code=status.HTTP_200_OK,
    summary="Request Super Admin Password Reset",
    description="Initiates secure single-use password recovery. Returns generic response to prevent email enumeration."
)
async def super_admin_forgot_password(payload: SuperAdminForgotPasswordRequest, request: Request):
    client_ip = request.client.host if request.client else ""

    success, temp_token, masked_email, dev_otp, dev_reset_url, status_code = super_admin_auth_service.forgot_password(
        email=payload.email,
        client_ip=client_ip
    )

    if not success and status_code == 429:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please wait a few minutes before trying again."
        )

    return SuperAdminForgotPasswordResponse(
        status="success",
        message="If an authorized Super Admin account exists with this email, verification instructions have been dispatched.",
        temp_token=temp_token,
        masked_email=masked_email,
        dev_otp=dev_otp,
        dev_reset_url=dev_reset_url
    )


@router.post(
    "/reset-password",
    response_model=SuperAdminStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute Super Admin Password Reset",
    description="Validates single-use token, validates password complexity, updates password, and revokes all active sessions."
)
async def super_admin_reset_password(payload: SuperAdminResetPasswordRequest, request: Request):
    client_ip = request.client.host if request.client else ""

    success, msg, status_code = super_admin_auth_service.reset_password(
        token=payload.token,
        new_password=payload.new_password,
        confirm_password=payload.confirm_password,
        client_ip=client_ip
    )

    if not success:
        raise HTTPException(
            status_code=status_code,
            detail=msg or "Password reset failed."
        )

    return SuperAdminStatusResponse(
        status="success",
        message=msg
    )


@router.get(
    "/me",
    response_model=SuperAdminUserInfo,
    status_code=status.HTTP_200_OK,
    summary="Get Current Super Administrator Profile",
    description="Returns authenticated Super Administrator identity and permissions."
)
async def get_current_super_admin_profile(current_admin: dict = Depends(get_current_super_admin)):
    return SuperAdminUserInfo(
        id=current_admin["id"],
        email=current_admin["email"],
        name=current_admin["name"],
        role=current_admin["role"],
        account_status=current_admin["account_status"],
        permissions=current_admin.get("permissions", ["*"]),
        last_login=current_admin.get("last_login"),
        is_super_admin=True
    )


@router.post(
    "/logout",
    response_model=SuperAdminStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign Out of Super Admin Control Center",
    description="Revokes the active Super Administrator session token."
)
async def super_admin_logout(request: Request, authorization: Optional[str] = Header(None)):
    client_ip = request.client.host if request.client else ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        super_admin_auth_service.revoke_token(token, client_ip=client_ip)

    return SuperAdminStatusResponse(
        status="success",
        message="Successfully signed out of the Super Admin Control Center."
    )
