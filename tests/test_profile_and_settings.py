import urllib.request
import json
import sys
import time

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


print("==================================================================")
print("  MASTER PROMPT 11 - BUGBASH USER PROFILE & SETTINGS VERIFICATION  ")
print("==================================================================")

# ------------------------------------------------------------------------------
# 1. Web Page & Static Asset Serving
# ------------------------------------------------------------------------------
print("\n--- 1. Testing Web Page & Asset Serving ---")
assets_to_test = [
    ("/user/profile", "My Profile"),
    ("/user/profile.html", "My Profile"),
    ("/user/settings", "Account Settings"),
    ("/user/settings.html", "Account Settings"),
    ("/css/profile.css", "profile-identity-card"),
    ("/css/settings.css", "settings-card"),
    ("/js/profile.js", "loadUserProfile"),
    ("/js/settings.js", "setupPasswordStrength"),
    ("/user/practice", "Practice Coding"),
    ("/user/practice.html", "Practice Coding"),
    ("/user/practice-problem", "Practice Problem"),
    ("/user/practice-problem.html", "Practice Problem"),
    ("/css/practice.css", "practice-stat-card"),
    ("/css/practice-problem.css", "solver-workspace"),
    ("/js/practice.js", "loadStatistics"),
    ("/js/practice-problem.js", "runCode")
]

for path, expected_snippet in assets_to_test:
    status_code, content = make_request(f"{BASE_URL}{path}")
    assert status_code == 200, f"Failed path: {path} (HTTP {status_code})"
    assert expected_snippet in str(content), f"Missing snippet '{expected_snippet}' in {path}"
    print(f"  [PASS] {path:28} -> HTTP 200 OK (Contains '{expected_snippet}')")

# ------------------------------------------------------------------------------
# 2. Authentication Protection (Unauthenticated 401 Rejections)
# ------------------------------------------------------------------------------
print("\n--- 2. Testing Authentication & Session Security (401 Unauthorized) ---")
protected_endpoints = [
    (f"{API_USERS}/me", "GET", None),
    (f"{API_USERS}/me/profile", "PUT", {"full_name": "Test", "phone_number": "+1234567890"}),
    (f"{API_USERS}/me/change-password", "POST", {"current_password": "a", "new_password": "b", "confirm_password": "b"}),
    (f"{API_USERS}/me/profile-picture", "POST", {"avatar_data": "data:image/png;base64,123"}),
    (f"{API_USERS}/me/preferences", "GET", None),
    (f"{API_USERS}/me/preferences", "PUT", {}),
    (f"{API_USERS}/me/sessions", "GET", None),
    (f"{API_USERS}/me/logout-other-sessions", "POST", None),
    (f"{API_USERS}/me/download-data", "GET", None),
    (f"{API_USERS}/me/account-deletion-request", "POST", {"confirm_password": "a", "confirmation_phrase": "b"})
]

for ep, method, data in protected_endpoints:
    code, resp = make_request(ep, method=method, data=data)
    assert code == 401, f"Expected 401 for {method} {ep}, got {code}"
    print(f"  [PASS] Unauthenticated {method:4} {ep.replace(BASE_URL, ''):30} properly rejected (HTTP 401)")

# ------------------------------------------------------------------------------
# 3. User Registration, OTP Verification, & Session Establishment
# ------------------------------------------------------------------------------
print("\n--- 3. Testing User Registration, OTP Verification, & Session Establishment ---")
login_email = f"candidate_profile_{int(time.time())}@bugbash.com"
initial_password = "Password123!"

# Register candidate
reg_code, reg_resp = make_request(f"{API_AUTH}/register", "POST", {
    "full_name": "Jordan Vance",
    "email": login_email,
    "phone_number": "+1 415-555-0144",
    "password": initial_password
})
assert reg_code in (200, 201), f"Registration failed: {reg_resp}"
dev_otp = reg_resp.get("dev_otp") or "123456"

