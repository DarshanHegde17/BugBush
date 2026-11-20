"""
BugBash - Master Prompt 17: Admin Submissions Management Test Suite
Verifies HTML & static asset delivery, RBAC enforcement, submissions listing & multi-filtering,
test-case sanitization (hidden test cases never exposed), 8-stage ML pipeline tracking,
manual review & score adjustments, and automated re-evaluation workflows.
"""

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
def test_admin_submissions_html_delivery():
    for page in [
        "/admin/submissions",
        "/admin/submissions.html",
        "/admin/submission-details",
        "/admin/submission-details.html",
        "/admin/manual-review",
        "/admin/manual-review.html"
    ]:
        res = client.get(page)
        assert res.status_code == 200, f"Page {page} failed to load"
        assert "<!DOCTYPE html>" in res.text or "<html" in res.text


def test_admin_submissions_css_and_js_delivery():
    assets = [
        "/css/submissions.css",
        "/css/submission-details.css",
        "/css/manual-review.css",
        "/js/submissions.js",
        "/js/submission-details.js",
        "/js/manual-review.js"
    ]
    for asset in assets:
        res = client.get(asset)
        assert res.status_code == 200, f"Static asset {asset} failed to load"


# ==============================================================================
# 2. Security & RBAC Enforcement Tests
# ==============================================================================
def test_submissions_unauthenticated_rejected():
    res = client.get("/api/v1/admin/submissions")
    assert res.status_code == 401

    res_stats = client.get("/api/v1/admin/submissions/statistics")
    assert res_stats.status_code == 401


def test_submissions_candidate_role_forbidden(candidate_token):
    res = client.get("/api/v1/admin/submissions", headers={
        "Authorization": f"Bearer {candidate_token}"
    })
    assert res.status_code == 403

    res_stats = client.get("/api/v1/admin/submissions/statistics", headers={
        "Authorization": f"Bearer {candidate_token}"
    })
    assert res_stats.status_code == 403


