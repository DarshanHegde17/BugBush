import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.super_admin_auth_service import super_admin_auth_service
from backend.app.services.admin_auth_service import admin_auth_service
from backend.app.services.user_service import user_service
from backend.app.services.password_reset_service import PasswordResetService

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_super_admin_fixtures():
    """Setup isolated test fixtures for Super Admin, Admin, and Candidate users."""
    # 1. Active Super Admin
    super_admin_auth_service.provision_super_admin(
        email="root_tester@bugbash.com",
        password="SuperAdminPass123!",
        full_name="Root System Tester",
        account_status="Active"
    )

    # 2. Inactive Super Admin
    super_admin_auth_service.provision_super_admin(
        email="inactive_sa@bugbash.com",
        password="SuperAdminPass123!",
        full_name="Inactive Super Admin",
        account_status="Inactive"
    )

    # 3. Suspended Super Admin
    super_admin_auth_service.provision_super_admin(
        email="suspended_sa@bugbash.com",
        password="SuperAdminPass123!",
        full_name="Suspended Super Admin",
        account_status="Suspended"
    )

    # 4. Standard Admin user (must NOT be permitted in Super Admin portal)
    admin_user_doc = {
        "email": "normal_admin@bugbash.com",
        "name": "Standard Administrator",
        "full_name": "Standard Administrator",
        "role": "admin",
        "account_status": "Active",
        "password_hash": PasswordResetService.hash_password("AdminPass123!"),
        "permissions": ["assessments:manage"],
        "created_at": datetime.now(timezone.utc)
    }
    user_service._users["normal_admin@bugbash.com"] = admin_user_doc

    # 5. Candidate User (must NOT be permitted in Super Admin portal)
    candidate_doc = {
        "email": "candidate_student@bugbash.com",
        "name": "Candidate Student",
        "full_name": "Candidate Student",
        "role": "candidate",
        "account_status": "Active",
        "password_hash": PasswordResetService.hash_password("CandidatePass123!"),
        "created_at": datetime.now(timezone.utc)
    }
    user_service._users["candidate_student@bugbash.com"] = candidate_doc

    # Reset rate limiting attempts
    super_admin_auth_service._failed_attempts.clear()


def test_super_admin_html_endpoints():
    """Verifies all Super Admin clean HTML routes render proper templates."""
    # 1. Login page
    resp = client.get("/super-admin/login")
    assert resp.status_code == 200
    assert "Super Admin" in resp.text
    assert "Control Center" in resp.text
    assert "superAdminEmail" in resp.text
    assert "superAdminPassword" in resp.text
    assert "superAdminSubmitBtn" in resp.text

    # 2. Forgot password page
    resp = client.get("/super-admin/forgot-password")
    assert resp.status_code == 200
    assert "superAdminRecoveryEmail" in resp.text
    assert "Credential Recovery" in resp.text or "Recovery" in resp.text

    # 3. Verify OTP page
    resp = client.get("/super-admin/verify-otp")
    assert resp.status_code == 200
    assert "sa-otp-input" in resp.text
    assert "superAdminOtpForm" in resp.text

    # 4. Reset password page
    resp = client.get("/super-admin/reset-password")
    assert resp.status_code == 200
    assert "superAdminNewPassword" in resp.text
    assert "superAdminResetForm" in resp.text
    assert "ruleLength" in resp.text


def test_super_admin_direct_login_and_profile():
    """Tests valid Super Admin login and fetching authenticated profile."""
    resp = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_tester@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": False
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["require_otp"] is False
    assert data["access_token"] is not None
    assert data["user"]["role"] == "super_admin"
    assert data["user"]["is_super_admin"] is True

    token = data["access_token"]

    # Verify /me endpoint
    me_resp = client.get("/api/v1/super-admin/auth/me", headers={
        "Authorization": f"Bearer {token}"
    })
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == "root_tester@bugbash.com"
    assert me_data["role"] == "super_admin"
    assert me_data["is_super_admin"] is True


def test_invalid_credentials_returns_generic_error():
    """Ensures incorrect passwords or non-existent accounts receive generic 401."""
    # Bad password
    resp = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_tester@bugbash.com",
        "password": "WrongPassword999!",
        "require_mfa": False
    })
    assert resp.status_code == 401
    assert "Invalid administrative credentials" in resp.json()["detail"]

    # Non-existent user
    resp_unknown = client.post("/api/v1/super-admin/auth/login", json={
        "email": "ghost_super_admin@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": False
    })
    assert resp_unknown.status_code == 401
    assert "Invalid administrative credentials" in resp_unknown.json()["detail"]


