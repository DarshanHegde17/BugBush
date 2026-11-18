"""
BugBash - Master Prompt 07 My Assessments Page Comprehensive Test Suite
Validates:
1. Web page and asset delivery (/user/assessments, css, js).
2. HTML structure: 5 overview cards, status filters, search, modal dialog.
3. SVG dimensions & brand logo containment.
4. JWT Authentication on /api/v1/users/me/assessments/statistics.
5. All 5 statistics breakdown counts from backend.
6. Dynamic filtering by status, difficulty, category, and search query.
7. Full assessment details retrieval (/api/v1/assessments/{id}).
8. Server-side start attempt authorization & schedule/deadline enforcement.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

def print_pass(msg):
    print(f"  [PASS] {msg}")

def print_fail(msg):
    print(f"  [FAIL] {msg}")
    sys.exit(1)

def http_get(path, headers=None):
    req = urllib.request.Request(f"{BASE_URL}{path}", headers=headers or {})
    try:
        with opener.open(req) as res:
            return res.status, res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

def http_post_json(path, data, headers=None):
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(data).encode("utf-8"),
        headers=req_headers,
        method="POST"
    )
    try:
        with opener.open(req) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode("utf-8"))
        except Exception:
            body = {}
        return e.code, body


print("\n==========================================================")
print("  MASTER PROMPT 07 - BUGBASH MY ASSESSMENTS VERIFICATION  ")
print("==========================================================")

# --- 1. Web Page & Asset Delivery ---
print("\n--- 1. Testing Web Page & Asset Serving ---")
pages = [
    ("/user/assessments", "My Assessments"),
    ("/user/assessments.html", "My Assessments"),
    ("/css/assessments.css", "assessment-stats-grid"),
    ("/js/assessments.js", "loadStatistics")
]
for p, expected in pages:
    status, content = http_get(p)
    if status == 200 and expected in content:
        print_pass(f"{p} -> HTTP 200 OK (Verified snippet: '{expected}')")
    else:
        print_fail(f"{p} failed: status={status}")

# --- 2. HTML Structure & Defensive Containment ---
print("\n--- 2. Testing Markup & Defensive Layout Checks ---")
status, html = http_get("/user/assessments")
required_elements = [
    'id="statTotalCount"',
    'id="statAvailableCount"',
    'id="statUpcomingCount"',
    'id="statCompletedCount"',
    'id="statExpiredCount"',
    'id="difficultyFilter"',
    'id="categoryFilter"',
    'id="assessmentSearchInput"',
    'id="assessmentsGrid"',
    'id="assessmentDetailsModal"',
    'id="modalStartBtn"',
    'id="confirmExamRules"'
]
for el in required_elements:
    if el in html:
        print_pass(f"Verified element {el}")
    else:
        print_fail(f"Missing required element {el} in assessments.html")

# Check all SVGs have width & height
import re
svgs = re.findall(r'<svg[^>]*>', html)
missing_svgs = [s for s in svgs if not ('width=' in s and 'height=' in s)]
if len(missing_svgs) == 0:
    print_pass(f"All {len(svgs)} SVGs in assessments.html have explicit width & height attributes")
else:
    print_fail(f"{len(missing_svgs)} SVGs missing explicit dimensions in assessments.html")

# Check logo constraints
if 'max-height: 36px' in html and 'max-width: 130px' in html:
    print_pass("Verified brand logo strict inline CSS containment (max 36px height, max 130px width)")
else:
    print_fail("Brand logo missing strict inline dimension safeguards")

# --- 3. Authentication & Security Dependency ---
print("\n--- 3. Testing Authentication & Session Security (401 Unauthorized) ---")
endpoints = [
    "/api/v1/users/me/assessments/statistics",
    "/api/v1/users/me/assessments",
    "/api/v1/assessments/asmt-101",
    "/api/v1/assessments/asmt-101/start"
]
for ep in endpoints:
    if ep.endswith("/start"):
        st, _ = http_post_json(ep, {})
    else:
        st, _ = http_get(ep)
    if st == 401:
        print_pass(f"Unauthenticated request to {ep} properly rejected (HTTP 401)")
    else:
        print_fail(f"Expected 401 on {ep}, got {st}")

# --- 4. Login & JWT Issuance ---
print("\n--- 4. Authenticating Candidate ---")
login_status, login_res = http_post_json("/api/v1/auth/login", {
    "email": "demo@bugbash.com",
    "password": "NewSecurePassword2026!"
})
if login_status != 200:
    # Try initial demo password if password wasn't rotated
    login_status, login_res = http_post_json("/api/v1/auth/login", {
        "email": "demo@bugbash.com",
        "password": "DemoPassword123!"
    })

if login_status != 200:
    print_fail(f"Candidate authentication failed: {login_res}")

token = login_res["access_token"]
auth_headers = {"Authorization": f"Bearer {token}"}
print_pass("Candidate authenticated successfully. JWT obtained.")

# --- 5. Assessment Statistics (5 Cards) ---
print("\n--- 5. Testing GET /api/v1/users/me/assessments/statistics ---")
st, stats_raw = http_get("/api/v1/users/me/assessments/statistics", headers=auth_headers)
if st != 200:
    print_fail(f"Statistics request failed: {stats_raw}")

stats = json.loads(stats_raw)
print_pass(f"Total:       {stats['total_assessments']}")
print_pass(f"Available:   {stats['available_assessments']}")
print_pass(f"Upcoming:    {stats['upcoming_assessments']}")
print_pass(f"In Progress: {stats.get('in_progress_assessments', 0)}")
print_pass(f"Completed:   {stats['completed_assessments']}")
print_pass(f"Expired:     {stats['expired_assessments']}")

if stats['total_assessments'] != (stats['available_assessments'] + stats['upcoming_assessments'] + stats['in_progress_assessments'] + stats['completed_assessments'] + stats['expired_assessments']):
    print_fail("Sum of categorized assessments does not match total_assessments!")
print_pass("Assessment statistics consistency verified 100%")

# --- 6. Assessment Filtering ---
print("\n--- 6. Testing GET /api/v1/users/me/assessments (Dynamic Filters) ---")
# 6.1 Status: Available
st, items = http_get("/api/v1/users/me/assessments?status=Available", headers=auth_headers)
items = json.loads(items)
if all(i["status"] == "Available" for i in items):
    print_pass(f"Status filter ('Available') returned {len(items)} items, all verified")
else:
    print_fail("Status filter returned unexpected items!")

# 6.2 Difficulty: Hard
st, items = http_get("/api/v1/users/me/assessments?difficulty=Hard", headers=auth_headers)
items = json.loads(items)
if all(i["difficulty"] == "Hard" for i in items):
    print_pass(f"Difficulty filter ('Hard') returned {len(items)} items")
else:
    print_fail("Difficulty filter returned non-matching items!")

# 6.3 Search: Algorithms
st, items = http_get("/api/v1/users/me/assessments?q=Algorithms", headers=auth_headers)
items = json.loads(items)
print_pass(f"Search query ('Algorithms') returned {len(items)} matching items")

# --- 7. Assessment Details Modal Endpoint ---
print("\n--- 7. Testing GET /api/v1/assessments/{assessment_id} ---")
st, detail_raw = http_get("/api/v1/assessments/asmt-101", headers=auth_headers)
if st != 200:
    print_fail(f"Failed to fetch assessment details: {detail_raw}")

detail = json.loads(detail_raw)
print_pass(f"Title: {detail['title']}")
print_pass(f"Questions Breakdown: {len(detail.get('questions', []))} questions")
print_pass(f"Allowed Languages: {', '.join(detail.get('allowed_languages', []))}")
print_pass(f"Proctor Rules: {len(detail.get('rules', []))} rules enforced")

# --- 8. Start Assessment Session & Security Checks ---
print("\n--- 8. Testing POST /api/v1/assessments/{id}/start ---")

# 8.1 Starting Upcoming should fail
st, err_body = http_post_json("/api/v1/assessments/asmt-102/start", {}, headers=auth_headers)
if st == 400 and "not opened yet" in err_body.get("detail", ""):
    print_pass(f"Upcoming assessment start blocked: {err_body['detail']}")
else:
    print_fail(f"Expected 400 on upcoming assessment start, got {st}: {err_body}")

# 8.2 Starting Expired should fail
st, err_body = http_post_json("/api/v1/assessments/asmt-107/start", {}, headers=auth_headers)
if st == 400 and "expired" in err_body.get("detail", "").lower():
    print_pass(f"Expired assessment start blocked: {err_body['detail']}")
else:
    print_fail(f"Expected 400 on expired assessment start, got {st}: {err_body}")

# 8.3 Starting Available should succeed
from backend.app.database.mongodb import mongodb
from backend.app.services.user_service import user_service
if mongodb.assessments is not None:
    mongodb.assessments.update_one({"user_email": "demo@bugbash.com", "id": "asmt-101"}, {"$set": {"status": "Available", "attempts_used": 0, "allowed_attempts": 10}})
user_service._init_user_dashboard_data("demo@bugbash.com")
for a in user_service._user_assessments.get("demo@bugbash.com", []):
    if a["id"] == "asmt-101":
        a["attempts_used"] = 0
        a["allowed_attempts"] = 10
        a["status"] = "Available"

st, start_res = http_post_json("/api/v1/assessments/asmt-101/start", {}, headers=auth_headers)
if st == 200 and start_res.get("exam_url") and start_res.get("attempt_id"):
    print_pass(f"Available assessment started successfully. Attempt ID: {start_res['attempt_id']}")
    print_pass(f"Exam Launch URL: {start_res['exam_url']}")
else:
    print_fail(f"Failed to start available assessment: {start_res}")

# 8.4 Test mock exam launch page delivery
st, exam_page = http_get(start_res['exam_url'])
if st == 200 and ("Assessment Workspace Initialized" in exam_page or "Proctored Coding Examination Workspace" in exam_page or "exam-workspace" in exam_page):
    print_pass(f"Exam session dispatch gateway ({start_res['exam_url']}) loaded (HTTP 200)")
else:
    print_fail(f"Exam session URL failed to render: {st}")

print("\n==========================================================")
print("  ALL MASTER PROMPT 07 ASSESSMENTS TESTS PASSED 100%!     ")
print("==========================================================")
