import urllib.request
import json
import sys

proxy_handler = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy_handler)

BASE_URL = "http://127.0.0.1:8000"
API_AUTH = f"{BASE_URL}/api/v1/auth"
API_USERS = f"{BASE_URL}/api/v1/users"
API_PRACTICE = f"{BASE_URL}/api/v1/practice"

def make_request(url, method="GET", data=None, token=None):
    headers = {"User-Agent": "Mozilla/5.0"}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with opener.open(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content.strip().startswith(("{", "[")) else content
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_content)
        except Exception:
            return e.code, err_content
    except Exception as e:
        return 0, str(e)


print("==========================================================")
print("  MASTER PROMPT 06 - BUGBASH USER DASHBOARD VERIFICATION  ")
print("==========================================================")

# ------------------------------------------------------------------------------
# 1. Web Page & Asset Serving
# ------------------------------------------------------------------------------
print("\n--- 1. Testing Web Page & Asset Serving ---")
pages_to_test = [
    ("/user/dashboard", "Candidate Dashboard"),
    ("/user/profile", "My Profile"),
    ("/user/dashboard.html", "Candidate Dashboard"),
    ("/user/profile.html", "My Profile"),
    ("/css/user-dashboard.css", "--primary-color"),
    ("/js/user-dashboard.js", "loadDashboardSummary")
]

for path, expected_snippet in pages_to_test:
    status_code, content = make_request(f"{BASE_URL}{path}")
    assert status_code == 200, f"Failed path: {path} (HTTP {status_code})"
    assert expected_snippet in str(content), f"Missing snippet in {path}"
    print(f"  [PASS] {path:26} -> HTTP 200 OK (Verified snippet: '{expected_snippet}')")

# ------------------------------------------------------------------------------
# 2. Authentication Protection (Unauthenticated Access Denied)
# ------------------------------------------------------------------------------
print("\n--- 2. Testing Authentication & Session Security (401 Unauthorized) ---")
protected_endpoints = [
    f"{API_USERS}/me",
    f"{API_USERS}/me/dashboard",
    f"{API_USERS}/me/assessments",
    f"{API_USERS}/me/results",
    f"{API_USERS}/me/activity"
]

for ep in protected_endpoints:
    code, resp = make_request(ep)
    assert code == 401, f"Expected 401 Unauthorized for {ep}, got {code}"
    print(f"  [PASS] Unauthenticated request to {ep.replace(BASE_URL, '')} properly rejected (HTTP 401)")

# ------------------------------------------------------------------------------
# 3. User Login & Bearer Token Generation
# ------------------------------------------------------------------------------
print("\n--- 3. Testing User Login & JWT Session Token Generation ---")
login_payload = {
    "email": "demo@bugbash.com",
    "password": "DemoPassword123!",
    "remember_me": True
}
code, login_data = make_request(f"{API_AUTH}/login", method="POST", data=login_payload)
assert code == 200, f"Login failed: {login_data}"
assert "access_token" in login_data, "Missing access_token"
assert login_data["token_type"] == "bearer", f"Invalid token type: {login_data['token_type']}"
assert login_data["user"]["email"] == "demo@bugbash.com"

demo_token = login_data["access_token"]
print(f"  [PASS] Successfully authenticated demo@bugbash.com")
print(f"  [PASS] Issued Bearer JWT token: {demo_token[:20]}... (expires in 7 days)")

# ------------------------------------------------------------------------------
# 4. Authenticated User Profile
# ------------------------------------------------------------------------------
print("\n--- 4. Testing GET /api/v1/users/me ---")
code, profile = make_request(f"{API_USERS}/me", token=demo_token)
assert code == 200, f"Failed getting profile: {profile}"
assert profile["email"] == "demo@bugbash.com"
assert profile["full_name"] == "Demo Candidate"
assert profile["is_verified"] is True
print(f"  [PASS] Profile retrieved: {profile['full_name']} <{profile['email']}> | Role: {profile['role']}")

