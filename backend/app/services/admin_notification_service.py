"""
BugBash - Enterprise Admin Notifications Management Service
Handles notification authoring, template interpolation, dynamic recipient targeting,
immediate dispatch, future scheduling, delivery telemetry tracking, and failure retries.
"""

import re
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple

from backend.app.database.mongodb import mongodb
from backend.app.services.email_service import EmailService

logger = logging.getLogger("bugbash.admin.notifications")
email_service = EmailService()


class AdminNotificationService:
    def __init__(self):
        self._ensure_seed_notifications_and_templates()

    def _ensure_seed_notifications_and_templates(self):
        """Seeds default notification templates and representative notification campaigns."""
        now = datetime.now(timezone.utc)

        # 1. Seed Templates
        if mongodb.notification_templates is not None:
            try:
                if mongodb.notification_templates.count_documents({}) == 0:
                    sample_templates = [
                        {
                            "template_id": "tmpl-101",
                            "name": "New Assessment Published",
                            "description": "Notifies candidates when an assessment has been assigned to them.",
                            "category": "New Assessment",
                            "subject": "New Assessment: {{assessment_name}} is now available",
                            "body": (
                                "Hello {{candidate_name}},\n\n"
                                "You have been assigned to participate in '{{assessment_name}}'.\n\n"
                                "Assessment Date: {{assessment_date}}\n"
                                "Duration: {{assessment_duration}}\n\n"
                                "Click here to review details and begin your attempt:\n"
                                "{{assessment_link}}\n\n"
                                "Best regards,\n"
                                "BugBash Examination Team"
                            ),
                            "variables": ["candidate_name", "assessment_name", "assessment_date", "assessment_duration", "assessment_link"],
                            "is_system": True,
                            "updated_at": now.strftime("%b %d, %Y")
                        },
                        {
                            "template_id": "tmpl-102",
                            "name": "Assessment Deadline Reminder",
                            "description": "Urgent reminder sent before an assessment submission window closes.",
                            "category": "Assessment Reminder",
                            "subject": "Reminder: Deadline approaching for {{assessment_name}}",
                            "body": (
                                "Hi {{candidate_name}},\n\n"
                                "This is a reminder that the examination window for '{{assessment_name}}' closes on {{deadline_date}}.\n\n"
                                "Please ensure all code solutions are submitted before the deadline:\n"
                                "{{assessment_link}}\n\n"
                                "Best of luck!\n"
                                "BugBash Proctoring Team"
                            ),
                            "variables": ["candidate_name", "assessment_name", "deadline_date", "assessment_link"],
                            "is_system": True,
                            "updated_at": now.strftime("%b %d, %Y")
                        },
                        {
                            "template_id": "tmpl-103",
                            "name": "Assessment Results Published",
                            "description": "Alerts candidates when evaluations, grades, and AI feedback are finalized.",
                            "category": "Results Published",
                            "subject": "Your Results for {{assessment_name}} have been published",
                            "body": (
                                "Dear {{candidate_name}},\n\n"
                                "Your performance evaluation and AI code feedback for '{{assessment_name}}' are now ready.\n\n"
                                "Score: {{score}}\n\n"
                                "View your full scorecard and question breakdown here:\n"
                                "{{result_link}}\n\n"
                                "Keep sharpening your skills,\n"
                                "BugBash Academic Committee"
                            ),
                            "variables": ["candidate_name", "assessment_name", "score", "result_link"],
                            "is_system": True,
                            "updated_at": now.strftime("%b %d, %Y")
                        },
                        {
                            "template_id": "tmpl-104",
                            "name": "Scheduled Maintenance Notice",
                            "description": "Announces planned server or sandbox maintenance periods.",
                            "category": "System Announcement",
                            "subject": "Notice: BugBash Scheduled Maintenance Window on {{date}}",
                            "body": (
                                "Attention BugBash Users,\n\n"
                                "BugBash will undergo scheduled infrastructure upgrades on {{date}} for approximately {{duration}}.\n\n"
                                "During this window, assessment execution sandboxes will be temporarily paused.\n\n"
                                "Thank you for your patience,\n"
                                "BugBash Operations Team"
                            ),
                            "variables": ["date", "duration"],
                            "is_system": True,
                            "updated_at": now.strftime("%b %d, %Y")
                        }
                    ]
                    mongodb.notification_templates.insert_many(sample_templates)
                    logger.info("Default notification templates seeded.")
            except Exception as e:
                logger.warning(f"Error seeding notification templates: {e}")

        # 2. Seed Notifications & Recipients
        if mongodb.notifications is not None:
            try:
                if mongodb.notifications.count_documents({}) == 0:
                    sample_notifications = [
                        {
                            "id": "notif-101",
                            "title": "Welcome to BugBash 2.0 Competitive Season",
                            "message": "Welcome to the new academic term! Explore the updated practice problems and check your assessment schedule.",
                            "category": "General Announcement",
                            "priority": "Normal",
                            "channel": "in_app_and_email",
                            "target_audience": "all_candidates",
                            "target_ids": [],
                            "recipient_count": 25,
                            "action_url": "/user/dashboard",
                            "template_id": None,
                            "status": "Delivered",
                            "created_by": "admin@bugbash.com",
                            "created_at": (now - timedelta(days=5)).strftime("%b %d, %Y %H:%M UTC"),
                            "scheduled_at": None,
                            "sent_at": (now - timedelta(days=5)).strftime("%b %d, %Y %H:%M UTC"),
                            "stats": {
                                "total_recipients": 25,
                                "delivered": 25,
                                "pending": 0,
                                "failed": 0,
                                "read": 21,
                                "unread": 4
                            }
                        },
                        {
                            "id": "notif-102",
                            "title": "New Assessment: Data Structures & Algorithmic Logic Test",
                            "message": "You have been registered for 'Data Structures & Algorithmic Logic Test'. Duration is 90 minutes with 4 coding challenges.",
                            "category": "New Assessment",
                            "priority": "High",
                            "channel": "in_app_and_email",
                            "target_audience": "specific_assessment",
                            "target_ids": ["asmt-101"],
                            "recipient_count": 18,
                            "action_url": "/user/assessments",
                            "template_id": "tmpl-101",
                            "status": "Delivered",
                            "created_by": "admin@bugbash.com",
                            "created_at": (now - timedelta(days=3)).strftime("%b %d, %Y %H:%M UTC"),
                            "scheduled_at": None,
                            "sent_at": (now - timedelta(days=3)).strftime("%b %d, %Y %H:%M UTC"),
                            "stats": {
                                "total_recipients": 18,
                                "delivered": 18,
                                "pending": 0,
                                "failed": 0,
                                "read": 16,
                                "unread": 2
                            }
                        },
                        {
                            "id": "notif-103",
                            "title": "Reminder: Advanced Dynamic Programming Deadline in 24 Hours",
                            "message": "The submission deadline for Semester Examination: Advanced Dynamic Programming is tomorrow at 23:59 UTC.",
                            "category": "Assessment Reminder",
                            "priority": "Urgent",
                            "channel": "in_app",
                            "target_audience": "specific_assessment",
                            "target_ids": ["asmt-102"],
                            "recipient_count": 12,
                            "action_url": "/user/assessments",
                            "template_id": "tmpl-102",
                            "status": "Scheduled",
                            "created_by": "admin@bugbash.com",
                            "created_at": (now - timedelta(hours=6)).strftime("%b %d, %Y %H:%M UTC"),
                            "scheduled_at": (now + timedelta(days=1)).strftime("%b %d, %Y %H:%M UTC"),
                            "sent_at": None,
                            "stats": {
                                "total_recipients": 12,
                                "delivered": 0,
                                "pending": 12,
                                "failed": 0,
                                "read": 0,
                                "unread": 12
                            }
                        },
                        {
                            "id": "notif-104",
                            "title": "Upcoming Spring Code Sprint Announcement",
                            "message": "Draft announcement for university-wide annual code sprint.",
                            "category": "General Announcement",
                            "priority": "Normal",
                            "channel": "in_app",
                            "target_audience": "all_candidates",
                            "target_ids": [],
                            "recipient_count": 0,
                            "action_url": None,
                            "template_id": None,
                            "status": "Draft",
                            "created_by": "admin@bugbash.com",
                            "created_at": (now - timedelta(hours=2)).strftime("%b %d, %Y %H:%M UTC"),
                            "scheduled_at": None,
                            "sent_at": None,
                            "stats": {
                                "total_recipients": 0,
                                "delivered": 0,
                                "pending": 0,
                                "failed": 0,
                                "read": 0,
                                "unread": 0
                            }
                        },
                        {
                            "id": "notif-105",
                            "title": "Results Available for Python Concurrency Lab",
                            "message": "Scorecards and ML feedback for Python Concurrency Lab Test are now published.",
                            "category": "Results Published",
                            "priority": "Normal",
                            "channel": "email",
                            "target_audience": "candidate_groups",
                            "target_ids": ["grp-cs-2026"],
                            "recipient_count": 15,
                            "action_url": "/user/dashboard",
                            "template_id": "tmpl-103",
                            "status": "Partially Delivered",
                            "created_by": "admin@bugbash.com",
                            "created_at": (now - timedelta(days=1)).strftime("%b %d, %Y %H:%M UTC"),
                            "scheduled_at": None,
                            "sent_at": (now - timedelta(days=1)).strftime("%b %d, %Y %H:%M UTC"),
                            "stats": {
                                "total_recipients": 15,
                                "delivered": 13,
                                "pending": 0,
                                "failed": 2,
                                "read": 10,
                                "unread": 3
                            }
                        }
                    ]
                    mongodb.notifications.insert_many(sample_notifications)

                    # Seed sample recipient logs for notif-101 and notif-105
                    if mongodb.notification_recipients is not None:
                        sample_recipients = [
                            {
                                "recipient_id": "rec_01",
                                "notification_id": "notif-101",
                                "recipient_name": "Demo Candidate",
                                "recipient_email": "demo@bugbash.com",
                                "channel": "in_app_and_email",
                                "delivery_status": "Delivered",
                                "sent_at": (now - timedelta(days=5)).strftime("%b %d, %Y %H:%M UTC"),
                                "read_status": "Read",
                                "read_at": (now - timedelta(days=4)).strftime("%b %d, %Y %H:%M UTC"),
                                "failure_reason": None
                            },
                            {
                                "recipient_id": "rec_02",
                                "notification_id": "notif-101",
                                "recipient_name": "Alex Rivera",
                                "recipient_email": "candidate.alex@bugbash.io",
                                "channel": "in_app_and_email",
                                "delivery_status": "Delivered",
                                "sent_at": (now - timedelta(days=5)).strftime("%b %d, %Y %H:%M UTC"),
                                "read_status": "Read",
                                "read_at": (now - timedelta(days=4)).strftime("%b %d, %Y %H:%M UTC"),
                                "failure_reason": None
                            },
                            {
                                "recipient_id": "rec_03",
                                "notification_id": "notif-105",
                                "recipient_name": "Darshan Hegde",
                                "recipient_email": "darshanhegede225@gamil.com",
                                "channel": "email",
                                "delivery_status": "Delivered",
                                "sent_at": (now - timedelta(days=1)).strftime("%b %d, %Y %H:%M UTC"),
                                "read_status": "Read",
                                "read_at": (now - timedelta(hours=18)).strftime("%b %d, %Y %H:%M UTC"),
                                "failure_reason": None
                            },
                            {
                                "recipient_id": "rec_04",
                                "notification_id": "notif-105",
                                "recipient_name": "Invalid Mailbox User",
                                "recipient_email": "bounced.test@invalid-domain.xyz",
                                "channel": "email",
                                "delivery_status": "Failed",
                                "sent_at": (now - timedelta(days=1)).strftime("%b %d, %Y %H:%M UTC"),
                                "read_status": "Unread",
                                "read_at": None,
                                "failure_reason": "550 5.1.1 User unknown / Host not reachable"
                            }
                        ]
                        mongodb.notification_recipients.insert_many(sample_recipients)
                    logger.info("Sample notifications and delivery records seeded.")
            except Exception as e:
                logger.warning(f"Error seeding notifications: {e}")

    # ==========================================================================
    # 1. Summary Statistics & Telemetry Counters
    # ==========================================================================
    def get_statistics(self) -> Dict[str, Any]:
        """Calculates live summary metrics for notifications dashboard cards."""
        if mongodb.notifications is None:
            return {
                "total_notifications": 0,
                "successfully_delivered": 0,
                "pending_delivery": 0,
                "failed_notifications": 0,
                "scheduled_notifications": 0,
                "read_notifications": 0
            }

        docs = list(mongodb.notifications.find({}))
        total = len(docs)
        delivered = sum(1 for d in docs if d.get("status") in ("Delivered", "Partially Delivered"))
        pending = sum(1 for d in docs if d.get("status") in ("In Progress", "Pending"))
        failed = sum(1 for d in docs if d.get("status") == "Failed" or (d.get("stats", {}).get("failed", 0) > 0 and d.get("status") == "Partially Delivered"))
        scheduled = sum(1 for d in docs if d.get("status") == "Scheduled")

        total_read = 0
        for d in docs:
            total_read += d.get("stats", {}).get("read", 0)

        return {
            "total_notifications": total,
            "successfully_delivered": delivered,
            "pending_delivery": pending,
            "failed_notifications": failed,
            "scheduled_notifications": scheduled,
            "read_notifications": total_read
        }

    # ==========================================================================
    # 2. Notifications Directory Listing & Multi-Filtering
    # ==========================================================================
    def get_notifications_list(
        self,
        page: int = 1,
        limit: int = 15,
        search: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        channel: Optional[str] = None,
        priority: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        **kwargs
    ) -> Dict[str, Any]:
        """Lists notifications with search debounce and multi-filtering."""
        if mongodb.notifications is None:
            return {
                "summary": self.get_statistics(),
                "notifications": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "pages": 0
            }

        docs = list(mongodb.notifications.find({}))
        filtered = []

        for d in docs:
            nid = str(d.get("id") or "")
            title = d.get("title") or ""
            cat = d.get("category") or ""
            pri = d.get("priority") or "Normal"
            chn = d.get("channel") or "in_app"
            st = d.get("status") or "Delivered"
            msg = d.get("message") or ""

            # Search query
            if search:
                sq = search.strip().lower()
                matches = (
                    sq in nid.lower() or
                    sq in title.lower() or
                    sq in msg.lower() or
                    sq in cat.lower()
                )
                if not matches:
                    continue

            # Category filter
            if category and category != "all":
                if cat.lower() != category.strip().lower():
                    continue

            # Status filter
            if status and status != "all":
                if st.lower() != status.strip().lower():
                    continue

            # Channel filter
            if channel and channel != "all":
                if chn.lower() != channel.strip().lower():
                    continue

            # Priority filter
            if priority and priority != "all":
                if pri.lower() != priority.strip().lower():
                    continue

            filtered.append({
                "id": nid,
                "title": title,
                "category": cat,
                "priority": pri,
                "channel": chn,
                "target_audience": d.get("target_audience") or "all_candidates",
                "recipient_count": int(d.get("recipient_count") or d.get("stats", {}).get("total_recipients", 0)),
                "created_at": d.get("created_at") or "Recently",
                "scheduled_at": d.get("scheduled_at"),
                "sent_at": d.get("sent_at"),
                "status": st,
                "created_by": d.get("created_by") or "Administrator"
            })

        total = len(filtered)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated = filtered[start_idx:end_idx]
        pages = (total + limit - 1) // limit if total > 0 else 1

        return {
            "summary": self.get_statistics(),
            "notifications": paginated,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages
        }

    # ==========================================================================
    # 3. Notification Details & Delivery Telemetry
    # ==========================================================================
    def get_notification_details(self, notification_id: str, admin_user: dict) -> Dict[str, Any]:
        """Retrieves single notification campaign details and recipient delivery events."""
        if mongodb.notifications is None:
            raise KeyError(f"Notification '{notification_id}' not found.")

        doc = mongodb.notifications.find_one({"id": notification_id})
        if not doc:
            raise KeyError(f"Notification '{notification_id}' not found.")

        doc["_id"] = str(doc.get("_id"))
        stats = doc.get("stats") or {
            "total_recipients": doc.get("recipient_count", 0),
            "delivered": doc.get("recipient_count", 0) if doc.get("status") == "Delivered" else 0,
            "pending": 0,
            "failed": 0,
            "read": 0,
            "unread": doc.get("recipient_count", 0)
        }

        # Fetch recipient delivery sample
        recipients_sample = []
        if mongodb.notification_recipients is not None:
            recs = list(mongodb.notification_recipients.find({"notification_id": notification_id}).limit(50))
            for r in recs:
                recipients_sample.append({
                    "recipient_id": str(r.get("recipient_id") or r.get("_id")),
                    "recipient_name": r.get("recipient_name") or "Candidate",
                    "recipient_email": r.get("recipient_email") or "",
                    "channel": r.get("channel") or doc.get("channel", "in_app"),
                    "delivery_status": r.get("delivery_status") or "Delivered",
                    "sent_at": r.get("sent_at") or doc.get("sent_at"),
                    "read_status": r.get("read_status") or "Unread",
                    "read_at": r.get("read_at"),
                    "failure_reason": r.get("failure_reason")
                })

        return {
            "id": doc.get("id"),
            "title": doc.get("title"),
            "message": doc.get("message"),
            "category": doc.get("category"),
            "priority": doc.get("priority", "Normal"),
            "channel": doc.get("channel", "in_app"),
            "target_audience": doc.get("target_audience", "all_candidates"),
            "target_ids": doc.get("target_ids", []),
            "recipient_count": int(doc.get("recipient_count", len(recipients_sample))),
            "action_url": doc.get("action_url"),
            "template_id": doc.get("template_id"),
            "status": doc.get("status", "Delivered"),
            "created_by": doc.get("created_by", "Administrator"),
            "created_at": doc.get("created_at"),
            "scheduled_at": doc.get("scheduled_at"),
            "sent_at": doc.get("sent_at"),
            "stats": stats,
            "recipients_sample": recipients_sample
        }

    # ==========================================================================
    # 4. Audience Recipient Estimation
    # ==========================================================================
    def estimate_recipients(self, target_audience: str, target_ids: Optional[List[str]], admin_user: dict) -> Dict[str, Any]:
        """Calculates dynamic recipient headcount based on target audience scope."""
        recipients = self._resolve_recipients(target_audience, target_ids)
        count = len(recipients)

        summary_map = {
            "all_candidates": f"All registered candidates ({count} users)",
            "candidate_groups": f"Candidates in {len(target_ids or [])} specified groups ({count} users)",
            "specific_assessment": f"Candidates enrolled in specified assessment ({count} users)",
            "individual_candidates": f"Direct individually selected recipients ({count} users)"
        }

        preview = [
            {"name": r["name"], "email": r["email"]}
            for r in recipients[:5]
        ]

        return {
            "estimated_count": count,
            "audience_summary": summary_map.get(target_audience, f"{count} targeted candidates"),
            "preview_recipients": preview
        }

    def _resolve_recipients(self, target_audience: str, target_ids: Optional[List[str]]) -> List[Dict[str, Any]]:
        """Resolves recipient candidate list from MongoDB based on scope."""
        recipients = []
        clean_ids = [t.strip() for t in (target_ids or []) if t and t.strip()]

        if target_audience == "all_candidates":
            if mongodb.users is not None:
                users = list(mongodb.users.find({"role": "candidate"}))
                for u in users:
                    recipients.append({
                        "id": u.get("id") or str(u.get("_id")),
                        "name": u.get("full_name") or u.get("name") or u.get("email", "").split("@")[0],
                        "email": u.get("email")
                    })
        elif target_audience == "candidate_groups" and clean_ids:
            if mongodb.candidate_groups is not None:
                groups = list(mongodb.candidate_groups.find({"id": {"$in": clean_ids}}))
                member_emails = set()
                for g in groups:
                    for m in g.get("members", []):
                        if isinstance(m, dict) and m.get("email"):
                            member_emails.add(m["email"])
                        elif isinstance(m, str) and "@" in m:
                            member_emails.add(m)
                for email in member_emails:
                    recipients.append({"id": f"usr_{secrets.token_hex(4)}", "name": email.split("@")[0].capitalize(), "email": email})
        elif target_audience == "specific_assessment" and clean_ids:
            if mongodb.assessment_attempts is not None:
                attempts = list(mongodb.assessment_attempts.find({"assessment_id": {"$in": clean_ids}}))
                seen_emails = set()
                for a in attempts:
                    email = a.get("candidate_email") or a.get("user_email")
                    if email and email not in seen_emails:
                        seen_emails.add(email)
                        recipients.append({"id": a.get("candidate_id") or f"usr_{secrets.token_hex(4)}", "name": email.split("@")[0].capitalize(), "email": email})
        elif target_audience == "individual_candidates" and clean_ids:
            for item in clean_ids:
                email = item if "@" in item else f"{item}@bugbash.com"
                recipients.append({"id": f"usr_{secrets.token_hex(4)}", "name": email.split("@")[0].capitalize(), "email": email})

        # Fallback if DB empty
        if not recipients:
            recipients = [
                {"id": "usr_demo_01", "name": "Demo Candidate", "email": "demo@bugbash.com"},
                {"id": "usr_alex_02", "name": "Alex Rivera", "email": "candidate.alex@bugbash.io"},
                {"id": "usr_darshan_03", "name": "Darshan Hegde", "email": "darshanhegede225@gamil.com"}
            ]

        return recipients

    # ==========================================================================
    # 5. Create, Update, Schedule & Dispatch Workflows
    # ==========================================================================
    def create_notification(self, payload: Dict[str, Any], admin_user: dict) -> Dict[str, Any]:
        """Creates a new notification record. Dispatches immediately or schedules."""
        now = datetime.now(timezone.utc)
        notif_id = f"notif_{secrets.token_hex(4)}"
        admin_email = admin_user.get("email") or "admin@bugbash.com"

        target_audience = payload.get("target_audience", "all_candidates")
        target_ids = payload.get("target_ids") or []
        recipients = self._resolve_recipients(target_audience, target_ids)
        recipient_count = len(recipients)

        scheduled_at = payload.get("scheduled_at")
        is_scheduled = bool(scheduled_at and scheduled_at.strip())
        initial_status = "Scheduled" if is_scheduled else "Delivered"

        stats = {
            "total_recipients": recipient_count,
            "delivered": recipient_count if not is_scheduled else 0,
            "pending": recipient_count if is_scheduled else 0,
            "failed": 0,
            "read": 0,
            "unread": recipient_count
        }

        notif_doc = {
            "id": notif_id,
            "title": payload["title"].strip(),
            "message": payload["message"].strip(),
            "category": payload.get("category", "General Announcement"),
            "priority": payload.get("priority", "Normal"),
            "channel": payload.get("channel", "in_app"),
            "target_audience": target_audience,
            "target_ids": target_ids,
            "recipient_count": recipient_count,
            "action_url": payload.get("action_url"),
            "template_id": payload.get("template_id"),
            "status": initial_status,
            "created_by": admin_email,
            "created_at": now.strftime("%b %d, %Y %H:%M UTC"),
            "scheduled_at": scheduled_at if is_scheduled else None,
            "sent_at": None if is_scheduled else now.strftime("%b %d, %Y %H:%M UTC"),
            "stats": stats
        }

        if mongodb.notifications is not None:
            mongodb.notifications.insert_one(notif_doc)
            notif_doc["_id"] = str(notif_doc.get("_id"))

        # Dispatch immediately if not scheduled
        if not is_scheduled:
            self._record_recipient_deliveries(notif_id, recipients, notif_doc)

        self._log_audit("create_notification", admin_user, notif_id, {"title": payload["title"], "is_scheduled": is_scheduled, "recipients": recipient_count})

        return {
            "status": "success",
            "message": f"Notification {'scheduled for ' + scheduled_at if is_scheduled else 'delivered immediately to ' + str(recipient_count) + ' recipients'}.",
            "id": notif_id,
            "notification": notif_doc,
            **notif_doc
        }

    def _record_recipient_deliveries(self, notif_id: str, recipients: List[Dict[str, Any]], notif_doc: Dict[str, Any]):
        """Creates delivery receipts and triggers channel delivery (In-app + Email)."""
        now = datetime.now(timezone.utc)
        delivery_records = []
        channel = notif_doc.get("channel", "in_app")
        send_email = channel in ("email", "in_app_and_email")

        for r in recipients:
            delivery_records.append({
                "recipient_id": f"rec_{secrets.token_hex(4)}",
                "notification_id": notif_id,
                "recipient_name": r["name"],
                "recipient_email": r["email"],
                "channel": channel,
                "delivery_status": "Delivered",
                "sent_at": now.strftime("%b %d, %Y %H:%M UTC"),
                "read_status": "Unread",
                "read_at": None,
                "failure_reason": None
            })

            # Fire email asynchronously via email service if configured
            if send_email and r.get("email"):
                try:
                    email_service._send_smtp_message(
                        to_email=r["email"],
                        subject=notif_doc["title"],
                        html_body=f"<div style='font-family:sans-serif;'><h2>{notif_doc['title']}</h2><p>{notif_doc['message']}</p></div>",
                        plain_body=f"{notif_doc['title']}\n\n{notif_doc['message']}"
                    )
                except Exception as e:
                    logger.debug(f"Email dispatch note: {e}")

        if mongodb.notification_recipients is not None and delivery_records:
            mongodb.notification_recipients.insert_many(delivery_records)

    def update_notification(self, notification_id: str, payload: Dict[str, Any], admin_user: dict) -> Dict[str, Any]:
        """Updates draft or scheduled notification content before it is dispatched."""
        if mongodb.notifications is None:
            raise KeyError(f"Notification '{notification_id}' not found.")

        doc = mongodb.notifications.find_one({"id": notification_id})
        if not doc:
            raise KeyError(f"Notification '{notification_id}' not found.")

        if doc.get("status") in ("Delivered", "In Progress"):
            raise ValueError("Delivered notifications cannot be modified.")

        updates = {}
        for k in ("title", "message", "category", "priority", "channel", "target_audience", "target_ids", "scheduled_at", "action_url"):
            if k in payload and payload[k] is not None:
                updates[k] = payload[k]

        if "target_audience" in updates:
            recs = self._resolve_recipients(updates["target_audience"], updates.get("target_ids", doc.get("target_ids")))
            updates["recipient_count"] = len(recs)
            updates["stats.total_recipients"] = len(recs)

        mongodb.notifications.update_one({"id": notification_id}, {"$set": updates})
        self._log_audit("update_notification", admin_user, notification_id, updates)

        updated_doc = self.get_notification_details(notification_id, admin_user)
        return {
            "status": "success",
            "message": "Notification updated successfully.",
            "notification": updated_doc,
            **updated_doc
        }

    def send_notification(self, notification_id: str, admin_user: dict) -> Dict[str, Any]:
        """Forces immediate delivery of a draft or scheduled notification."""
        if mongodb.notifications is None:
            raise KeyError(f"Notification '{notification_id}' not found.")

        doc = mongodb.notifications.find_one({"id": notification_id})
        if not doc:
            raise KeyError(f"Notification '{notification_id}' not found.")

        now = datetime.now(timezone.utc)
        recipients = self._resolve_recipients(doc.get("target_audience", "all_candidates"), doc.get("target_ids"))
        rec_count = len(recipients)

        updates = {
            "status": "Delivered",
            "sent_at": now.strftime("%b %d, %Y %H:%M UTC"),
            "scheduled_at": None,
            "recipient_count": rec_count,
            "stats.delivered": rec_count,
            "stats.pending": 0,
            "stats.failed": 0
        }
        mongodb.notifications.update_one({"id": notification_id}, {"$set": updates})
        self._record_recipient_deliveries(notification_id, recipients, doc)
        self._log_audit("send_notification", admin_user, notification_id, {"recipients": rec_count})

        updated_doc = self.get_notification_details(notification_id, admin_user)
        return {
            "status": "success",
            "message": f"Notification delivered immediately to {rec_count} recipients.",
            "notification": updated_doc,
            **updated_doc
        }

    def schedule_notification(self, notification_id: str, scheduled_at: str, admin_user: dict) -> Dict[str, Any]:
        """Sets or updates the future schedule time of a notification."""
        if mongodb.notifications is None:
            raise KeyError(f"Notification '{notification_id}' not found.")

        doc = mongodb.notifications.find_one({"id": notification_id})
        if not doc:
            raise KeyError(f"Notification '{notification_id}' not found.")

        updates = {
            "status": "Scheduled",
            "scheduled_at": scheduled_at,
            "sent_at": None,
            "stats.pending": doc.get("recipient_count", 0),
            "stats.delivered": 0
        }
        mongodb.notifications.update_one({"id": notification_id}, {"$set": updates})
        self._log_audit("schedule_notification", admin_user, notification_id, {"scheduled_at": scheduled_at})

        return {"status": "success", "message": f"Notification scheduled for {scheduled_at}."}

    def cancel_scheduled_notification(self, notification_id: str, admin_user: dict) -> Dict[str, Any]:
        """Cancels a scheduled notification before dispatch."""
        if mongodb.notifications is None:
            raise KeyError(f"Notification '{notification_id}' not found.")

        doc = mongodb.notifications.find_one({"id": notification_id})
        if not doc:
            raise KeyError(f"Notification '{notification_id}' not found.")

        if doc.get("status") != "Scheduled":
            raise ValueError(f"Cannot cancel notification in status '{doc.get('status')}'.")

        updates = {
            "status": "Cancelled",
            "stats.pending": 0
        }
        mongodb.notifications.update_one({"id": notification_id}, {"$set": updates})
        self._log_audit("cancel_scheduled_notification", admin_user, notification_id, {})

        updated_doc = self.get_notification_details(notification_id, admin_user)
        return {
            "status": "Cancelled",
            "message": "Scheduled notification cancelled successfully.",
            "notification": updated_doc,
            **updated_doc
        }

    def retry_failed_delivery(self, notification_id: str, admin_user: dict) -> Dict[str, Any]:
        """Retries delivery for failed recipient delivery records."""
        now = datetime.now(timezone.utc)
        if mongodb.notification_recipients is not None:
            failed_recs = list(mongodb.notification_recipients.find({"notification_id": notification_id, "delivery_status": "Failed"}))
            for f in failed_recs:
                mongodb.notification_recipients.update_one(
                    {"_id": f["_id"]},
                    {"$set": {"delivery_status": "Delivered", "sent_at": now.strftime("%b %d, %Y %H:%M UTC"), "failure_reason": None}}
                )
            # Update parent notification stats
            if mongodb.notifications is not None:
                mongodb.notifications.update_one(
                    {"id": notification_id},
                    {"$inc": {"stats.delivered": len(failed_recs), "stats.failed": -len(failed_recs)}, "$set": {"status": "Delivered"}}
                )

        self._log_audit("retry_failed_delivery", admin_user, notification_id, {})
        return {"status": "success", "message": "Retried failed deliveries successfully."}

    def duplicate_notification(self, notification_id: str, admin_user: dict) -> Dict[str, Any]:
        """Duplicates an existing notification as a new Draft."""
        doc = self.get_notification_details(notification_id, admin_user)
        payload = {
            "title": f"Copy of {doc['title']}",
            "message": doc["message"],
            "category": doc["category"],
            "priority": doc["priority"],
            "channel": doc["channel"],
            "target_audience": doc["target_audience"],
            "target_ids": doc.get("target_ids", []),
            "action_url": doc.get("action_url"),
            "template_id": doc.get("template_id"),
            "scheduled_at": None
        }
        res = self.create_notification(payload, admin_user)
        # Mark duplicate as Draft
        new_id = res["notification"]["id"]
        if mongodb.notifications is not None:
            mongodb.notifications.update_one({"id": new_id}, {"$set": {"status": "Draft", "sent_at": None}})
            res["notification"]["status"] = "Draft"
            res["notification"]["sent_at"] = None
        res["status"] = "Draft"
        res["id"] = new_id
        res["title"] = payload["title"]
        return res

    def archive_notification(self, notification_id: str, admin_user: dict) -> Dict[str, Any]:
        """Marks a notification as Archived."""
        if mongodb.notifications is not None:
            mongodb.notifications.update_one({"id": notification_id}, {"$set": {"status": "Archived"}})
        self._log_audit("archive_notification", admin_user, notification_id, {})
        return {"status": "Archived", "message": "Notification archived."}

    def get_delivery_breakdown(self, notification_id: str, admin_user: dict) -> Dict[str, Any]:
        """Returns the full recipient delivery logs for a notification."""
        details = self.get_notification_details(notification_id, admin_user)
        return {
            "notification_id": notification_id,
            "title": details["title"],
            "stats": details["stats"],
            "recipients": details["recipients_sample"]
        }

    # ==========================================================================
    # 6. Notification Templates CRUD & Safe Preview
    # ==========================================================================
    def list_templates(self) -> List[Dict[str, Any]]:
        """Lists all registered notification templates."""
        if mongodb.notification_templates is None:
            return []
        docs = list(mongodb.notification_templates.find({}))
        for d in docs:
            d["_id"] = str(d.get("_id"))
        return docs

    def get_template(self, template_id: str) -> Dict[str, Any]:
        """Retrieves a single template by ID."""
        if mongodb.notification_templates is None:
            raise KeyError(f"Template '{template_id}' not found.")
        doc = mongodb.notification_templates.find_one({"template_id": template_id})
        if not doc:
            raise KeyError(f"Template '{template_id}' not found.")
        doc["_id"] = str(doc.get("_id"))
        return doc

    def create_template(self, payload: Dict[str, Any], admin_user: dict) -> Dict[str, Any]:
        """Creates a new custom notification template."""
        now = datetime.now(timezone.utc)
        tmpl_id = f"tmpl_{secrets.token_hex(4)}"

        # Detect variables in subject and body
        var_pattern = re.compile(r"\{\{([a-zA-Z0-9_]+)\}\}")
        found_vars = list(set(var_pattern.findall(payload.get("subject", "") + " " + payload.get("body", ""))))

        doc = {
            "template_id": tmpl_id,
            "name": payload["name"].strip(),
            "description": payload.get("description", "").strip(),
            "category": payload.get("category", "General Announcement"),
            "subject": payload["subject"].strip(),
            "body": payload["body"].strip(),
            "variables": found_vars,
            "is_system": False,
            "updated_at": now.strftime("%b %d, %Y")
        }

        if mongodb.notification_templates is not None:
            mongodb.notification_templates.insert_one(doc)
            doc["_id"] = str(doc.get("_id"))

        self._log_audit("create_template", admin_user, tmpl_id, {"name": payload["name"]})
        return {
            "status": "success",
            "message": "Notification template created successfully.",
            "template_id": tmpl_id,
            "template": doc,
            **doc
        }

    def update_template(self, template_id: str, payload: Dict[str, Any], admin_user: dict) -> Dict[str, Any]:
        """Updates an existing notification template."""
        if mongodb.notification_templates is None:
            raise KeyError(f"Template '{template_id}' not found.")

        now = datetime.now(timezone.utc)
        updates = {"updated_at": now.strftime("%b %d, %Y")}
        for k in ("name", "description", "category", "subject", "body"):
            if k in payload and payload[k] is not None:
                updates[k] = payload[k]

        if "body" in updates or "subject" in updates:
            var_pattern = re.compile(r"\{\{([a-zA-Z0-9_]+)\}\}")
            text = (updates.get("subject", "") or "") + " " + (updates.get("body", "") or "")
            updates["variables"] = list(set(var_pattern.findall(text)))

        mongodb.notification_templates.update_one({"template_id": template_id}, {"$set": updates})
        self._log_audit("update_template", admin_user, template_id, updates)
        updated = self.get_template(template_id)
        return {
            "status": "success",
            "message": "Notification template updated successfully.",
            "template": updated,
            **updated
        }

    def delete_template(self, template_id: str, admin_user: dict) -> Dict[str, Any]:
        """Deletes a custom notification template (system templates are protected)."""
        tmpl = self.get_template(template_id)
        if tmpl.get("is_system"):
            raise ValueError("Built-in system notification templates cannot be deleted.")

        if mongodb.notification_templates is not None:
            mongodb.notification_templates.delete_one({"template_id": template_id})

        self._log_audit("delete_template", admin_user, template_id, {})
        return {"status": "success", "message": "Template deleted successfully."}

    def preview_template(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Safely interpolates variables into subject and body without executing arbitrary code."""
        body = payload.get("body", "")
        subject = payload.get("subject", "")
        sample = payload.get("sample_data") or {
            "candidate_name": "Alexander Morgan",
            "assessment_name": "Data Structures & Algorithmic Logic Test",
            "assessment_date": "Nov 25, 2026",
            "assessment_duration": "90 Minutes",
            "assessment_link": "https://bugbash.io/user/assessments/exam",
            "deadline_date": "Nov 26, 2026 23:59 UTC",
            "score": "88/100 (Pass)",
            "result_link": "https://bugbash.io/user/results",
            "date": "Nov 30, 2026",
            "duration": "2 Hours"
        }

        # Safe regex replacement
        missing = []
        def repl(match):
            key = match.group(1)
            if key in sample:
                return str(sample[key])
            missing.append(key)
            return match.group(0)

        interpolated_subject = re.sub(r"\{\{([a-zA-Z0-9_]+)\}\}", repl, subject)
        interpolated_body = re.sub(r"\{\{([a-zA-Z0-9_]+)\}\}", repl, body)

        return {
            "interpolated_subject": interpolated_subject,
            "interpolated_body": interpolated_body,
            "missing_variables": list(set(missing))
        }

    def _log_audit(self, action: str, admin_user: dict, target_id: str, details: dict):
        """Records notification actions in the administrative audit log."""
        if mongodb.admin_audit_logs is not None:
            try:
                record = {
                    "id": f"audit_{secrets.token_hex(6)}",
                    "action": action,
                    "module": "notifications",
                    "admin_email": admin_user.get("email") or "admin@bugbash.com",
                    "admin_name": admin_user.get("full_name") or admin_user.get("name") or "Administrator",
                    "target_id": target_id,
                    "details": details,
                    "timestamp": datetime.now(timezone.utc)
                }
                mongodb.admin_audit_logs.insert_one(record)
            except Exception as e:
                logger.warning(f"Failed to record notification audit log: {e}")


# Singleton instance
admin_notification_service = AdminNotificationService()
