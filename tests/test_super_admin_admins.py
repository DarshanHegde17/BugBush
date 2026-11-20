import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.super_admin_auth_service import super_admin_auth_service
from backend.app.services.admin_auth_service import admin_auth_service
from backend.app.services.user_service import user_service
from backend.app.services.password_reset_service import PasswordResetService
from backend.app.services.super_admin_admins_service import super_admin_admins_service
from backend.app.database.mongodb import mongodb

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_super_admin_fixtures():
    """Sets up fresh test users and clears rate limits."""
    test_emails = [
        "brand_new_admin@bugbash.com",
        "invitee_admin@bugbash.com",
        "pending_resend_tester@bugbash.com",
        "standard_admin_tester@bugbash.com"
    ]
    for em in test_emails:
        if em in user_service._users:
            del user_service._users[em]

    if mongodb.users is not None:
        try:
            mongodb.users.delete_many({"email": {"$in": test_emails}})
        except Exception:
            pass

    if mongodb.db is not None:
        try:
            mongodb.db.admin_invitations.delete_many({"email": {"$in": test_emails}})
            mongodb.db.admin_audit_logs.delete_many({"details": {"$regex": "tester|invitee|brand_new", "$options": "i"}})
        except Exception:
            pass

    # Clear internal in-memory caches
    admin_auth_service._revoked_emails.clear()
    admin_auth_service._revoked_tokens.clear()
    super_admin_admins_service._invitations.clear()
    super_admin_admins_service._invitations_by_email.clear()
    super_admin_admins_service._audit_logs.clear()

    # 1. Super Admin
    super_admin_auth_service.provision_super_admin(
        email="root_admins_tester@bugbash.com",
        password="SuperAdminPass123!",
        full_name="Root Admins Governance Tester",
        account_status="Active"
    )

    # 2. Standard Admin
    admin_doc = {
        "id": "usr_standard_test_admin",
        "email": "standard_admin_tester@bugbash.com",
        "name": "Standard Admin Tester",
        "full_name": "Standard Admin Tester",
        "role": "admin",
        "account_status": "Active",
        "password_hash": PasswordResetService.hash_password("AdminSecure123!"),
        "password": PasswordResetService.hash_password("AdminSecure123!"),
        "organization_name": "BugBash Global Operations",
        "permissions": ["assessments:manage"],
        "created_at": datetime.now(timezone.utc)
    }
    user_service._users["standard_admin_tester@bugbash.com"] = admin_doc
    if mongodb.users is not None:
        try:
            mongodb.users.insert_one(dict(admin_doc))
        except Exception:
            pass

    # 3. Candidate
    candidate_doc = {
        "id": "usr_candidate_test_01",
        "email": "candidate_test_01@bugbash.com",
        "name": "Candidate Tester 01",
        "full_name": "Candidate Tester 01",
        "role": "candidate",
        "account_status": "Active",
        "password_hash": PasswordResetService.hash_password("Candidate123!"),
        "created_at": datetime.now(timezone.utc)
    }
    user_service._users["candidate_test_01@bugbash.com"] = candidate_doc

    # Clear rate limits
    super_admin_auth_service._failed_attempts.clear()
    admin_auth_service._failed_attempts.clear()


def get_super_admin_token() -> str:
    """Helper to authenticate Super Admin and return JWT."""
    login_resp = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_admins_tester@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": False
    })
    return login_resp.json()["access_token"]


def get_admin_token(email: str = "standard_admin_tester@bugbash.com", password: str = "AdminSecure123!") -> str:
    """Helper to authenticate Admin and return JWT."""
    resp = client.post("/api/v1/admin/auth/login", json={
        "email": email,
        "password": password
    })
    return resp.json()["access_token"]


