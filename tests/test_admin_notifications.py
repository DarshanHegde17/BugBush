"""
BugBash - Master Prompt 20: Admin Notifications Management Test Suite
Verifies HTML & static asset delivery, RBAC enforcement, summary metrics,
multi-filtering, dynamic audience estimation, notification creation (immediate & scheduled),
details telemetry, lifecycle actions (send, cancel, retry, duplicate, archive),
and template management with safe variable interpolation.
"""

import pytest
from datetime import datetime, timedelta, timezone
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
def test_admin_notifications_html_delivery():
    pages = [
        "/admin/notifications",
        "/admin/notifications.html",
        "/admin/create-notification",
        "/admin/create-notification.html",
        "/admin/notification-details",
        "/admin/notification-details.html",
        "/admin/notification-templates",
        "/admin/notification-templates.html"
    ]
    for page in pages:
        res = client.get(page)
        assert res.status_code == 200, f"Page {page} failed to load"
        assert "<!DOCTYPE html>" in res.text or "<html" in res.text


def test_admin_notifications_css_and_js_delivery():
    assets = [
        "/css/notifications.css",
        "/css/notification-form.css",
        "/css/notification-details.css",
        "/css/notification-templates.css",
        "/js/notifications.js",
        "/js/notification-form.js",
        "/js/notification-details.js",
        "/js/notification-templates.js"
    ]
    for asset in assets:
        res = client.get(asset)
        assert res.status_code == 200, f"Asset {asset} failed to load"
        assert len(res.text) > 50


# ==============================================================================
# 2. RBAC & Security Enforcement
# ==============================================================================
def test_admin_notifications_unauthenticated_blocked():
    """Requests without token must be rejected with 401."""
    res = client.get("/api/v1/admin/notifications/statistics")
    assert res.status_code == 401

    res = client.get("/api/v1/admin/notifications")
    assert res.status_code == 401

    res = client.get("/api/v1/admin/notification-templates")
    assert res.status_code == 401


def test_admin_notifications_candidate_forbidden(candidate_token):
    """Candidate attempting admin notifications routes must be rejected with 403."""
    headers = {"Authorization": f"Bearer {candidate_token}"}
    
    res = client.get("/api/v1/admin/notifications/statistics", headers=headers)
    assert res.status_code == 403

    res = client.get("/api/v1/admin/notifications", headers=headers)
    assert res.status_code == 403

    res = client.post("/api/v1/admin/notifications", headers=headers, json={
        "title": "Unauthorized attempt",
        "message": "Should not pass"
    })
    assert res.status_code == 403


