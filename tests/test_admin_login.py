import urllib.request
import json
import time
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

proxy_handler = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy_handler)

BASE_URL = "http://127.0.0.1:8000"
API_AUTH = f"{BASE_URL}/api/v1/auth"
API_ADMIN_AUTH = f"{BASE_URL}/api/v1/admin/auth"

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
print("  MASTER PROMPT 12 - BUGBASH ADMIN LOGIN VERIFICATION     ")
print("==========================================================")

# ------------------------------------------------------------------------------
# 1. Web Page & Asset Serving
# ------------------------------------------------------------------------------
print("\n--- 1. Testing Web Page & Asset Serving ---")
assets_to_test = [
    ("/admin/login", "Admin Portal"),
    ("/admin/login.html", "Welcome Back, Admin"),
    ("/css/admin-login.css", "admin-auth-container"),
    ("/js/admin-login.js", "handleLogin")
]

for path, snippet in assets_to_test:
    status_code, content = make_request(f"{BASE_URL}{path}")
    assert status_code == 200, f"Failed to serve {path}: HTTP {status_code}"
    assert snippet in str(content), f"Snippet '{snippet}' missing in {path}"
    print(f"  [PASS] {path:24} -> HTTP 200 OK (Contains '{snippet}')")

# ------------------------------------------------------------------------------
# 2. Strict UI Architectural Separation Checks
# ------------------------------------------------------------------------------
print("\n--- 2. Verifying UI Separation & Absence of Public Registration ---")
_, admin_login_html = make_request(f"{BASE_URL}/admin/login")
assert 'href="/signup"' not in admin_login_html and 'href="signup.html"' not in admin_login_html, \
    "Security Violation: Public Sign Up link detected on Admin Login page!"
print("  [PASS] Admin Login page has zero public registration links")

_, candidate_login_html = make_request(f"{BASE_URL}/login")
assert 'Role permissions (Admin' not in candidate_login_html, \
    "Separation Violation: Admin role option or label displayed on public /login page!"
print("  [PASS] Public /login page does not offer or display Admin role options")

# ------------------------------------------------------------------------------
# 3. Unauthenticated Rejection (HTTP 401)
# ------------------------------------------------------------------------------
print("\n--- 3. Testing Unauthenticated Access Rejection ---")
code, resp = make_request(f"{API_ADMIN_AUTH}/me")
assert code == 401, f"Expected 401 Unauthorized for /admin/auth/me, got {code}"
print("  [PASS] Unauthenticated request to /admin/auth/me properly rejected (HTTP 401)")

# ------------------------------------------------------------------------------
# 4. Role-Based Access Control: Candidate Blocked from Admin Portal (HTTP 403)
# ------------------------------------------------------------------------------
print("\n--- 4. Testing Role Authorization: Candidate Account Access Blocked ---")
# Authenticate candidate first
demo_pwd = "NewSecurePassword2026!"
code, login_candidate = make_request(f"{API_AUTH}/login", method="POST", data={
    "email": "demo@bugbash.com",
    "password": demo_pwd
})
if code != 200:
    demo_pwd = "DemoPassword123!"
    code, login_candidate = make_request(f"{API_AUTH}/login", method="POST", data={
        "email": "demo@bugbash.com",
        "password": demo_pwd
    })

assert code == 200, f"Candidate login failed: {login_candidate}"
candidate_token = login_candidate["access_token"]

# Candidate attempting GET /api/v1/admin/auth/me
code, me_cand_resp = make_request(f"{API_ADMIN_AUTH}/me", token=candidate_token)
assert code == 403, f"Expected 403 Forbidden for candidate on /admin/auth/me, got {code}"
print(f"  [PASS] Candidate Bearer token rejected by /admin/auth/me (HTTP 403: {me_cand_resp.get('detail')})")

# Candidate attempting POST /api/v1/admin/auth/login
code, login_cand_attempt = make_request(f"{API_ADMIN_AUTH}/login", method="POST", data={
    "email": "demo@bugbash.com",
    "password": demo_pwd
})
assert code == 403, f"Expected 403 Forbidden for candidate login attempt, got {code}"
assert "Candidate accounts are not permitted" in login_cand_attempt.get("detail", ""), \
    f"Unexpected error detail: {login_cand_attempt}"
print(f"  [PASS] Candidate credentials rejected by /admin/auth/login (HTTP 403: {login_cand_attempt.get('detail')})")

