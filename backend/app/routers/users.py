from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from typing import Optional, List

from backend.app.schemas.dashboard import (
    UserProfileResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
    SimpleStatusResponse,
    DashboardSummaryResponse,
    AssessmentItem,
    ResultItem,
    ActivityItem,
    PracticeProblemItem
)
from backend.app.services.user_service import user_service

router = APIRouter()


# ==============================================================================
# Security Dependency: Authoritative Authenticated User Resolution
# ==============================================================================
def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Enforces authentication across all dashboard endpoints.
    Resolves the user identity exclusively from the validated cryptographic JWT.
    Never accepts client-supplied IDs to eliminate IDOR and unauthorized elevation.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access your dashboard.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = authorization.split(" ", 1)[1].strip()
    user = user_service.get_user_by_token(token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return user


# ==============================================================================
# User Profile Endpoints
# ==============================================================================
@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get current user profile",
    description="Returns profile details for the authenticated candidate."
)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    profile = user_service.get_user_profile(current_user["email"])
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    return profile


@router.put(
    "/me/profile",
    response_model=UserProfileResponse,
    summary="Update profile details",
    description="Updates permitted profile fields (full name, phone number) for the authenticated user."
)
async def update_my_profile(
    payload: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user)
):
    success, updated_profile, err = user_service.update_user_profile(
        email=current_user["email"],
        full_name=payload.full_name,
        phone_number=payload.phone_number
    )

    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err or "Failed to update profile.")

    return updated_profile


@router.post(
    "/me/change-password",
    response_model=SimpleStatusResponse,
    summary="Change account password",
    description="Securely changes account password after validating current password and new complexity."
)
async def change_my_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password and confirmation do not match.")

    success, msg = user_service.change_password(
        email=current_user["email"],
        current_password=payload.current_password,
        new_password=payload.new_password
    )

    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg or "Unable to change password.")

    return SimpleStatusResponse(status="success", message=msg)


# ==============================================================================
# User Dashboard & Metric Endpoints
# ==============================================================================
@router.get(
    "/me/dashboard",
    response_model=DashboardSummaryResponse,
    summary="Get live dashboard summary",
    description="Returns live statistics (total, completed, pending, average score) and recent activities."
)
async def get_my_dashboard(current_user: dict = Depends(get_current_user)):
    summary = user_service.get_user_dashboard_summary(current_user["email"])
    return summary


@router.get(
    "/me/assessments",
    response_model=List[AssessmentItem],
    summary="Get my assessments",
    description="Returns assessments assigned to or available for the authenticated user."
)
async def get_my_assessments(current_user: dict = Depends(get_current_user)):
    return user_service.get_user_assessments(current_user["email"])


@router.get(
    "/me/results",
    response_model=List[ResultItem],
    summary="Get my assessment results & reports",
    description="Returns completed assessment results, scores, and performance breakdowns for the user."
)
async def get_my_results(current_user: dict = Depends(get_current_user)):
    return user_service.get_user_results(current_user["email"])


@router.get(
    "/me/activity",
    response_model=List[ActivityItem],
    summary="Get my recent assessment & practice activity",
    description="Returns recent activity log for the authenticated user."
)
async def get_my_activity(current_user: dict = Depends(get_current_user)):
    return user_service.get_user_activity(current_user["email"])


# ==============================================================================
# Practice Coding Endpoints
# ==============================================================================
practice_router = APIRouter()

@practice_router.get(
    "/problems",
    response_model=List[PracticeProblemItem],
    summary="List practice coding problems",
    description="Returns coding challenges filterable by difficulty, programming language, and search query."
)
async def list_practice_problems(
    difficulty: Optional[str] = Query(None, description="Filter difficulty: Easy, Medium, Hard, All"),
    language: Optional[str] = Query(None, description="Filter language: Python, C++, Java, JavaScript, Go"),
    q: Optional[str] = Query(None, description="Search query")
):
    return user_service.get_practice_problems(difficulty=difficulty, language=language, query=q)
