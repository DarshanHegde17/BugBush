"""
BugBash - Master Prompt 18: Admin Results & Analytics Test Suite
Verifies HTML & static asset delivery, RBAC enforcement, results directory multi-filtering,
scorecard details, assessment cohort telemetry, score distributions, candidate lifetime profiling,
question health indicators, leaderboards, and report CSV exports.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.user_service import user_service

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
def test_admin_results_html_delivery():
    pages = [
        "/admin/results",
        "/admin/results.html",
        "/admin/result-details",
        "/admin/result-details.html",
        "/admin/assessment-analytics",
        "/admin/assessment-analytics.html",
        "/admin/candidate-performance",
        "/admin/candidate-performance.html"
    ]
    for page in pages:
        res = client.get(page)
        assert res.status_code == 200, f"Page {page} failed to load"
        assert "<!DOCTYPE html>" in res.text or "<html" in res.text


def test_admin_results_css_and_js_delivery():
    assets = [
        "/css/results.css",
        "/css/result-details.css",
        "/css/assessment-analytics.css",
        "/css/candidate-performance.css",
        "/js/result-charts.js",
        "/js/results.js",
        "/js/result-details.js",
        "/js/assessment-analytics.js",
        "/js/candidate-performance.js"
    ]
    for asset in assets:
        res = client.get(asset)
        assert res.status_code == 200, f"Static asset {asset} failed to load"


# ==============================================================================
# 2. Security & RBAC Enforcement Tests
# ==============================================================================
def test_results_unauthenticated_rejected():
    res = client.get("/api/v1/admin/results")
    assert res.status_code == 401

    res_stats = client.get("/api/v1/admin/results/statistics")
    assert res_stats.status_code == 401

    res_rankings = client.get("/api/v1/admin/results/rankings")
    assert res_rankings.status_code == 401


def test_results_candidate_role_forbidden(candidate_token):
    res = client.get("/api/v1/admin/results", headers={
        "Authorization": f"Bearer {candidate_token}"
    })
    assert res.status_code == 403

    res_stats = client.get("/api/v1/admin/results/statistics", headers={
        "Authorization": f"Bearer {candidate_token}"
    })
    assert res_stats.status_code == 403


# ==============================================================================
# 3. Results Statistics Summary Tests
# ==============================================================================
def test_results_statistics(admin_token):
    res = client.get("/api/v1/admin/results/statistics", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "total_evaluated_candidates" in data
    assert "total_assessments_completed" in data
    assert "average_score" in data
    assert "pass_rate" in data
    assert "failure_rate" in data
    assert data["total_assessments_completed"] >= 0


# ==============================================================================
# 4. Results Directory Listing & Multi-Filtering Tests
# ==============================================================================
def test_results_list(admin_token):
    res = client.get("/api/v1/admin/results?page=1&limit=10", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "results" in data
    assert "total" in data
    assert isinstance(data["results"], list)
    assert len(data["results"]) > 0

    first = data["results"][0]
    assert "candidate_name" in first
    assert "assessment_title" in first
    assert "obtained_marks" in first
    assert "percentage" in first
    assert "grade" in first
    assert "pass_fail_status" in first


def test_results_filtering_by_pass_fail(admin_token):
    res_pass = client.get("/api/v1/admin/results?pass_fail=Pass", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_pass.status_code == 200
    pass_data = res_pass.json()
    for item in pass_data.get("results", []):
        assert item["pass_fail_status"].lower() == "pass"


def test_results_filtering_by_search(admin_token):
    res = client.get("/api/v1/admin/results?search=demo", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    for item in data.get("results", []):
        matches = (
            "demo" in item["candidate_name"].lower() or
            "demo" in item["candidate_email"].lower() or
            "demo" in item["assessment_title"].lower() or
            "demo" in item["candidate_id"].lower() or
            "demo" in item["id"].lower()
        )
        assert matches


# ==============================================================================
# 5. Result Scorecard Details Tests
# ==============================================================================
def test_result_details(admin_token):
    # Fetch list to pick an existing valid ID
    list_res = client.get("/api/v1/admin/results?limit=1", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert list_res.status_code == 200
    first_id = list_res.json()["results"][0]["id"]

    res = client.get(f"/api/v1/admin/results/{first_id}", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == first_id
    assert "candidate_name" in data
    assert "evaluation_breakdown" in data
    assert "test_case_correctness" in data["evaluation_breakdown"]
    assert "questions" in data
    assert isinstance(data["questions"], list)


def test_result_details_not_found(admin_token):
    res = client.get("/api/v1/admin/results/non-existent-result-9999", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 404


# ==============================================================================
# 6. Assessment Analytics & Score Distribution Tests
# ==============================================================================
def test_assessment_analytics(admin_token):
    res = client.get("/api/v1/admin/results/assessment/asmt-101/analytics", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["assessment_id"] == "asmt-101"
    assert "score_distribution" in data
    assert "0-20" in data["score_distribution"]
    assert "81-100" in data["score_distribution"]
    assert "pass_fail_distribution" in data
    assert "question_averages" in data
    assert "difficulty_performance" in data
    assert "language_performance" in data


# ==============================================================================
# 7. Candidate Lifetime Performance Analytics Tests
# ==============================================================================
def test_candidate_performance(admin_token):
    res = client.get("/api/v1/admin/results/candidate/usr_demo_01/performance", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "candidate_id" in data
    assert "candidate_name" in data
    assert "total_attempted" in data
    assert "total_completed" in data
    assert "average_score" in data
    assert "performance_trend" in data
    assert "history" in data


# ==============================================================================
# 8. Question-Level Analytics & Health Indicators Tests
# ==============================================================================
def test_question_analytics(admin_token):
    res = client.get("/api/v1/admin/results/question-analytics", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first = data[0]
        assert "question_id" in first
        assert "title" in first
        assert "attempt_count" in first
        assert "health_indicator" in first
        assert first["health_indicator"] in ["Healthy", "Too Easy", "Too Difficult", "Frequently Misunderstood"]


# ==============================================================================
# 9. Rankings & Leaderboards Tests
# ==============================================================================
def test_rankings_leaderboard(admin_token):
    res = client.get("/api/v1/admin/results/rankings?limit=10", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    rankings = res.json()
    assert isinstance(rankings, list)
    if len(rankings) > 0:
        first = rankings[0]
        assert first["rank"] == 1
        assert "candidate_name" in first
        assert "score" in first
        assert "percentage" in first


# ==============================================================================
# 10. Report Export & File Download Tests
# ==============================================================================
def test_export_report_and_download(admin_token):
    # 1. Trigger Report Generation
    export_payload = {
        "report_type": "results",
        "format": "csv",
        "filters": {"pass_fail": "Pass"}
    }
    res = client.post("/api/v1/admin/results/export", json=export_payload, headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "report_id" in data
    assert "download_url" in data
    assert "filename" in data
    assert data["filename"].endswith(".csv")

    report_id = data["report_id"]

    # 2. Download Report
    download_res = client.get(f"/api/v1/admin/results/reports/{report_id}", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert download_res.status_code == 200
    assert "text/csv" in download_res.headers.get("Content-Type", "")
    assert "attachment" in download_res.headers.get("Content-Disposition", "")
    assert "Result ID,Candidate Name,Candidate Email" in download_res.text
