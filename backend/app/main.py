import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.routers.auth import router as auth_router
from backend.app.routers.users import router as users_router, practice_router, assessments_router
from backend.app.routers.exam import (
    attempts_router,
    questions_router,
    executions_router,
    submissions_router
)

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
app.include_router(attempts_router)
app.include_router(questions_router)
app.include_router(executions_router)
app.include_router(submissions_router)


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

@app.get("/user/assessment/exam", include_in_schema=False)
@app.get("/user/assessment/exam/{attempt_id}", include_in_schema=False)
def serve_exam_attempt(attempt_id: str = ""):
    """Serves the main BugBash coding examination interface."""
    exam_file = os.path.join(frontend_dir, "user", "assessment", "exam.html")
    if os.path.exists(exam_file):
        return FileResponse(exam_file)
    return FileResponse(os.path.join(frontend_dir, "user", "assessments.html"))


# Mount frontend static files
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
