"""
BugBash - Enterprise Admin Notifications Management Router
API endpoints for system announcements, assessment reminders, deadline alerts,
recipient audience resolution, delivery tracking, and notification templates.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from backend.app.routers.admin_auth import get_current_admin
from backend.app.schemas.admin_notification import (
    NotificationSummaryMetrics,
    NotificationListResponse,
    NotificationDetailResponse,
    CreateNotificationRequest,
    UpdateNotificationRequest,
    ScheduleNotificationRequest,
    EstimateRecipientsRequest,
    EstimateRecipientsResponse,
    NotificationTemplateItem,
    CreateTemplateRequest,
    UpdateTemplateRequest,
    PreviewTemplateRequest,
    PreviewTemplateResponse
)
from backend.app.services.admin_notification_service import admin_notification_service

router = APIRouter()
templates_router = APIRouter()


# ==============================================================================
# 1. Summary Statistics & Overview Counters
# ==============================================================================
@router.get(
    "/statistics",
    response_model=NotificationSummaryMetrics,
    status_code=status.HTTP_200_OK,
    summary="Get overall notification delivery telemetry and counters"
)
async def get_notification_statistics(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        stats = admin_notification_service.get_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 2. Audience Estimation & Recipient Resolution
# ==============================================================================
@router.get(
    "/recipients/estimate",
    response_model=EstimateRecipientsResponse,
    status_code=status.HTTP_200_OK,
    summary="Estimate recipient counts and sample recipient preview via GET query"
)
async def estimate_recipients_get(
    target_audience: str = Query("all_candidates", description="all_candidates, candidate_groups, specific_assessment, individual_candidates"),
    target_ids: Optional[str] = Query(None, description="Comma-separated IDs or emails"),
    current_admin: dict = Depends(get_current_admin)
):
    try:
        parsed_ids = [i.strip() for i in target_ids.split(",") if i.strip()] if target_ids else None
        res = admin_notification_service.estimate_recipients(
            target_audience=target_audience,
            target_ids=parsed_ids,
            admin_user=current_admin
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/recipients/estimate",
    response_model=EstimateRecipientsResponse,
    status_code=status.HTTP_200_OK,
    summary="Estimate recipient counts and sample recipient preview via POST payload"
)
async def estimate_recipients_post(
    req: EstimateRecipientsRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        res = admin_notification_service.estimate_recipients(
            target_audience=req.target_audience,
            target_ids=req.target_ids,
            admin_user=current_admin
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 3. Notifications Listing
# ==============================================================================
@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all notifications with search, status, category, channel, and priority filtering"
)
async def list_notifications(
    search: Optional[str] = Query(None, description="Search keyword in title or message body"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status (Draft, Scheduled, Delivered, Failed, etc.)"),
    channel: Optional[str] = Query(None, description="Filter by channel (in_app, email, in_app_and_email)"),
    priority: Optional[str] = Query(None, description="Filter by priority (Low, Normal, High, Urgent)"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.get_notifications_list(
            page=page,
            limit=limit,
            search=search,
            category=category,
            status=status,
            channel=channel,
            priority=priority,
            sort_by=sort_by,
            sort_order=sort_order
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 4. Notification Creation
# ==============================================================================
@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new notification (draft, immediate send, or scheduled)"
)
async def create_notification(
    req: CreateNotificationRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        created = admin_notification_service.create_notification(
            payload=req.model_dump() if hasattr(req, "model_dump") else req.dict(),
            admin_user=current_admin
        )
        return created
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 5. Notification Details & Delivery Telemetry
# ==============================================================================
@router.get(
    "/{notification_id}",
    response_model=NotificationDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get detailed notification records including delivery status and recipient sample"
)
async def get_notification_details(
    notification_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.get_notification_details(
            notification_id=notification_id,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put(
    "/{notification_id}",
    status_code=status.HTTP_200_OK,
    summary="Update an existing draft or scheduled notification"
)
async def update_notification(
    notification_id: str,
    req: UpdateNotificationRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        payload = req.model_dump(exclude_unset=True) if hasattr(req, "model_dump") else req.dict(exclude_unset=True)
        return admin_notification_service.update_notification(
            notification_id=notification_id,
            payload=payload,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 6. Lifecycle Actions: Send, Schedule, Cancel, Retry, Duplicate, Archive
# ==============================================================================
@router.post(
    "/{notification_id}/send",
    status_code=status.HTTP_200_OK,
    summary="Trigger immediate delivery dispatch for a draft or scheduled notification"
)
async def send_notification(
    notification_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.send_notification(
            notification_id=notification_id,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{notification_id}/schedule",
    status_code=status.HTTP_200_OK,
    summary="Set or update the future execution timestamp for a notification"
)
async def schedule_notification(
    notification_id: str,
    req: ScheduleNotificationRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.schedule_notification(
            notification_id=notification_id,
            scheduled_at=req.scheduled_at,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{notification_id}/cancel",
    status_code=status.HTTP_200_OK,
    summary="Cancel a scheduled notification from future automatic dispatch"
)
async def cancel_scheduled_notification(
    notification_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.cancel_scheduled_notification(
            notification_id=notification_id,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{notification_id}/retry",
    status_code=status.HTTP_200_OK,
    summary="Retry failed recipient deliveries for a notification"
)
async def retry_failed_delivery(
    notification_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.retry_failed_delivery(
            notification_id=notification_id,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{notification_id}/duplicate",
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate an existing notification as a new draft"
)
async def duplicate_notification(
    notification_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.duplicate_notification(
            notification_id=notification_id,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{notification_id}/archive",
    status_code=status.HTTP_200_OK,
    summary="Archive a notification to hide it from active dashboards"
)
async def archive_notification(
    notification_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.archive_notification(
            notification_id=notification_id,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{notification_id}/delivery",
    status_code=status.HTTP_200_OK,
    summary="Fetch paginated delivery logs for this notification"
)
async def get_delivery_breakdown(
    notification_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.get_delivery_breakdown(
            notification_id=notification_id,
            admin_user=current_admin
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# 7. Notification Templates Management Sub-Router
# ==============================================================================
@templates_router.get(
    "",
    response_model=List[NotificationTemplateItem],
    status_code=status.HTTP_200_OK,
    summary="List all reusable notification templates"
)
async def list_templates(
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.list_templates()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@templates_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new custom notification template"
)
async def create_template(
    req: CreateTemplateRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        payload = req.model_dump() if hasattr(req, "model_dump") else req.dict()
        return admin_notification_service.create_template(payload, admin_user=current_admin)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@templates_router.post(
    "/preview",
    response_model=PreviewTemplateResponse,
    status_code=status.HTTP_200_OK,
    summary="Safely preview interpolated template variables without execution"
)
async def preview_template(
    req: PreviewTemplateRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        payload = req.model_dump() if hasattr(req, "model_dump") else req.dict()
        return admin_notification_service.preview_template(payload)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@templates_router.get(
    "/{template_id}",
    response_model=NotificationTemplateItem,
    status_code=status.HTTP_200_OK,
    summary="Get single template details"
)
async def get_template(
    template_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.get_template(template_id)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@templates_router.put(
    "/{template_id}",
    status_code=status.HTTP_200_OK,
    summary="Update an existing custom notification template"
)
async def update_template(
    template_id: str,
    req: UpdateTemplateRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        payload = req.model_dump(exclude_unset=True) if hasattr(req, "model_dump") else req.dict(exclude_unset=True)
        return admin_notification_service.update_template(template_id, payload, admin_user=current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@templates_router.delete(
    "/{template_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a non-system notification template"
)
async def delete_template(
    template_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        return admin_notification_service.delete_template(template_id, admin_user=current_admin)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
