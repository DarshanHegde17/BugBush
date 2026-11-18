from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from typing import Optional, List

from backend.app.schemas.dashboard import (
    UserProfileResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
    SimpleStatusResponse,
    DashboardSummaryResponse,
    AssessmentItem,
    AssessmentDetailResponse,
    AssessmentStatisticsResponse,
    StartAssessmentResponse,
    ResultItem,
    ActivityItem,
    PracticeProblemItem,
    ProfilePictureRequest,
    UserPreferencesModel,
    SessionsResponse,
    AccountDeletionRequest
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
        phone_number=payload.phone_number,
        bio=payload.bio,
        college_name=payload.college_name,
        degree_major=payload.degree_major,
        graduation_year=payload.graduation_year
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


@router.post(
    "/me/profile-picture",
    response_model=SimpleStatusResponse,
    summary="Upload and update user profile avatar",
    description="Updates user profile avatar picture."
)
async def update_my_avatar(
    payload: ProfilePictureRequest,
    current_user: dict = Depends(get_current_user)
):
    success, avatar_url, err = user_service.update_profile_picture(current_user["email"], payload.avatar_data)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err or "Unable to update profile picture.")
    return SimpleStatusResponse(status="success", message="Profile picture updated successfully.")


@router.get(
    "/me/preferences",
    response_model=UserPreferencesModel,
    summary="Get user appearance, notification, and learning preferences"
)
async def get_my_preferences(current_user: dict = Depends(get_current_user)):
    return user_service.get_user_preferences(current_user["email"])


@router.put(
    "/me/preferences",
    response_model=UserPreferencesModel,
    summary="Update appearance, notification, and learning preferences"
)
async def update_my_preferences(
    payload: UserPreferencesModel,
    current_user: dict = Depends(get_current_user)
):
    success, updated, err = user_service.update_user_preferences(current_user["email"], payload.dict())
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err or "Unable to save preferences.")
    return updated


@router.get(
    "/me/sessions",
    response_model=SessionsResponse,
    summary="Get active session list"
)
async def get_my_sessions(current_user: dict = Depends(get_current_user)):
    return user_service.get_user_sessions(current_user["email"])


@router.post(
    "/me/logout-other-sessions",
    response_model=SimpleStatusResponse,
    summary="Logout from all other active sessions"
)
async def logout_other_sessions(current_user: dict = Depends(get_current_user)):
    success, msg = user_service.logout_other_sessions(current_user["email"])
    return SimpleStatusResponse(status="success", message=msg)


@router.post(
    "/me/account-deletion-request",
    response_model=SimpleStatusResponse,
    summary="Submit account deletion request"
)
async def request_account_deletion(
    payload: AccountDeletionRequest,
    current_user: dict = Depends(get_current_user)
):
    success, msg = user_service.request_account_deletion(
        email=current_user["email"],
        confirm_password=payload.confirm_password,
        reason=payload.reason,
        phrase=payload.confirmation_phrase
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return SimpleStatusResponse(status="success", message=msg)


@router.get(
    "/me/download-data",
    summary="Export all personal data as JSON"
)
async def export_my_data(current_user: dict = Depends(get_current_user)):
    return user_service.get_personal_data_export(current_user["email"])


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
    "/me/assessments/statistics",
    response_model=AssessmentStatisticsResponse,
    summary="Get assessment statistics breakdown",
    description="Returns live counts for total, available, upcoming, in-progress, completed, and expired assessments."
)
async def get_my_assessment_statistics(current_user: dict = Depends(get_current_user)):
    return user_service.get_user_assessment_statistics(current_user["email"])


@router.get(
    "/me/assessments",
    response_model=List[AssessmentItem],
    summary="Get my assessments",
    description="Returns assessments assigned to or available for the authenticated user with optional dynamic filters."
)
async def get_my_assessments(
    status: Optional[str] = Query(None, description="Filter by status: Available, Upcoming, In Progress, Completed, Expired, All"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty: Easy, Medium, Hard, All"),
    category: Optional[str] = Query(None, description="Filter by category"),
    q: Optional[str] = Query(None, description="Search by title, description or creator"),
    current_user: dict = Depends(get_current_user)
):
    return user_service.get_user_assessments(
        email=current_user["email"],
        status=status,
        difficulty=difficulty,
        category=category,
        query=q
    )


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
# Dedicated Assessment Session & Inspection Endpoints (/api/v1/assessments)
# ==============================================================================
assessments_router = APIRouter()

@assessments_router.get(
    "/{assessment_id}",
    response_model=AssessmentDetailResponse,
    summary="Get full assessment details, instructions & questions",
    description="Returns syllabus, rules, allowed languages, and questions breakdown for modal display."
)
async def get_assessment_details(
    assessment_id: str,
    current_user: dict = Depends(get_current_user)
):
    success, data, err = user_service.get_assessment_details(current_user["email"], assessment_id)
    if not success or not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err or "Assessment not found.")
    return data


@assessments_router.post(
    "/{assessment_id}/start",
    response_model=StartAssessmentResponse,
    summary="Start assessment attempt",
    description="Authorizes and begins an examination session, verifying schedules and attempt limits."
)
async def start_assessment(
    assessment_id: str,
    current_user: dict = Depends(get_current_user)
):
    success, attempt_info, err = user_service.start_assessment_attempt(current_user["email"], assessment_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err or "Unable to start assessment.")
    return attempt_info


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