def test_unauthorized_roles_blocked_from_super_admin_gateway():
    """Ensures normal Admins and Candidates are strictly forbidden from Super Admin."""
    # Normal Admin trying to login at Super Admin gateway
    resp_admin = client.post("/api/v1/super-admin/auth/login", json={
        "email": "normal_admin@bugbash.com",
        "password": "AdminPass123!",
        "require_mfa": False
    })
    assert resp_admin.status_code == 403
    assert "Only authorized Super Administrators" in resp_admin.json()["detail"]

    # Candidate trying to login at Super Admin gateway
    resp_candidate = client.post("/api/v1/super-admin/auth/login", json={
        "email": "candidate_student@bugbash.com",
        "password": "CandidatePass123!",
        "require_mfa": False
    })
    assert resp_candidate.status_code == 403
    assert "Only authorized Super Administrators" in resp_candidate.json()["detail"]

    # Create admin token and attempt to call /super-admin/auth/me
    admin_token, _ = admin_auth_service.create_admin_token({
        "email": "normal_admin@bugbash.com",
        "name": "Standard Administrator",
        "role": "admin",
        "permissions": ["assessments:manage"]
    })

    me_resp = client.get("/api/v1/super-admin/auth/me", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert me_resp.status_code == 403
    assert "Insufficient administrative privileges" in me_resp.json()["detail"]


def test_inactive_and_suspended_super_admin_accounts():
    """Ensures deactivated or suspended Super Admins cannot authenticate."""
    resp_inactive = client.post("/api/v1/super-admin/auth/login", json={
        "email": "inactive_sa@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": False
    })
    assert resp_inactive.status_code == 403
    assert "inactive" in resp_inactive.json()["detail"].lower()

    resp_suspended = client.post("/api/v1/super-admin/auth/login", json={
        "email": "suspended_sa@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": False
    })
    assert resp_suspended.status_code == 403
    assert "suspended" in resp_suspended.json()["detail"].lower()


def test_mfa_challenge_and_otp_verification():
    """Tests the full multi-factor authentication lifecycle."""
    # 1. Login with require_mfa=True triggers challenge
    login_resp = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_tester@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": True
    })
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert login_data["require_otp"] is True
    assert login_data["status"] == "mfa_required"
    temp_token = login_data["temp_token"]
    assert temp_token is not None

    # Retrieve dev OTP from internal cache for testing
    otp_record = super_admin_auth_service._otp_cache.get(temp_token)
    assert otp_record is not None

    # 2. Invalid OTP fails
    bad_otp_resp = client.post("/api/v1/super-admin/auth/verify-otp", json={
        "temp_token": temp_token,
        "otp": "000000"
    })
    assert bad_otp_resp.status_code == 400
    assert "Invalid verification code" in bad_otp_resp.json()["detail"]

    # Re-fetch the correct OTP from cache
    # The OTP value was generated; let's recreate challenge or use resend to get known OTP
    resend_resp = client.post("/api/v1/super-admin/auth/resend-otp", json={
        "temp_token": temp_token
    })
    # Might be on cooldown or returns new OTP
    if resend_resp.status_code == 429:
        # Fast forward cooldown
        super_admin_auth_service._otp_cache[temp_token]["last_sent_at"] = datetime.now(timezone.utc) - timedelta(seconds=70)
        resend_resp = client.post("/api/v1/super-admin/auth/resend-otp", json={
            "temp_token": temp_token
        })

    assert resend_resp.status_code == 200
    valid_otp = resend_resp.json()["dev_otp"]
    assert valid_otp is not None and len(valid_otp) == 6

    # 3. Valid OTP succeeds
    verify_resp = client.post("/api/v1/super-admin/auth/verify-otp", json={
        "temp_token": temp_token,
        "otp": valid_otp,
        "remember_device": True
    })
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["access_token"] is not None
    assert verify_data["user"]["role"] == "super_admin"

    # 4. Re-using the same OTP fails (single-use)
    reuse_resp = client.post("/api/v1/super-admin/auth/verify-otp", json={
        "temp_token": temp_token,
        "otp": valid_otp
    })
    assert reuse_resp.status_code == 400


