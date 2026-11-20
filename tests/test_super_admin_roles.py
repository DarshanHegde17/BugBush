import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.super_admin_auth_service import super_admin_auth_service
from backend.app.services.admin_auth_service import admin_auth_service
from backend.app.services.user_service import user_service
from backend.app.services.password_reset_service import PasswordResetService
from backend.app.services.super_admin_roles_service import super_admin_roles_service
from backend.app.database.mongodb import mongodb

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_roles_fixtures():
    """Sets up fresh test users, clears rate limits, and purges test roles/users."""
    test_emails = [
        "root_roles_tester@bugbash.com",
        "standard_roles_admin@bugbash.com",
        "candidate_roles_test@bugbash.com"
    ]

    for em in test_emails:
        if em in user_service._users:
            del user_service._users[em]

    if hasattr(super_admin_auth_service, "_provisioned_users"):
        super_admin_auth_service._provisioned_users.clear()

    if mongodb.users is not None:
        try:
            mongodb.users.delete_many({"email": {"$in": test_emails}})
        except Exception:
            pass

    if mongodb.db is not None:
        try:
            mongodb.db.admin_roles.delete_many({"slug": {"$regex": "test|interview|eval|proctor|temp"}})
        except Exception:
            pass

    # Clear rate limits and revoked lists
    admin_auth_service._revoked_emails.clear()
    admin_auth_service._revoked_tokens.clear()
    super_admin_auth_service._failed_attempts.clear()
    admin_auth_service._failed_attempts.clear()

    # 1. Super Admin
    super_admin_auth_service.provision_super_admin(
        email="root_roles_tester@bugbash.com",
        password="SuperAdminPass123!",
        full_name="Root Roles Governance Tester",
        account_status="Active"
    )

    # 2. Standard Admin
    admin_doc = {
        "id": "usr_standard_roles_admin",
        "email": "standard_roles_admin@bugbash.com",
        "name": "Standard Roles Admin",
        "full_name": "Standard Roles Admin",
        "role": "admin",
        "account_status": "Active",
        "password_hash": PasswordResetService.hash_password("AdminSecure123!"),
        "password": PasswordResetService.hash_password("AdminSecure123!"),
        "organization_name": "BugBash Global Operations",
        "permissions": ["dashboard:view", "questions:view", "assessments:view"],
        "created_at": datetime.now(timezone.utc)
    }
    user_service._users["standard_roles_admin@bugbash.com"] = admin_doc
    if mongodb.users is not None:
        try:
            mongodb.users.insert_one(dict(admin_doc))
        except Exception:
            pass

    # 3. Candidate
    candidate_doc = {
        "id": "usr_candidate_roles_test",
        "email": "candidate_roles_test@bugbash.com",
        "name": "Candidate Roles Test",
        "full_name": "Candidate Roles Test",
        "role": "candidate",
        "account_status": "Active",
        "password_hash": PasswordResetService.hash_password("Candidate123!"),
        "created_at": datetime.now(timezone.utc)
    }
    user_service._users["candidate_roles_test@bugbash.com"] = candidate_doc


def get_super_admin_token() -> str:
    """Helper to authenticate Super Admin and return JWT."""
    login_resp = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_roles_tester@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": False
    })
    return login_resp.json()["access_token"]


def get_admin_token(email: str = "standard_roles_admin@bugbash.com", password: str = "AdminSecure123!") -> str:
    """Helper to authenticate Admin and return JWT."""
    resp = client.post("/api/v1/admin/auth/login", json={
        "email": email,
        "password": password
    })
    return resp.json()["access_token"]


