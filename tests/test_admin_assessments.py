import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.user_service import user_service
from backend.app.services.admin_auth_service import admin_auth_service
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
def test_admin_assessments_html_delivery():
    res = client.get("/admin/assessments.html")
    assert res.status_code == 200
    assert "Assessment Management" in res.text
    assert "btn-create-assessment" in res.text


def test_admin_create_assessment_html_delivery():
    res = client.get("/admin/create-assessment.html")
    assert res.status_code == 200
    assert "wizardPageTitle" in res.text
    assert "step-indicator" in res.text


def test_admin_edit_assessment_html_delivery():
    res = client.get("/admin/edit-assessment.html")
    assert res.status_code == 200
    assert "wizardPageTitle" in res.text
    assert "step-indicator" in res.text


def test_admin_assessment_details_html_delivery():
    res = client.get("/admin/assessment-details.html")
    assert res.status_code == 200
    assert "telemetry-grid" in res.text
    assert "sectionsAccordionContainer" in res.text
    assert "assignedCandidatesTableBody" in res.text


def test_admin_assessments_css_and_js_delivery():
    for asset in [
        "/css/assessments.css",
        "/css/assessment-form.css",
        "/css/assessment-details.css",
        "/js/assessment-form.js",
        "/js/assessment-details.js"
    ]:
        res = client.get(asset)
        assert res.status_code == 200, f"Asset {asset} failed to load"


# ==============================================================================
# 2. Security & RBAC Enforcement Tests
# ==============================================================================
def test_unauthenticated_access_rejected():
    res = client.get("/api/v1/admin/assessments")
    assert res.status_code == 401


def test_candidate_access_forbidden(candidate_token):
    res = client.get("/api/v1/admin/assessments", headers={
        "Authorization": f"Bearer {candidate_token}"
    })
    assert res.status_code == 403


