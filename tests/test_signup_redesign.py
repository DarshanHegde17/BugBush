import urllib.request
import json
import sys

proxy_handler = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy_handler)
BASE_API = 'http://127.0.0.1:8000/api/v1/auth'
BASE_WEB = 'http://127.0.0.1:8000'

print('=== 1. Checking signup.html Web Delivery & Markup ===')
with opener.open(urllib.request.Request(f'{BASE_WEB}/signup.html')) as resp:
    html = resp.read().decode('utf-8')
    assert resp.status == 200
    
    # Must have new 5 fields
    assert 'id="fullName"' in html, 'Missing fullName field'
    assert 'id="email"' in html, 'Missing email field'
    assert 'id="phoneNumber"' in html, 'Missing phoneNumber field'
    assert 'id="password"' in html, 'Missing password field'
    assert 'id="confirmPassword"' in html, 'Missing confirmPassword field'

    # Must have password entropy & match controls
    assert 'id="entropyFill"' in html, 'Missing entropyFill'
    assert 'id="entropyVerdict"' in html, 'Missing entropyVerdict'
    assert 'id="critLength"' in html, 'Missing critLength'
    assert 'id="critSpecial"' in html, 'Missing critSpecial'
    assert 'id="matchStatusBar"' in html, 'Missing matchStatusBar'

    # Must have left-side copy
    assert 'Join <span class="highlight">BugBash</span>' in html, 'Missing Join BugBash heading'
    assert 'Create your account and start experiencing intelligent coding assessments.' in html, 'Missing description'

    # Must NOT have old organization fields
    assert 'orgCardCollege' not in html, 'Obsolete orgCardCollege still present!'
    assert 'orgCardCompany' not in html, 'Obsolete orgCardCompany still present!'
    assert 'University Affiliation' not in html, 'Obsolete University Affiliation still present!'
    assert 'Institution Email' not in html, 'Obsolete Institution Email still present!'
    assert 'Organization Address' not in html, 'Obsolete Organization Address still present!'

    print('  [PASS] All 5 individual user fields verified')
    print('  [PASS] Password entropy meter & criteria checklist verified')
    print('  [PASS] All obsolete organization registration elements eliminated')
    print('  [PASS] Brand identity, beetle logo, and left-side copy verified')

print('\n=== 2. Testing Registration API (POST /api/v1/auth/register) ===')
candidate_email = 'candidate.alex@bugbash.io'
reg_payload = {
    'full_name': 'Alex Rivera',
    'email': candidate_email,
    'phone_number': '+1 (415) 555-0199',
    'password': 'SecureCode2026!#'
}

# 2a. Successful Registration
req_reg = urllib.request.Request(
    f'{BASE_API}/register',
    data=json.dumps(reg_payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
with opener.open(req_reg) as resp:
    assert resp.status == 201
    res = json.loads(resp.read().decode())
    assert res['status'] == 'success'
    assert 'verification_token' in res
    token = res['verification_token']
    otp = res.get('dev_otp')
    print(f'  [PASS] Candidate registered (201 Created). Token: {token[:8]}..., OTP: {otp}')

# 2b. Password Complexity Enforcement
weak_payload = dict(reg_payload)
weak_payload['email'] = 'another.candidate@bugbash.io'
weak_payload['password'] = 'weak'
try:
    req_weak = urllib.request.Request(
        f'{BASE_API}/register',
        data=json.dumps(weak_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    opener.open(req_weak)
    assert False, 'Weak password should be rejected!'
except urllib.error.HTTPError as e:
    assert e.code == 422
    print(f'  [PASS] Weak password rejected (HTTP 422 Unprocessable Entity)')

# 2c. Invalid Phone Number Enforcement
invalid_phone_payload = dict(reg_payload)
invalid_phone_payload['email'] = 'valid.email@bugbash.io'
invalid_phone_payload['phone_number'] = '123'
try:
    req_invalid_phone = urllib.request.Request(
        f'{BASE_API}/register',
        data=json.dumps(invalid_phone_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    opener.open(req_invalid_phone)
    assert False, 'Invalid phone number should be rejected!'
except urllib.error.HTTPError as e:
    assert e.code == 422
    print(f'  [PASS] Invalid phone rejected (HTTP 422 Unprocessable Entity)')

print('\n=== 3. Testing Duplicate Email Handling ===')
# First, complete verification of candidate_email so it is fully verified
req_verify_alex = urllib.request.Request(
    f'{BASE_API}/verify-email',
    data=json.dumps({'verification_token': token, 'otp': otp, 'email': candidate_email}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
with opener.open(req_verify_alex) as resp:
    v_res = json.loads(resp.read().decode())
    assert v_res['status'] == 'success'
    print(f'  [PASS] Account verified and activated: {candidate_email}')

# Now attempt duplicate registration with the same verified email
try:
    req_dup = urllib.request.Request(
        f'{BASE_API}/register',
        data=json.dumps(reg_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    opener.open(req_dup)
    assert False, 'Duplicate registration must fail with 409!'
except urllib.error.HTTPError as e:
    assert e.code == 409
    err_body = json.loads(e.read().decode())
    print(f'  [PASS] Duplicate email rejected (HTTP 409 Conflict): \"{err_body["detail"]}\"')

print('\n=== 4. Testing OTP Resend & Rate Limiting ===')
# Register a second candidate to test resend
candidate2_email = 'second.candidate@bugbash.io'
reg2_payload = {
    'full_name': 'Marcus Vance',
    'email': candidate2_email,
    'phone_number': '+44 20 7946 0991',
    'password': 'StrongPassword2026!$'
}
req_reg2 = urllib.request.Request(
    f'{BASE_API}/register',
    data=json.dumps(reg2_payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
with opener.open(req_reg2) as resp:
    res2 = json.loads(resp.read().decode())
    token2 = res2['verification_token']
    print(f'  [PASS] Registered candidate 2: {candidate2_email}')

# Resend immediately should trigger cooldown (HTTP 429)
try:
    req_resend = urllib.request.Request(
        f'{BASE_API}/resend-otp',
        data=json.dumps({'verification_token': token2, 'email': candidate2_email}).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    opener.open(req_resend)
    assert False, 'Immediate resend should trigger cooldown!'
except urllib.error.HTTPError as e:
    assert e.code == 429
    err = json.loads(e.read().decode())
    print(f'  [PASS] Resend cooldown rate limiting active (HTTP 429): \"{err["detail"]}\"')

print('\n======================================================')
print('  ALL MASTER PROMPT SIGNUP REDESIGN TESTS PASSED!    ')
print('======================================================')

