import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.super_admin_auth_service import super_admin_auth_service
from backend.app.services.admin_auth_service import admin_auth_service
from backend.app.services.user_service import user_service
from backend.app.services.password_reset_service import PasswordResetService

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_dashboard_fixtures():
    """Sets up Super Admin, Admin, and Candidate user fixtures."""
    # 1. Super Admin
    super_admin_auth_service.provision_super_admin(
        email="root_dashboard_tester@bugbash.com",
        password="SuperAdminPass123!",
        full_name="Root Dashboard Tester",
        account_status="Active"
    )

    # 2. Standard Admin (must be forbidden from Super Admin dashboard endpoints)
    admin_doc = {
        "email": "normal_admin_tester@bugbash.com",
        "name": "Standard Admin",
        "full_name": "Standard Admin",
        "role": "admin",
        "account_status": "Active",
        "password_hash": PasswordResetService.hash_password("AdminPass123!"),
        "permissions": ["assessments:manage"],
        "created_at": datetime.now(timezone.utc)
    }
    user_service._users["normal_admin_tester@bugbash.com"] = admin_doc

    # 3. Candidate
    candidate_doc = {
        "email": "candidate_tester@bugbash.com",
        "name": "Candidate Tester",
        "full_name": "Candidate Tester",
        "role": "candidate",
        "account_status": "Active",
        "password_hash": PasswordResetService.hash_password("CandidatePass123!"),
        "created_at": datetime.now(timezone.utc)
    }
    user_service._users["candidate_tester@bugbash.com"] = candidate_doc

    super_admin_auth_service._failed_attempts.clear()


def get_super_admin_token() -> str:
    """Helper to authenticate Super Admin and return JWT."""
    login_resp = client.post("/api/v1/super-admin/auth/login", json={
        "email": "root_dashboard_tester@bugbash.com",
        "password": "SuperAdminPass123!",
        "require_mfa": False
    })
    return login_resp.json()["access_token"]


def test_super_admin_dashboard_html_templates():
    """Verifies that all 3 Super Admin dashboard HTML clean routes return 200 with proper markup."""
    # 1. Main Dashboard
    resp = client.get("/super-admin/dashboard")
    assert resp.status_code == 200
    html = resp.text
    assert "Super Admin" in html
    assert "Platform Overview" in html
    
    # Assert 16 Navigation items in sidebar
    assert "Overview" in html
    assert "Admin Management" in html
    assert "User Management" in html
    assert "Assessment Management" in html
    assert "Question Bank Overview" in html
    assert "Submissions Overview" in html
    assert "Results & Analytics" in html
    assert "ML Insights" in html
    assert "Notifications" in html
    assert "System Configuration" in html
    assert "Roles & Permissions" in html
    assert "Audit Logs" in html
    assert "Security Monitoring" in html
    assert "Platform Monitoring" in html
    assert "My Profile" in html
    assert "Sign Out" in html

    # Assert 8 Metric Card IDs
    assert "statTotalUsers" in html
    assert "statActiveUsers" in html
    assert "statTotalAdmins" in html
    assert "statActiveAssessments" in html
    assert "statTotalSubmissions" in html
    assert "statCompletedEvaluations" in html
    assert "statPendingMl" in html
    assert "statSuspendedAccounts" in html

    # 2. Platform Overview
    resp_overview = client.get("/super-admin/platform-overview")
    assert resp_overview.status_code == 200
    assert "Infrastructure & Node Health" in resp_overview.text or "Infrastructure" in resp_overview.text
    assert "platformNodesGrid" in resp_overview.text
    assert "refreshHealthBtn" in resp_overview.text

    # 3. System Activity
    resp_activity = client.get("/super-admin/system-activity")
    assert resp_activity.status_code == 200
    assert "System Activity Stream" in resp_activity.text
    assert "activityTableBody" in resp_activity.text
    assert "activitySearchInput" in resp_activity.text