# ==============================================================================
# 3. Submissions Statistics Summary Tests
# ==============================================================================
def test_submissions_statistics(admin_token):
    res = client.get("/api/v1/admin/submissions/statistics", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "total_submissions" in data
    assert "successful_submissions" in data
    assert "failed_submissions" in data
    assert "pending_evaluation" in data
    assert "manual_reviews_required" in data
    assert "evaluation_errors" in data
    assert data["total_submissions"] >= 1


# ==============================================================================
# 4. Submissions Directory Listing & Multi-Filtering Tests
# ==============================================================================
def test_list_submissions_directory(admin_token):
    res = client.get("/api/v1/admin/submissions", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "submissions" in data
    assert "total" in data
    assert data["total"] >= 5
    assert len(data["submissions"]) >= 5

    # Filter by Search
    res_search = client.get("/api/v1/admin/submissions?search=Two Sum", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert any("Two Sum" in s["question_title"] for s in search_data["submissions"])

    # Filter by Language
    res_lang = client.get("/api/v1/admin/submissions?language=Python", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_lang.status_code == 200
    assert all(s["language"] == "Python" for s in res_lang.json()["submissions"] if s["language"])

    # Filter by Status (Successful)
    res_status = client.get("/api/v1/admin/submissions?status=successful", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_status.status_code == 200
    assert all(s["evaluation_status"] == "Accepted" for s in res_status.json()["submissions"])

    # Filter by Review Needed
    res_review = client.get("/api/v1/admin/submissions?review_filter=pending_review", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_review.status_code == 200
    assert any(s["review_required"] and not s["is_reviewed"] for s in res_review.json()["submissions"])


# ==============================================================================
# 5. Submission Details & Test-Case Sanitization Security Tests
# ==============================================================================
def test_submission_details_and_test_case_sanitization(admin_token):
    # Retrieve details of sub_code_01
    res = client.get("/api/v1/admin/submissions/sub_code_01", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    detail = res.json()
    assert detail["submission_id"] == "sub_code_01"
    assert detail["candidate_name"] == "Alexander Morgan"
    assert detail["question_title"] == "Two Sum - Optimized Hash Map"
    assert detail["score"] == 25.0
    assert detail["evaluation_status"] == "Accepted"

    # CRITICAL SECURITY CHECK: Test cases sanitization
    test_cases = detail["test_cases"]
    assert len(test_cases) == 5

    # Public test cases may have inputs
    public_cases = [tc for tc in test_cases if tc["visibility"] == "public"]
    assert len(public_cases) == 2
    assert public_cases[0]["input_preview"] is not None

    # Hidden test cases MUST NOT have inputs or expected outputs
    hidden_cases = [tc for tc in test_cases if tc["visibility"] == "hidden"]
    assert len(hidden_cases) == 3
    for hc in hidden_cases:
        assert hc["input_preview"] is None, "Hidden test case input MUST NOT be exposed"
        assert hc["expected_output_preview"] is None, "Hidden test case expected output MUST NOT be exposed"

    # Non-existent submission returns 404
    res_404 = client.get("/api/v1/admin/submissions/nonexistent_sub_999", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_404.status_code == 404


# ==============================================================================
# 6. Specific Inspection Sub-Endpoints Tests
# ==============================================================================
def test_submission_code_and_execution_subroutes(admin_token):
    # Code route
    res_code = client.get("/api/v1/admin/submissions/sub_code_01/code", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_code.status_code == 200
    code_body = res_code.json()
    assert code_body["submission_id"] == "sub_code_01"
    assert "class Solution:" in code_body["code"]
    assert code_body["language"] == "Python"

    # Execution Results route
    res_exec = client.get("/api/v1/admin/submissions/sub_code_01/execution-results", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_exec.status_code == 200
    exec_body = res_exec.json()
    assert "execution_summary" in exec_body
    assert "test_cases" in exec_body

    # ML Analysis route (8 stages check)
    res_ml = client.get("/api/v1/admin/submissions/sub_code_01/ml-analysis", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_ml.status_code == 200
    ml_body = res_ml.json()
    stages = ml_body["ml_analysis"]["pipeline_stages"]
    assert len(stages) == 8
    assert stages[0]["name"] == "Code submission received"
    assert stages[7]["name"] == "Final result calculated"

    # Evaluation history route
    res_hist = client.get("/api/v1/admin/submissions/sub_code_01/evaluation-history", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_hist.status_code == 200
    hist = res_hist.json()
    assert len(hist) >= 1
    assert hist[0]["action"] == "Automated Evaluation"


# ==============================================================================
# 7. Manual Review & Score Adjustment Action Tests
# ==============================================================================
def test_manual_review_and_score_adjustment(admin_token):
    target_sid = "sub_code_02"
    review_payload = {
        "review_notes": "Granted +3 partial credit: Stack logic is clean, missed empty stack check on return.",
        "review_reason": "Edge-Case Partial Credit Appeal",
        "adjusted_score": 18.0,
        "mark_as_reviewed": True
    }

    res_review = client.post(
        f"/api/v1/admin/submissions/{target_sid}/review",
        json=review_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_review.status_code == 200
    review_res = res_review.json()
    assert review_res["status"] == "success"
    assert review_res["score"] == 18.0
    assert review_res["is_reviewed"] is True

    # Verify score and manual review record are updated in submission details
    res_detail = client.get(f"/api/v1/admin/submissions/{target_sid}", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["score"] == 18.0
    assert detail["manual_review"]["is_reviewed"] is True
    assert detail["manual_review"]["adjusted_score"] == 18.0
    assert detail["manual_review"]["original_score"] == 15.0

    # Verify new history entry was appended
    history = detail["evaluation_history"]
    assert len(history) >= 2
    latest = history[-1]
    assert latest["action"] == "Manual Score Adjustment"
    assert latest["score"] == 18.0
    assert "admin@bugbash.com" in latest["actor"]


# ==============================================================================
# 8. Automated Re-Evaluation Request Tests
# ==============================================================================
def test_request_reevaluation(admin_token):
    target_sid = "sub_code_03"
    reeval_payload = {
        "reason": "Sandbox watchdog timeout suspected due to runner node CPU congestion"
    }

    res_reeval = client.post(
        f"/api/v1/admin/submissions/{target_sid}/request-reevaluation",
        json=reeval_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_reeval.status_code == 200
    res_body = res_reeval.json()
    assert res_body["status"] == "success"
    assert res_body["re_evaluation_reason"] == reeval_payload["reason"]

    # Verify history entry
    res_hist = client.get(f"/api/v1/admin/submissions/{target_sid}/evaluation-history", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_hist.status_code == 200
    hist = res_hist.json()
    assert any(h["action"] == "Re-Evaluation Requested" for h in hist)