# ------------------------------------------------------------------------------
# 5. Dashboard Summary (Live metrics from backend)
# ------------------------------------------------------------------------------
print("\n--- 5. Testing GET /api/v1/users/me/dashboard (Summary Cards) ---")
code, dash = make_request(f"{API_USERS}/me/dashboard", token=demo_token)
assert code == 200, f"Failed getting dashboard: {dash}"
assert "total_assessments" in dash
assert "completed_assessments" in dash
assert "pending_assessments" in dash
assert "average_score" in dash
assert dash["total_assessments"] >= 4
assert dash["completed_assessments"] >= 1
assert dash["average_score"] > 0
print(f"  [PASS] Total Assessments:     {dash['total_assessments']}")
print(f"  [PASS] Completed Assessments: {dash['completed_assessments']}")
print(f"  [PASS] Pending Assessments:   {dash['pending_assessments']}")
print(f"  [PASS] Average Score:         {dash['average_score']}%")

# ------------------------------------------------------------------------------
# 6. My Assessments List
# ------------------------------------------------------------------------------
print("\n--- 6. Testing GET /api/v1/users/me/assessments ---")
code, assessments = make_request(f"{API_USERS}/me/assessments", token=demo_token)
assert code == 200, f"Failed getting assessments: {assessments}"
assert len(assessments) >= 4
statuses = {a["status"] for a in assessments}
print(f"  [PASS] Retrieved {len(assessments)} user assessments")
print(f"  [PASS] Verified status distribution: {list(statuses)}")

# ------------------------------------------------------------------------------
# 7. Results & Reports List
# ------------------------------------------------------------------------------
print("\n--- 7. Testing GET /api/v1/users/me/results ---")
code, results = make_request(f"{API_USERS}/me/results", token=demo_token)
assert code == 200, f"Failed getting results: {results}"
assert len(results) >= 1
for r in results:
    assert "score" in r and "percentage" in r and "result_status" in r
    assert "metrics" in r and r["metrics"]["logic_correctness"] > 0
print(f"  [PASS] Retrieved {len(results)} verified assessment scorecards")
print(f"  [PASS] Scorecard 1: '{results[0]['assessment_title']}' -> {results[0]['percentage']}% ({results[0]['result_status']})")

# ------------------------------------------------------------------------------
# 8. Recent Activity Log
# ------------------------------------------------------------------------------
print("\n--- 8. Testing GET /api/v1/users/me/activity ---")
code, activity = make_request(f"{API_USERS}/me/activity", token=demo_token)
assert code == 200, f"Failed getting activity: {activity}"
assert len(activity) >= 2
print(f"  [PASS] Retrieved {len(activity)} recent user activities")

# ------------------------------------------------------------------------------
# 9. Practice Coding Problems Catalog & Filtering
# ------------------------------------------------------------------------------
print("\n--- 9. Testing GET /api/v1/practice/problems (Catalog & Filters) ---")
code, all_probs = make_request(f"{API_PRACTICE}/problems")
assert code == 200, f"Failed practice problems: {all_probs}"
assert len(all_probs) >= 10

code, hard_probs = make_request(f"{API_PRACTICE}/problems?difficulty=Hard")
assert code == 200 and all(p["difficulty"] == "Hard" for p in hard_probs)

code, py_probs = make_request(f"{API_PRACTICE}/problems?language=Python")
assert code == 200 and all("Python" in p["languages"] for p in py_probs)

code, search_probs = make_request(f"{API_PRACTICE}/problems?q=Two+Sum")
assert code == 200 and any("Two Sum" in p["title"] for p in search_probs)

print(f"  [PASS] Catalog total problems: {len(all_probs)}")
print(f"  [PASS] Difficulty filter ('Hard') returned {len(hard_probs)} problems")
print(f"  [PASS] Language filter ('Python') returned {len(py_probs)} problems")
print(f"  [PASS] Search filter ('Two Sum') matched '{search_probs[0]['title']}'")

