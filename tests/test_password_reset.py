import urllib.request
import json
import sys

proxy_handler = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy_handler)
BASE_API = 'http://127.0.0.1:8000/api/v1/auth'
BASE_WEB = 'http://127.0.0.1:8000'

print('--- 1. Testing Web Page & Asset Serving ---')
assets = [
    'forgot-password.html',
    'reset-password.html',
    'css/forgot-password.css',
    'js/forgot-password.js',
    'js/reset-password.js'
]
for asset in assets:
    url = f'{BASE_WEB}/{asset}'
    with opener.open(urllib.request.Request(url)) as resp:
        content = resp.read().decode('utf-8')
        assert resp.status == 200, f'Failed {asset}'
        print(f'  [PASS] {asset} (200 OK, {len(content)} chars)')

print('\n--- 2. Testing HTML Structure & Attributes ---')
with opener.open(urllib.request.Request(f'{BASE_WEB}/forgot-password.html')) as resp:
    html = resp.read().decode('utf-8')
    assert 'id="forgotPasswordForm"' in html
    assert 'id="emailInput"' in html
    assert 'id="btnSubmit"' in html
    assert 'id="successState"' in html
    assert 'assets/images/bugbash-logo.png?v=1.1' in html
    print('  [PASS] forgot-password.html structural integrity verified')

with opener.open(urllib.request.Request(f'{BASE_WEB}/reset-password.html')) as resp:
    html = resp.read().decode('utf-8')
    assert 'id="resetPasswordForm"' in html
    assert 'id="newPassword"' in html
    assert 'id="confirmPassword"' in html
    assert 'id="entropyVerdict"' in html
    assert 'id="critLength"' in html
    assert 'id="critSpecial"' in html
    assert 'id="tokenVerifyingState"' in html
    assert 'id="invalidTokenState"' in html
    assert 'id="resetSuccessState"' in html
    print('  [PASS] reset-password.html structural integrity verified')

print('\n--- 3. Testing Forgot Password API & Generic Response ---')
req_forgot = urllib.request.Request(
    f'{BASE_API}/forgot-password',
    data=json.dumps({'email': 'engineer@bugbash.io'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
with opener.open(req_forgot) as resp:
    res = json.loads(resp.read().decode())
    assert res['status'] == 'success'
    assert 'If an account exists' in res['message']
    dev_url = res.get('dev_reset_url')
    assert dev_url and 'token=' in dev_url
    token = dev_url.split('token=')[-1]
    print(f'  [PASS] Generic message returned: "{res["message"]}"')
    print(f'  [PASS] Token issued: {token[:8]}...')

print('\n--- 4. Testing Token Verification Endpoint ---')
# Valid
with opener.open(urllib.request.Request(f'{BASE_API}/verify-reset-token?token={token}')) as resp:
    val = json.loads(resp.read().decode())
    assert val['valid'] is True
    print('  [PASS] Valid token acknowledged as valid: True')

# Invalid
with opener.open(urllib.request.Request(f'{BASE_API}/verify-reset-token?token=completely_fake_token_12345')) as resp:
    val = json.loads(resp.read().decode())
    assert val['valid'] is False
    print(f'  [PASS] Invalid token rejected: {val["reason"]}')

print('\n--- 5. Testing Password Complexity Enforcement ---')
weak_passwords = [
    'short',               # Too short
    'alllowercase123!',    # No uppercase
    'ALLUPPERCASE123!',    # No lowercase
    'NoNumbersHere!@#',    # No number
    'NoSpecialChar123'     # No special character
]
for weak_pw in weak_passwords:
    try:
        req_weak = urllib.request.Request(
            f'{BASE_API}/reset-password',
            data=json.dumps({'token': token, 'new_password': weak_pw}).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        opener.open(req_weak)
        assert False, f'Password "{weak_pw}" should have been rejected!'
    except urllib.error.HTTPError as e:
        assert e.code == 422, f'Expected 422, got {e.code}'
        print(f'  [PASS] Weak password rejected (422): "{weak_pw}"')

print('\n--- 6. Testing Successful Password Reset ---')
strong_pw = 'Enterprise@2026#Bash'
req_reset = urllib.request.Request(
    f'{BASE_API}/reset-password',
    data=json.dumps({'token': token, 'new_password': strong_pw}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
with opener.open(req_reset) as resp:
    reset_res = json.loads(resp.read().decode())
    assert reset_res['status'] == 'success'
    print(f'  [PASS] Password reset successfully: "{reset_res["message"]}"')

print('\n--- 7. Testing Single-Use Token Invalidation ---')
try:
    req_reuse = urllib.request.Request(
        f'{BASE_API}/reset-password',
        data=json.dumps({'token': token, 'new_password': 'AnotherPassword123!'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    opener.open(req_reuse)
    assert False, 'Reused token should fail'
except urllib.error.HTTPError as e:
    assert e.code == 400
    err_body = json.loads(e.read().decode())
    print(f'  [PASS] Reused token rejected (400): "{err_body["detail"]}"')

print('\n=============================================')
print('  ALL MASTER PROMPT 05 VERIFICATIONS PASSED! ')
print('=============================================')

