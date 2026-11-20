"""
BugBash - Enterprise Admin Candidate & Student Management Router
API endpoints for managing candidate accounts, groups, bulk CSV imports,
invitations, assessment assignments, and administrative account suspensions.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header

from backend.app.routers.admin_auth import get_current_admin
from backend.app.schemas.admin_candidate import (
    CandidateListResponse,
    CandidateDetailResponse,
    CandidateUpdateRequest,
    SuspendCandidateRequest,
    CandidateGroupItem,
    CandidateGroupCreateRequest,
    CandidateGroupUpdateRequest,
    CandidateGroupMembersRequest,
    AssignAssessmentToGroupRequest,
    CandidateImportRequest,
    CandidateImportResult,
    CandidateInvitationCreateRequest,
    CandidateInvitationItem,
    CandidateAssignAssessmentRequest
)
from backend.app.services.admin_candidate_service import admin_candidate_service

router = APIRouter()
groups_router = APIRouter()


# ==============================================================================
# 1. Candidate Directory & Listing
# ==============================================================================
@router.get(
    "",
    response_model=CandidateListResponse,
    status_code=status.HTTP_200_OK,
    summary="List candidates with filters, metrics, and pagination"
)
async def list_candidates(
    search: Optional[str] = Query(None, description="Search by name, email, ID, or college"),
    status: Optional[str] = Query(None, description="Filter: Active, Suspended, Verified, Unverified, Invited, Assigned, Completed, No_Assessment"),
    group: Optional[str] = Query(None, description="Filter by candidate group ID"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(15, ge=1, le=100, description="Items per page"),
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.get_candidates(
            search=search,
            status_filter=status,
            group_filter=group,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 2. Candidate Invitations (Static Sub-routes before /{candidate_id})
# ==============================================================================
@router.post(
    "/invitations",
    status_code=status.HTTP_201_CREATED,
    summary="Send candidate invitations with optional assessment"
)
async def create_candidate_invitations(
    payload: CandidateInvitationCreateRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        result = admin_candidate_service.create_invitations(
            emails=[str(e) for e in payload.emails],
            assessment_id=payload.assessment_id,
            group_ids=payload.group_ids,
            expiry_days=payload.expiry_days or 7,
            custom_message=payload.custom_message,
            admin_user=current_admin
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/invitations",
    response_model=List[CandidateInvitationItem],
    status_code=status.HTTP_200_OK,
    summary="List candidate invitations"
)
async def list_candidate_invitations(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.list_invitations()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete(
    "/invitations/{invitation_id}",
    status_code=status.HTTP_200_OK,
    summary="Cancel a pending candidate invitation"
)
async def cancel_candidate_invitation(
    invitation_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.cancel_invitation(invitation_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/invitations/{invitation_id}/resend",
    status_code=status.HTTP_200_OK,
    summary="Resend/refresh a candidate invitation"
)
async def resend_candidate_invitation(
    invitation_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.resend_invitation(invitation_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 3. Bulk CSV Candidate Import
# ==============================================================================
@router.post(
    "/import",
    response_model=CandidateImportResult,
    status_code=status.HTTP_200_OK,
    summary="Bulk import candidates from parsed CSV rows"
)
async def import_candidates(
    payload: CandidateImportRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        raw_rows = [r.dict() if hasattr(r, "dict") else r.model_dump() for r in payload.rows]
        return admin_candidate_service.import_candidates(
            rows=raw_rows,
            send_invitations=payload.send_invitations,
            assessment_id=payload.assessment_id,
            admin_user=current_admin
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 4. Candidate Detail & Management Endpoints
# ==============================================================================
@router.get(
    "/{candidate_id}",
    response_model=CandidateDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get candidate specifications, assessments, and telemetry"
)
async def get_candidate(
    candidate_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.get_candidate_details(candidate_id)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put(
    "/{candidate_id}",
    response_model=CandidateDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update admin-managed candidate profile details"
)
async def update_candidate(
    candidate_id: str,
    payload: CandidateUpdateRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        data = payload.dict(exclude_unset=True) if hasattr(payload, "dict") else payload.model_dump(exclude_unset=True)
        return admin_candidate_service.update_candidate(candidate_id, data, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{candidate_id}/suspend",
    status_code=status.HTTP_200_OK,
    summary="Suspend candidate account with mandatory reason"
)
async def suspend_candidate(
    candidate_id: str,
    payload: SuspendCandidateRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.suspend_candidate(candidate_id, payload.reason, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{candidate_id}/reactivate",
    status_code=status.HTTP_200_OK,
    summary="Reactivate a suspended candidate account"
)
async def reactivate_candidate(
    candidate_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.reactivate_candidate(candidate_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{candidate_id}/assessments",
    status_code=status.HTTP_200_OK,
    summary="Get candidate assigned and attempted assessments"
)
async def get_candidate_assessments(
    candidate_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        details = admin_candidate_service.get_candidate_details(candidate_id)
        return details.get("assessments", {})
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{candidate_id}/results",
    status_code=status.HTTP_200_OK,
    summary="Get candidate assessment results and performance telemetry"
)
async def get_candidate_results(
    candidate_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        details = admin_candidate_service.get_candidate_details(candidate_id)
        return details.get("performance", {})
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{candidate_id}/assignments",
    status_code=status.HTTP_200_OK,
    summary="Assign an assessment to a single candidate"
)
async def assign_assessment_to_candidate(
    candidate_id: str,
    payload: CandidateAssignAssessmentRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.assign_assessment_to_candidate(
            candidate_id=candidate_id,
            assessment_id=payload.assessment_id,
            deadline=payload.deadline,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 5. Candidate Groups Router Endpoints
# ==============================================================================
@groups_router.get(
    "",
    response_model=List[CandidateGroupItem],
    status_code=status.HTTP_200_OK,
    summary="List all candidate cohorts and groups"
)
async def list_candidate_groups(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.list_groups()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@groups_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new candidate group"
)
async def create_candidate_group(
    payload: CandidateGroupCreateRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        data = payload.dict() if hasattr(payload, "dict") else payload.model_dump()
        return admin_candidate_service.create_group(data, current_admin)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@groups_router.put(
    "/{group_id}",
    status_code=status.HTTP_200_OK,
    summary="Update candidate group metadata"
)
async def update_candidate_group(
    group_id: str,
    payload: CandidateGroupUpdateRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        data = payload.dict(exclude_unset=True) if hasattr(payload, "dict") else payload.model_dump(exclude_unset=True)
        return admin_candidate_service.update_group(group_id, data, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@groups_router.delete(
    "/{group_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a candidate group"
)
async def delete_candidate_group(
    group_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.delete_group(group_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@groups_router.post(
    "/{group_id}/members",
    status_code=status.HTTP_200_OK,
    summary="Add members to a candidate group"
)
async def add_candidate_group_members(
    group_id: str,
    payload: CandidateGroupMembersRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.add_group_members(group_id, payload.candidate_ids_or_emails, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@groups_router.delete(
    "/{group_id}/members/{candidate_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove a member from a candidate group"
)
async def remove_candidate_group_member(
    group_id: str,
    candidate_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.remove_group_member(group_id, candidate_id, current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@groups_router.post(
    "/{group_id}/assign-assessment",
    status_code=status.HTTP_200_OK,
    summary="Assign an assessment to all members of a candidate group"
)
async def assign_assessment_to_candidate_group(
    group_id: str,
    payload: AssignAssessmentToGroupRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_candidate_service.assign_assessment_to_group(
            group_id=group_id,
            assessment_id=payload.assessment_id,
            deadline=payload.deadline,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