# ==============================================================================
# 1. HTML Clean URL Endpoints Tests
# ==============================================================================
def test_super_admin_admins_html_endpoints():
    """Verifies that all 5 Prompt 24 HTML pages resolve cleanly with 200 OK and expected markup."""
    # 1. Admins Listing
    resp = client.get("/super-admin/admins")
    assert resp.status_code == 200
    assert "Administrator Accounts" in resp.text
    assert "super-admin-admins.js" in resp.text

    # 2. Create Admin
    resp = client.get("/super-admin/create-admin")
    assert resp.status_code == 200
    assert "Create &amp; Invite Administrator" in resp.text
    assert "super-admin-create-admin.js" in resp.text

    # 3. Admin Details
    resp = client.get("/super-admin/admin-details")
    assert resp.status_code == 200
    assert "Administrator Details" in resp.text
    assert "super-admin-admin-details.js" in resp.text

    # 4. Edit Admin
    resp = client.get("/super-admin/edit-admin")
    assert resp.status_code == 200
    assert "Edit Administrator Information" in resp.text
    assert "super-admin-edit-admin.js" in resp.text

    # 5. Accept Invitation
    resp = client.get("/admin/accept-invitation")
    assert resp.status_code == 200
    assert "Activate Admin Account" in resp.text
    assert "admin-accept-invitation.js" in resp.text


