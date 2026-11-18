import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.schemas.practice import (
    PracticeProblemSummary,
    PracticeProblemDetail,
    PracticeStatisticsResponse,
    PracticeExecuteRequest,
    PracticeExecuteResponse,
    PracticeSubmitRequest,
    PracticeSubmitResponse,
    PracticeRecommendationItem,
    PracticeHistoryItem
)
from backend.app.services.practice_service import practice_service
from backend.app.routers.users import get_current_user
from backend.app.services.user_service import user_service
from fastapi import Header

router = APIRouter()

def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    payload = user_service.verify_jwt_token(token)
    if not payload or not payload.get("sub"):
        return None
    return user_service._get_user_doc(payload["sub"].lower())


@router.get(
    "/statistics",
    response_model=PracticeStatisticsResponse,
    summary="Get user practice statistics & daily streak",
    description="Returns total problems solved, attempted, easy/medium/hard breakdown, and current streak."
)
async def get_practice_statistics(current_user: dict = Depends(get_current_user)):
    return practice_service.get_user_statistics(current_user["email"])


@router.get(
    "/problems",
    response_model=List[PracticeProblemSummary],
    summary="List practice problems with filters",
    description="Filters problems by difficulty, language, topic/category, user status, and search query."
)
async def list_practice_problems(
    difficulty: Optional[str] = Query(None, description="Easy, Medium, Hard, All"),
    language: Optional[str] = Query(None, description="Python, Java, C, C++, JavaScript, SQL"),
    category: Optional[str] = Query(None, description="Topic or category name"),
    status: Optional[str] = Query(None, description="Not Started, Attempted, Solved"),
    q: Optional[str] = Query(None, description="Search keyword in title, tags, or description"),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    user_email = current_user["email"] if current_user else "demo@bugbash.com"
    return practice_service.list_problems(
        user_email=user_email,
        difficulty=difficulty,
        language=language,
        category=category,
        status=status,
        query=q
    )


@router.get(
    "/problems/{problem_id}",
    response_model=PracticeProblemDetail,
    summary="Get full problem details",
    description="Returns problem statement, input/output formats, constraints, sample cases, and starter templates."
)
async def get_practice_problem(
    problem_id: str,
    current_user: dict = Depends(get_current_user)
):
    success, detail, err = practice_service.get_problem_detail(problem_id, current_user["email"])
    if not success or not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=err or f"Problem '{problem_id}' not found."
        )
    return detail


@router.get(
    "/recommendations",
    response_model=List[PracticeRecommendationItem],
    summary="Personalized learning recommendations",
    description="Recommends problems based on previous weak topics, difficulty tiers, and category progression."
)
async def get_practice_recommendations(current_user: dict = Depends(get_current_user)):
    return practice_service.get_recommendations(current_user["email"])


@router.post(
    "/execute",
    response_model=PracticeExecuteResponse,
    summary="Execute practice code inside sandbox",
    description="Runs untrusted practice code against permitted sample test cases in an isolated subprocess."
)
async def execute_practice_code(
    payload: PracticeExecuteRequest,
    current_user: dict = Depends(get_current_user)
):
    success, res, err = practice_service.execute_code(
        problem_id=payload.problem_id,
        language=payload.language,
        code=payload.code,
        custom_input=payload.custom_input
    )
    if not success or not res:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err or "Execution error."
        )
    return res


@router.post(
    "/submit",
    response_model=PracticeSubmitResponse,
    summary="Submit practice solution & get ML insights",
    description="Evaluates all test cases, updates user progress, and returns ML complexity and code quality insights."
)
async def submit_practice_solution(
    payload: PracticeSubmitRequest,
    current_user: dict = Depends(get_current_user)
):
    success, res, err = practice_service.submit_solution(
        problem_id=payload.problem_id,
        language=payload.language,
        code=payload.code,
        user_email=current_user["email"]
    )
    if not success or not res:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err or "Submission evaluation error."
        )
    return res


@router.get(
    "/history",
    response_model=List[PracticeHistoryItem],
    summary="Get user practice submission history",
    description="Returns chronological history of practice attempts with test counts and execution metrics."
)
async def get_practice_history(current_user: dict = Depends(get_current_user)):
    return practice_service.get_user_history(current_user["email"])
