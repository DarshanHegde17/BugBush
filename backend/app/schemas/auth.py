from pydantic import BaseModel, EmailStr, Field
from typing import Optional


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
