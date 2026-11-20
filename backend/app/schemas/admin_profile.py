"""
BugBash - Enterprise Admin Profile & Settings Schemas
Pydantic schemas for administrator personal profile, password security,
active device sessions, audit security activity, appearance preferences,
and personal notification settings.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ==============================================================================
# 1. Administrator Profile Models
# ==============================================================================
class AdminProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone_number: Optional[str] = None
    role: str
    permissions: List[str] = Field(default_factory=list)
    account_status: str = "Active"
    is_verified: bool = True
    profile_picture: Optional[str] = None
    organization_name: Optional[str] = None
    created_at: Optional[str] = None
    last_login: Optional[str] = None
    last_password_change: Optional[str] = None


class UpdateAdminProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100, description="Full administrator name")
    phone_number: Optional[str] = Field(None, max_length=25, description="Administrative contact phone number")
    bio: Optional[str] = Field(None, max_length=300, description="Optional profile bio or department notes")


class AdminProfilePhotoRequest(BaseModel):
    photo_data: str = Field(..., description="Base64 encoded image string or safe data URI")


# ==============================================================================
# 2. Password Security Models
# ==============================================================================
class AdminChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Current administrator password for verification")
    new_password: str = Field(..., min_length=8, description="New password complying with complexity policy")
    confirm_password: str = Field(..., min_length=8, description="Matching password confirmation")
    revoke_other_sessions: bool = Field(False, description="Whether to revoke all other active sessions")


# ==============================================================================
# 3. Active Sessions & Security Telemetry
# ==============================================================================
class AdminSessionItem(BaseModel):
    session_id: str
    device: str
    browser: str
    ip_address: str
    location: str
    login_time: str
    last_activity: str
    is_current: bool = False


class AdminSessionsResponse(BaseModel):
    sessions: List[AdminSessionItem] = Field(default_factory=list)
    total_active: int = 0


class AdminSecurityActivityItem(BaseModel):
    event_id: str
    event_type: str
    description: str
    ip_address: str
    timestamp: str
    status: str = "success"  # success, warning, alert


class AdminSecurityActivityResponse(BaseModel):
    two_factor_enabled: bool = False
    password_last_changed: Optional[str] = None
    recent_activity: List[AdminSecurityActivityItem] = Field(default_factory=list)


# ==============================================================================
# 4. Appearance & Dashboard Preferences
# ==============================================================================
class AdminPreferencesModel(BaseModel):
    theme: str = Field("dark", description="Visual theme: dark, light, or system")
    language: str = Field("en", description="Interface language code: en, es, fr, de, hi")
    timezone: str = Field("UTC", description="Display timezone identifier")
    date_format: str = Field("MMM DD, YYYY", description="Date presentation format")
    default_view: str = Field("overview", description="Default dashboard tab on login")
    table_page_size: int = Field(20, description="Default pagination size: 10, 20, 50, 100")


# ==============================================================================
# 5. Personal Notification Preferences
# ==============================================================================
class AdminNotificationPreferencesModel(BaseModel):
    assessment_updates: bool = Field(True, description="Alerts when assessments are created or published")
    candidate_activity: bool = Field(True, description="Alerts on new candidate enrollments")
    submission_updates: bool = Field(True, description="Alerts when coding submissions are received")
    result_publication: bool = Field(True, description="Alerts when evaluation scorecards are finalized")
    ml_evaluation_updates: bool = Field(True, description="Alerts when ML models complete code analysis")
    security_alerts: bool = Field(True, description="Critical security alerts (always enforced True)")
    system_announcements: bool = Field(True, description="Platform infrastructure and maintenance alerts")
    in_app: bool = Field(True, description="Receive personal notifications in-app")
    email: bool = Field(True, description="Receive personal notification emails")