# ==============================================================================
# 3. Notification Summary Statistics
# ==============================================================================
def test_admin_notifications_statistics(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/admin/notifications/statistics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "total_notifications" in data
    assert "successfully_delivered" in data
    assert "pending_delivery" in data
    assert "failed_notifications" in data
    assert "scheduled_notifications" in data
    assert "read_notifications" in data
    assert data["total_notifications"] >= 1


# ==============================================================================
# 4. Audience Estimation (GET & POST)
# ==============================================================================
def test_admin_notifications_audience_estimation(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # GET test
    res = client.get("/api/v1/admin/notifications/recipients/estimate?target_audience=all_candidates", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "estimated_count" in data
    assert "audience_summary" in data
    assert data["estimated_count"] >= 0

    # POST test with individual candidates
    res_post = client.post("/api/v1/admin/notifications/recipients/estimate", headers=headers, json={
        "target_audience": "individual_candidates",
        "target_ids": ["student1@university.edu", "student2@university.edu"]
    })
    assert res_post.status_code == 200
    data_post = res_post.json()
    assert data_post["estimated_count"] == 2


# ==============================================================================
# 5. Notifications Listing & Multi-Filtering
# ==============================================================================
def test_admin_notifications_listing_and_filtering(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    res = client.get("/api/v1/admin/notifications?page=1&limit=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "notifications" in data
    assert len(data["notifications"]) > 0

    # Test filtering by category
    res_cat = client.get("/api/v1/admin/notifications?category=General Announcement", headers=headers)
    assert res_cat.status_code == 200
    for item in res_cat.json()["notifications"]:
        assert item["category"] == "General Announcement"

    # Test search
    res_search = client.get("/api/v1/admin/notifications?search=BugBash", headers=headers)
    assert res_search.status_code == 200
    assert len(res_search.json()["notifications"]) >= 1


# ==============================================================================
# 6. Notification Creation & Details
# ==============================================================================
def test_admin_notification_create_immediate(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    payload = {
        "title": "Automated Test Announcement",
        "message": "Dear {{candidate_name}}, this is an automated testing notification dispatch.",
        "category": "General Announcement",
        "priority": "High",
        "channel": "in_app",
        "target_audience": "all_candidates"
    }

    res = client.post("/api/v1/admin/notifications", headers=headers, json=payload)
    assert res.status_code == 201
    created = res.json()
    assert "id" in created
    assert created["title"] == payload["title"]
    assert created["status"] == "Delivered"
    notif_id = created["id"]

    # Verify detail endpoint
    res_detail = client.get(f"/api/v1/admin/notifications/{notif_id}", headers=headers)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["id"] == notif_id
    assert detail["title"] == payload["title"]
    assert "stats" in detail
    assert detail["stats"]["delivered"] >= 0


def test_admin_notification_create_scheduled_and_cancel(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    future_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    payload = {
        "title": "Scheduled Deadline Reminder Test",
        "message": "Reminder: Coding Assessment closes on {{due_date}}.",
        "category": "Deadline Alert",
        "priority": "Urgent",
        "channel": "in_app_and_email",
        "target_audience": "all_candidates",
        "scheduled_at": future_time
    }

    res = client.post("/api/v1/admin/notifications", headers=headers, json=payload)
    assert res.status_code == 201
    created = res.json()
    notif_id = created["id"]
    assert created["status"] == "Scheduled"
    assert created["scheduled_at"] == future_time

    # Cancel scheduled notification
    res_cancel = client.post(f"/api/v1/admin/notifications/{notif_id}/cancel", headers=headers)
    assert res_cancel.status_code == 200
    cancelled = res_cancel.json()
    assert cancelled["status"] == "Cancelled"


# ==============================================================================
# 7. Notification Lifecycle Actions (Send Now, Retry, Duplicate, Archive)
# ==============================================================================
def test_admin_notification_lifecycle_actions(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 1. Create a draft notification
    payload = {
        "title": "Draft Lifecycle Test",
        "message": "Draft message content for lifecycle testing.",
        "category": "New Assessment",
        "priority": "Normal",
        "channel": "email",
        "target_audience": "individual_candidates",
        "target_ids": ["test_cand@bugbash.com"]
    }
    # Passing empty scheduled_at means immediate send, but we can update to draft or send directly
    res = client.post("/api/v1/admin/notifications", headers=headers, json=payload)
    assert res.status_code == 201
    notif_id = res.json()["id"]

    # 2. Duplicate notification
    res_dup = client.post(f"/api/v1/admin/notifications/{notif_id}/duplicate", headers=headers)
    assert res_dup.status_code == 201
    dup_data = res_dup.json()
    assert dup_data["id"] != notif_id
    assert "Copy" in dup_data["title"]
    assert dup_data["status"] == "Draft"
    dup_id = dup_data["id"]

    # 3. Update the duplicate
    res_update = client.put(f"/api/v1/admin/notifications/{dup_id}", headers=headers, json={
        "title": "Updated Duplicate Notification"
    })
    assert res_update.status_code == 200
    assert res_update.json()["title"] == "Updated Duplicate Notification"

    # 4. Send the draft
    res_send = client.post(f"/api/v1/admin/notifications/{dup_id}/send", headers=headers)
    assert res_send.status_code == 200
    assert res_send.json()["status"] == "Delivered"

    # 5. Retry failed delivery
    res_retry = client.post(f"/api/v1/admin/notifications/{dup_id}/retry", headers=headers)
    assert res_retry.status_code == 200

    # 6. Archive notification
    res_archive = client.post(f"/api/v1/admin/notifications/{dup_id}/archive", headers=headers)
    assert res_archive.status_code == 200
    assert res_archive.json()["status"] == "Archived"

    # 7. Delivery breakdown
    res_delivery = client.get(f"/api/v1/admin/notifications/{dup_id}/delivery", headers=headers)
    assert res_delivery.status_code == 200
    assert "recipients" in res_delivery.json()


# ==============================================================================
# 8. Notification Templates CRUD & Safe Variable Preview
# ==============================================================================
def test_admin_notification_templates_crud_and_preview(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 1. List templates
    res = client.get("/api/v1/admin/notification-templates", headers=headers)
    assert res.status_code == 200
    templates = res.json()
    assert len(templates) >= 4  # Default seeded templates

    # 2. Safe variable preview
    preview_payload = {
        "subject": "Hello {{candidate_name}}, your score in {{assessment_name}} is ready!",
        "body": "Dear {{candidate_name}},\nYour final score is {{score}}.\nVisit {{result_link}} to inspect.",
        "sample_data": {
            "candidate_name": "Sarah Connor",
            "assessment_name": "Cybernetics 101",
            "score": "98/100",
            "result_link": "https://bugbash.dev/user/results/res-01"
        }
    }
    res_prev = client.post("/api/v1/admin/notification-templates/preview", headers=headers, json=preview_payload)
    assert res_prev.status_code == 200
    prev_data = res_prev.json()
    assert "Hello Sarah Connor, your score in Cybernetics 101 is ready!" in prev_data["interpolated_subject"]
    assert "Sarah Connor" in prev_data["interpolated_body"]
    assert "98/100" in prev_data["interpolated_body"]
    assert len(prev_data["missing_variables"]) == 0

    # 3. Create custom template
    create_payload = {
        "name": "Custom Placement Drive Invitation",
        "description": "Invite shortlisted candidates to campus drive rounds.",
        "category": "Assessment Assignment",
        "subject": "Invitation: {{assessment_name}} Placement Coding Round",
        "body": "Dear {{candidate_name}},\nYou have been invited to participate on {{due_date}}.",
        "variables": ["candidate_name", "assessment_name", "due_date"]
    }
    res_create = client.post("/api/v1/admin/notification-templates", headers=headers, json=create_payload)
    assert res_create.status_code == 201
    created_tmpl = res_create.json()
    tmpl_id = created_tmpl["template_id"]
    assert created_tmpl["name"] == create_payload["name"]
    assert created_tmpl["is_system"] is False

    # 4. Get template
    res_get = client.get(f"/api/v1/admin/notification-templates/{tmpl_id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["template_id"] == tmpl_id

    # 5. Update template
    res_update = client.put(f"/api/v1/admin/notification-templates/{tmpl_id}", headers=headers, json={
        "description": "Updated placement drive description"
    })
    assert res_update.status_code == 200
    assert res_update.json()["description"] == "Updated placement drive description"

    # 6. Delete template
    res_del = client.delete(f"/api/v1/admin/notification-templates/{tmpl_id}", headers=headers)
    assert res_del.status_code == 200
    assert res_del.json()["status"] in ["success", "deleted"]

    # 7. System templates must not be deleted
    system_tmpl_id = templates[0]["template_id"] if templates[0].get("is_system") else "tmpl-101"
    res_del_sys = client.delete(f"/api/v1/admin/notification-templates/{system_tmpl_id}", headers=headers)
    assert res_del_sys.status_code == 400
    assert "system notification templates cannot be deleted" in res_del_sys.json()["detail"].lower()