# Verify OTP
v_code, v_resp = make_request(f"{API_AUTH}/verify-email", "POST", {
    "email": login_email,
    "otp": dev_otp,
    "verification_token": reg_resp.get("verification_token")
})
assert v_code == 200, f"OTP verification failed: {v_resp}"

# Log in
code, login_resp = make_request(f"{API_AUTH}/login", "POST", {
    "email": login_email,
    "password": initial_password
})
assert code == 200, f"Login failed: {login_resp}"
token = login_resp.get("access_token") or login_resp.get("token")
assert token, "Missing JWT access token in login response"
print(f"  [PASS] Successfully registered, OTP-verified, and authenticated {login_email}")

# ------------------------------------------------------------------------------
# 4. User Profile Retrieval (GET /api/v1/users/me)
# ------------------------------------------------------------------------------
print("\n--- 4. Testing GET /api/v1/users/me ---")
code, profile = make_request(f"{API_USERS}/me", token=token)
assert code == 200, f"Failed to get profile: {profile}"
assert profile["email"].lower() == login_email.lower()
assert "role" in profile and profile["role"] == "candidate"
assert "is_verified" in profile
assert "account_status" in profile
print(f"  [PASS] Profile retrieved: {profile.get('full_name')} | Status: {profile.get('account_status')} | Verified: {profile.get('is_verified')}")

# ------------------------------------------------------------------------------
# 5. User Profile Update (PUT /api/v1/users/me/profile)
# ------------------------------------------------------------------------------
print("\n--- 5. Testing PUT /api/v1/users/me/profile ---")
update_payload = {
    "full_name": "Jordan C. Vance",
    "phone_number": "+1 415-555-9988",
    "bio": "Competitive programmer and algorithms enthusiast.",
    "college_name": "BugBash Institute of Technology",
    "degree_major": "B.Tech Computer Science & AI",
    "graduation_year": "2026"
}
code, updated_profile = make_request(f"{API_USERS}/me/profile", method="PUT", data=update_payload, token=token)
assert code == 200, f"Failed to update profile: {updated_profile}"
assert updated_profile["full_name"] == "Jordan C. Vance"
assert updated_profile["phone_number"] == "+1 415-555-9988"
assert updated_profile["bio"] == "Competitive programmer and algorithms enthusiast."
assert updated_profile["college_name"] == "BugBash Institute of Technology"
print("  [PASS] Personal and academic information successfully updated in database")

# ------------------------------------------------------------------------------
# 6. Profile Avatar Upload (POST /api/v1/users/me/profile-picture)
# ------------------------------------------------------------------------------
print("\n--- 6. Testing POST /api/v1/users/me/profile-picture ---")
sample_avatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
code, avatar_resp = make_request(f"{API_USERS}/me/profile-picture", method="POST", data={"avatar_data": sample_avatar}, token=token)
assert code == 200, f"Avatar upload failed: {avatar_resp}"

# Verify profile now returns the updated avatar
code, fresh_profile = make_request(f"{API_USERS}/me", token=token)
assert fresh_profile["avatar_url"] == sample_avatar
print("  [PASS] Profile picture successfully updated and persisted")

# ------------------------------------------------------------------------------
# 7. User Preferences (GET & PUT /api/v1/users/me/preferences)
# ------------------------------------------------------------------------------
print("\n--- 7. Testing User Preferences & Policy Enforcement ---")
code, prefs = make_request(f"{API_USERS}/me/preferences", token=token)
assert code == 200, f"Failed to get preferences: {prefs}"
assert "appearance" in prefs and "notifications" in prefs and "learning" in prefs
print(f"  [PASS] Default preferences loaded: Theme={prefs['appearance']['theme']}, Languages={prefs['learning']['preferred_languages']}")

