import urllib.request

proxy_handler = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy_handler)

routes = [
    '/',
    '/login',
    '/signup',
    '/verify-otp',
    '/forgot-password',
    '/reset-password',
    '/index.html',
    '/login.html',
    '/signup.html',
    '/verify-otp.html',
    '/forgot-password.html',
    '/reset-password.html',
    '/css/auth.css?v=1.4',
    '/css/signup.css?v=1.4',
    '/css/otp.css?v=1.4',
    '/css/forgot-password.css?v=1.4',
    '/css/reset-password.css?v=1.4',
    '/css/style.css?v=1.1',
    '/assets/images/bugbash-logo.png?v=1.1'
]

print("=== VERIFYING ALL ROUTES, PAGES & ASSETS ===")
all_pass = True
for r in routes:
    url = f"http://127.0.0.1:8000{r}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with opener.open(req) as resp:
            content = resp.read()
            print(f"  [OK] {r:35} -> HTTP {resp.status} ({len(content)} bytes)")
    except Exception as e:
        print(f"  [FAIL] {r:35} -> {e}")
        all_pass = False

if all_pass:
    print("\n>>> ALL ROUTES AND ASSETS VERIFIED 100% OK! <<<")
else:
    print("\n>>> SOME ROUTES FAILED <<<")
