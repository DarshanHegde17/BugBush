import os
from dotenv import load_dotenv

# Load environment configuration from .env file
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app.routers.auth import router as auth_router
from backend.app.routers.admin_auth import router as admin_auth_router
from backend.app.routers.super_admin_auth import router as super_admin_auth_router
from backend.app.routers.super_admin_dashboard import (
    dashboard_router as super_admin_dashboard_router,
    platform_router as super_admin_platform_router
)
from backend.app.routers.super_admin_admins import router as super_admin_admins_router
from backend.app.routers.super_admin_roles import roles_router as super_admin_roles_router, admin_roles_router as super_admin_admin_roles_router
from backend.app.routers.super_admin_config import (
    config_router as super_admin_config_router,
    integrations_router as super_admin_integrations_router,
    public_config_router
)
from backend.app.services.super_admin_config_service import super_admin_config_service
from backend.app.routers.admin_dashboard import router as admin_dashboard_router
from backend.app.routers.admin_assessments import router as admin_assessments_router
from backend.app.routers.admin_candidates import router as admin_candidates_router, groups_router as admin_groups_router
from backend.app.routers.admin_submissions import router as admin_submissions_router
from backend.app.routers.admin_results import router as admin_results_router
from backend.app.routers.admin_ml_insights import router as admin_ml_insights_router
from backend.app.routers.admin_notifications import router as admin_notifications_router, templates_router as admin_templates_router
from backend.app.routers.admin_profile import (
    router as admin_profile_router,
    security_router as admin_security_router,
    preferences_router as admin_preferences_router,
    notification_prefs_router as admin_notification_prefs_router
)
from backend.app.routers.users import router as users_router, assessments_router
from backend.app.routers.practice import router as practice_router
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


@app.middleware("http")
async def maintenance_mode_middleware(request: Request, call_next):
    """Enforces platform maintenance mode across non-exempt routes and endpoints."""
    if super_admin_config_service.is_maintenance_active():
        path = request.url.path
        exempt_prefixes = (
            "/super-admin",
            "/api/v1/super-admin",
            "/api/health",
            "/assets",
            "/css",
            "/js",
            "/api/v1/public"
        )
        is_exempt = any(path.startswith(p) for p in exempt_prefixes)
        if not is_exempt:
            if path.startswith("/api/"):
                maint_info = super_admin_config_service.get_public_maintenance_status()
                return JSONResponse(
                    status_code=503,
                    content={
                        "status": "maintenance",
                        "message": maint_info["message"],
                        "start_time": maint_info["start_time"],
                        "end_time": maint_info["end_time"]
                    }
                )
    return await call_next(request)


# Include API Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(admin_auth_router, prefix="/api/v1/admin/auth", tags=["Admin Authentication"])
app.include_router(super_admin_auth_router, prefix="/api/v1/super-admin/auth", tags=["Super Admin Authentication"])
app.include_router(super_admin_dashboard_router, prefix="/api/v1/super-admin/dashboard", tags=["Super Admin Dashboard"])
app.include_router(super_admin_platform_router, prefix="/api/v1/super-admin/platform", tags=["Super Admin Platform"])
app.include_router(super_admin_admins_router, prefix="/api/v1/super-admin/admins", tags=["Super Admin Admin Management"])
app.include_router(super_admin_roles_router, prefix="/api/v1/super-admin", tags=["Super Admin Roles & Permissions"])
app.include_router(super_admin_admin_roles_router, prefix="/api/v1/super-admin/admins", tags=["Super Admin Admin Role Assignments"])
app.include_router(super_admin_config_router, prefix="/api/v1/super-admin/configuration", tags=["Super Admin Configuration"])
app.include_router(super_admin_integrations_router, prefix="/api/v1/super-admin/integrations", tags=["Super Admin Integrations"])
app.include_router(public_config_router, prefix="/api/v1/public", tags=["Public Configuration"])
app.include_router(admin_dashboard_router, prefix="/api/v1/admin", tags=["Admin Dashboard"])
app.include_router(admin_assessments_router, prefix="/api/v1/admin/assessments", tags=["Admin Assessment Management"])
app.include_router(admin_candidates_router, prefix="/api/v1/admin/candidates", tags=["Admin Candidates Management"])
app.include_router(admin_groups_router, prefix="/api/v1/admin/candidate-groups", tags=["Admin Candidate Groups"])
app.include_router(admin_submissions_router, prefix="/api/v1/admin/submissions", tags=["Admin Submissions Management"])
app.include_router(admin_results_router, prefix="/api/v1/admin/results", tags=["Admin Results & Analytics"])
app.include_router(admin_ml_insights_router, prefix="/api/v1/admin/ml-insights", tags=["Admin ML Insights"])
app.include_router(admin_notifications_router, prefix="/api/v1/admin/notifications", tags=["Admin Notifications Management"])
app.include_router(admin_templates_router, prefix="/api/v1/admin/notification-templates", tags=["Admin Notification Templates"])
app.include_router(admin_profile_router, prefix="/api/v1/admin/profile", tags=["Admin Profile"])
app.include_router(admin_security_router, prefix="/api/v1/admin/security", tags=["Admin Security"])
app.include_router(admin_preferences_router, prefix="/api/v1/admin/preferences", tags=["Admin Preferences"])
app.include_router(admin_notification_prefs_router, prefix="/api/v1/admin/notification-preferences", tags=["Admin Notification Preferences"])
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