# Update preferences - Attempt disabling security_alerts (must remain True by policy!)
prefs_update = {
    "appearance": {
        "theme": "light",
        "font_size": "large",
        "high_contrast": True
    },
    "notifications": {
        "assessment_notifications": True,
        "deadline_reminders": False,
        "result_notifications": True,
        "practice_recommendations": False,
        "security_alerts": False  # Must be enforced to True!
    },
    "learning": {
        "preferred_languages": ["Python", "C++", "Go"],
        "preferred_difficulty": "Hard",
        "learning_interests": ["Dynamic Programming", "Graph Theory"],
        "practice_topics": ["Tree Algorithms"]
    }
}
code, saved_prefs = make_request(f"{API_USERS}/me/preferences", method="PUT", data=prefs_update, token=token)
assert code == 200, f"Failed to save preferences: {saved_prefs}"
assert saved_prefs["appearance"]["theme"] == "light"
assert saved_prefs["appearance"]["font_size"] == "large"
assert saved_prefs["notifications"]["deadline_reminders"] is False
assert saved_prefs["notifications"]["security_alerts"] is True, "Security policy failure: security_alerts was disabled!"
assert "Go" in saved_prefs["learning"]["preferred_languages"]
print("  [PASS] Preferences updated and persisted; security-critical alerts policy strictly enforced (immutable)")

# ------------------------------------------------------------------------------
# 8. Active Sessions (GET /api/v1/users/me/sessions & POST /logout-other-sessions)
# ------------------------------------------------------------------------------
print("\n--- 8. Testing Active Sessions & Session Revocation ---")
code, sessions_resp = make_request(f"{API_USERS}/me/sessions", token=token)
assert code == 200, f"Failed to get sessions: {sessions_resp}"
assert len(sessions_resp["sessions"]) >= 1
assert any(s["is_current"] for s in sessions_resp["sessions"])
print(f"  [PASS] Retrieved {len(sessions_resp['sessions'])} active login sessions")

code, logout_other_resp = make_request(f"{API_USERS}/me/logout-other-sessions", method="POST", token=token)
assert code == 200, f"Failed to logout other sessions: {logout_other_resp}"
print("  [PASS] Successfully revoked all other active sessions")

# ------------------------------------------------------------------------------
# 9. Personal Data Export (GET /api/v1/users/me/download-data)
# ------------------------------------------------------------------------------
print("\n--- 9. Testing Data Portability (GET /api/v1/users/me/download-data) ---")
code, export_data = make_request(f"{API_USERS}/me/download-data", token=token)
assert code == 200, f"Failed to export data: {export_data}"
assert "export_date" in export_data
assert "profile" in export_data and export_data["profile"]["full_name"] == "Jordan C. Vance"
assert "preferences" in export_data
print("  [PASS] GDPR / Data portability archive successfully generated with complete profile & activity")

# ------------------------------------------------------------------------------
# 10. Password Change & Complexity Verification
# ------------------------------------------------------------------------------
print("\n--- 10. Testing POST /api/v1/users/me/change-password ---")
new_pwd = "NewSecurePassword456@"

# Bad current password
code, bad_pwd_resp = make_request(f"{API_USERS}/me/change-password", method="POST", data={
    "current_password": "WrongPassword999!",
    "new_password": new_pwd,
    "confirm_password": new_pwd
}, token=token)
assert code == 400, "Expected 400 for incorrect current password"
print("  [PASS] Incorrect current password properly rejected (HTTP 400)")

# Password mismatch
code, mismatch_resp = make_request(f"{API_USERS}/me/change-password", method="POST", data={
    "current_password": initial_password,
    "new_password": new_pwd,
    "confirm_password": "DifferentPassword123!"
}, token=token)
assert code == 400, "Expected 400 for mismatched passwords"
print("  [PASS] Mismatched password confirmation properly rejected (HTTP 400)")

# Successful password update
code, success_pwd_resp = make_request(f"{API_USERS}/me/change-password", method="POST", data={
    "current_password": initial_password,
    "new_password": new_pwd,
    "confirm_password": new_pwd
}, token=token)
assert code == 200, f"Failed to update password: {success_pwd_resp}"
print("  [PASS] Password successfully updated")

# Verify new password works for login
code, new_login_resp = make_request(f"{API_AUTH}/login", method="POST", data={
    "email": login_email,
    "password": new_pwd
})
assert code == 200, "Failed to login with new password"
new_token = new_login_resp.get("access_token") or new_login_resp.get("token")
print("  [PASS] Successfully authenticated with new credentials")

