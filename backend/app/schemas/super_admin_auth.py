from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List


# ==============================================================================
# Super Admin Authentication Schemas
# ==============================================================================
class SuperAdminLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered Super Administrator email address")
    password: str = Field(..., min_length=1, description="Account password")
    remember_me: Optional[bool] = Field(False, description="Persist extended session duration")
    require_mfa: Optional[bool] = Field(None, description="Explicit MFA challenge request")


class SuperAdminUserInfo(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str = "super_admin"
    account_status: str = "Active"
    permissions: List[str] = ["*"]
    last_login: Optional[str] = None
    is_super_admin: bool = True


class SuperAdminLoginResponse(BaseModel):
    status: str = "success"
    require_otp: bool = False
    temp_token: Optional[str] = None
    masked_email: Optional[str] = None
    access_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    user: Optional[SuperAdminUserInfo] = None
    redirect_url: str = "/super-admin/dashboard"
    message: Optional[str] = None


class SuperAdminVerifyOtpRequest(BaseModel):
    email: Optional[EmailStr] = Field(None, description="Registered email address")
    temp_token: Optional[str] = Field(None, description="Pre-authentication context token")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    remember_device: Optional[bool] = Field(False, description="Remember this device")


class SuperAdminResendOtpRequest(BaseModel):
    email: Optional[EmailStr] = Field(None, description="Registered email address")
    temp_token: Optional[str] = Field(None, description="Pre-authentication context token")


class SuperAdminOtpResponse(BaseModel):
    status: str = "success"
    message: str
    access_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    user: Optional[SuperAdminUserInfo] = None
    redirect_url: Optional[str] = "/super-admin/dashboard"
    dev_otp: Optional[str] = None


class SuperAdminForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered Super Administrator email address")


class SuperAdminForgotPasswordResponse(BaseModel):
    status: str = "success"
    message: str = "If an authorized Super Admin account exists with this email, verification instructions have been dispatched."
    temp_token: Optional[str] = None
    masked_email: Optional[str] = None
    dev_otp: Optional[str] = None
    dev_reset_url: Optional[str] = None


class SuperAdminVerifyResetOtpRequest(BaseModel):
    email: Optional[EmailStr] = None
    temp_token: Optional[str] = None
    otp: str = Field(..., min_length=6, max_length=6)


class SuperAdminResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, description="Cryptographic single-use password reset token")
    new_password: str = Field(..., min_length=1, description="New strong password")
    confirm_password: str = Field(..., min_length=1, description="Confirmation password matching new_password")


class SuperAdminStatusResponse(BaseModel):
    status: str = "success"
    message: str