# ==============================================================================
# 1. HTML Clean URL Endpoints Tests
# ==============================================================================
def test_super_admin_roles_html_pages():
    """Verifies that all 5 Prompt 25 HTML pages resolve cleanly with 200 OK and expected markup."""
    # 1. Roles listing
    resp = client.get("/super-admin/roles")
    assert resp.status_code == 200
    assert "Roles &amp; Permissions Management" in resp.text
    assert "super-admin-roles.js" in resp.text

    # 2. Create custom role
    resp = client.get("/super-admin/create-role")
    assert resp.status_code == 200
    assert "Create Custom Role" in resp.text
    assert "super-admin-create-role.js" in resp.text

    # 3. Edit role
    resp = client.get("/super-admin/edit-role")
    assert resp.status_code == 200
    assert "Edit Role &amp; Permissions" in resp.text
    assert "super-admin-edit-role.js" in resp.text

    # 4. Role details
    resp = client.get("/super-admin/role-details")
    assert resp.status_code == 200
    assert "Role Details" in resp.text
    assert "super-admin-role-details.js" in resp.text

    # 5. Permission matrix
    resp = client.get("/super-admin/permissions")
    assert resp.status_code == 200
    assert "Cross-Role Permission Matrix" in resp.text
    assert "super-admin-permissions.js" in resp.text