def test_super_admin_dashboard_statistics():
    """Verifies the 8 live summary metric counts from GET /dashboard/statistics."""
    token = get_super_admin_token()
    resp = client.get("/api/v1/super-admin/dashboard/statistics", headers={
        "Authorization": f"Bearer {token}"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert isinstance(data["total_registered_users"], int) and data["total_registered_users"] >= 0
    assert isinstance(data["total_active_users"], int) and data["total_active_users"] >= 0
    assert isinstance(data["total_admins"], int) and data["total_admins"] >= 0
    assert isinstance(data["active_assessments"], int) and data["active_assessments"] >= 0
    assert isinstance(data["total_submissions"], int) and data["total_submissions"] >= 0
    assert isinstance(data["completed_evaluations"], int) and data["completed_evaluations"] >= 0
    assert isinstance(data["pending_ml_analyses"], int) and data["pending_ml_analyses"] >= 0
    assert isinstance(data["suspended_accounts"], int) and data["suspended_accounts"] >= 0
    assert data["system_status"] == "Healthy"
    assert "timestamp" in data


def test_super_admin_analytics_endpoints_and_filters():
    """Tests all 4 analytics endpoints and date range query parameters."""
    token = get_super_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Unified Analytics (30d)
    resp_all = client.get("/api/v1/super-admin/dashboard/analytics?range=30d", headers=headers)
    assert resp_all.status_code == 200
    all_data = resp_all.json()
    assert all_data["range"] == "30d"
    assert "users" in all_data
    assert "assessments" in all_data
    assert "submissions" in all_data
    assert "ml" in all_data

    # 2. User Analytics with 7d filter
    resp_users = client.get("/api/v1/super-admin/dashboard/user-analytics?range=7d", headers=headers)
    assert resp_users.status_code == 200
    user_data = resp_users.json()
    assert user_data["range"] == "7d"
    assert len(user_data["daily_registrations"]) > 0
    assert len(user_data["monthly_registrations"]) > 0
    assert "candidates" in user_data["roles_breakdown"]

    # 3. Assessment Analytics with today filter
    resp_assessments = client.get("/api/v1/super-admin/dashboard/assessment-analytics?range=today", headers=headers)
    assert resp_assessments.status_code == 200
    ass_data = resp_assessments.json()
    assert ass_data["assessments_created"] >= 0
    assert len(ass_data["category_distribution"]) > 0

    # 4. Submission Analytics with 90d filter
    resp_submissions = client.get("/api/v1/super-admin/dashboard/submission-analytics?range=90d", headers=headers)
    assert resp_submissions.status_code == 200
    sub_data = resp_submissions.json()
    assert sub_data["successful_submissions"] >= 0
    assert "Python" in sub_data["language_breakdown"]

    # 5. ML Analytics
    resp_ml = client.get("/api/v1/super-admin/dashboard/ml-analytics?range=30d", headers=headers)
    assert resp_ml.status_code == 200
    ml_data = resp_ml.json()
    assert ml_data["analysis_success_rate"] > 0
    assert "Two Pointers" in ml_data["algorithm_distribution"]


def test_super_admin_platform_health_security():
    """Verifies that platform health probes all 8 services without leaking secrets or credentials."""
    token = get_super_admin_token()
    resp = client.get("/api/v1/super-admin/platform/health", headers={
        "Authorization": f"Bearer {token}"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["overall_status"] == "Healthy"

    service_names = [s["name"] for s in data["services"]]
    assert "FastAPI Core Application" in service_names
    assert "MongoDB Database" in service_names
    assert "Redis In-Memory Cache" in service_names
    assert "Celery Asynchronous Workers" in service_names
    assert "Code Execution Sandbox" in service_names
    assert "ML Code Analysis Engine" in service_names
    assert "Email Notification Relay" in service_names
    assert "WebSocket Telemetry Gateway" in service_names

    # CRITICAL SECURITY CHECK: Ensure no secrets are leaked in response text
    raw_text = resp.text.lower()
    assert "mongodb://" not in raw_text
    assert "password" not in raw_text
    assert "secret" not in raw_text
    assert "token" not in raw_text


def test_super_admin_platform_activity_stream():
    """Verifies chronological activity stream with pagination and category filtering."""
    token = get_super_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch page 1 with limit 10
    resp = client.get("/api/v1/super-admin/platform/activity?page=1&limit=10", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["total"] >= 1
    assert len(data["activities"]) <= 10

    first = data["activities"][0]
    assert "id" in first
    assert "event_type" in first
    assert "title" in first
    assert "description" in first
    assert "actor" in first
    assert "status" in first

    # Filter by category: security
    sec_resp = client.get("/api/v1/super-admin/platform/activity?category=security", headers=headers)
    assert sec_resp.status_code == 200
    sec_data = sec_resp.json()
    assert all(a["category"] == "security" for a in sec_data["activities"])


def test_unauthorized_dashboard_access_rejected():
    """Ensures that unauthenticated requests or candidate/admin tokens are strictly blocked."""
    # 1. No Authorization header -> 401
    resp_anon = client.get("/api/v1/super-admin/dashboard/statistics")
    assert resp_anon.status_code == 401

    # 2. Candidate User token -> 403 Forbidden
    candidate_token = user_service.create_access_token({
        "email": "candidate_tester@bugbash.com",
        "role": "candidate"
    })
    resp_cand = client.get("/api/v1/super-admin/dashboard/statistics", headers={
        "Authorization": f"Bearer {candidate_token}"
    })
    assert resp_cand.status_code == 403

    # 3. Standard Admin token -> 403 Forbidden
    admin_token, _ = admin_auth_service.create_admin_token({
        "email": "normal_admin_tester@bugbash.com",
        "name": "Standard Admin",
        "role": "admin",
        "permissions": ["assessments:manage"]
    })
    resp_admin = client.get("/api/v1/super-admin/dashboard/statistics", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert resp_admin.status_code == 403

    # 4. Standard Admin trying platform health -> 403 Forbidden
    resp_admin_health = client.get("/api/v1/super-admin/platform/health", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert resp_admin_health.status_code == 403
