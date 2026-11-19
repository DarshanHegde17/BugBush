from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List


# ==============================================================================
# Admin Authentication Schemas
# ==============================================================================
class AdminLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered administrator email address")
    password: str = Field(..., min_length=1, description="Account password")
    remember_me: Optional[bool] = Field(False, description="Persist extended session")


class AdminUserInfo(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    account_status: str = "Active"
    organization_name: Optional[str] = "BugBash Global Assessment Operations"
    permissions: List[str] = []
    last_login: Optional[str] = None


class AdminLoginResponse(BaseModel):
    status: str = "success"
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AdminUserInfo
    redirect_url: str = "/admin/dashboard"


class AdminStatusResponse(BaseModel):
    status: str = "success"
    message: str
