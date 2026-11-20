"""
BugBash - Super Admin System Configuration Schemas
Pydantic models for platform-wide settings, assessment defaults, security policies,
email service settings, integrations, and maintenance mode.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr


class GeneralSettingsSchema(BaseModel):
    platform_name: str = Field(default="BugBash", min_length=2, max_length=100)
    platform_tagline: str = Field(default="Smart Coding. Better Assessment.", min_length=2, max_length=255)
    platform_logo: str = Field(default="/assets/images/bugbash-logo.png", max_length=500)
    support_email: str = Field(default="support@bugbash.com")
    support_phone: Optional[str] = Field(default="+1 (800) 555-0199", max_length=50)
    support_contact_url: Optional[str] = Field(default="https://bugbash.io/support", max_length=500)
    default_timezone: str = Field(default="UTC", max_length=100)
    default_language: str = Field(default="English (US)", max_length=50)
    date_time_format: str = Field(default="YYYY-MM-DD HH:mm:ss", max_length=50)
    default_theme: str = Field(default="system", pattern="^(system|light|dark)$")
    announcement_banner_active: bool = False
    announcement_banner_text: Optional[str] = Field(default="", max_length=1000)


class AssessmentSettingsSchema(BaseModel):
    default_duration_minutes: int = Field(default=60, ge=10, le=360)
    section_timer_behavior: str = Field(default="flexible_total_time", pattern="^(flexible_total_time|strict_per_section|warning_prompts)$")
    allowed_languages: List[str] = Field(default_factory=lambda: ["Python", "JavaScript", "C++", "Java", "C", "Go", "Rust"])
    default_difficulty: str = Field(default="Intermediate", pattern="^(Beginner|Intermediate|Advanced|Expert)$")
    max_questions_per_assessment: int = Field(default=10, ge=1, le=50)
    submission_limits: int = Field(default=5, ge=0, le=50)  # 0 indicates unlimited
    code_execution_time_limit_seconds: float = Field(default=3.0, ge=1.0, le=15.0)
    memory_limit_mb: int = Field(default=256, ge=64, le=1024)
    autosave_interval_seconds: int = Field(default=30, ge=5, le=300)
    result_visibility: str = Field(default="after_assessment_closes", pattern="^(immediate|after_assessment_closes|manual_admin_release|hidden_from_candidate)$")
    default_instructions: str = Field(
        default="1. Read all instructions carefully before writing your solutions.\n2. Ensure your code passes all visible sample test cases.\n3. Do not navigate away from the fullscreen examination environment.",
        max_length=5000
    )


class SecuritySettingsSchema(BaseModel):
    min_password_length: int = Field(default=8, ge=8, le=64)
    require_uppercase: bool = True
    require_lowercase: bool = True
    require_numbers: bool = True
    require_special_characters: bool = True
    login_attempt_limit: int = Field(default=5, ge=3, le=20)
    account_lockout_duration_minutes: int = Field(default=15, ge=5, le=1440)
    otp_expiration_minutes: int = Field(default=10, ge=2, le=60)
    otp_resend_limit_per_hour: int = Field(default=3, ge=1, le=10)
    session_expiration_hours: int = Field(default=24, ge=1, le=720)
    refresh_token_rotation: bool = True
    mfa_requirement: str = Field(default="optional", pattern="^(optional|required_for_admins|required_all)$")
    allowed_login_methods: List[str] = Field(default_factory=lambda: ["email_password", "google_oauth"])
    session_revocation_policy: str = Field(default="revoke_all_on_password_reset", pattern="^(revoke_all_on_password_reset|preserve_active_sessions)$")


class EmailSettingsSchema(BaseModel):
    smtp_host: str = Field(default="smtp.gmail.com")
    smtp_port: int = Field(default=587, ge=1, le=65535)
    sender_email: str = Field(default="no-reply@bugbash.com")
    sender_name: str = Field(default="BugBash Security")
    encryption_method: str = Field(default="TLS", pattern="^(TLS|SSL|None)$")
    smtp_user: Optional[str] = ""
    smtp_password: Optional[str] = None  # Masked in response, provided when updating
    has_password: bool = False
    is_configured: bool = False


class EmailTestRequest(BaseModel):
    recipient_email: EmailStr


class MaintenanceSettingsSchema(BaseModel):
    is_enabled: bool = False
    message: str = Field(default="BugBash is currently undergoing scheduled platform upgrades. We will be back online shortly.", max_length=1000)
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    exempt_routes: List[str] = Field(default_factory=lambda: [
        "/super-admin",
        "/api/v1/super-admin",
        "/api/health",
        "/assets",
        "/css",
        "/js"
    ])
    status: str = "Inactive"  # "Active", "Inactive", "Scheduled"


class IntegrationItem(BaseModel):
    id: str
    name: str
    category: str
    status: str  # "Connected", "Degraded", "Disconnected", "Unconfigured"
    latency_ms: Optional[float] = 0.0
    last_health_check: str
    details: str
    is_testable: bool = True
    config_summary: Dict[str, Any] = Field(default_factory=dict)


class SystemConfigurationResponse(BaseModel):
    status: str = "success"
    general: GeneralSettingsSchema
    assessment: AssessmentSettingsSchema
    security: SecuritySettingsSchema
    email: EmailSettingsSchema
    maintenance: MaintenanceSettingsSchema
    updated_at: str


class ConfigAuditLogItem(BaseModel):
    id: str
    timestamp: str
    actor: str
    category: str
    action: str
    details: str
    changes: Optional[Dict[str, Any]] = None


class ConfigActionResponse(BaseModel):
    status: str = "success"
    message: str
    details: Optional[Dict[str, Any]] = None
