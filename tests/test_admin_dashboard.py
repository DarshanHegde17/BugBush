"""
Unit and integration tests for Master Prompt 13: BugBash Admin Dashboard & Profile.
Validates HTML routes, CSS/JS static assets, unauthorized access prevention,
candidate token rejection, and full statistics/analytics telemetry payloads.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.admin_auth_service import admin_auth_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Clear failed attempt trackers before each test."""
    admin_auth_service._failed_attempts.clear()


@pytest.fixture
def admin_token():
    """Logs in as default test administrator and returns JWT token."""
    res = client.post(
        "/api/v1/admin/auth/login",
        json={"email": "admin@bugbash.com", "password": "AdminSecure2026!"}
    )
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.json()["access_token"]


@pytest.fixture
def candidate_token():
    """Generates a candidate JWT token to verify role rejection on admin routes."""
    import jwt
    import os
    from datetime import datetime, timezone, timedelta
    secret = os.environ.get("JWT_SECRET", "bugbash-super-secure-jwt-secret-key-2026-auth-06")
    payload = {
        "sub": "demo@bugbash.com",
        "email": "demo@bugbash.com",
        "role": "candidate",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    return jwt.encode(payload, secret, algorithm="HS256")


# ==============================================================================
# 1. Frontend Route & Static Asset Availability
# ==============================================================================
def test_admin_dashboard_html_route():
    """Verify /admin/dashboard returns 200 with complete dashboard markup."""
    res = client.get("/admin/dashboard")
    assert res.status_code == 200
    html = res.text
    assert "BugBash" in html
    assert "Overview" in html
    assert "Question Bank" in html
    assert "statTotalQuestions" in html
    assert "chartParticipation" in html
    assert "chartLanguages" in html
    assert "chartPassFail" in html
    assert "chartDifficulty" in html


def test_admin_profile_html_route():
    """Verify /admin/profile returns 200 with profile management markup."""
    res = client.get("/admin/profile")
    assert res.status_code == 200
    html = res.text
    assert "Administrator Profile" in html
    assert "adminChangePasswordForm" in html
    assert "profilePermissionsGrid" in html


def test_admin_dashboard_css_asset():
    """Verify /css/admin-dashboard.css is delivered."""
    res = client.get("/css/admin-dashboard.css")
    assert res.status_code == 200
    assert "--primary: #ff6b35" in res.text


def test_admin_dashboard_js_asset():
    """Verify /js/admin-dashboard.js is delivered."""
    res = client.get("/js/admin-dashboard.js")
    assert res.status_code == 200
    assert "renderParticipationChart" in res.text


# ==============================================================================
# 2. Authorization Security & Role Verification
# ==============================================================================
def test_unauthenticated_dashboard_endpoints_rejected():
    """Ensure all dashboard API endpoints require a valid Bearer token."""
    endpoints = [
        "/api/v1/admin/dashboard/statistics",
        "/api/v1/admin/dashboard/analytics",
        "/api/v1/admin/dashboard/recent-activity",
        "/api/v1/admin/permissions",
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401, f"Expected 401 for {ep}, got {res.status_code}"


def test_candidate_token_rejected_on_admin_dashboard(candidate_token):
    """Ensure candidate role tokens are strictly rejected on admin dashboard endpoints."""
    headers = {"Authorization": f"Bearer {candidate_token}"}
    endpoints = [
        "/api/v1/admin/dashboard/statistics",
        "/api/v1/admin/dashboard/analytics",
        "/api/v1/admin/dashboard/recent-activity",
        "/api/v1/admin/permissions",
    ]
    for ep in endpoints:
        res = client.get(ep, headers=headers)
        assert res.status_code in (401, 403), f"Expected 401 or 403 for candidate on {ep}, got {res.status_code}"


# ==============================================================================
# 3. Telemetry & Analytics Data Endpoints
# ==============================================================================
def test_admin_dashboard_statistics(admin_token):
    """Verify live statistics payload contains all 6 required metric counters."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/admin/dashboard/statistics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "total_questions" in data
    assert "total_assessments" in data
    assert "active_assessments" in data
    assert "registered_users" in data
    assert "completed_submissions" in data
    assert "pending_evaluations" in data

    assert isinstance(data["total_questions"], int)
    assert isinstance(data["total_assessments"], int)
    assert data["total_questions"] >= 1
    assert data["total_assessments"] >= 1


def test_admin_dashboard_analytics(admin_token):
    """Verify analytics datasets match Chart.js integration expectations."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/admin/dashboard/analytics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Participation
    assert "participation" in data
    assert len(data["participation"]["timeline_labels"]) == len(data["participation"]["participation_counts"])
    assert len(data["participation"]["timeline_labels"]) >= 5

    # Language usage
    assert "language_usage" in data
    assert "Python" in data["language_usage"]["languages"]
    assert len(data["language_usage"]["percentages"]) > 0

    # Pass / Fail
    assert "pass_fail" in data
    assert "passed_count" in data["pass_fail"]
    assert "failed_count" in data["pass_fail"]

    # Difficulty
    assert "difficulty_distribution" in data
    assert "easy_count" in data["difficulty_distribution"]
    assert "medium_count" in data["difficulty_distribution"]
    assert "hard_count" in data["difficulty_distribution"]


def test_admin_recent_activity(admin_token):
    """Verify live activity audit trail returns formatted stream items."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/admin/dashboard/recent-activity", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "activities" in data
    assert isinstance(data["activities"], list)
    assert len(data["activities"]) >= 1

    item = data["activities"][0]
    assert "actor" in item or "user_name" in item
    assert "title" in item or "action" in item
    assert "time_ago" in item


def test_admin_permissions_endpoint(admin_token):
    """Verify admin permissions endpoint returns role and permission list."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/admin/permissions", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "role" in data
    assert "permissions" in data
    assert isinstance(data["permissions"], list)
    assert "assessments:manage" in data["permissions"]


def test_admin_change_password_validation(admin_token):
    """Verify change password rejects mismatched confirmation and enforces complexity."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Mismatched confirmation
    res = client.post(
        "/api/v1/admin/change-password",
        headers=headers,
        json={
            "current_password": "AdminSecure2026!",
            "new_password": "NewAdminPass2026!",
            "confirm_password": "DifferentPass123!"
        }
    )
    assert res.status_code == 400
    assert "do not match" in res.json()["detail"].lower()

    # Weak password (< 8 chars triggers Pydantic 422, >= 8 chars without symbols triggers service 400)
    res = client.post(
        "/api/v1/admin/change-password",
        headers=headers,
        json={
            "current_password": "AdminSecure2026!",
            "new_password": "weak",
            "confirm_password": "weak"
        }
    )
    assert res.status_code == 422

    # Simple password (8 chars but no symbols/numbers/uppercase)
    res = client.post(
        "/api/v1/admin/change-password",
        headers=headers,
        json={
            "current_password": "AdminSecure2026!",
            "new_password": "simplestringonly",
            "confirm_password": "simplestringonly"
        }
    )
    assert res.status_code == 400