# ==============================================================================
# 3. Question Bank Catalog Tests
# ==============================================================================
def test_question_bank_catalog(admin_token):
    res = client.get("/api/v1/admin/assessments/questions/catalog", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    catalog = res.json()
    assert len(catalog) >= 14
    assert any("Two Sum" in q["title"] for q in catalog)
    assert any(q.get("question_type") == "mcq" for q in catalog)


def test_question_bank_catalog_filtering(admin_token):
    res = client.get("/api/v1/admin/assessments/questions/catalog?difficulty=Easy&language=Python", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    catalog = res.json()
    assert len(catalog) > 0
    for q in catalog:
        assert q["difficulty"] == "Easy"
        if q.get("question_type") == "coding":
            assert any(l.lower() == "python" for l in q.get("languages", []))


# ==============================================================================
# 4. Full Assessment Lifecycle Tests (Create, Generate, Edit, Assign, Publish, Duplicate, Delete)
# ==============================================================================
def test_assessment_crud_lifecycle(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    created_id = None
    dup_id = None

    try:
        # 1. Create Draft Assessment
        create_payload = {
            "title": "Automated Test Assessment 2026",
            "description": "Enterprise coding evaluation test suite.",
            "assessment_type": "Company Technical Interview",
            "category": "Algorithms & Logic",
            "difficulty": "Medium",
            "duration_minutes": 75,
            "total_marks": 100,
            "sections": [
                {
                    "id": "sec-core-01",
                    "name": "Core Data Structures",
                    "duration_minutes": 45,
                    "question_ids": ["prob-01", "prob-02"]
                }
            ],
            "questions": [
                {"question_id": "prob-01", "section_id": "sec-core-01", "custom_marks": 25},
                {"question_id": "prob-02", "section_id": "sec-core-01", "custom_marks": 25}
            ],
            "rules": {
                "negative_marking": True,
                "negative_mark_value": 0.5,
                "question_navigation": "free",
                "passing_percentage": 65,
                "max_attempts": 2,
                "autosave": True,
                "result_visibility": "immediate"
            },
            "schedule": {
                "start_date": "2026-12-01T09:00:00Z",
                "end_date": "2026-12-31T18:00:00Z",
                "timezone": "UTC",
                "availability": "scheduled"
            }
        }
        res_create = client.post("/api/v1/admin/assessments", json=create_payload, headers=headers)
        assert res_create.status_code == 201
        created_data = res_create.json()["assessment"]
        created_id = created_data["id"]
        assert created_data["title"] == "Automated Test Assessment 2026"
        assert created_data["status"] == "Draft"
        assert len(created_data["questions"]) == 2

        # 2. Automatic Question Generation
        gen_payload = {
            "specifications": {
                "Python": {"Medium": 1}
            },
            "mcq_count": 2
        }
        res_gen = client.post(f"/api/v1/admin/assessments/{created_id}/generate-questions", json=gen_payload, headers=headers)
        assert res_gen.status_code == 200
        gen_data = res_gen.json()
        assert gen_data["total_selected"] == 3
        assert len(gen_data["selected_questions"]) == 3

        # 3. Question Generation Validation (Excessive count)
        excess_payload = {
            "specifications": {
                "Python": {"Hard": 999}
            },
            "mcq_count": 0
        }
        res_excess = client.post(f"/api/v1/admin/assessments/{created_id}/generate-questions", json=excess_payload, headers=headers)
        assert res_excess.status_code == 400
        assert "insufficient" in res_excess.json()["detail"].lower()

        # 4. Update Assessment Metadata
        update_payload = {
            "title": "Automated Test Assessment 2026 - Updated",
            "duration_minutes": 90,
            "total_marks": 120
        }
        res_update = client.put(f"/api/v1/admin/assessments/{created_id}", json=update_payload, headers=headers)
        assert res_update.status_code == 200
        updated_data = res_update.json()["assessment"]
        assert updated_data["title"] == "Automated Test Assessment 2026 - Updated"
        assert updated_data["duration_minutes"] == 90

        # 5. Assign Candidates
        assign_payload = {
            "candidate_emails": ["darshanhegdehegde@gmail.com", "candidate.alex@bugbash.io"]
        }
        res_assign = client.post(f"/api/v1/admin/assessments/{created_id}/assign", json=assign_payload, headers=headers)
        assert res_assign.status_code == 200
        assert res_assign.json()["total_assigned"] >= 2

        # 6. Fetch Candidates
        res_cands = client.get(f"/api/v1/admin/assessments/{created_id}/candidates", headers=headers)
        assert res_cands.status_code == 200
        cands_list = res_cands.json()
        assert len(cands_list) == 2
        assert any(c["email"] == "darshanhegdehegde@gmail.com" for c in cands_list)

        # 7. Statistics & Telemetry
        res_stats = client.get(f"/api/v1/admin/assessments/{created_id}/statistics", headers=headers)
        assert res_stats.status_code == 200
        stats = res_stats.json()
        assert stats["assigned_count"] == 2

        # 8. Publish Assessment
        res_pub = client.post(f"/api/v1/admin/assessments/{created_id}/publish", headers=headers)
        assert res_pub.status_code == 200
        assert res_pub.json()["assessment"]["status"] in ("Published", "Scheduled")

        # 9. Duplicate Assessment
        res_dup = client.post(f"/api/v1/admin/assessments/{created_id}/duplicate", headers=headers)
        assert res_dup.status_code == 201
        dup_data = res_dup.json()
        dup_id = dup_data["assessment"]["id"]
        assert dup_id != created_id
        assert dup_data["assessment"]["status"] == "Draft"
        assert "Copy" in dup_data["assessment"]["title"]

        # 10. Archive Assessment
        res_arc = client.post(f"/api/v1/admin/assessments/{created_id}/archive", headers=headers)
        assert res_arc.status_code == 200
        assert res_arc.json()["assessment"]["status"] == "Archived"

    finally:
        # Cleanup
        if created_id:
            client.delete(f"/api/v1/admin/assessments/{created_id}", headers=headers)
        if dup_id:
            client.delete(f"/api/v1/admin/assessments/{dup_id}", headers=headers)