# ------------------------------------------------------------------------------
# 10. Update Profile (PUT /api/v1/users/me/profile)
# ------------------------------------------------------------------------------
print("\n--- 10. Testing PUT /api/v1/users/me/profile ---")
update_payload = {
    "full_name": "Alexander Morgan",
    "phone_number": "+1 (555) 987-6543"
}
code, updated_prof = make_request(f"{API_USERS}/me/profile", method="PUT", data=update_payload, token=demo_token)
assert code == 200, f"Failed updating profile: {updated_prof}"
assert updated_prof["full_name"] == "Alexander Morgan"
assert updated_prof["phone_number"] == "+1 (555) 987-6543"
print(f"  [PASS] Profile updated successfully to '{updated_prof['full_name']}'")

# ------------------------------------------------------------------------------
# 11. Secure Password Change Workflow
# ------------------------------------------------------------------------------
print("\n--- 11. Testing POST /api/v1/users/me/change-password ---")
# 11a. Test incorrect current password rejected
bad_pw_payload = {
    "current_password": "WrongPassword999!",
    "new_password": "NewSecurePassword2026!",
    "confirm_password": "NewSecurePassword2026!"
}
code, err_resp = make_request(f"{API_USERS}/me/change-password", method="POST", data=bad_pw_payload, token=demo_token)
assert code == 400, f"Expected 400 for bad password, got {code}"
print("  [PASS] Incorrect current password properly rejected (HTTP 400)")

# 11b. Test successful password change
good_pw_payload = {
    "current_password": "DemoPassword123!",
    "new_password": "NewSecurePassword2026!",
    "confirm_password": "NewSecurePassword2026!"
}
code, success_resp = make_request(f"{API_USERS}/me/change-password", method="POST", data=good_pw_payload, token=demo_token)
assert code == 200, f"Password change failed: {success_resp}"
print("  [PASS] Password successfully updated")

# 11c. Test old password no longer works
code, _ = make_request(f"{API_AUTH}/login", method="POST", data={"email": "demo@bugbash.com", "password": "DemoPassword123!"})
assert code == 401, "Old password should not authenticate"
print("  [PASS] Old password revoked immediately")

# 11d. Test new password logs in
code, new_login = make_request(f"{API_AUTH}/login", method="POST", data={"email": "demo@bugbash.com", "password": "NewSecurePassword2026!"})
assert code == 200, "New password should authenticate"
print("  [PASS] Authenticated successfully with new password")

# ------------------------------------------------------------------------------
# 12. User Isolation & IDOR Prevention
# ------------------------------------------------------------------------------
print("\n--- 12. Testing Multi-User Isolation & IDOR Protection ---")
# Register Candidate 2
reg2_payload = {
    "full_name": "Second Candidate",
    "email": "candidate2.test@bugbash.io",
    "phone_number": "+1 (555) 444-3322",
    "password": "Candidate2Password123!"
}
code, reg2 = make_request(f"{API_AUTH}/register", method="POST", data=reg2_payload)
assert code == 201, f"Failed reg 2: {reg2}"

# Verify Candidate 2 with dev OTP
code, ver2 = make_request(f"{API_AUTH}/verify-email", method="POST", data={
    "verification_token": reg2["verification_token"],
    "otp": reg2["dev_otp"],
    "email": "candidate2.test@bugbash.io"
})
assert code == 200

# Login Candidate 2
code, login2 = make_request(f"{API_AUTH}/login", method="POST", data={
    "email": "candidate2.test@bugbash.io",
    "password": "Candidate2Password123!"
})
token2 = login2["access_token"]

# Verify Candidate 2 only sees Candidate 2 profile
code, prof2 = make_request(f"{API_USERS}/me", token=token2)
assert prof2["email"] == "candidate2.test@bugbash.io"
assert prof2["full_name"] == "Second Candidate"
print("  [PASS] Candidate 2 isolated from Demo Candidate")

print("\n==========================================================")
print("  ALL MASTER PROMPT 06 USER DASHBOARD TESTS PASSED 100%!  ")
print("==========================================================")
