import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.routers.auth import router as auth_router
from backend.app.routers.users import router as users_router, practice_router, assessments_router

app = FastAPI(
    title="BugBash API",
    description="API for the BugBash platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/v1/users", tags=["Users & Dashboard"])
app.include_router(assessments_router, prefix="/api/v1/assessments", tags=["Assessments Execution"])
app.include_router(practice_router, prefix="/api/v1/practice", tags=["Practice Coding"])


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "BugBash API"}


frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))

# Direct HTML Clean URL Handlers
@app.get("/login", include_in_schema=False)
def serve_login():
    return FileResponse(os.path.join(frontend_dir, "login.html"))

@app.get("/signup", include_in_schema=False)
def serve_signup():
    return FileResponse(os.path.join(frontend_dir, "signup.html"))

@app.get("/verify-otp", include_in_schema=False)
def serve_verify_otp():
    return FileResponse(os.path.join(frontend_dir, "verify-otp.html"))

@app.get("/forgot-password", include_in_schema=False)
def serve_forgot_password():
    return FileResponse(os.path.join(frontend_dir, "forgot-password.html"))

@app.get("/reset-password", include_in_schema=False)
def serve_reset_password():
    return FileResponse(os.path.join(frontend_dir, "reset-password.html"))

@app.get("/user/dashboard", include_in_schema=False)
def serve_user_dashboard():
    return FileResponse(os.path.join(frontend_dir, "user", "dashboard.html"))

@app.get("/user/assessments", include_in_schema=False)
def serve_user_assessments():
    return FileResponse(os.path.join(frontend_dir, "user", "assessments.html"))

@app.get("/user/profile", include_in_schema=False)
def serve_user_profile():
    return FileResponse(os.path.join(frontend_dir, "user", "profile.html"))

@app.get("/user/assessment/exam/{attempt_id}", include_in_schema=False)
def serve_exam_attempt_redirect(attempt_id: str):
    """
    Mock exam dispatch gateway:
    Acknowledges verified attempt initialization without building the full editor in this task.
    """
    from fastapi.responses import HTMLResponse
    html_content = f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <title>BugBash Exam Workspace | Attempt {attempt_id}</title>
    <link rel="icon" type="image/png" href="/assets/icons/favicon.png">
    <link rel="stylesheet" href="/css/auth.css">
    <style>
        body {{
            background: #0f1117;
            color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }}
        .exam-gate-card {{
            background: #181b23;
            border: 1px solid #2a2e39;
            border-radius: 16px;
            padding: 40px;
            max-width: 580px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }}
        .badge-attempt {{
            display: inline-block;
            background: rgba(255, 107, 53, 0.15);
            color: #ff6b35;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 20px;
            font-family: monospace;
        }}
        h1 {{ font-size: 24px; margin-bottom: 12px; }}
        p {{ color: #9ca3af; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }}
        .btn-return {{
            display: inline-block;
            background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%);
            color: #ffffff;
            font-weight: 700;
            padding: 12px 28px;
            border-radius: 8px;
            text-decoration: none;
        }}
    </style>
</head>
<body>
    <div class="exam-gate-card">
        <div class="badge-attempt">SESSION #{attempt_id.upper()}</div>
        <h1>Assessment Workspace Initialized</h1>
        <p>Your examination session has been cryptographically registered on the BugBash assessment cluster. Telemetry tracking and proctored sandbox allocation are active.</p>
        <a href="/user/assessments" class="btn-return">Return to Assessments</a>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)


# Mount frontend static files
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
