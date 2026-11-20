from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any


# ==============================================================================
# Admin Listing & Item Schemas
# ==============================================================================
class AdminListItem(BaseModel):
    id: str
    email: EmailStr
    name: str
    phone: Optional[str] = None
    role: str = "admin"
    organization_name: Optional[str] = "BugBash Global Assessment Operations"
    description: Optional[str] = None
    profile_image: Optional[str] = None
    account_status: str = "Active"  # Active, Pending Invitation, Suspended, Deactivated
    invitation_status: Optional[str] = None  # Accepted, Pending, Expired, Revoked
    created_at: str
    last_login: Optional[str] = None
    last_activity: Optional[str] = None
    permissions: List[str] = []


class AdminListResponse(BaseModel):
    status: str = "success"
    total: int
    active_count: int
    pending_count: int
    suspended_count: int
    page: int = 1
    limit: int = 20
    admins: List[AdminListItem]


# ==============================================================================
# Admin Creation & Invitation Schemas
# ==============================================================================
class CreateAdminRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full Name of the Administrator")
    email: EmailStr = Field(..., description="Unique email address of the responsible person")
    phone: Optional[str] = Field(None, max_length=25, description="Contact phone number")
    role: Optional[str] = Field("admin", description="Admin role: admin, organization_admin, college_admin, company_admin")
    organization_name: Optional[str] = Field("BugBash Global Assessment Operations", max_length=150)
    description: Optional[str] = Field(None, max_length=500, description="Administrative responsibilities or notes")
    profile_image: Optional[str] = Field(None, description="Optional profile image url or base64")


class CreateAdminResponse(BaseModel):
    status: str = "success"
    message: str
    admin_id: str
    email: str
    invitation_token: str
    invitation_url: str
    dev_otp: Optional[str] = None
    email_delivery_status: str
    admin: AdminListItem


class UpdateAdminRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=25)
    organization_name: Optional[str] = Field(None, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    profile_image: Optional[str] = None


class AdminActivityItem(BaseModel):
    id: str
    event_type: str
    title: str
    details: str
    timestamp: str
    actor: Optional[str] = None
    status: str = "success"


class AdminActivityResponse(BaseModel):
    status: str = "success"
    admin_id: str
    activities: List[AdminActivityItem]


class AdminStatusActionResponse(BaseModel):
    status: str = "success"
    message: str
    admin: Optional[AdminListItem] = None


# ==============================================================================
# Invitation Verification & Activation Schemas
# ==============================================================================
class InvitationDetailsResponse(BaseModel):
    status: str = "success"
    valid: bool
    email: str
    name: str
    organization_name: Optional[str] = None
    role: str
    expires_at: str


class AcceptInvitationRequest(BaseModel):
    token: str = Field(..., min_length=16, description="Cryptographic invitation token")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    password: str = Field(..., min_length=8, description="New strong password")
    confirm_password: str = Field(..., min_length=8, description="Password confirmation")
