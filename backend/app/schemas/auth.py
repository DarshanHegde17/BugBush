from pydantic import BaseModel, EmailStr, Field
from typing import Optional


# ==============================================================================
# Registration & Verification Schemas
# ==============================================================================
class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Full Name of the candidate")
    email: EmailStr = Field(..., description="Unique email address")
    phone_number: str = Field(..., min_length=7, max_length=25, description="Contact phone number")
    password: str = Field(..., min_length=8, description="Account password meeting complexity rules")


class RegisterResponse(BaseModel):
    status: str = "success"
    message: str = "Account created successfully. A 6-digit verification code has been sent to your email."
    email: str
    verification_token: str
    dev_otp: Optional[str] = Field(None, description="Local development OTP helper")


class VerifyEmailRequest(BaseModel):
    verification_token: Optional[str] = Field(None, description="Server-issued registration context token")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    email: Optional[EmailStr] = Field(None, description="Registered email address")


class VerifyEmailResponse(BaseModel):
    status: str = "success"
    message: str = "Email verified successfully! Your account is now active."
    redirect_url: str = "login.html"


class ResendOtpRequest(BaseModel):
    verification_token: Optional[str] = Field(None, description="Server-issued registration context token")
    email: Optional[EmailStr] = Field(None, description="Registered email address")


class ResendOtpResponse(BaseModel):
    status: str = "success"
    message: str = "A new verification code has been dispatched to your email."
    dev_otp: Optional[str] = Field(None, description="Local development OTP helper")


# ==============================================================================
# Forgot & Reset Password Schemas
# ==============================================================================
class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered user email address")


class ForgotPasswordResponse(BaseModel):
    status: str = "success"
    message: str = "If an account exists with this email, a password reset link has been sent."
    dev_reset_url: Optional[str] = Field(None, description="Local development reset link helper")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, description="Cryptographic password reset token")
    new_password: str = Field(..., min_length=8, description="New password meeting entropy requirements")


class ResetPasswordResponse(BaseModel):
    status: str = "success"
    message: str = "Your password has been successfully reset. You can now log in with your new password."


class VerifyResetTokenResponse(BaseModel):
    valid: bool
    reason: Optional[str] = None


# ==============================================================================
# Login Schemas
# ==============================================================================
class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered account email")
    password: str = Field(..., min_length=1, description="Account password")
    remember_me: Optional[bool] = Field(False, description="Remember login session across browser reloads")


class UserBasicInfo(BaseModel):
    id: str
    email: str
    name: str
    phone_number: Optional[str] = None
    role: str = "candidate"
    organization_type: Optional[str] = None
    is_verified: bool = True
    created_at: Optional[str] = None


class LoginResponse(BaseModel):
    status: str = "success"
    access_token: str
    token_type: str = "bearer"
    user: UserBasicInfo
    redirect_url: str = "/user/dashboard"
