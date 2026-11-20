"""
BugBash - Enterprise Admin Notifications Management Schemas
Pydantic schemas for announcements, assessment notifications, reminders,
recipient targeting, delivery tracking, and notification templates.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ==============================================================================
# 1. Summary Metrics & Delivery Telemetry
# ==============================================================================
class NotificationSummaryMetrics(BaseModel):
    total_notifications: int = Field(0, description="Total notifications created")
    successfully_delivered: int = Field(0, description="Notifications successfully delivered to recipients")
    pending_delivery: int = Field(0, description="Notifications currently queued or sending")
    failed_notifications: int = Field(0, description="Notifications that encountered delivery failures")
    scheduled_notifications: int = Field(0, description="Notifications scheduled for future delivery")
    read_notifications: int = Field(0, description="In-app notifications confirmed read by candidates")


class NotificationDeliveryStats(BaseModel):
    total_recipients: int = 0
    delivered: int = 0
    pending: int = 0
    failed: int = 0
    read: int = 0
    unread: int = 0


class NotificationRecipientItem(BaseModel):
    recipient_id: str
    recipient_name: str
    recipient_email: str
    channel: str = "in_app"
    delivery_status: str = "Delivered"  # "Delivered", "Pending", "Failed", "Scheduled"
    sent_at: Optional[str] = None
    read_status: str = "Unread"  # "Read", "Unread"
    read_at: Optional[str] = None
    failure_reason: Optional[str] = None


# ==============================================================================
# 2. Notification Listing & Detail Responses
# ==============================================================================
class NotificationListItem(BaseModel):
    id: str
    title: str
    category: str
    priority: str = "Normal"  # "Low", "Normal", "High", "Urgent"
    channel: str = "in_app"  # "in_app", "email", "in_app_and_email"
    target_audience: str = "all_candidates"
    recipient_count: int = 0
    created_at: str
    scheduled_at: Optional[str] = None
    sent_at: Optional[str] = None
    status: str = "Delivered"  # "Draft", "Scheduled", "In Progress", "Delivered", "Failed", "Cancelled", "Archived"
    created_by: str


class NotificationListResponse(BaseModel):
    summary: NotificationSummaryMetrics
    notifications: List[NotificationListItem]
    total: int
    page: int
    limit: int
    pages: int


class NotificationDetailResponse(BaseModel):
    id: str
    title: str
    message: str
    category: str
    priority: str = "Normal"
    channel: str = "in_app"
    target_audience: str = "all_candidates"
    target_ids: Optional[List[str]] = None
    recipient_count: int = 0
    action_url: Optional[str] = None
    template_id: Optional[str] = None
    status: str = "Delivered"
    created_by: str
    created_at: str
    scheduled_at: Optional[str] = None
    sent_at: Optional[str] = None
    stats: NotificationDeliveryStats
    recipients_sample: List[NotificationRecipientItem] = Field(default_factory=list)


# ==============================================================================
# 3. Notification Creation & Modification Requests
# ==============================================================================
class CreateNotificationRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200, description="Notification headline")
    message: str = Field(..., min_length=5, max_length=5000, description="Notification message body")
    category: str = Field("General Announcement", description="Category: New Assessment, Assessment Reminder, Deadline, etc.")
    priority: str = Field("Normal", description="Priority tier: Low, Normal, High, Urgent")
    channel: str = Field("in_app", description="Delivery channel: in_app, email, in_app_and_email")
    target_audience: str = Field("all_candidates", description="Audience: all_candidates, candidate_groups, specific_assessment, individual_candidates")
    target_ids: Optional[List[str]] = Field(default=None, description="Optional list of group IDs, assessment IDs, or candidate emails")
    scheduled_at: Optional[str] = Field(default=None, description="Optional ISO timestamp for future scheduling")
    action_url: Optional[str] = Field(default=None, description="Optional direct link to BugBash assessment or results")
    template_id: Optional[str] = Field(default=None, description="Optional template origin ID")


class UpdateNotificationRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    message: Optional[str] = Field(None, min_length=5, max_length=5000)
    category: Optional[str] = None
    priority: Optional[str] = None
    channel: Optional[str] = None
    target_audience: Optional[str] = None
    target_ids: Optional[List[str]] = None
    scheduled_at: Optional[str] = None
    action_url: Optional[str] = None


class ScheduleNotificationRequest(BaseModel):
    scheduled_at: str = Field(..., description="Target ISO datetime for delayed delivery")


# ==============================================================================
# 4. Recipient Estimation
# ==============================================================================
class EstimateRecipientsRequest(BaseModel):
    target_audience: str = Field("all_candidates", description="all_candidates, candidate_groups, specific_assessment, individual_candidates")
    target_ids: Optional[List[str]] = Field(default=None, description="Selected group, assessment, or candidate IDs")


class EstimateRecipientsResponse(BaseModel):
    estimated_count: int
    audience_summary: str
    preview_recipients: List[Dict[str, str]] = Field(default_factory=list)


# ==============================================================================
# 5. Notification Templates
# ==============================================================================
class NotificationTemplateItem(BaseModel):
    template_id: str
    name: str
    description: str
    category: str
    subject: str
    body: str
    variables: List[str] = Field(default_factory=list)
    is_system: bool = False
    updated_at: str


class CreateTemplateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=150)
    description: str = Field(..., max_length=300)
    category: str = Field("General Announcement")
    subject: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=5, max_length=5000)
    variables: Optional[List[str]] = Field(default_factory=list)


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=150)
    description: Optional[str] = Field(None, max_length=300)
    category: Optional[str] = None
    subject: Optional[str] = Field(None, min_length=3, max_length=200)
    body: Optional[str] = Field(None, min_length=5, max_length=5000)
    variables: Optional[List[str]] = None


class PreviewTemplateRequest(BaseModel):
    body: str
    subject: Optional[str] = None
    sample_data: Optional[Dict[str, str]] = None


class PreviewTemplateResponse(BaseModel):
    interpolated_subject: str
    interpolated_body: str
    missing_variables: List[str] = Field(default_factory=list)
