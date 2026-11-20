"""
BugBash - Super Admin System Configuration Router
Exposes platform-wide settings, default assessment configurations, security policies,
email service integration, real-time health checks, and maintenance mode controls.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Query, status

from backend.app.routers.super_admin_auth import get_current_super_admin
from backend.app.services.super_admin_config_service import super_admin_config_service
from backend.app.schemas.super_admin_config import (
    GeneralSettingsSchema,
    AssessmentSettingsSchema,
    SecuritySettingsSchema,
    EmailSettingsSchema,
    EmailTestRequest,
    MaintenanceSettingsSchema,
    IntegrationItem,
    SystemConfigurationResponse,
    ConfigAuditLogItem,
    ConfigActionResponse
)

config_router = APIRouter()
integrations_router = APIRouter()
public_config_router = APIRouter()


# ==============================================================================
# 1. Main Unified Configuration
# ==============================================================================
@config_router.get(
    "",
    response_model=SystemConfigurationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Full System Configuration",
    description="Retrieves platform information, assessment defaults, security policies, masked email settings, and maintenance status."
)
async def get_configuration(current_super_admin: dict = Depends(get_current_super_admin)):
    return super_admin_config_service.get_unified_configuration()


# ==============================================================================
# 2. General Settings
# ==============================================================================
@config_router.put(
    "/general",
    response_model=GeneralSettingsSchema,
    status_code=status.HTTP_200_OK,
    summary="Update General Platform Settings",
    description="Updates platform name, tagline, branding, logo, support contact, and time/date preferences."
)
async def update_general_settings(
    payload: GeneralSettingsSchema,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email") or "superadmin@bugbash.com"
    return super_admin_config_service.update_general_settings(payload, actor_email=actor)


# ==============================================================================
# 3. Assessment Defaults
# ==============================================================================
@config_router.put(
    "/assessment",
    response_model=AssessmentSettingsSchema,
    status_code=status.HTTP_200_OK,
    summary="Update Default Assessment Configuration",
    description="Updates platform-wide default durations, execution limits, memory bounds, allowed languages, and candidate instructions."
)
async def update_assessment_settings(
    payload: AssessmentSettingsSchema,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email") or "superadmin@bugbash.com"
    return super_admin_config_service.update_assessment_settings(payload, actor_email=actor)


# ==============================================================================
# 4. Security Policies
# ==============================================================================
@config_router.put(
    "/security",
    response_model=SecuritySettingsSchema,
    status_code=status.HTTP_200_OK,
    summary="Update Platform Security Policies",
    description="Configures password complexity, login lockout thresholds, OTP expiration, session lifespans, and MFA rules."
)
async def update_security_settings(
    payload: SecuritySettingsSchema,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email") or "superadmin@bugbash.com"
    return super_admin_config_service.update_security_settings(payload, actor_email=actor)


# ==============================================================================
# 5. Email Configuration & Test Email
# ==============================================================================
@config_router.get(
    "/email",
    response_model=EmailSettingsSchema,
    status_code=status.HTTP_200_OK,
    summary="Get Email Service Settings",
    description="Returns current SMTP credentials with the password masked."
)
async def get_email_settings(current_super_admin: dict = Depends(get_current_super_admin)):
    return super_admin_config_service.get_email_settings()


@config_router.put(
    "/email",
    response_model=EmailSettingsSchema,
    status_code=status.HTTP_200_OK,
    summary="Update Email Service Settings",
    description="Configures SMTP host, port, security, and sender details without exposing or overwriting masked credentials."
)
async def update_email_settings(
    payload: EmailSettingsSchema,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email") or "superadmin@bugbash.com"
    return super_admin_config_service.update_email_settings(payload, actor_email=actor)


@config_router.post(
    "/email/test",
    response_model=ConfigActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Send SMTP Diagnostic Test Email",
    description="Attempts live delivery of a test email message to the specified recipient and reports real provider results."
)
async def test_email_configuration(
    payload: EmailTestRequest,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email") or "superadmin@bugbash.com"
    return await super_admin_config_service.test_email_dispatch(payload.recipient_email, actor_email=actor)


# ==============================================================================
# 6. Maintenance Mode
# ==============================================================================
@config_router.get(
    "/maintenance",
    response_model=MaintenanceSettingsSchema,
    status_code=status.HTTP_200_OK,
    summary="Get Platform Maintenance Status",
    description="Returns whether maintenance mode is active, scheduling windows, and emergency bypass routes."
)
async def get_maintenance_settings(current_super_admin: dict = Depends(get_current_super_admin)):
    return super_admin_config_service.get_maintenance_settings()


@config_router.put(
    "/maintenance",
    response_model=MaintenanceSettingsSchema,
    status_code=status.HTTP_200_OK,
    summary="Toggle / Update Maintenance Mode",
    description="Activates or deactivates platform maintenance mode with broadcast notifications."
)
async def update_maintenance_settings(
    payload: MaintenanceSettingsSchema,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email") or "superadmin@bugbash.com"
    return super_admin_config_service.update_maintenance_settings(payload, actor_email=actor)


# ==============================================================================
# 7. Audit History
# ==============================================================================
@config_router.get(
    "/audit",
    response_model=List[ConfigAuditLogItem],
    status_code=status.HTTP_200_OK,
    summary="Get Configuration Change Audit Trail",
    description="Returns chronological history of configuration changes with secrets redacted."
)
async def get_configuration_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    return super_admin_config_service.get_audit_logs(limit=limit)


# ==============================================================================
# 8. Integrations & Live Health Checks
# ==============================================================================
@integrations_router.get(
    "",
    response_model=List[IntegrationItem],
    status_code=status.HTTP_200_OK,
    summary="List External Service Integrations",
    description="Performs live connection checks across database, sandbox, mail gateway, AI models, and caching brokers."
)
async def get_integrations(current_super_admin: dict = Depends(get_current_super_admin)):
    return super_admin_config_service.get_all_integrations()


@integrations_router.post(
    "/{integration_id}/test",
    response_model=ConfigActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Test Connection to Specific Service Integration",
    description="Runs real on-demand diagnostic test on the requested service (e.g., MongoDB, Sandbox, SMTP, AST)."
)
async def test_integration(
    integration_id: str,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email") or "superadmin@bugbash.com"
    return super_admin_config_service.test_specific_integration(integration_id, actor_email=actor)


# ==============================================================================
# 9. Public Maintenance Status
# ==============================================================================
@public_config_router.get(
    "/maintenance-status",
    status_code=status.HTTP_200_OK,
    summary="Get Public Maintenance Status",
    description="Unauthenticated status endpoint used by frontend single-page routing and candidate apps."
)
async def get_public_maintenance_status():
    return super_admin_config_service.get_public_maintenance_status()