def test_resend_otp_rate_limiting():
    """Verifies 60-second rate limiting cooldown on OTP resend."""
    temp_token, _ = super_admin_auth_service.create_otp_challenge("root_tester@bugbash.com")

    # Immediate second request should trigger 429
    resp = client.post("/api/v1/super-admin/auth/resend-otp", json={
        "temp_token": temp_token
    })
    assert resp.status_code == 429
    assert "Please wait" in resp.json()["detail"]


def test_forgot_password_generic_privacy():
    """Verifies generic anti-enumeration response for non-existent and valid emails."""
    # Unknown email
    unknown_resp = client.post("/api/v1/super-admin/auth/forgot-password", json={
        "email": "nonexistent_super_admin@bugbash.com"
    })
    assert unknown_resp.status_code == 200
    assert "If an authorized Super Admin account exists" in unknown_resp.json()["message"]

    # Known Super Admin
    known_resp = client.post("/api/v1/super-admin/auth/forgot-password", json={
        "email": "root_tester@bugbash.com"
    })
    assert known_resp.status_code == 200
    data = known_resp.json()
    assert "If an authorized Super Admin account exists" in data["message"]
    assert data["temp_token"] is not None


def test_reset_password_workflow_and_session_revocation():
    """Tests password complexity validation, reset execution, and mandatory session revocation."""
    # 1. Obtain an active session token before reset
    login_resp = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_tester@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": False
    })
    old_token = login_resp.json()["access_token"]

    # Verify old token works
    pre_resp = client.get("/api/v1/super-admin/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert pre_resp.status_code == 200

    # 2. Trigger forgot password
    forgot_resp = client.post("/api/v1/super-admin/auth/forgot-password", json={
        "email": "root_tester@bugbash.com"
    })
    reset_token = forgot_resp.json()["temp_token"]
    assert reset_token is not None

    # 3. Password mismatch
    mismatch_resp = client.post("/api/v1/super-admin/auth/reset-password", json={
        "token": reset_token,
        "new_password": "NewStrongPass999!",
        "confirm_password": "DifferentPassword!"
    })
    assert mismatch_resp.status_code == 400
    assert "Passwords do not match" in mismatch_resp.json()["detail"]

    # 4. Weak password complexity failure
    weak_resp = client.post("/api/v1/super-admin/auth/reset-password", json={
        "token": reset_token,
        "new_password": "simple",
        "confirm_password": "simple"
    })
    assert weak_resp.status_code == 400

    # 5. Successful reset with strong password
    success_resp = client.post("/api/v1/super-admin/auth/reset-password", json={
        "token": reset_token,
        "new_password": "BrandNewSuperAdminPass2026!",
        "confirm_password": "BrandNewSuperAdminPass2026!"
    })
    assert success_resp.status_code == 200
    assert "Password reset successful" in success_resp.json()["message"]

    # 6. MANDATORY SECURITY CHECK: Old token is revoked
    post_resp = client.get("/api/v1/super-admin/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert post_resp.status_code == 401

    # 7. Old password no longer works
    old_pw_login = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_tester@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": False
    })
    assert old_pw_login.status_code == 401

    # 8. New password succeeds
    new_pw_login = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_tester@bugbash.com",
        "password": "BrandNewSuperAdminPass2026!",
        "require_mfa": False
    })
    assert new_pw_login.status_code == 200

    # 9. Single-use token cannot be reused
    reuse_token_resp = client.post("/api/v1/super-admin/auth/reset-password", json={
        "token": reset_token,
        "new_password": "BrandNewSuperAdminPass2026!",
        "confirm_password": "BrandNewSuperAdminPass2026!"
    })
    assert reuse_token_resp.status_code == 400


def test_logout_revokes_token():
    """Tests Super Admin logout endpoint and immediate token revocation."""
    login_resp = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_tester@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": False
    })
    token = login_resp.json()["access_token"]

    # Logout
    logout_resp = client.post("/api/v1/super-admin/auth/logout", headers={
        "Authorization": f"Bearer {token}"
    })
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "success"

    # Subsequent access with revoked token must fail
    me_resp = client.get("/api/v1/super-admin/auth/me", headers={
        "Authorization": f"Bearer {token}"
    })
    assert me_resp.status_code == 401
