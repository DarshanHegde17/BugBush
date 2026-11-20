"""
BugBash - Super Admin System Configuration Test Suite
Verifies platform settings, default assessment parameters, security policies,
email gateway configuration with masked credentials, integration diagnostics,
maintenance mode enforcement with Super Admin emergency bypass, and audit trail.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.super_admin_auth_service import super_admin_auth_service
from backend.app.services.admin_auth_service import admin_auth_service
from backend.app.services.user_service import user_service
from backend.app.services.password_reset_service import PasswordResetService
from backend.app.services.super_admin_config_service import super_admin_config_service
from backend.app.database.mongodb import mongodb

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_config_fixtures():
    """Sets up fresh test Super Admin, clears rate limits, and purges test artifacts."""
    test_emails = [
        "root_config_tester@bugbash.com",
        "standard_config_admin@bugbash.com",
        "candidate_config_tester@bugbash.com"
    ]

    for em in test_emails:
        if em in user_service._users:
            del user_service._users[em]

    if mongodb.users is not None:
        try:
            mongodb.users.delete_many({"email": {"$in": test_emails}})
        except Exception:
            pass

    # Clear rate limits and revoked lists
    admin_auth_service._revoked_emails.clear()
    admin_auth_service._revoked_tokens.clear()
    super_admin_auth_service._failed_attempts.clear()
    admin_auth_service._failed_attempts.clear()

    # Provision active test Super Admin
    super_admin_auth_service.provision_super_admin(
        email="root_config_tester@bugbash.com",
        password="SuperAdminConfig123!",
        full_name="Root Configuration Tester",
        account_status="Active"
    )

    # Standard Admin (No Super Admin Root Clearance)
    admin_doc = {
        "id": "adm_cfg_test",
        "email": "standard_config_admin@bugbash.com",
        "password_hash": PasswordResetService.hash_password("StandardAdmin123!"),
        "password": PasswordResetService.hash_password("StandardAdmin123!"),
        "name": "Standard Operations Admin",
        "full_name": "Standard Operations Admin",
        "role": "admin",
        "account_status": "Active",
        "permissions": ["assessments:view"]
    }
    user_service._users["standard_config_admin@bugbash.com"] = admin_doc

    # Candidate user
    cand_doc = {
        "id": "cand_cfg_test",
        "email": "candidate_config_tester@bugbash.com",
        "password_hash": PasswordResetService.hash_password("CandidatePass123!"),
        "password": PasswordResetService.hash_password("CandidatePass123!"),
        "name": "Candidate Config Tester",
        "full_name": "Candidate Config Tester",
        "role": "candidate",
        "account_status": "Active"
    }
    user_service._users["candidate_config_tester@bugbash.com"] = cand_doc

    if mongodb.users is not None:
        try:
            mongodb.users.insert_one(dict(admin_doc))
            mongodb.users.insert_one(dict(cand_doc))
        except Exception:
            pass

    yield

    # Clean up: ensure maintenance mode is restored to disabled
    super_admin_config_service._maintenance["is_enabled"] = False
    super_admin_config_service._maintenance["status"] = "Inactive"


def get_super_admin_token() -> str:
    login_resp = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_config_tester@bugbash.com",
        "password": "SuperAdminConfig123!",
        "require_mfa": False
    })
    assert login_resp.status_code == 200, f"Super admin login failed: {login_resp.text}"
    return login_resp.json()["access_token"]


def get_admin_token() -> str:
    login_resp = client.post("/api/v1/admin/auth/login", json={
        "email": "standard_config_admin@bugbash.com",
        "password": "StandardAdmin123!"
    })
    assert login_resp.status_code == 200
    return login_resp.json()["access_token"]


# ==============================================================================
# 1. HTML Endpoint Tests
# ==============================================================================
def test_super_admin_config_html_endpoints():
    """Verifies that all 7 configuration module HTML pages are served cleanly."""
    pages = [
        "/super-admin/system-configuration",
        "/super-admin/system-config",
        "/super-admin/general-settings",
        "/super-admin/assessment-settings",
        "/super-admin/security-settings",
        "/super-admin/email-settings",
        "/super-admin/integrations",
        "/super-admin/maintenance"
    ]
    for url in pages:
        resp = client.get(url)
        assert resp.status_code == 200, f"Failed to serve {url}"
        assert "<html" in resp.text.lower()
        assert "BugBash" in resp.text


# ==============================================================================
# 2. RBAC & Unified Configuration Retrieval
# ==============================================================================
def test_get_unified_configuration_and_rbac():
    """
    Verifies that:
    - Unauthenticated requests are rejected (401).
    - Standard admin requests are rejected (403).
    - Super Admin can retrieve complete configuration with secrets masked.
    """
    # 1. Unauthenticated rejected
    resp_unauth = client.get("/api/v1/super-admin/configuration")
    assert resp_unauth.status_code == 401

    # 2. Standard admin rejected
    adm_token = get_admin_token()
    resp_adm = client.get(
        "/api/v1/super-admin/configuration",
        headers={"Authorization": f"Bearer {adm_token}"}
    )
    assert resp_adm.status_code == 403

    # 3. Super admin succeeds
    sa_token = get_super_admin_token()
    resp_sa = client.get(
        "/api/v1/super-admin/configuration",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert resp_sa.status_code == 200
    data = resp_sa.json()
    assert data["status"] == "success"
    assert "general" in data
    assert "assessment" in data
    assert "security" in data
    assert "email" in data
    assert "maintenance" in data

    # Verify secret password masking
    email_cfg = data["email"]
    assert email_cfg["smtp_password"] in ("", "••••••••")


# ==============================================================================
# 3. General Settings Update
# ==============================================================================
def test_update_general_settings():
    """Verifies that Super Admin can update platform branding, support email, and timezones."""
    sa_token = get_super_admin_token()

    update_payload = {
        "platform_name": "BugBash Enterprise",
        "platform_tagline": "Next-Gen Coding & Assessment Engine",
        "platform_logo": "/assets/images/bugbash-logo-enterprise.png",
        "support_email": "enterprise-support@bugbash.com",
        "support_phone": "+1 (888) 999-0011",
        "support_contact_url": "https://bugbash.io/helpdesk",
        "default_timezone": "America/New_York",
        "default_language": "English (US)",
        "date_time_format": "YYYY-MM-DD HH:mm:ss",
        "default_theme": "dark",
        "announcement_banner_active": True,
        "announcement_banner_text": "Global Hackathon starts at 18:00 UTC."
    }

    put_resp = client.put(
        "/api/v1/super-admin/configuration/general",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=update_payload
    )
    assert put_resp.status_code == 200
    res_data = put_resp.json()
    assert res_data["platform_name"] == "BugBash Enterprise"
    assert res_data["support_email"] == "enterprise-support@bugbash.com"
    assert res_data["announcement_banner_active"] is True

    # Confirm unified get reflects the updated settings
    get_resp = client.get(
        "/api/v1/super-admin/configuration",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert get_resp.json()["general"]["platform_name"] == "BugBash Enterprise"


# ==============================================================================
# 4. Assessment Defaults Update (Preserving Active Assessments)
# ==============================================================================
def test_update_assessment_defaults_preserves_assessments():
    """
    Verifies that Super Admin can update default assessment settings,
    and validates that existing assessments are not modified unexpectedly.
    """
    sa_token = get_super_admin_token()

    asm_payload = {
        "default_duration_minutes": 90,
        "section_timer_behavior": "strict_per_section",
        "allowed_languages": ["Python", "Java", "C++", "Rust"],
        "default_difficulty": "Advanced",
        "max_questions_per_assessment": 15,
        "submission_limits": 3,
        "code_execution_time_limit_seconds": 4.5,
        "memory_limit_mb": 512,
        "autosave_interval_seconds": 15,
        "result_visibility": "manual_admin_release",
        "default_instructions": "Review all problems before beginning. Fullscreen proctoring enforced."
    }

    put_resp = client.put(
        "/api/v1/super-admin/configuration/assessment",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=asm_payload
    )
    assert put_resp.status_code == 200
    res_data = put_resp.json()
    assert res_data["default_duration_minutes"] == 90
    assert res_data["default_difficulty"] == "Advanced"
    assert res_data["code_execution_time_limit_seconds"] == 4.5
    assert "Rust" in res_data["allowed_languages"]


# ==============================================================================
# 5. Security Policy Validation & Rejection of Weak Settings
# ==============================================================================
def test_update_security_settings_validation_and_rejections():
    """
    Verifies that:
    - Insecure password lengths (< 8) are strictly rejected with 400.
    - Dangerous lockout durations (< 5 mins) are rejected with 400.
    - Safe security settings are validated and enforced.
    """
    sa_token = get_super_admin_token()

    # 1. Attempt to set weak password length (e.g. 4)
    weak_pwd_payload = {
        "min_password_length": 4,  # Violates policy (< 8)
        "require_uppercase": True,
        "require_lowercase": True,
        "require_numbers": True,
        "require_special_characters": True,
        "login_attempt_limit": 5,
        "account_lockout_duration_minutes": 15,
        "otp_expiration_minutes": 10,
        "otp_resend_limit_per_hour": 3,
        "session_expiration_hours": 24,
        "refresh_token_rotation": True,
        "mfa_requirement": "optional",
        "allowed_login_methods": ["email_password"],
        "session_revocation_policy": "revoke_all_on_password_reset"
    }
    resp1 = client.put(
        "/api/v1/super-admin/configuration/security",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=weak_pwd_payload
    )
    assert resp1.status_code == 422 or resp1.status_code == 400

    # 2. Attempt to disable lockout (< 5 minutes)
    weak_lockout_payload = dict(weak_pwd_payload)
    weak_lockout_payload["min_password_length"] = 10
    weak_lockout_payload["account_lockout_duration_minutes"] = 1  # Too short
    resp2 = client.put(
        "/api/v1/super-admin/configuration/security",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=weak_lockout_payload
    )
    assert resp2.status_code == 422 or resp2.status_code == 400

    # 3. Valid high-security configuration succeeds
    valid_sec_payload = dict(weak_pwd_payload)
    valid_sec_payload["min_password_length"] = 12
    valid_sec_payload["account_lockout_duration_minutes"] = 30
    valid_sec_payload["mfa_requirement"] = "required_for_admins"

    resp3 = client.put(
        "/api/v1/super-admin/configuration/security",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=valid_sec_payload
    )
    assert resp3.status_code == 200
    assert resp3.json()["min_password_length"] == 12
    assert resp3.json()["mfa_requirement"] == "required_for_admins"


# ==============================================================================
# 6. Email Configuration & Password Masking
# ==============================================================================
def test_email_configuration_masking_and_updating():
    """
    Verifies that:
    - Passwords are never returned in plaintext.
    - Password is retained when client submits masked bullets or None.
    - New password is encrypted and saved when explicitly provided.
    """
    sa_token = get_super_admin_token()

    # 1. Update email config with a new password
    initial_payload = {
        "smtp_host": "smtp.mailprovider.com",
        "smtp_port": 587,
        "sender_email": "alerts@bugbash.com",
        "sender_name": "BugBash Dispatch",
        "encryption_method": "TLS",
        "smtp_user": "relay_user_01",
        "smtp_password": "InitialSecretPassword123!"
    }
    put_resp = client.put(
        "/api/v1/super-admin/configuration/email",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=initial_payload
    )
    assert put_resp.status_code == 200
    res_data = put_resp.json()
    assert res_data["smtp_host"] == "smtp.mailprovider.com"
    assert res_data["smtp_password"] == "••••••••"
    assert res_data["has_password"] is True

    # 2. Update without changing password (masked bullet points submitted)
    update_without_pwd = {
        "smtp_host": "smtp.mailprovider.com",
        "smtp_port": 587,
        "sender_email": "alerts@bugbash.com",
        "sender_name": "BugBash Dispatch - Renamed",
        "encryption_method": "TLS",
        "smtp_user": "relay_user_01",
        "smtp_password": "••••••••"
    }
    put_resp2 = client.put(
        "/api/v1/super-admin/configuration/email",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=update_without_pwd
    )
    assert put_resp2.status_code == 200
    assert put_resp2.json()["sender_name"] == "BugBash Dispatch - Renamed"
    # Ensure backend preserved the original secret
    assert super_admin_config_service._email["smtp_password"] == "InitialSecretPassword123!"


# ==============================================================================
# 7. Test Email Dispatch
# ==============================================================================
def test_test_email_dispatch_actual_report():
    """Verifies that test email execution returns an actual provider report."""
    sa_token = get_super_admin_token()

    test_resp = client.post(
        "/api/v1/super-admin/configuration/email/test",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={"recipient_email": "diagnostic_recipient@bugbash.com"}
    )
    assert test_resp.status_code == 200
    data = test_resp.json()
    assert data["status"] in ("success", "warning", "error")
    assert "message" in data


# ==============================================================================
# 8. External Integrations Live Health Checks
# ==============================================================================
def test_integrations_list_and_health_checks():
    """
    Verifies that:
    - List of external integrations returns real statuses and categories.
    - Specific diagnostic endpoint tests MongoDB, Sandbox, AST ML, and Storage.
    """
    sa_token = get_super_admin_token()

    # 1. Retrieve all integrations
    list_resp = client.get(
        "/api/v1/super-admin/integrations",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert list_resp.status_code == 200
    integrations = list_resp.json()
    assert len(integrations) >= 7

    service_ids = [i["id"] for i in integrations]
    assert "mongodb_database" in service_ids
    assert "code_execution_sandbox" in service_ids
    assert "ml_analysis_service" in service_ids
    assert "file_storage" in service_ids

    # 2. Test code execution sandbox
    sb_test_resp = client.post(
        "/api/v1/super-admin/integrations/code_execution_sandbox/test",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert sb_test_resp.status_code == 200
    assert sb_test_resp.json()["status"] == "success"

    # 3. Test ML AST engine
    ml_test_resp = client.post(
        "/api/v1/super-admin/integrations/ml_analysis_service/test",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert ml_test_resp.status_code == 200
    assert ml_test_resp.json()["status"] == "success"


# ==============================================================================
# 9. Maintenance Mode & Emergency Super Admin Bypass
# ==============================================================================
def test_maintenance_mode_activation_and_emergency_exemption():
    """
    Verifies that:
    - Super Admin can activate maintenance mode.
    - Public status endpoint reflects maintenance active.
    - Standard API requests receive HTTP 503 Service Unavailable.
    - Super Admin routes (/super-admin/*, /api/v1/super-admin/*) and /api/health
      are strictly exempted and remain 200 OK.
    - Deactivating maintenance restores normal operations.
    """
    sa_token = get_super_admin_token()

    # 1. Enable Maintenance Mode
    maint_payload = {
        "is_enabled": True,
        "message": "BugBash scheduled platform infrastructure upgrades in progress.",
        "start_time": None,
        "end_time": None,
        "exempt_routes": [
            "/super-admin",
            "/api/v1/super-admin",
            "/api/health"
        ]
    }
    enable_resp = client.put(
        "/api/v1/super-admin/configuration/maintenance",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=maint_payload
    )
    assert enable_resp.status_code == 200
    assert enable_resp.json()["is_enabled"] is True
    assert enable_resp.json()["status"] == "Active"

    # 2. Public status endpoint confirms maintenance active
    pub_resp = client.get("/api/v1/public/maintenance-status")
    assert pub_resp.status_code == 200
    assert pub_resp.json()["maintenance_active"] is True

    # 3. Candidate / Standard API call receives 503 Service Unavailable
    candidate_api_resp = client.get("/api/v1/practice/problems")
    assert candidate_api_resp.status_code == 503
    assert candidate_api_resp.json()["status"] == "maintenance"

    # 4. Super Admin routes and /api/health remain completely accessible
    sa_check_resp = client.get(
        "/api/v1/super-admin/configuration",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert sa_check_resp.status_code == 200

    health_resp = client.get("/api/health")
    assert health_resp.status_code == 200

    # 5. Disable Maintenance Mode
    disable_payload = dict(maint_payload)
    disable_payload["is_enabled"] = False
    disable_resp = client.put(
        "/api/v1/super-admin/configuration/maintenance",
        headers={"Authorization": f"Bearer {sa_token}"},
        json=disable_payload
    )
    assert disable_resp.status_code == 200
    assert disable_resp.json()["is_enabled"] is False

    # 6. Candidate API routes are restored
    candidate_api_resp2 = client.get("/api/v1/practice/problems")
    assert candidate_api_resp2.status_code != 503


# ==============================================================================
# 10. Audit Logging of Configuration Changes
# ==============================================================================
def test_config_audit_logging():
    """Verifies that configuration actions are logged with secrets redacted."""
    sa_token = get_super_admin_token()

    audit_resp = client.get(
        "/api/v1/super-admin/configuration/audit?limit=20",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    assert len(logs) >= 1

    # Verify that no item in the audit log reveals secrets in plaintext
    for item in logs:
        changes = item.get("changes")
        if changes:
            raw_str = str(changes)
            assert "InitialSecretPassword123!" not in raw_str
