import os
import asyncio
from fastapi import APIRouter, HTTPException, Request, status, Query
from backend.app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
    ResendOtpRequest,
    ResendOtpResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    VerifyResetTokenResponse,
    LoginRequest,
    LoginResponse,
    UserBasicInfo
)
from backend.app.services.password_reset_service import password_reset_service
from backend.app.services.user_service import user_service
from backend.app.services.email_service import email_service

router = APIRouter()

IS_DEV = os.environ.get("ENVIRONMENT", "development").lower() in ("development", "test", "local")


# ==============================================================================
# 1. Candidate Registration & OTP Email Verification Endpoints
# ==============================================================================
@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new individual candidate account",
    description="Registers an individual candidate with full name, email, phone number, and password. Issues a 6-digit OTP."
)
async def register_user(payload: RegisterRequest):
    success, user_record, token, otp, err_msg = user_service.register_user(
        full_name=payload.full_name,
        email=payload.email,
        phone_number=payload.phone_number,
        password=payload.password
    )

    if not success:
        # Determine whether it's a conflict (duplicate email) or validation failure
        if "already exists" in (err_msg or "").lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=err_msg or "Invalid registration information."
        )

    # Dispatch real email via SMTP if configured
    asyncio.create_task(email_service.send_otp_email(
        to_email=user_record["email"],
        otp_code=otp,
        candidate_name=payload.full_name
    ))

    return RegisterResponse(
        status="success",
        message="Account created successfully. A 6-digit verification code has been sent to your email.",
        email=user_record["email"],
        verification_token=token,
        dev_otp=otp if IS_DEV else None
    )


@router.post(
    "/verify-email",
    response_model=VerifyEmailResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify candidate email using 6-digit OTP",
    description="Verifies the OTP sent during registration and activates the user account."
)
async def verify_email(payload: VerifyEmailRequest):
    success, err_msg = user_service.verify_email_otp(
        token=payload.verification_token,
        otp=payload.otp,
        email=payload.email
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg or "Verification failed."
        )

    return VerifyEmailResponse(
        status="success",
        message="Email verified successfully! Your account is now active.",
        redirect_url="login.html"
    )


@router.post(
    "/resend-otp",
    response_model=ResendOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend verification OTP",
    description="Generates and dispatches a fresh 6-digit OTP subject to rate limit cooldowns."
)
async def resend_otp(payload: ResendOtpRequest):
    success, new_otp, err_msg = user_service.resend_otp(
        token=payload.verification_token,
        email=payload.email
    )

    if not success:
        if "wait" in (err_msg or "").lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg or "Unable to resend verification code."
        )

    target_email = payload.email
    if not target_email and payload.verification_token:
        otp_rec = user_service._otps.get(payload.verification_token)
        if otp_rec:
            target_email = otp_rec.get("email")

    if target_email:
        asyncio.create_task(email_service.send_otp_email(
            to_email=target_email,
            otp_code=new_otp,
            candidate_name="Candidate"
        ))

    return ResendOtpResponse(
        status="success",
        message="A new verification code has been dispatched to your email.",
        dev_otp=new_otp if IS_DEV else None
    )


@router.get(
    "/dev-otp",
    include_in_schema=False,
    summary="Get pending OTP for development helper"
)
async def get_dev_otp(email: str = Query(...)):
    """Provides the active OTP in development mode so candidates can verify without active SMTP."""
    if not IS_DEV:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Disabled in production.")
    clean_email = email.strip().lower()
    tok = user_service._email_to_token.get(clean_email)
    if tok and tok in user_service._otps:
        return {"dev_otp": user_service._otps[tok]["otp"]}
    from backend.app.database.mongodb import mongodb
    if mongodb.otps is not None:
        rec = mongodb.otps.find_one({"email": clean_email})
        if rec and "otp" in rec:
            return {"dev_otp": rec["otp"]}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active OTP found for this email.")


# ==============================================================================
# 2. Candidate Login & Authentication
# ==============================================================================
@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign in to BugBash candidate workspace",
    description="Authenticates candidate credentials and issues an HMAC-SHA256 Bearer JWT session token."
)
async def login_user(payload: LoginRequest):
    success, user, err_msg = user_service.authenticate_user(
        email=payload.email,
        password=payload.password
    )

    if not success:
        # Check if unverified
        if user and not user.get("is_verified", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=err_msg or "Your email has not been verified yet. Please complete verification."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_msg or "Invalid email or password."
        )

    # Issue JWT token
    token = user_service.create_access_token(user, remember_me=payload.remember_me or False)

    created_at_val = user.get("created_at")
    created_str = created_at_val.isoformat() if hasattr(created_at_val, "isoformat") else str(created_at_val or "")

    return LoginResponse(
        status="success",
        access_token=token,
        token_type="bearer",
        user=UserBasicInfo(
            id=user.get("id", user["email"]),
            email=user["email"],
            name=user.get("full_name", "Candidate"),
            phone_number=user.get("phone_number"),
            role=user.get("role", "candidate"),
            organization_type=user.get("organization_type"),
            is_verified=user.get("is_verified", True),
            created_at=created_str
        ),
        redirect_url="/user/dashboard"
    )


# ==============================================================================
# 3. Password Recovery Endpoints
# ==============================================================================
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

    response_data = {
        "status": "success",
        "message": "If an account exists with this email, a password reset link has been sent."
    }

    reset_url = f"http://127.0.0.1:8000/reset-password.html?token={raw_token}"
    asyncio.create_task(email_service.send_password_reset_email(
        to_email=payload.email,
        reset_url=reset_url,
        user_name="Candidate"
    ))

    if IS_DEV:
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
