"""
BugBash - Master Prompt 19: Admin ML Insights Dashboard Test Suite
Verifies HTML & static asset delivery, RBAC enforcement, 10-stage evaluation pipeline telemetry,
code logic recognition, alternative solution approaches, Big-O complexity proofs,
code optimization, model performance benchmarks, and human reviewer corrections.
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
def test_admin_ml_insights_html_delivery():
    pages = [
        "/admin/ml-insights",
        "/admin/ml-insights.html",
        "/admin/code-analysis",
        "/admin/code-analysis.html",
        "/admin/algorithm-analytics",
        "/admin/algorithm-analytics.html",
        "/admin/ml-model-performance",
        "/admin/ml-model-performance.html"
    ]
    for page in pages:
        res = client.get(page)
        assert res.status_code == 200, f"Page {page} failed to load"
        assert "<!DOCTYPE html>" in res.text or "<html" in res.text


def test_admin_ml_insights_css_and_js_delivery():
    assets = [
        "/css/ml-insights.css",
        "/css/code-analysis.css",
        "/css/algorithm-analytics.css",
        "/css/ml-model-performance.css",
        "/js/ml-charts.js",
        "/js/ml-insights.js",
        "/js/code-analysis.js",
        "/js/algorithm-analytics.js",
        "/js/ml-model-performance.js"
    ]
    for asset in assets:
        res = client.get(asset)
        assert res.status_code == 200, f"Static asset {asset} failed to load"


# ==============================================================================
# 2. Security & RBAC Enforcement Tests
# ==============================================================================
def test_ml_insights_unauthenticated_rejected():
    res = client.get("/api/v1/admin/ml-insights/statistics")
    assert res.status_code == 401

    res_pipe = client.get("/api/v1/admin/ml-insights/pipeline")
    assert res_pipe.status_code == 401

    res_analyses = client.get("/api/v1/admin/ml-insights/analyses")
    assert res_analyses.status_code == 401


def test_ml_insights_candidate_role_forbidden(candidate_token):
    res = client.get("/api/v1/admin/ml-insights/statistics", headers={
        "Authorization": f"Bearer {candidate_token}"
    })
    assert res.status_code == 403

    res_pipe = client.get("/api/v1/admin/ml-insights/pipeline", headers={
        "Authorization": f"Bearer {candidate_token}"
    })
    assert res_pipe.status_code == 403


# ==============================================================================
# 3. ML Statistics & 10-Stage Pipeline Telemetry Tests
# ==============================================================================
def test_ml_statistics(admin_token):
    res = client.get("/api/v1/admin/ml-insights/statistics", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "total_code_analyses" in data
    assert "successfully_analyzed" in data
    assert "pending_analyses" in data
    assert "average_confidence" in data
    assert "optimizations_detected" in data
    assert "analysis_failures" in data
    assert data["total_code_analyses"] >= 1


def test_ml_pipeline_telemetry(admin_token):
    res = client.get("/api/v1/admin/ml-insights/pipeline", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "stages" in data
    assert len(data["stages"]) == 10
    first = data["stages"][0]
    assert first["stage_number"] == 1
    assert "Receive submitted source code" in first["name"]
    tenth = data["stages"][9]
    assert tenth["stage_number"] == 10
    assert "Store analysis results" in tenth["name"]


# ==============================================================================
# 4. Searchable Analyses Listing & Filtering Tests
# ==============================================================================
def test_ml_analyses_listing(admin_token):
    res = client.get("/api/v1/admin/ml-insights/analyses?page=1&limit=10", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "analyses" in data
    assert "total" in data
    assert len(data["analyses"]) > 0

    first = data["analyses"][0]
    assert "analysis_id" in first
    assert "candidate_name" in first
    assert "question_title" in first
    assert "language" in first
    assert "detected_algorithm" in first
    assert "time_complexity" in first
    assert "space_complexity" in first


def test_ml_analyses_filtering(admin_token):
    # Language filter
    res_py = client.get("/api/v1/admin/ml-insights/analyses?language=python", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_py.status_code == 200
    for a in res_py.json()["analyses"]:
        assert a["language"].lower() == "python"

    # Search filter
    res_search = client.get("/api/v1/admin/ml-insights/analyses?search=Two+Sum", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_search.status_code == 200
    for a in res_search.json()["analyses"]:
        assert "two sum" in a["question_title"].lower() or "two sum" in a["analysis_id"].lower()


# ==============================================================================
# 5. Deep Code Logic Recognition & Proof Details Tests
# ==============================================================================
def test_ml_analysis_deep_details(admin_token):
    res = client.get("/api/v1/admin/ml-insights/analyses/mla-101", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["analysis_id"] == "mla-101"
    assert "code_snippet" in data
    assert len(data["code_snippet"]) > 0
    assert data["detected_algorithm"] == "Single-Pass Hash Map Lookup"
    assert data["algorithm_confidence"] >= 0.9
    assert "Hash Table" in data["detected_concepts"]

    # Structural AST logic features
    assert "control_flow" in data
    assert "data_structures_used" in data
    assert "loop_structures" in data

    # Alternative solution approaches
    assert "alternative_approaches" in data
    assert len(data["alternative_approaches"]) >= 2
    detected_approaches = [ap for ap in data["alternative_approaches"] if ap["is_detected_approach"]]
    assert len(detected_approaches) == 1

    # Time & Space Big-O proof
    assert data["time_complexity"]["notation"] == "O(n)"
    assert len(data["time_complexity"]["code_evidence"]) > 0
    assert data["space_complexity"]["notation"] == "O(n)"
    assert data["space_complexity"]["auxiliary_memory"] is not None

    # Code quality & optimizations
    assert data["code_quality"]["readability_score"] >= 80
    assert len(data["optimizations"]) >= 1

    # AI Pedagogical Feedback
    assert len(data["ai_feedback"]["candidate_strengths"]) > 0
    assert len(data["ai_feedback"]["recommended_study_topics"]) > 0
    assert "AI-generated" in data["ai_feedback"]["disclaimer"]


def test_ml_analysis_not_found(admin_token):
    res = client.get("/api/v1/admin/ml-insights/analyses/non-existent-mla-9999", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 404


# ==============================================================================
# 6. Algorithm, Complexity & Optimization Analytics Tests
# ==============================================================================
def test_algorithm_analytics(admin_token):
    res = client.get("/api/v1/admin/ml-insights/algorithms", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "frequent_algorithms" in data
    assert len(data["frequent_algorithms"]) > 0
    assert "common_approaches" in data
    assert "language_distribution" in data
    assert "time_complexity_distribution" in data
    assert "space_complexity_distribution" in data
    assert "common_coding_mistakes" in data
    assert "optimization_by_topic" in data


def test_complexity_and_optimization_endpoints(admin_token):
    res_cpx = client.get("/api/v1/admin/ml-insights/complexity", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_cpx.status_code == 200
    assert "time_complexity_breakdown" in res_cpx.json()

    res_opt = client.get("/api/v1/admin/ml-insights/optimization", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_opt.status_code == 200
    assert "top_bottlenecks" in res_opt.json()

    res_fb = client.get("/api/v1/admin/ml-insights/feedback", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res_fb.status_code == 200
    assert "most_recommended_topics" in res_fb.json()


# ==============================================================================
# 7. Model Performance Benchmarks Tests
# ==============================================================================
def test_models_performance(admin_token):
    res = client.get("/api/v1/admin/ml-insights/models/performance", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "models" in data
    assert len(data["models"]) >= 3
    ast_model = next((m for m in data["models"] if "AST" in m["name"]), None)
    assert ast_model is not None
    assert ast_model["accuracy"] is not None
    assert ast_model["precision"] is not None
    assert ast_model["f1_score"] is not None
    assert ast_model["human_agreement_rate"] is not None


# ==============================================================================
# 8. Human Review & Feedback Correction Lifecycle Tests
# ==============================================================================
def test_submit_analysis_review(admin_token):
    payload = {
        "comments": "Inspected AST and verified single-pass complement indexing logic.",
        "rating": "Accurate"
    }
    res = client.post("/api/v1/admin/ml-insights/analyses/mla-101/review", json=payload, headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["review"]["rating"] == "Accurate"


def test_submit_human_correction(admin_token):
    correction_payload = {
        "corrected_algorithm": "Single-Pass Hash Map with Complements",
        "corrected_approach": "Optimal Linear Scan",
        "corrected_time_complexity": "O(n)",
        "corrected_space_complexity": "O(n)",
        "misleading_feedback_flag": False,
        "correction_notes": "Confirmed algorithm matches Single-Pass Hash Map approach with 100% test pass rate.",
        "submit_to_dataset": True
    }
    res = client.post("/api/v1/admin/ml-insights/analyses/mla-101/corrections", json=correction_payload, headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["correction"]["corrected_algorithm"] == "Single-Pass Hash Map with Complements"

    # Verify subsequent detail GET attaches the reviewer correction
    detail_res = client.get("/api/v1/admin/ml-insights/analyses/mla-101", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["corrections"] is not None
    assert detail_data["corrections"]["corrected_algorithm"] == "Single-Pass Hash Map with Complements"