# ------------------------------------------------------------------------------
# 5. Invalid Credentials & Email Enumeration Protection (HTTP 401)
# ------------------------------------------------------------------------------
print("\n--- 5. Testing Generic Error Handling for Invalid Credentials ---")
# Non-existent email
code, bad_email_resp = make_request(f"{API_ADMIN_AUTH}/login", method="POST", data={
    "email": "nonexistent_admin@bugbash.com",
    "password": "SomePassword123!"
})
assert code == 401, f"Expected 401, got {code}"
assert "Invalid email or password" in bad_email_resp.get("detail", "")
print("  [PASS] Non-existent email rejected with generic message (HTTP 401)")

# Wrong password for existing admin
code, bad_pwd_resp = make_request(f"{API_ADMIN_AUTH}/login", method="POST", data={
    "email": "admin@bugbash.com",
    "password": "WrongPassword999!"
})
assert code == 401, f"Expected 401, got {code}"
assert "Invalid email or password" in bad_pwd_resp.get("detail", "")
print("  [PASS] Incorrect password rejected with identical generic message (HTTP 401)")

# ------------------------------------------------------------------------------
# 6. Rate Limiting Protection (HTTP 429)
# ------------------------------------------------------------------------------
print("\n--- 6. Testing Rate Limiting & Brute Force Defense ---")
test_rate_email = f"ratelimit_test_{int(time.time())}@bugbash.com"
# Trigger failed attempts
triggered_429 = False
for i in range(7):
    code, rl_resp = make_request(f"{API_ADMIN_AUTH}/login", method="POST", data={
        "email": test_rate_email,
        "password": "WrongPassword!"
    })
    if code == 429:
        triggered_429 = True
        print(f"  [PASS] Rate limiter triggered at attempt {i + 1} (HTTP 429: {rl_resp.get('detail')[:45]}...)")
        break

assert triggered_429, "Rate limiter did not trigger after multiple failed login attempts!"

# ------------------------------------------------------------------------------
# 7. Successful Administrator Login (HTTP 200)
# ------------------------------------------------------------------------------
print("\n--- 7. Testing Authorized Administrator Authentication ---")
code, admin_login_data = make_request(f"{API_ADMIN_AUTH}/login", method="POST", data={
    "email": "admin@bugbash.com",
    "password": "AdminSecure2026!",
    "remember_me": True
})
assert code == 200, f"Admin login failed: {admin_login_data}"
assert admin_login_data["status"] == "success"
assert admin_login_data["token_type"] == "bearer"
assert "access_token" in admin_login_data
assert admin_login_data["user"]["role"] in ("admin", "super_admin")
admin_token = admin_login_data["access_token"]
print(f"  [PASS] Successfully authenticated admin: {admin_login_data['user']['name']} ({admin_login_data['user']['email']})")
print(f"  [PASS] Assigned Role: {admin_login_data['user']['role']} | Redirect: {admin_login_data['redirect_url']}")

# ------------------------------------------------------------------------------
# 8. Testing GET /api/v1/admin/auth/me
# ------------------------------------------------------------------------------
print("\n--- 8. Testing GET /api/v1/admin/auth/me ---")
code, admin_profile = make_request(f"{API_ADMIN_AUTH}/me", token=admin_token)
assert code == 200, f"Failed to get admin profile: {admin_profile}"
assert admin_profile["email"] == "admin@bugbash.com"
assert len(admin_profile["permissions"]) > 0
print(f"  [PASS] Admin profile verified | Permissions: {admin_profile['permissions']}")

# ------------------------------------------------------------------------------
# 9. Testing POST /api/v1/admin/auth/logout & Token Revocation
# ------------------------------------------------------------------------------
print("\n--- 9. Testing Admin Logout & Immediate Token Revocation ---")
code, logout_data = make_request(f"{API_ADMIN_AUTH}/logout", method="POST", token=admin_token)
assert code == 200, f"Logout failed: {logout_data}"
assert logout_data["status"] == "success"
print(f"  [PASS] Logout endpoint confirmed: {logout_data['message']}")

# Verify that revoked token is immediately rejected
code, post_logout_me = make_request(f"{API_ADMIN_AUTH}/me", token=admin_token)
assert code == 401, f"Expected 401 Unauthorized after token revocation, got {code}"
print("  [PASS] Revoked token rejected on subsequent requests (HTTP 401)")

print("\n==========================================================")
print("  ALL MASTER PROMPT 12 ADMIN LOGIN TESTS PASSED 100%!     ")
print("==========================================================")
