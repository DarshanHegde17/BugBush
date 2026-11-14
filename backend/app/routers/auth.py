import os
from fastapi import APIRouter, HTTPException, Request, status, Query
from backend.app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    VerifyResetTokenResponse
)
from backend.app.services.password_reset_service import password_reset_service

router = APIRouter()

IS_DEV = os.environ.get("ENVIRONMENT", "development").lower() in ("development", "test", "local")


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_200_OK,
    summary="Request a password reset link",
    description="Initiates password recovery. Always returns a generic response to prevent email enumeration."
)
async def forgot_password(payload: ForgotPasswordRequest, request: Request):
    client_ip = request.client.host if request.client else ""
    
    # Check rate limit upfront
    if password_reset_service.is_rate_limited(payload.email) or (client_ip and password_reset_service.is_rate_limited(client_ip)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please wait 15 minutes before requesting again."
        )

    # Issue secure reset token (stored as SHA-256 hash)
    raw_token = password_reset_service.create_reset_token(payload.email, client_ip=client_ip)
    
    if raw_token is None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please wait a few minutes before trying again."
        )

    # In local development mode, we can optionally attach the reset link for direct UI testing
    response_data = {
        "status": "success",
        "message": "If an account exists with this email, a password reset link has been sent."
    }

    # If in local dev environment and requested or needed for local browser simulation:
    if IS_DEV:
        # Provide dev helper URL so developer can click directly without an SMTP mail server
        response_data["dev_reset_url"] = f"/reset-password.html?token={raw_token}"

    return response_data


@router.get(
    "/verify-reset-token",
    response_model=VerifyResetTokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify reset token validity",
    description="Checks whether a given reset token is valid, unexpired, and not yet used."
)
async def verify_reset_token(token: str = Query(..., min_length=16, description="Reset token")):
    is_valid, email, reason = password_reset_service.verify_reset_token(token)
    return VerifyResetTokenResponse(valid=is_valid, reason=reason)


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset account password",
    description="Updates password using a single-use token. Destroys the token upon success."
)
async def reset_password(payload: ResetPasswordRequest):
    # Validate complexity first
    is_complex, complexity_msg = password_reset_service.validate_password_complexity(payload.new_password)
    if not is_complex:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=complexity_msg or "Password does not meet complexity requirements."
        )

    # Attempt reset
    success, message = password_reset_service.reset_password(payload.token, payload.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    return ResetPasswordResponse(
        status="success",
        message="Your password has been successfully reset. You can now log in with your new password."
    )