# ==============================================================================
# 2. Permissions Catalog & RBAC Security Tests
# ==============================================================================
def test_permissions_catalog_and_rbac():
    """Verifies RBAC protection on permissions catalog: only Super Admin can query."""
    # 1. Unauthenticated -> 401
    resp = client.get("/api/v1/super-admin/permissions")
    assert resp.status_code == 401

    # 2. Standard Admin token -> 403 Forbidden
    admin_token = get_admin_token()
    resp = client.get("/api/v1/super-admin/permissions", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 403

    # 3. Super Admin token -> 200 OK
    sa_token = get_super_admin_token()
    resp = client.get("/api/v1/super-admin/permissions", headers={"Authorization": f"Bearer {sa_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["total_permissions"] >= 32
    assert data["total_categories"] == 10
    assert any(c["category_id"] == "questions" for c in data["categories"])


# ==============================================================================
# 3. Default Roles Listing Tests
# ==============================================================================
def test_default_roles_listing():
    """Verifies that all pre-configured system roles are available in the roles directory."""
    sa_token = get_super_admin_token()
    resp = client.get("/api/v1/super-admin/roles", headers={"Authorization": f"Bearer {sa_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    slugs = [r["slug"] for r in data["roles"]]
    assert "super_admin" in slugs
    assert "question_manager" in slugs
    assert "assessment_manager" in slugs
    assert "evaluator" in slugs
    assert "analytics_manager" in slugs
    assert "candidate_manager" in slugs
    assert "notification_manager" in slugs
    assert "admin" in slugs


# ==============================================================================
# 4. Custom Role Creation Lifecycle & Duplicate Name Rejection
# ==============================================================================
def test_create_custom_role_lifecycle_and_duplicate_rejection():
    """Verifies Super Admin can author custom role and duplicate names are rejected."""
    sa_token = get_super_admin_token()

    # 1. Create custom role
    create_resp = client.post(
        "/api/v1/super-admin/roles",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={
            "name": "Technical Interview Evaluator",
            "description": "Reviews candidate coding submissions and evaluates algorithm complexity.",
            "permissions": [
                "dashboard:view",
                "submissions:view",
                "submissions:review",
                "submissions:evaluate",
                "ml_insights:view"
            ]
        }
    )
    assert create_resp.status_code == 201
    role_data = create_resp.json()
    assert role_data["name"] == "Technical Interview Evaluator"
    assert role_data["slug"] == "technical_interview_evaluator"
    assert role_data["is_system"] is False
    assert len(role_data["permissions"]) == 5

    # 2. Duplicate role name returns 409 Conflict
    dup_resp = client.post(
        "/api/v1/super-admin/roles",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={
            "name": "Technical Interview Evaluator",
            "description": "Duplicate attempt",
            "permissions": ["dashboard:view"]
        }
    )
    assert dup_resp.status_code == 409
    assert "already exists" in dup_resp.json()["detail"]


# ==============================================================================
# 5. Role Assignment to Admin & Backend Permission Enforcement
# ==============================================================================
def test_role_assignment_and_backend_permission_enforcement():
    """
    Verifies that:
    - Super Admin assigns a specific role (e.g. Question Manager) to an admin.
    - Admin can access permitted capabilities (e.g. questions:create).
    - Admin CANNOT access ungranted capabilities (e.g. candidates:suspend) -> 403 Forbidden.
    """
    sa_token = get_super_admin_token()
    target_email = "standard_roles_admin@bugbash.com"

    # Step 1: Assign 'question_manager' role to admin
    assign_resp = client.post(
        f"/api/v1/super-admin/admins/{target_email}/assign-role",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={"role_id": "question_manager"}
    )
    assert assign_resp.status_code == 200
    assigned_data = assign_resp.json()
    assert assigned_data["role_slug"] == "question_manager"
    assert "questions:create" in assigned_data["permissions"]

    # Step 2: Admin authenticates and receives updated session claims
    adm_token = get_admin_token(target_email, "AdminSecure123!")

    # Step 3: Admin checks permitted capability -> 200 OK
    perm_ok = client.get(
        "/api/v1/admin/auth/check-permission/questions:create",
        headers={"Authorization": f"Bearer {adm_token}"}
    )
    assert perm_ok.status_code == 200
    assert perm_ok.json()["authorized"] is True

    # Step 4: Admin checks UNGRANTED capability -> 403 Forbidden!
    perm_forbidden = client.get(
        "/api/v1/admin/auth/check-permission/candidates:suspend",
        headers={"Authorization": f"Bearer {adm_token}"}
    )
    assert perm_forbidden.status_code == 403
    assert "lacks the 'candidates:suspend' permission" in perm_forbidden.json()["detail"]


# ==============================================================================
# 6. Role Update Propagates to Assigned Admins
# ==============================================================================
def test_role_update_propagates_to_assigned_admins():
    """
    Verifies that updating a role's permissions automatically propagates
    to all administrators assigned to that role.
    """
    sa_token = get_super_admin_token()
    target_email = "standard_roles_admin@bugbash.com"

    # 1. Create a custom role
    custom_role = client.post(
        "/api/v1/super-admin/roles",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={
            "name": "Campus Exam Proctor",
            "description": "Proctors campus examination rooms",
            "permissions": ["dashboard:view", "candidates:view"]
        }
    ).json()
    slug = custom_role["slug"]

    # 2. Assign role to admin
    client.post(
        f"/api/v1/super-admin/admins/{target_email}/assign-role",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={"role_id": slug}
    )

    # 3. Super Admin updates role to also include notifications:send
    update_resp = client.put(
        f"/api/v1/super-admin/roles/{slug}",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={
            "permissions": ["dashboard:view", "candidates:view", "notifications:send"]
        }
    )
    assert update_resp.status_code == 200

    # 4. Check admin effective permissions
    admin_perms_resp = client.get(
        f"/api/v1/super-admin/admins/{target_email}/permissions",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert admin_perms_resp.status_code == 200
    assert "notifications:send" in admin_perms_resp.json()["permissions"]


# ==============================================================================
# 7. Admin Cannot Tamper with Roles or Access Super Admin Routes
# ==============================================================================
def test_admin_cannot_tamper_with_roles_or_access_super_admin():
    """Verifies that ordinary admins cannot call Super Admin APIs or elevate their permissions."""
    adm_token = get_admin_token("standard_roles_admin@bugbash.com", "AdminSecure123!")

    # 1. Admin cannot list roles
    resp1 = client.get("/api/v1/super-admin/roles", headers={"Authorization": f"Bearer {adm_token}"})
    assert resp1.status_code == 403

    # 2. Admin cannot create roles
    resp2 = client.post(
        "/api/v1/super-admin/roles",
        headers={"Authorization": f"Bearer {adm_token}"},
        json={"name": "Hacker Role", "description": "Hacker", "permissions": ["*"]}
    )
    assert resp2.status_code == 403

    # 3. Admin cannot assign roles
    resp3 = client.post(
        "/api/v1/super-admin/admins/standard_roles_admin@bugbash.com/assign-role",
        headers={"Authorization": f"Bearer {adm_token}"},
        json={"role_id": "super_admin"}
    )
    assert resp3.status_code == 403


# ==============================================================================
# 8. Protection of Last Super Admin Account
# ==============================================================================
def test_last_super_admin_protection():
    """
    Verifies that the platform prevents accidental removal or demotion
    of the last remaining active Super Admin account.
    """
    sa_token = get_super_admin_token()
    super_admin_email = "root_roles_tester@bugbash.com"

    # Temporarily stash any other super admins so root_roles_tester is the only active one
    stashed_provisioned = {}
    stashed_users = {}
    stashed_db = []

    for em, u in list(super_admin_auth_service._provisioned_users.items()):
        if em.lower() != super_admin_email.lower() and (u.get("role") or "").strip().lower() == "super_admin":
            stashed_provisioned[em] = u
            del super_admin_auth_service._provisioned_users[em]

    for em, u in list(user_service._users.items()):
        if em.lower() != super_admin_email.lower() and (u.get("role") or "").strip().lower() == "super_admin":
            stashed_users[em] = u
            del user_service._users[em]

    if mongodb.users is not None:
        try:
            for doc in mongodb.users.find({"role": "super_admin", "email": {"$ne": super_admin_email}}):
                stashed_db.append(doc)
            mongodb.users.delete_many({"role": "super_admin", "email": {"$ne": super_admin_email}})
        except Exception:
            pass

    try:
        # Attempt to demote the sole active super admin to a standard role
        demote_resp = client.post(
            f"/api/v1/super-admin/admins/{super_admin_email}/assign-role",
            headers={"Authorization": f"Bearer {sa_token}"},
            json={"role_id": "question_manager"}
        )
        assert demote_resp.status_code == 400
        assert "last authorized Super Administrator" in demote_resp.json()["detail"]
    finally:
        # Restore stashed super admins
        super_admin_auth_service._provisioned_users.update(stashed_provisioned)
        user_service._users.update(stashed_users)
        if mongodb.users is not None and stashed_db:
            try:
                mongodb.users.insert_many(stashed_db)
            except Exception:
                pass


# ==============================================================================
# 9. Role Deletion Rules & System Role Protection
# ==============================================================================
def test_delete_role_rules_and_system_protection():
    """
    Verifies that:
    - System roles cannot be deleted (400).
    - Custom roles assigned to active admins cannot be deleted (400).
    - Once unassigned, custom roles can be deleted successfully (200).
    """
    sa_token = get_super_admin_token()

    # 1. System role cannot be deleted
    del_sys_resp = client.delete(
        "/api/v1/super-admin/roles/question_manager",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert del_sys_resp.status_code == 400
    assert "System role" in del_sys_resp.json()["detail"]

    # 2. Create custom role
    custom = client.post(
        "/api/v1/super-admin/roles",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={"name": "Temporary Role", "description": "Temp description", "permissions": ["dashboard:view"]}
    ).json()
    slug = custom["slug"]

    # 3. Assign to admin
    client.post(
        f"/api/v1/super-admin/admins/standard_roles_admin@bugbash.com/assign-role",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={"role_id": slug}
    )

    # 4. Attempt to delete assigned role -> 400 Bad Request
    del_assigned = client.delete(
        f"/api/v1/super-admin/roles/{slug}",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert del_assigned.status_code == 400
    assert "administrator(s) are currently assigned" in del_assigned.json()["detail"]

    # 5. Remove role from admin (reset to default)
    client.delete(
        f"/api/v1/super-admin/admins/standard_roles_admin@bugbash.com/remove-role",
        headers={"Authorization": f"Bearer {sa_token}"}
    )

    # 6. Deletion now succeeds -> 200 OK
    del_ok = client.delete(
        f"/api/v1/super-admin/roles/{slug}",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert del_ok.status_code == 200
    assert del_ok.json()["status"] == "success"