@app.get("/user/settings", include_in_schema=False)
def serve_user_settings():
    return FileResponse(os.path.join(frontend_dir, "user", "settings.html"))

@app.get("/user/practice", include_in_schema=False)
def serve_user_practice():
    return FileResponse(os.path.join(frontend_dir, "user", "practice.html"))

@app.get("/user/practice/problem/{problem_id}", include_in_schema=False)
@app.get("/user/practice-problem", include_in_schema=False)
def serve_user_practice_problem(problem_id: str = ""):
    return FileResponse(os.path.join(frontend_dir, "user", "practice-problem.html"))

@app.get("/user/assessment/exam", include_in_schema=False)
@app.get("/user/assessment/exam/{attempt_id}", include_in_schema=False)
def serve_exam_attempt(attempt_id: str = ""):
    """Serves the main BugBash coding examination interface."""
    exam_file = os.path.join(frontend_dir, "user", "assessment", "exam.html")
    if os.path.exists(exam_file):
        return FileResponse(exam_file)
    return FileResponse(os.path.join(frontend_dir, "user", "assessments.html"))


@app.get("/admin/login", include_in_schema=False)
def serve_admin_login():
    return FileResponse(os.path.join(frontend_dir, "admin", "login.html"))

@app.get("/admin/dashboard", include_in_schema=False)
def serve_admin_dashboard():
    dashboard_file = os.path.join(frontend_dir, "admin", "dashboard.html")
    if os.path.exists(dashboard_file):
        return FileResponse(dashboard_file)
    return FileResponse(os.path.join(frontend_dir, "admin", "login.html"))


@app.get("/admin/profile", include_in_schema=False)
def serve_admin_profile():
    profile_file = os.path.join(frontend_dir, "admin", "profile.html")
    if os.path.exists(profile_file):
        return FileResponse(profile_file)
    return FileResponse(os.path.join(frontend_dir, "admin", "dashboard.html"))

@app.get("/admin/{page}", include_in_schema=False)
def serve_admin_page(page: str):
    filename = page if page.endswith(".html") else f"{page}.html"
    target = os.path.join(frontend_dir, "admin", filename)
    if os.path.exists(target):
        return FileResponse(target)
    # Default fallback to dashboard if file not found
    return FileResponse(os.path.join(frontend_dir, "admin", "dashboard.html"))


# Super Admin HTML Clean URL Handlers
@app.get("/super-admin/login", include_in_schema=False)
def serve_super_admin_login():
    return FileResponse(os.path.join(frontend_dir, "super-admin", "login.html"))

@app.get("/super-admin/dashboard", include_in_schema=False)
def serve_super_admin_dashboard():
    target = os.path.join(frontend_dir, "super-admin", "dashboard.html")
    if os.path.exists(target):
        return FileResponse(target)
    return FileResponse(os.path.join(frontend_dir, "super-admin", "login.html"))

@app.get("/super-admin/platform-overview", include_in_schema=False)
def serve_super_admin_platform_overview():
    target = os.path.join(frontend_dir, "super-admin", "platform-overview.html")
    if os.path.exists(target):
        return FileResponse(target)
    return FileResponse(os.path.join(frontend_dir, "super-admin", "dashboard.html"))

@app.get("/super-admin/system-activity", include_in_schema=False)
def serve_super_admin_system_activity():
    target = os.path.join(frontend_dir, "super-admin", "system-activity.html")
    if os.path.exists(target):
        return FileResponse(target)
    return FileResponse(os.path.join(frontend_dir, "super-admin", "dashboard.html"))

@app.get("/super-admin/forgot-password", include_in_schema=False)
def serve_super_admin_forgot_password():
    return FileResponse(os.path.join(frontend_dir, "super-admin", "forgot-password.html"))

@app.get("/super-admin/verify-otp", include_in_schema=False)
def serve_super_admin_verify_otp():
    return FileResponse(os.path.join(frontend_dir, "super-admin", "verify-otp.html"))

@app.get("/super-admin/reset-password", include_in_schema=False)
def serve_super_admin_reset_password():
    return FileResponse(os.path.join(frontend_dir, "super-admin", "reset-password.html"))

@app.get("/super-admin/{page}", include_in_schema=False)
def serve_super_admin_page(page: str):
    filename = page if page.endswith(".html") else f"{page}.html"
    target = os.path.join(frontend_dir, "super-admin", filename)
    if os.path.exists(target):
        return FileResponse(target)
    return FileResponse(os.path.join(frontend_dir, "super-admin", "login.html"))


# Mount frontend static files
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
