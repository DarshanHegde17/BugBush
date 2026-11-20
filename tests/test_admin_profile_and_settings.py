"""
BugBash - Master Prompt 21: Admin Profile & Settings Test Suite
Verifies HTML & static asset delivery, RBAC enforcement, profile retrieval,
profile modification (with role elevation protection), photo uploads,
password complexity and change lifecycle, active device sessions & revocation,
security audit activity, appearance preferences, and personal notification preferences.
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
# 1. HTML & Static Asset Delivery Tests
# ==============================================================================
def test_admin_profile_and_settings_html_delivery():
    pages = [
        "/admin/profile",
        "/admin/profile.html",
        "/admin/settings",
        "/admin/settings.html",
        "/admin/security-settings",
        "/admin/security-settings.html",
        "/admin/notification-settings",
        "/admin/notification-settings.html"
    ]
    for page in pages:
        res = client.get(page)
        assert res.status_code == 200, f"Page {page} failed to load"
        assert "<!DOCTYPE html>" in res.text or "<html" in res.text


def test_admin_profile_and_settings_css_and_js_delivery():
    assets = [
        "/css/admin-profile.css",
        "/css/admin-settings.css",
        "/css/admin-security.css",
        "/css/admin-notification-settings.css",
        "/js/admin-profile.js",
        "/js/admin-settings.js",
        "/js/admin-security.js",
        "/js/admin-notification-settings.js"
    ]
    for asset in assets:
        res = client.get(asset)
        assert res.status_code == 200, f"Asset {asset} failed to load"
        assert len(res.text) > 30


# ==============================================================================
# 2. RBAC & Security Enforcement
# ==============================================================================
def test_admin_profile_unauthenticated_blocked():
    """Requests without token must be rejected with 401."""
    res = client.get("/api/v1/admin/profile")
    assert res.status_code == 401

    res = client.put("/api/v1/admin/profile", json={"full_name": "Hacker"})
    assert res.status_code == 401

    res = client.get("/api/v1/admin/security/sessions")
    assert res.status_code == 401

    res = client.get("/api/v1/admin/preferences")
    assert res.status_code == 401

    res = client.get("/api/v1/admin/notification-preferences")
    assert res.status_code == 401


def test_admin_profile_candidate_forbidden(candidate_token):
    """Candidate token must be forbidden on admin profile routes with 403."""
    headers = {"Authorization": f"Bearer {candidate_token}"}

    res = client.get("/api/v1/admin/profile", headers=headers)
    assert res.status_code == 403

    res = client.put("/api/v1/admin/profile", headers=headers, json={"full_name": "Candidate Attempt"})
    assert res.status_code == 403

    res = client.get("/api/v1/admin/security/sessions", headers=headers)
    assert res.status_code == 403

    res = client.get("/api/v1/admin/preferences", headers=headers)
    assert res.status_code == 403


# ==============================================================================
# 3. Profile Retrieval & Role Protection
# ==============================================================================
def test_admin_profile_get_and_update(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Get profile
    res = client.get("/api/v1/admin/profile", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "admin@bugbash.com"
    assert data["role"] in ["admin", "super_admin"]
    assert "permissions" in data
    assert data["account_status"] == "Active"

    # 2. Update profile permitted fields
    update_payload = {
        "full_name": "BugBash Lead Administrator",
        "phone_number": "+1 (555) 444-9999",
        "bio": "Senior evaluation director for regional hackathons."
    }
    res_up = client.put("/api/v1/admin/profile", headers=headers, json=update_payload)
    assert res_up.status_code == 200
    updated = res_up.json()
    assert updated["full_name"] == update_payload["full_name"]
    assert updated["phone_number"] == update_payload["phone_number"]

    # 3. Security Check: Disallow privilege escalation
    malicious_payload = {
        "role": "super_admin_god_mode",
        "permissions": ["*"],
        "account_status": "Bypassed",
        "email": "hacked@bugbash.com"
    }
    res_mal = client.put("/api/v1/admin/profile", headers=headers, json=malicious_payload)
    assert res_mal.status_code == 200
    safe_data = res_mal.json()
    assert safe_data["email"] == "admin@bugbash.com"  # Email unchanged
    assert safe_data["role"] in ["admin", "super_admin"]  # Role unchanged


# ==============================================================================
# 4. Profile Photo Upload
# ==============================================================================
def test_admin_profile_photo_upload(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Valid base64 image data
    photo_payload = {
        "photo_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    }
    res = client.post("/api/v1/admin/profile/photo", headers=headers, json=photo_payload)
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # Oversized photo rejection (simulate > 3MB)
    huge_payload = {"photo_data": "data:image/png;base64," + ("A" * (4 * 1024 * 1024))}
    res_huge = client.post("/api/v1/admin/profile/photo", headers=headers, json=huge_payload)
    assert res_huge.status_code == 400
    assert "exceeds" in res_huge.json()["detail"].lower()


# ==============================================================================
# 5. Password Security & Change Lifecycle
# ==============================================================================
def test_admin_password_change_validation(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Wrong current password
    res_bad_curr = client.post("/api/v1/admin/profile/change-password", headers=headers, json={
        "current_password": "WrongPassword123!",
        "new_password": "NewAdminPassword2026!",
        "confirm_password": "NewAdminPassword2026!"
    })
    assert res_bad_curr.status_code == 400
    assert "current password verification failed" in res_bad_curr.json()["detail"].lower()

    # 2. Mismatched confirmation
    res_mismatch = client.post("/api/v1/admin/profile/change-password", headers=headers, json={
        "current_password": "AdminSecure2026!",
        "new_password": "NewAdminPassword2026!",
        "confirm_password": "DifferentPassword2026!"
    })
    assert res_mismatch.status_code == 400
    assert "do not match" in res_mismatch.json()["detail"].lower()

    # 3. Weak password (no special char)
    res_weak = client.post("/api/v1/admin/profile/change-password", headers=headers, json={
        "current_password": "AdminSecure2026!",
        "new_password": "WeakPassword123",
        "confirm_password": "WeakPassword123"
    })
    assert res_weak.status_code == 400
    assert "special character" in res_weak.json()["detail"].lower()

    # 4. Valid password change
    res_valid = client.post("/api/v1/admin/profile/change-password", headers=headers, json={
        "current_password": "AdminSecure2026!",
        "new_password": "TemporaryAdminPass2026#",
        "confirm_password": "TemporaryAdminPass2026#",
        "revoke_other_sessions": True
    })
    assert res_valid.status_code == 200
    assert res_valid.json()["status"] == "success"

    # 5. Restore original password so subsequent test runs and fixture logins remain deterministic
    res_restore = client.post("/api/v1/admin/profile/change-password", headers=headers, json={
        "current_password": "TemporaryAdminPass2026#",
        "new_password": "AdminSecure2026!",
        "confirm_password": "AdminSecure2026!"
    })
    assert res_restore.status_code == 200


# ==============================================================================
# 6. Active Device Sessions Management
# ==============================================================================
def test_admin_sessions_management(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Get active sessions
    res = client.get("/api/v1/admin/security/sessions", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "sessions" in data
    assert len(data["sessions"]) >= 1

    session_id = data["sessions"][0]["session_id"]

    # 2. Revoke an individual session
    res_rev = client.delete(f"/api/v1/admin/security/sessions/{session_id}", headers=headers)
    assert res_rev.status_code == 200
    assert res_rev.json()["status"] == "success"

    # 3. Log out all other sessions
    res_logout_others = client.post("/api/v1/admin/security/logout-other-sessions", headers=headers)
    assert res_logout_others.status_code == 200
    assert res_logout_others.json()["status"] == "success"


# ==============================================================================
# 7. Security Activity Audit Telemetry
# ==============================================================================
def test_admin_security_activity(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/admin/security/activity", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "recent_activity" in data
    assert "password_last_changed" in data
    assert len(data["recent_activity"]) >= 1


# ==============================================================================
# 8. Preferences & Personal Notifications
# ==============================================================================
def test_admin_preferences_and_notifications(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Get appearance preferences
    res_pref = client.get("/api/v1/admin/preferences", headers=headers)
    assert res_pref.status_code == 200
    pref_data = res_pref.json()
    assert "theme" in pref_data
    assert "language" in pref_data

    # 2. Update appearance preferences
    new_prefs = {
        "theme": "light",
        "language": "en",
        "timezone": "America/New_York",
        "date_format": "YYYY-MM-DD",
        "default_view": "assessments",
        "table_page_size": 50
    }
    res_pref_up = client.put("/api/v1/admin/preferences", headers=headers, json=new_prefs)
    assert res_pref_up.status_code == 200
    assert res_pref_up.json()["theme"] == "light"
    assert res_pref_up.json()["timezone"] == "America/New_York"

    # 3. Get notification preferences
    res_notif = client.get("/api/v1/admin/notification-preferences", headers=headers)
    assert res_notif.status_code == 200
    notif_data = res_notif.json()
    assert notif_data["security_alerts"] is True

    # 4. Update notification preferences (attempting to turn off security_alerts)
    update_notif = {
        "assessment_updates": False,
        "candidate_activity": True,
        "submission_updates": True,
        "result_publication": False,
        "ml_evaluation_updates": True,
        "security_alerts": False,  # Should be overridden to True by security policy
        "system_announcements": True,
        "in_app": True,
        "email": True
    }
    res_notif_up = client.put("/api/v1/admin/notification-preferences", headers=headers, json=update_notif)
    assert res_notif_up.status_code == 200
    saved_notif = res_notif_up.json()
    assert saved_notif["assessment_updates"] is False
    assert saved_notif["security_alerts"] is True  # Enforced platform policy!