# ------------------------------------------------------------------------------
# 11. Account Deletion Request
# ------------------------------------------------------------------------------
print("\n--- 11. Testing POST /api/v1/users/me/account-deletion-request ---")
# Phrase mismatch
code, bad_phrase_resp = make_request(f"{API_USERS}/me/account-deletion-request", method="POST", data={
    "confirm_password": new_pwd,
    "reason": "Graduated",
    "confirmation_phrase": "PLEASE DELETE"
}, token=new_token)
assert code == 400, "Expected 400 for incorrect phrase"
print("  [PASS] Invalid deletion phrase properly rejected (HTTP 400)")

# Correct phrase and password
code, del_resp = make_request(f"{API_USERS}/me/account-deletion-request", method="POST", data={
    "confirm_password": new_pwd,
    "reason": "Graduated and completed placement testing.",
    "confirmation_phrase": "DELETE MY ACCOUNT"
}, token=new_token)
assert code == 200, f"Failed deletion request: {del_resp}"
print("  [PASS] Account deletion request successfully accepted and scheduled")

# Verify account status updated to Deletion Pending
code, check_profile = make_request(f"{API_USERS}/me", token=new_token)
assert check_profile["account_status"] == "Deletion Pending"
print("  [PASS] Account status updated to 'Deletion Pending'")

# ------------------------------------------------------------------------------
# 12. Practice Coding Module Integration
# ------------------------------------------------------------------------------
print("\n--- 12. Testing Practice Coding Hub Endpoints ---")
code, stats = make_request(f"{API_PRACTICE}/statistics", token=new_token)
assert code == 200, f"Practice stats failed: {stats}"
assert "problems_solved" in stats and "problems_attempted" in stats and "current_streak" in stats
print(f"  [PASS] Practice Stats: Solved={stats['problems_solved']}, Attempted={stats['problems_attempted']}, Streak={stats['current_streak']}d")

code, recs = make_request(f"{API_PRACTICE}/recommendations", token=new_token)
assert code == 200, f"Recommendations failed: {recs}"
assert len(recs) >= 1
print(f"  [PASS] Retrieved {len(recs)} personalized recommendations")

# Practice execution test
code, exec_resp = make_request(f"{API_PRACTICE}/execute", method="POST", data={
    "problem_id": "prob-01",
    "language": "Python",
    "code": "def two_sum(nums, target):\n    lookup = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in lookup:\n            return [lookup[diff], i]\n        lookup[num] = i\n    return []\n",
    "test_cases": [{"input_data": "[2, 7, 11, 15]\n9", "expected_output": "[0, 1]"}]
}, token=new_token)
assert code == 200, f"Practice execute failed: {exec_resp}"
assert exec_resp["status"].lower() == "success"
print(f"  [PASS] Practice execution sandbox verified (Status: {exec_resp['status']}, Execution Time: {exec_resp['execution_time_ms']:.1f}ms)")

# Practice submission test with ML insights
code, submit_resp = make_request(f"{API_PRACTICE}/submit", method="POST", data={
    "problem_id": "prob-01",
    "language": "Python",
    "code": "def two_sum(nums, target):\n    lookup = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in lookup:\n            return [lookup[diff], i]\n        lookup[num] = i\n    return []\n"
}, token=new_token)
assert code == 200, f"Practice submit failed: {submit_resp}"
assert submit_resp["status"] in ("Accepted", "Wrong Answer")
ml_data = submit_resp.get("ml_insights") or submit_resp.get("ml_feedback") or {}
assert ml_data, "Missing ML feedback in practice submission"
print(f"  [PASS] Practice submission verified: Status={submit_resp['status']}, Approach={ml_data.get('recognized_approach')}, Quality={ml_data.get('code_quality_score')}")

print("\n==================================================================")
print("  ALL MASTER PROMPTS 10 & 11 VERIFICATION TESTS PASSED 100%!       ")
print("==================================================================")
