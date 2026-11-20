import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.user_service import user_service
from backend.app.database.mongodb import mongodb

client = TestClient(app)


@pytest.fixture(scope="module")
def admin_token():
    """Authenticates as administrator and returns the access_token."""
    res = client.post("/api/v1/admin/auth/login", json={
        "email": "admin@bugbash.com",
        "password": "AdminSecure2026!"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def candidate_token():
    """Authenticates as a candidate and returns candidate JWT."""
    user = user_service._get_user_doc("demo@bugbash.com")
    assert user is not None
    return user_service.create_access_token(user)


# ==============================================================================
# 1. Static Assets & HTML Delivery Tests
# ==============================================================================
def test_admin_candidates_html_delivery():
    for page in [
        "/admin/candidates",
        "/admin/candidates.html",
        "/admin/candidate-details",
        "/admin/candidate-details.html",
        "/admin/candidate-groups",
        "/admin/candidate-groups.html",
        "/admin/import-candidates",
        "/admin/import-candidates.html"
    ]:
        res = client.get(page)
        assert res.status_code == 200, f"Page {page} failed to load"
        assert "<!DOCTYPE html>" in res.text or "<html" in res.text


def test_admin_candidates_css_and_js_delivery():
    assets = [
        "/css/candidates.css",
        "/css/candidate-details.css",
        "/css/candidate-groups.css",
        "/js/candidates.js",
        "/js/candidate-details.js",
        "/js/candidate-groups.js",
        "/js/import-candidates.js"
    ]
    for asset in assets:
        res = client.get(asset)
        assert res.status_code == 200, f"Static asset {asset} failed to load"


# ==============================================================================
# 2. Security & RBAC Enforcement Tests
# ==============================================================================
def test_candidates_unauthenticated_rejected():
    res = client.get("/api/v1/admin/candidates")
    assert res.status_code == 401

    res_groups = client.get("/api/v1/admin/candidate-groups")
    assert res_groups.status_code == 401


def test_candidates_candidate_role_forbidden(candidate_token):
    res = client.get("/api/v1/admin/candidates", headers={
        "Authorization": f"Bearer {candidate_token}"
    })
    assert res.status_code == 403

    res_groups = client.get("/api/v1/admin/candidate-groups", headers={
        "Authorization": f"Bearer {candidate_token}"
    })
    assert res_groups.status_code == 403


# ==============================================================================
# 3. Candidate Directory & Listing Tests
# ==============================================================================
def test_list_candidates_directory(admin_token):
    res = client.get("/api/v1/admin/candidates", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "candidates" in data
    assert "total" in data
    assert data["summary"]["total_candidates"] >= 1
    assert data["total"] >= 1

    # Search filter test
    res_search = client.get("/api/v1/admin/candidates?search=demo@bugbash.com", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert any(c["email"] == "demo@bugbash.com" for c in search_data["candidates"])

    # Status filter test
    res_active = client.get("/api/v1/admin/candidates?status=Active", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_active.status_code == 200


# ==============================================================================
# 4. Candidate Details & Profile Updates
# ==============================================================================
def test_candidate_details_and_update(admin_token):
    # Lookup demo user
    res_list = client.get("/api/v1/admin/candidates?search=demo@bugbash.com", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_list.status_code == 200
    candidates = res_list.json()["candidates"]
    assert len(candidates) > 0
    candidate_id = candidates[0]["id"]

    # Retrieve candidate specifications
    res_detail = client.get(f"/api/v1/admin/candidates/{candidate_id}", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["email"] == "demo@bugbash.com"
    assert "assessments" in detail
    assert "performance" in detail
    assert "activity" in detail

    # Update candidate fields
    update_payload = {
        "college_name": "BugBash Advanced Tech Institute",
        "degree_major": "Computer Science & Engineering",
        "graduation_year": "2026",
        "bio": "Senior year algorithms and distributed systems specialist.",
        "tags": ["Full-Stack", "High Performer"]
    }
    res_update = client.put(f"/api/v1/admin/candidates/{candidate_id}", json=update_payload, headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_update.status_code == 200
    updated_data = res_update.json()
    assert updated_data["college_name"] == "BugBash Advanced Tech Institute"
    assert "High Performer" in updated_data.get("tags", [])

    # Non-existent candidate test
    res_404 = client.get("/api/v1/admin/candidates/nonexistent_id_999", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_404.status_code == 404


# ==============================================================================
# 5. Candidate Suspension & Reactivation Lifecycle Tests
# ==============================================================================
def test_candidate_suspension_and_reactivation_lifecycle(admin_token):
    # Create an isolated temporary candidate for suspension testing
    unique_suffix = uuid.uuid4().hex[:8]
    test_email = f"suspend_test_{unique_suffix}@bugbash.com"
    raw_pwd = "TestCandidate2026!"

    res_reg = user_service.register_user(
        full_name="Suspension Test Subject",
        email=test_email,
        phone_number="+1 555-999-8888",
        password=raw_pwd
    )
    user_doc = user_service._get_user_doc(test_email)
    assert user_doc is not None
    candidate_id = user_doc["id"]

    mongodb.users.update_one({"email": test_email}, {"$set": {"is_verified": True}})

    # Verify initial authentication succeeds
    auth_ok, _, _ = user_service.authenticate_user(test_email, raw_pwd)
    assert auth_ok is True

    # Administrative Suspension
    suspension_reason = "Flagged by automated proctoring for multi-display anomalies"
    res_suspend = client.post(
        f"/api/v1/admin/candidates/{candidate_id}/suspend",
        json={"reason": suspension_reason},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_suspend.status_code == 200
    suspend_body = res_suspend.json()
    assert suspend_body["is_suspended"] is True
    assert suspend_body["account_status"] == "Suspended"
    assert suspend_body["suspension_reason"] == suspension_reason

    # Verify Authentication is strictly blocked during suspension
    auth_suspended, _, err_msg = user_service.authenticate_user(test_email, raw_pwd)
    assert auth_suspended is False
    assert "suspended" in err_msg.lower()

    # Administrative Reactivation
    res_reactivate = client.post(
        f"/api/v1/admin/candidates/{candidate_id}/reactivate",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_reactivate.status_code == 200
    reactivate_body = res_reactivate.json()
    assert reactivate_body["is_suspended"] is False
    assert reactivate_body["account_status"] == "Active"

    # Verify Authentication works again after reactivation
    auth_restored, _, _ = user_service.authenticate_user(test_email, raw_pwd)
    assert auth_restored is True


# ==============================================================================
# 6. Candidate Assessment Assignment Tests
# ==============================================================================
def test_candidate_assessment_assignment(admin_token):
    res_list = client.get("/api/v1/admin/candidates?search=demo@bugbash.com", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    candidate_id = res_list.json()["candidates"][0]["id"]

    # Assign assessment directly
    assign_payload = {
        "assessment_id": "asmt-101",
        "deadline": "2026-12-31T23:59:59Z"
    }
    res_assign = client.post(
        f"/api/v1/admin/candidates/{candidate_id}/assignments",
        json=assign_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_assign.status_code == 200
    assign_body = res_assign.json()
    assert assign_body["status"] == "success"

    # Verify assessment sub-routes
    res_asmts = client.get(
        f"/api/v1/admin/candidates/{candidate_id}/assessments",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_asmts.status_code == 200
    asmts_data = res_asmts.json()
    assert "assigned" in asmts_data
    assert "completed" in asmts_data

    # Verify results sub-routes
    res_results = client.get(
        f"/api/v1/admin/candidates/{candidate_id}/results",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_results.status_code == 200
    results_data = res_results.json()
    assert "total_attempts" in results_data


# ==============================================================================
# 7. Candidate Groups CRUD & Assignment Tests
# ==============================================================================
def test_candidate_groups_crud_and_assignment(admin_token):
    # List initial groups
    res_list = client.get("/api/v1/admin/candidate-groups", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_list.status_code == 200
    groups = res_list.json()
    assert isinstance(groups, list)

    # Create new group
    unique_tag = uuid.uuid4().hex[:6]
    create_payload = {
        "name": f"Automated Test Cohort {unique_tag}",
        "description": "Integration testing candidate cohort group",
        "tags": ["IntegrationTest", "Cohort2026"],
        "initial_candidate_ids": []
    }
    res_create = client.post("/api/v1/admin/candidate-groups", json=create_payload, headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_create.status_code == 201
    created_group = res_create.json()["group"]
    group_id = created_group["id"]
    assert created_group["name"] == create_payload["name"]

    # Update group
    res_update = client.put(f"/api/v1/admin/candidate-groups/{group_id}", json={
        "description": "Updated description for test cohort"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_update.status_code == 200
    assert res_update.json()["group"]["description"] == "Updated description for test cohort"

    # Add member to group
    res_members = client.post(
        f"/api/v1/admin/candidate-groups/{group_id}/members",
        json={"candidate_ids_or_emails": ["demo@bugbash.com"]},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_members.status_code == 200
    assert res_members.json()["added_count"] >= 1

    # Assign assessment to group
    res_group_assign = client.post(
        f"/api/v1/admin/candidate-groups/{group_id}/assign-assessment",
        json={"assessment_id": "asmt-102"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_group_assign.status_code == 200
    assert res_group_assign.json()["status"] == "success"

    # Remove member from group
    res_rem = client.delete(
        f"/api/v1/admin/candidate-groups/{group_id}/members/usr_demo_01",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_rem.status_code == 200

    # Delete group
    res_del = client.delete(f"/api/v1/admin/candidate-groups/{group_id}", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "success"


# ==============================================================================
# 8. CSV Bulk Candidate Import Tests
# ==============================================================================
def test_candidate_csv_import(admin_token):
    unique_suffix = uuid.uuid4().hex[:6]
    import_payload = {
        "rows": [
            {
                "full_name": f"Import User One {unique_suffix}",
                "email": f"import_one_{unique_suffix}@bugbash.com",
                "phone_number": "+1 555-111-2222",
                "group_name": "Automated Import Group"
            },
            {
                "full_name": f"Import User Two {unique_suffix}",
                "email": f"import_two_{unique_suffix}@bugbash.com",
                "phone_number": "+1 555-333-4444",
                "group_name": "Automated Import Group"
            },
            {
                # Duplicate existing candidate
                "full_name": "Duplicate Candidate",
                "email": "demo@bugbash.com",
                "phone_number": "+1 555-000-0000"
            }
        ],
        "send_invitations": True,
        "assessment_id": "asmt-101"
    }

    res_import = client.post(
        "/api/v1/admin/candidates/import",
        json=import_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_import.status_code == 200
    import_result = res_import.json()
    assert import_result["total_rows"] == 3
    assert import_result["successful_count"] == 2
    assert import_result["duplicate_count"] == 1
    assert len(import_result["imported_candidates"]) == 2

    # Verify newly imported accounts exist in MongoDB
    new_user = mongodb.users.find_one({"email": f"import_one_{unique_suffix}@bugbash.com"})
    assert new_user is not None
    assert new_user["role"] == "candidate"
    assert new_user.get("is_verified") is False


# ==============================================================================
# 9. Candidate Invitations Lifecycle Tests
# ==============================================================================
def test_candidate_invitations_lifecycle(admin_token):
    unique_suffix = uuid.uuid4().hex[:6]
    invite_email = f"invitee_{unique_suffix}@bugbash.com"

    # Create invitation
    invite_payload = {
        "emails": [invite_email],
        "assessment_id": "asmt-101",
        "group_ids": [],
        "expiry_days": 14,
        "custom_message": "Welcome to BugBash coding assessments!"
    }
    res_create = client.post(
        "/api/v1/admin/candidates/invitations",
        json=invite_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_create.status_code == 201
    created_invites = res_create.json()["invitations"]
    assert len(created_invites) == 1
    invitation_id = created_invites[0]["id"]
    assert created_invites[0]["email"] == invite_email

    # List invitations
    res_list = client.get(
        "/api/v1/admin/candidates/invitations",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_list.status_code == 200
    all_invites = res_list.json()
    assert any(i["id"] == invitation_id for i in all_invites)

    # Resend invitation
    res_resend = client.post(
        f"/api/v1/admin/candidates/invitations/{invitation_id}/resend",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_resend.status_code == 200
    assert res_resend.json()["status"] == "success"

    # Cancel invitation
    res_cancel = client.delete(
        f"/api/v1/admin/candidates/invitations/{invitation_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "success"
