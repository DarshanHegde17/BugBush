"""
BugBash - Enterprise Admin Assessment Management Router
Provides REST endpoints for assessment lifecycle, manual & automatic question
curation, section timers, candidate assignment, and performance statistics.
Protected with Admin Bearer authentication and role-based permissions.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Optional, List, Dict, Any

from backend.app.schemas.admin_assessment import (
    AdminAssessmentCreateRequest,
    AdminAssessmentUpdateRequest,
    AdminAssessmentListResponse,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    QuestionBankCatalogItem,
    AssignCandidatesRequest,
    AssessmentStatisticsResponse,
    CandidateAssignmentStatusItem
)
from backend.app.routers.admin_auth import get_current_admin
from backend.app.services.admin_assessment_service import admin_assessment_service
from backend.app.services.question_bank_service import question_bank_service

router = APIRouter()


# ==============================================================================
# 1. List Assessments & Lifecycle Statistics
# ==============================================================================
@router.get(
    "",
    response_model=AdminAssessmentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List assessments with overview statistics",
    description="Returns filterable, searchable list of assessments along with system-wide state counts."
)
async def list_assessments(
    status_filter: Optional[str] = Query("all", alias="status", description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by title, ID, or description"),
    assessment_type: Optional[str] = Query("all", alias="type", description="Filter by assessment type"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: dict = Depends(get_current_admin)
):
    items, stats, total_count = admin_assessment_service.list_assessments(
        status_filter=status_filter,
        search_query=search,
        assessment_type=assessment_type,
        limit=limit,
        offset=offset
    )
    return {
        "assessments": items,
        "statistics": stats,
        "total_count": total_count
    }


# ==============================================================================
# 2. Question Bank Catalog for Assessment Assembly
# ==============================================================================
@router.get(
    "/questions/catalog",
    response_model=List[QuestionBankCatalogItem],
    status_code=status.HTTP_200_OK,
    summary="Browse Question Bank catalog for assessment assembly"
)
async def get_questions_catalog(
    search: Optional[str] = Query(None, description="Search keyword in title, description, or tags"),
    language: Optional[str] = Query("all", description="Programming language filter"),
    difficulty: Optional[str] = Query("all", description="Difficulty filter: Easy, Medium, Hard"),
    category: Optional[str] = Query("all", description="Category filter"),
    question_type: Optional[str] = Query("all", description="coding or mcq"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: dict = Depends(get_current_admin)
):
    questions, _ = question_bank_service.filter_questions(
        query=search,
        language=language,
        difficulty=difficulty,
        category=category,
        question_type=question_type,
        limit=limit,
        offset=offset
    )

    catalog_items = []
    for q in questions:
        desc = q.get("description", "")
        snippet = desc[:140] + "..." if len(desc) > 140 else desc
        catalog_items.append({
            "id": q["id"],
            "title": q.get("title", ""),
            "difficulty": q.get("difficulty", "Medium"),
            "category": q.get("category", "General"),
            "languages": q.get("languages", []),
            "question_type": q.get("question_type", "coding"),
            "points": q.get("points", 20),
            "tags": q.get("tags", []),
            "description_snippet": snippet,
            "options": q.get("options")
        })
    return catalog_items


# ==============================================================================
# 3. Create Assessment
# ==============================================================================
@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new assessment in Draft state"
)
async def create_assessment(
    payload: AdminAssessmentCreateRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        created = admin_assessment_service.create_assessment(payload.dict(), current_admin)
        return {
            "status": "success",
            "message": f"Assessment '{created.get('title')}' created successfully in Draft mode.",
            "assessment": created
        }
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create assessment: {str(e)}")


# ==============================================================================
# 4. Get Single Assessment Details
# ==============================================================================
@router.get(
    "/{assessment_id}",
    status_code=status.HTTP_200_OK,
    summary="Get single assessment details with enriched Question Bank metadata"
)
async def get_assessment_details(
    assessment_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    asmt = admin_assessment_service.get_assessment(assessment_id)
    if not asmt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found."
        )
    return asmt


# ==============================================================================
# 5. Update Assessment
# ==============================================================================
@router.put(
    "/{assessment_id}",
    status_code=status.HTTP_200_OK,
    summary="Update assessment configuration"
)
async def update_assessment(
    assessment_id: str,
    payload: AdminAssessmentUpdateRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        updated = admin_assessment_service.update_assessment(
            assessment_id=assessment_id,
            payload=payload.dict(exclude_unset=True),
            admin_user=current_admin
        )
        return {
            "status": "success",
            "message": "Assessment updated successfully.",
            "assessment": updated
        }
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 6. Automatic Question Generation
# ==============================================================================
@router.post(
    "/{assessment_id}/generate-questions",
    response_model=GenerateQuestionsResponse,
    status_code=status.HTTP_200_OK,
    summary="Automatically generate questions based on exact custom language and difficulty counts"
)
async def generate_questions_for_assessment(
    assessment_id: str,
    payload: GenerateQuestionsRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        selected_questions = admin_assessment_service.generate_questions_for_assessment(
            assessment_id=assessment_id,
            specifications=payload.specifications,
            mcq_count=payload.mcq_count
        )

        total_marks = sum(q.get("custom_marks", 20) for q in selected_questions)

        return GenerateQuestionsResponse(
            success=True,
            message=f"Successfully generated {len(selected_questions)} questions from Question Bank.",
            selected_questions=selected_questions,
            total_selected=len(selected_questions),
            total_marks=total_marks
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 7. Publish Assessment
# ==============================================================================
@router.post(
    "/{assessment_id}/publish",
    status_code=status.HTTP_200_OK,
    summary="Publish assessment for candidate participation"
)
async def publish_assessment(
    assessment_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        published = admin_assessment_service.publish_assessment(assessment_id, current_admin)
        return {
            "status": "success",
            "message": f"Assessment '{published.get('title')}' is now {published.get('status')}.",
            "assessment": published
        }
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 8. Archive Assessment
# ==============================================================================
@router.post(
    "/{assessment_id}/archive",
    status_code=status.HTTP_200_OK,
    summary="Archive assessment"
)
async def archive_assessment(
    assessment_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        archived = admin_assessment_service.archive_assessment(assessment_id, current_admin)
        return {
            "status": "success",
            "message": f"Assessment '{archived.get('title')}' archived.",
            "assessment": archived
        }
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 9. Duplicate Assessment
# ==============================================================================
@router.post(
    "/{assessment_id}/duplicate",
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate existing assessment into a fresh Draft"
)
async def duplicate_assessment(
    assessment_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        clone = admin_assessment_service.duplicate_assessment(assessment_id, current_admin)
        return {
            "status": "success",
            "message": f"Cloned assessment as '{clone.get('title')}'.",
            "assessment": clone
        }
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 10. Delete Assessment
# ==============================================================================
@router.delete(
    "/{assessment_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete assessment (Draft or Archived only)"
)
async def delete_assessment(
    assessment_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        admin_assessment_service.delete_assessment(assessment_id, current_admin)
        return {
            "status": "success",
            "message": f"Assessment '{assessment_id}' deleted successfully."
        }
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 11. Assessment Statistics
# ==============================================================================
@router.get(
    "/{assessment_id}/statistics",
    response_model=AssessmentStatisticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get assessment performance and participation statistics"
)
async def get_assessment_statistics(
    assessment_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_assessment_service.get_assessment_statistics(assessment_id)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 12. Assign Candidates & View Assignment Status
# ==============================================================================
@router.post(
    "/{assessment_id}/assign",
    status_code=status.HTTP_200_OK,
    summary="Assign candidate emails or cohorts to assessment"
)
async def assign_candidates_to_assessment(
    assessment_id: str,
    payload: AssignCandidatesRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        total_assigned = admin_assessment_service.assign_candidates(
            assessment_id=assessment_id,
            candidate_emails=payload.candidate_emails,
            cohort_names=payload.cohort_names,
            deadline=payload.deadline,
            admin_user=current_admin
        )
        return {
            "status": "success",
            "message": f"Successfully assigned {len(payload.candidate_emails)} candidates.",
            "total_assigned": total_assigned
        }
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{assessment_id}/candidates",
    response_model=List[CandidateAssignmentStatusItem],
    status_code=status.HTTP_200_OK,
    summary="Get assigned candidates and participation status"
)
async def get_assigned_candidates(
    assessment_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_assessment_service.get_assigned_candidates(assessment_id)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