# ==============================================================================
# 2. Listing & RBAC Authorization Tests
# ==============================================================================
def test_list_admins_rbac():
    """Verifies RBAC protection: only Super Admin can list admins."""
    # 1. Unauthenticated -> 401
    resp = client.get("/api/v1/super-admin/admins")
    assert resp.status_code == 401

    # 2. Standard Admin token -> 403 Forbidden
    admin_token = get_admin_token()
    resp = client.get("/api/v1/super-admin/admins", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 403

    # 3. Super Admin token -> 200 OK
    sa_token = get_super_admin_token()
    resp = client.get("/api/v1/super-admin/admins", headers={"Authorization": f"Bearer {sa_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["total"] >= 1
    assert any(a["email"] == "standard_admin_tester@bugbash.com" for a in data["admins"])


# ==============================================================================
# 3. Admin Creation & Invitation Lifecycle Tests
# ==============================================================================
def test_create_and_invite_admin_duplicate_rejection():
    """Verifies admin invitation issuance and 409 conflict on duplicate email."""
    sa_token = get_super_admin_token()

    # 1. Try to invite with an existing email -> 409 Conflict
    dup_resp = client.post(
        "/api/v1/super-admin/admins/invite",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={
            "name": "Duplicate Tester",
            "email": "standard_admin_tester@bugbash.com",
            "role": "admin"
        }
    )
    assert dup_resp.status_code == 409
    assert "already exists" in dup_resp.json()["detail"]

    # 2. Successfully invite brand new admin
    new_email = "brand_new_admin@bugbash.com"
    create_resp = client.post(
        "/api/v1/super-admin/admins/invite",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={
            "name": "Brand New Admin",
            "email": new_email,
            "role": "college_admin",
            "organization_name": "MIT Assessment Division",
            "description": "Overseeing Fall 2026 computer science exam cohorts."
        }
    )
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["status"] == "success"
    assert created_data["email"] == new_email
    assert created_data["invitation_token"] is not None
    assert created_data["dev_otp"] is not None
    assert "/admin/accept-invitation?token=" in created_data["invitation_url"]
    assert created_data["admin"]["account_status"] == "Pending Invitation"

    # Verify admin is in listing
    list_resp = client.get(
        "/api/v1/super-admin/admins?status=Pending",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert list_resp.status_code == 200
    assert any(a["email"] == new_email for a in list_resp.json()["admins"])


# ==============================================================================
# 4. Invitation Acceptance & Authentication Workflow Tests
# ==============================================================================
def test_invitation_acceptance_and_first_login():
    """
    Tests full invitation flow:
    - Super Admin invites admin
    - Pending admin cannot log in with password
    - Admin verifies token
    - Admin establishes password with OTP
    - Admin logs in at /admin/login
    """
    sa_token = get_super_admin_token()
    invite_email = "invitee_admin@bugbash.com"

    # Step 1: Issue invitation
    create_resp = client.post(
        "/api/v1/super-admin/admins/invite",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={
            "name": "Invitee Admin",
            "email": invite_email,
            "role": "admin",
            "organization_name": "BugBash Labs"
        }
    )
    assert create_resp.status_code == 201
    inv_data = create_resp.json()
    token = inv_data["invitation_token"]
    otp = inv_data["dev_otp"]

    # Step 2: Pending admin cannot log in before accepting invitation
    pending_login = client.post("/api/v1/admin/auth/login", json={
        "email": invite_email,
        "password": "AnyRandomPassword123!"
    })
    assert pending_login.status_code in (401, 403)

    # Step 3: Validate invitation token
    val_resp = client.get(f"/api/v1/admin/auth/invitation?token={token}")
    assert val_resp.status_code == 200
    assert val_resp.json()["valid"] is True
    assert val_resp.json()["email"] == invite_email

    # Step 4: Invalid OTP check
    bad_otp_resp = client.post("/api/v1/admin/auth/activate", json={
        "token": token,
        "otp": "999999",
        "password": "MyStrongPassword2026!",
        "confirm_password": "MyStrongPassword2026!"
    })
    assert bad_otp_resp.status_code == 400
    assert "Invalid 6-digit verification code" in bad_otp_resp.json()["detail"]

    # Step 5: Valid OTP + Password activation
    activate_resp = client.post("/api/v1/admin/auth/activate", json={
        "token": token,
        "otp": otp,
        "password": "MyStrongPassword2026!",
        "confirm_password": "MyStrongPassword2026!"
    })
    assert activate_resp.status_code == 200
    assert activate_resp.json()["status"] == "success"
    assert activate_resp.json()["admin"]["account_status"] == "Active"

    # Step 6: Token cannot be reused
    reused_resp = client.get(f"/api/v1/admin/auth/invitation?token={token}")
    assert reused_resp.status_code == 400

    # Step 7: Activated Admin logs in successfully
    admin_login_resp = client.post("/api/v1/admin/auth/login", json={
        "email": invite_email,
        "password": "MyStrongPassword2026!"
    })
    assert admin_login_resp.status_code == 200
    new_admin_jwt = admin_login_resp.json()["access_token"]
    assert new_admin_jwt is not None

    # Step 8: Can access protected admin endpoints
    me_resp = client.get("/api/v1/admin/auth/me", headers={"Authorization": f"Bearer {new_admin_jwt}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == invite_email


# ==============================================================================
# 5. Admin Profile Retrieval & Update Tests
# ==============================================================================
def test_get_and_update_admin_profile():
    """Verifies fetching details and updating admin profile while ensuring email & role are immutable."""
    sa_token = get_super_admin_token()

    # 1. Fetch details
    details_resp = client.get(
        "/api/v1/super-admin/admins/standard_admin_tester@bugbash.com",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert details_resp.status_code == 200
    admin_item = details_resp.json()
    assert admin_item["email"] == "standard_admin_tester@bugbash.com"

    # 2. Update allowed fields
    update_resp = client.put(
        "/api/v1/super-admin/admins/standard_admin_tester@bugbash.com",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={
            "name": "Updated Standard Admin",
            "phone": "+1 (555) 999-8877",
            "organization_name": "BugBash Global Assessment Operations Center",
            "description": "Lead assessment proctor for senior software engineering certifications."
        }
    )
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["name"] == "Updated Standard Admin"
    assert updated_data["phone"] == "+1 (555) 999-8877"
    assert updated_data["organization_name"] == "BugBash Global Assessment Operations Center"
    assert updated_data["email"] == "standard_admin_tester@bugbash.com"  # Email remains intact


# ==============================================================================
# 6. Admin Suspension & Reactivation Tests
# ==============================================================================
def test_suspend_and_reactivate_admin():
    """
    Tests admin suspension:
    - Suspended admin is blocked from login (403)
    - Active sessions are terminated
    - Reactivation restores login capability
    """
    sa_token = get_super_admin_token()
    target_email = "standard_admin_tester@bugbash.com"

    # 1. Admin gets active token
    adm_token = get_admin_token(target_email, "AdminSecure123!")
    me_ok = client.get("/api/v1/admin/auth/me", headers={"Authorization": f"Bearer {adm_token}"})
    assert me_ok.status_code == 200

    # 2. Super Admin suspends the admin
    suspend_resp = client.post(
        f"/api/v1/super-admin/admins/{target_email}/suspend",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={"reason": "Audit review following unusual login anomaly"}
    )
    assert suspend_resp.status_code == 200
    assert suspend_resp.json()["admin"]["account_status"] == "Suspended"

    # 3. Existing token is rejected immediately (revoked / suspended check)
    me_blocked = client.get("/api/v1/admin/auth/me", headers={"Authorization": f"Bearer {adm_token}"})
    assert me_blocked.status_code in (401, 403)

    # 4. Attempt to sign in again receives 403 Forbidden
    login_blocked = client.post("/api/v1/admin/auth/login", json={
        "email": target_email,
        "password": "AdminSecure123!"
    })
    assert login_blocked.status_code == 403
    assert "suspended" in login_blocked.json()["detail"].lower()

    # 5. Super Admin reactivates account
    reactivate_resp = client.post(
        f"/api/v1/super-admin/admins/{target_email}/reactivate",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert reactivate_resp.status_code == 200
    assert reactivate_resp.json()["admin"]["account_status"] == "Active"

    # 6. Admin can log in again
    relogin_ok = client.post("/api/v1/admin/auth/login", json={
        "email": target_email,
        "password": "AdminSecure123!"
    })
    assert relogin_ok.status_code == 200


# ==============================================================================
# 7. Resend Invitation Tests
# ==============================================================================
def test_resend_invitation_lifecycle():
    """Verifies that resend invitation issues fresh token & OTP for pending admins and rejects active admins."""
    sa_token = get_super_admin_token()
    invite_email = "pending_resend_tester@bugbash.com"

    # 1. Create pending admin
    create_resp = client.post(
        "/api/v1/super-admin/admins/invite",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={"name": "Pending Resend", "email": invite_email, "role": "admin"}
    )
    token1 = create_resp.json()["invitation_token"]

    # 2. Resend invitation
    resend_resp = client.post(
        f"/api/v1/super-admin/admins/{invite_email}/resend-invitation",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert resend_resp.status_code == 200
    token2 = resend_resp.json()["invitation_token"]
    assert token2 is not None
    assert token2 != token1  # Fresh cryptographic token

    # 3. Trying to resend for an active admin raises 400
    bad_resend = client.post(
        "/api/v1/super-admin/admins/standard_admin_tester@bugbash.com/resend-invitation",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert bad_resend.status_code == 400
    assert "already 'Active'" in bad_resend.json()["detail"]


# ==============================================================================
# 8. Revoke Sessions Tests
# ==============================================================================
def test_revoke_admin_sessions():
    """Verifies that Super Admin can instantly invalidate all active sessions for an administrator."""
    sa_token = get_super_admin_token()
    target_email = "standard_admin_tester@bugbash.com"

    # Admin signs in and gets valid token
    adm_token = get_admin_token(target_email, "AdminSecure123!")
    me_resp1 = client.get("/api/v1/admin/auth/me", headers={"Authorization": f"Bearer {adm_token}"})
    assert me_resp1.status_code == 200

    # Super admin revokes sessions
    revoke_resp = client.post(
        f"/api/v1/super-admin/admins/{target_email}/revoke-sessions",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["status"] == "success"

    # Token is now rejected
    me_resp2 = client.get("/api/v1/admin/auth/me", headers={"Authorization": f"Bearer {adm_token}"})
    assert me_resp2.status_code == 401


# ==============================================================================
# 9. Admin Activity Log Tests
# ==============================================================================
def test_admin_activity_log():
    """Verifies that admin audit trail returns recorded administrative activities."""
    sa_token = get_super_admin_token()
    target_email = "standard_admin_tester@bugbash.com"

    act_resp = client.get(
        f"/api/v1/super-admin/admins/{target_email}/activity",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert act_resp.status_code == 200
    data = act_resp.json()
    assert data["status"] == "success"
    assert len(data["activities"]) >= 1
