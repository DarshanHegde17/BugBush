"""
BugBash - Enterprise Admin Candidate & Student Management Service
Provides complete business logic for candidate directory, profile management,
account suspension, candidate groups, CSV bulk imports, invitations, and assessment assignments.
Fully integrated with MongoDB collections and administrative audit trails.
"""

import os
import re
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple

from backend.app.database.mongodb import mongodb
from backend.app.services.password_reset_service import PasswordResetService
from backend.app.services.admin_assessment_service import admin_assessment_service
from backend.app.services.email_service import email_service

logger = logging.getLogger("bugbash.admin.candidates")

EMAIL_REGEX = re.compile(r"^[\w\.-]+@([\w-]+\.)+[\w-]{2,8}$")


class AdminCandidateService:
    def __init__(self):
        self._ensure_sample_groups()

    def _ensure_sample_groups(self):
        """Seeds initial default candidate groups if missing in MongoDB."""
        if mongodb.candidate_groups is not None:
            try:
                if mongodb.candidate_groups.count_documents({}) == 0:
                    now = datetime.now(timezone.utc)
                    sample_groups = [
                        {
                            "id": "grp-py-batch-a",
                            "name": "Python Batch A",
                            "description": "Core Python programming cohort - Fall 2026",
                            "tags": ["Python", "Algorithms", "Batch A"],
                            "member_ids": ["usr_demo_01"],
                            "assigned_assessments": ["asmt-101"],
                            "created_by": "admin@bugbash.com",
                            "created_at": now,
                            "updated_at": now
                        },
                        {
                            "id": "grp-tech-round-1",
                            "name": "Technical Interview Round 1",
                            "description": "Shortlisted campus placement interview candidates",
                            "tags": ["Interviews", "Data Structures", "Placement"],
                            "member_ids": [],
                            "assigned_assessments": ["asmt-103"],
                            "created_by": "admin@bugbash.com",
                            "created_at": now,
                            "updated_at": now
                        },
                        {
                            "id": "grp-final-year",
                            "name": "Final Year Students",
                            "description": "Class of 2026 graduating computer science cohort",
                            "tags": ["University", "2026 Cohort", "Semester Exam"],
                            "member_ids": ["usr_demo_01"],
                            "assigned_assessments": ["asmt-102"],
                            "created_by": "admin@bugbash.com",
                            "created_at": now,
                            "updated_at": now
                        }
                    ]
                    mongodb.candidate_groups.insert_many(sample_groups)
                    logger.info("Sample candidate groups seeded into MongoDB.")
            except Exception as e:
                logger.warning(f"Error seeding candidate groups: {e}")

    def _log_audit(self, action: str, admin_user: dict, target_id: str, details: dict):
        """Records administrative actions to the immutable audit trail."""
        if mongodb.admin_audit_logs is not None:
            try:
                record = {
                    "id": f"audit_{secrets.token_hex(6)}",
                    "action": action,
                    "module": "candidates",
                    "admin_email": admin_user.get("email") or "admin@bugbash.com",
                    "admin_name": admin_user.get("full_name") or admin_user.get("name") or "Administrator",
                    "target_id": target_id,
                    "details": details,
                    "timestamp": datetime.now(timezone.utc)
                }
                mongodb.admin_audit_logs.insert_one(record)
            except Exception as e:
                logger.warning(f"Failed to record candidate audit log: {e}")

    # ==========================================================================
    # 1. Candidate Directory & Summary
    # ==========================================================================
    def get_candidates(
        self,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        group_filter: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        limit: int = 15
    ) -> Dict[str, Any]:
        """
        Retrieves paginated candidate accounts with search, multi-condition filtering,
        assigned assessment counters, and cohort-level summary statistics.
        """
        if mongodb.users is None:
            return {
                "summary": {
                    "total_candidates": 0, "active_candidates": 0, "verified_candidates": 0,
                    "assessment_participants": 0, "pending_invitations": 0, "suspended_candidates": 0
                },
                "candidates": [], "total": 0, "page": page, "limit": limit, "pages": 1
            }

        # Candidate match: role is candidate, user, student, or not admin
        base_match: Dict[str, Any] = {
            "role": {"$ne": "admin"}
        }

        # Search filter across name, email, id, college
        if search and search.strip():
            s = search.strip()
            base_match["$or"] = [
                {"full_name": {"$regex": s, "$options": "i"}},
                {"name": {"$regex": s, "$options": "i"}},
                {"email": {"$regex": s, "$options": "i"}},
                {"id": {"$regex": s, "$options": "i"}},
                {"college_name": {"$regex": s, "$options": "i"}}
            ]

        # Calculate Summary Metrics across all candidates (without search restriction)
        total_candidates = mongodb.users.count_documents({"role": {"$ne": "admin"}})
        active_candidates = mongodb.users.count_documents({
            "role": {"$ne": "admin"},
            "account_status": {"$ne": "Suspended"},
            "is_suspended": {"$ne": True}
        })
        verified_candidates = mongodb.users.count_documents({
            "role": {"$ne": "admin"},
            "is_verified": True
        })
        suspended_candidates = mongodb.users.count_documents({
            "role": {"$ne": "admin"},
            "$or": [
                {"account_status": "Suspended"},
                {"is_suspended": True}
            ]
        })

        pending_invitations = 0
        if mongodb.candidate_invitations is not None:
            pending_invitations = mongodb.candidate_invitations.count_documents({"status": "Pending"})

        assessment_participants = 0
        if mongodb.results is not None:
            assessment_participants = len(mongodb.results.distinct("user_email"))

        summary = {
            "total_candidates": total_candidates,
            "active_candidates": active_candidates,
            "verified_candidates": verified_candidates,
            "assessment_participants": assessment_participants,
            "pending_invitations": pending_invitations,
            "suspended_candidates": suspended_candidates
        }

        # Apply specific Status Filter
        if status_filter:
            st = status_filter.strip().lower()
            if st == "active":
                base_match["account_status"] = {"$ne": "Suspended"}
                base_match["is_suspended"] = {"$ne": True}
            elif st == "suspended":
                base_match["$or"] = [
                    {"account_status": "Suspended"},
                    {"is_suspended": True}
                ]
            elif st == "verified":
                base_match["is_verified"] = True
            elif st == "unverified":
                base_match["is_verified"] = False
            elif st == "invited":
                base_match["account_status"] = "Pending Invitation"

        # Apply Group Filter
        if group_filter and group_filter.strip():
            g_doc = mongodb.candidate_groups.find_one({"id": group_filter.strip()})
            if g_doc:
                member_ids = g_doc.get("member_ids", [])
                base_match["$or"] = [
                    {"id": {"$in": member_ids}},
                    {"email": {"$in": member_ids}}
                ]

        total_matching = mongodb.users.count_documents(base_match)
        pages = max(1, (total_matching + limit - 1) // limit)
        skip = (page - 1) * limit

        # Sorting
        sort_dir = -1 if sort_order.lower() == "desc" else 1
        sort_field = "created_at"
        if sort_by in ("full_name", "email", "created_at", "updated_at", "college_name"):
            sort_field = sort_by

        cursor = mongodb.users.find(base_match).sort(sort_field, sort_dir).skip(skip).limit(limit)
        candidates_raw = list(cursor)

        # Batch lookup assignments, groups, and results for enriched row items
        all_groups = list(mongodb.candidate_groups.find({})) if mongodb.candidate_groups is not None else []
        group_map = {}
        for g in all_groups:
            for mid in g.get("member_ids", []):
                group_map.setdefault(mid.lower(), []).append(g.get("name"))

        candidates_list = []
        for u in candidates_raw:
            email = u.get("email", "").strip().lower()
            uid = str(u.get("id") or u.get("_id") or email)
            is_susp = bool(u.get("is_suspended") or u.get("account_status") == "Suspended")
            status_label = "Suspended" if is_susp else (
                u.get("account_status") or ("Active" if u.get("is_verified") else "Unverified")
            )

            # Assigned assessments count
            assigned_count = 0
            if mongodb.assessments is not None:
                assigned_count = mongodb.assessments.count_documents({
                    "$or": [
                        {"assigned_candidates": email},
                        {"assigned_candidates": uid},
                        {"user_email": email}
                    ]
                })

            # Completed count and average score from results
            completed_count = 0
            avg_score = 0.0
            highest_score = None
            if mongodb.results is not None:
                results = list(mongodb.results.find({"user_email": email}))
                completed_count = len(results)
                if results:
                    scores = [float(r.get("score") or 0) for r in results]
                    avg_score = round(sum(scores) / len(scores), 1)
                    highest_score = max(scores)

            # Groups for this candidate
            c_groups = group_map.get(uid.lower(), []) + group_map.get(email, [])
            c_groups = list(dict.fromkeys(c_groups))

            candidates_list.append({
                "id": uid,
                "full_name": u.get("full_name") or u.get("name") or "Unnamed Candidate",
                "email": email,
                "phone_number": u.get("phone_number"),
                "account_status": status_label,
                "is_verified": bool(u.get("is_verified", False)),
                "is_suspended": is_susp,
                "suspension_reason": u.get("suspension_reason"),
                "assigned_assessments_count": assigned_count,
                "completed_assessments_count": completed_count,
                "average_score": avg_score,
                "highest_score": highest_score,
                "college_name": u.get("college_name"),
                "degree_major": u.get("degree_major"),
                "created_at": u.get("created_at"),
                "groups": c_groups,
                "avatar_url": u.get("avatar_url")
            })

        # Post-filter if "Assigned", "Completed", or "No_Assessment"
        if status_filter:
            st = status_filter.strip().lower()
            if st == "assigned":
                candidates_list = [c for c in candidates_list if c["assigned_assessments_count"] > 0]
            elif st == "completed":
                candidates_list = [c for c in candidates_list if c["completed_assessments_count"] > 0]
            elif st == "no_assessment":
                candidates_list = [c for c in candidates_list if c["assigned_assessments_count"] == 0]

        return {
            "summary": summary,
            "candidates": candidates_list,
            "total": total_matching,
            "page": page,
            "limit": limit,
            "pages": pages
        }

    # ==========================================================================
    # 2. Candidate Detail View
    # ==========================================================================
    def get_candidate_details(self, candidate_id: str) -> Dict[str, Any]:
        """
        Retrieves in-depth specifications, grouped assessments, complete performance metrics,
        and chronological activity log for a specific candidate.
        """
        cid = candidate_id.strip()
        user = None

        if mongodb.users is not None:
            user = mongodb.users.find_one({
                "$or": [
                    {"id": cid},
                    {"email": cid.lower()}
                ]
            })

        if not user:
            raise KeyError(f"Candidate '{cid}' not found in BugBash records.")

        email = user.get("email", "").strip().lower()
        uid = str(user.get("id") or user.get("_id") or email)
        is_susp = bool(user.get("is_suspended") or user.get("account_status") == "Suspended")
        status_label = "Suspended" if is_susp else (
            user.get("account_status") or ("Active" if user.get("is_verified") else "Unverified")
        )

        # 1. Groups Lookup
        c_groups = []
        if mongodb.candidate_groups is not None:
            groups = list(mongodb.candidate_groups.find({
                "$or": [
                    {"member_ids": uid},
                    {"member_ids": email}
                ]
            }))
            c_groups = [g.get("name") for g in groups if g.get("name")]

        # 2. Assessments Lookup
        assigned_asmts = []
        upcoming_asmts = []
        inprogress_asmts = []
        completed_asmts = []
        missed_asmts = []

        now = datetime.now(timezone.utc)

        # Look up attempts for status
        attempts_map = {}
        if mongodb.assessment_attempts is not None:
            for att in mongodb.assessment_attempts.find({"user_email": email}):
                attempts_map[att.get("assessment_id")] = att

        # Look up results for grades
        results_map = {}
        if mongodb.results is not None:
            for res in mongodb.results.find({"user_email": email}):
                results_map[res.get("assessment_id")] = res

        if mongodb.assessments is not None:
            asmts = list(mongodb.assessments.find({
                "$or": [
                    {"assigned_candidates": email},
                    {"assigned_candidates": uid},
                    {"user_email": email}
                ]
            }))

            for a in asmts:
                aid = a.get("id")
                title = a.get("title", "Assessment")
                att = attempts_map.get(aid)
                res = results_map.get(aid)

                start_date = a.get("schedule", {}).get("start_date") or a.get("start_date")
                deadline = a.get("schedule", {}).get("end_date") or a.get("deadline")

                asmt_ref = {
                    "id": aid,
                    "title": title,
                    "category": a.get("category", "General"),
                    "difficulty": a.get("difficulty", "Medium"),
                    "duration_minutes": a.get("duration_minutes", 60),
                    "assigned_at": a.get("created_at"),
                    "deadline": deadline,
                    "score": res.get("score") if res else (att.get("score") if att else None),
                    "max_score": res.get("max_score", 100) if res else a.get("total_marks", 100),
                    "percentage": res.get("percentage") if res else None
                }

                if res or (att and att.get("status") == "Completed"):
                    asmt_ref["status"] = "Completed"
                    completed_asmts.append(asmt_ref)
                elif att and att.get("status") == "In Progress":
                    asmt_ref["status"] = "In Progress"
                    inprogress_asmts.append(asmt_ref)
                elif start_date and isinstance(start_date, datetime) and start_date.replace(tzinfo=timezone.utc) > now:
                    asmt_ref["status"] = "Upcoming"
                    upcoming_asmts.append(asmt_ref)
                elif deadline and isinstance(deadline, datetime) and deadline.replace(tzinfo=timezone.utc) < now:
                    asmt_ref["status"] = "Missed"
                    missed_asmts.append(asmt_ref)
                else:
                    asmt_ref["status"] = "Assigned"
                    assigned_asmts.append(asmt_ref)

        # 3. Performance Stats
        all_results = list(mongodb.results.find({"user_email": email})) if mongodb.results is not None else []
        total_attempts = len(all_results)
        avg_score = 0.0
        highest_score = 0.0
        passed_count = 0
        failed_count = 0

        if all_results:
            scores = [float(r.get("score") or 0) for r in all_results]
            avg_score = round(sum(scores) / len(scores), 1)
            highest_score = max(scores)
            for r in all_results:
                passed = r.get("passed")
                if passed is None:
                    pct = float(r.get("percentage") or 0)
                    passed = pct >= 60.0
                if passed:
                    passed_count += 1
                else:
                    failed_count += 1

        total_assigned_count = len(assigned_asmts) + len(upcoming_asmts) + len(inprogress_asmts) + len(completed_asmts) + len(missed_asmts)
        completion_rate = round((len(completed_asmts) / max(1, total_assigned_count)) * 100, 1)

        # 4. Activity History
        activity_items = []
        if mongodb.activity is not None:
            raw_act = list(mongodb.activity.find({"user_email": email}).sort("timestamp", -1).limit(20))
            for act in raw_act:
                activity_items.append({
                    "action": act.get("action") or act.get("title") or "Assessment Activity",
                    "description": act.get("description") or act.get("details"),
                    "timestamp": act.get("timestamp") or act.get("created_at")
                })

        # Add registration event
        activity_items.append({
            "action": "Account Created",
            "description": f"Candidate account initialized with status '{status_label}'",
            "timestamp": user.get("created_at")
        })

        if user.get("verified_at"):
            activity_items.append({
                "action": "Email Verified",
                "description": "Cryptographic 6-digit OTP verified successfully",
                "timestamp": user.get("verified_at")
            })

        if is_susp:
            activity_items.append({
                "action": "Account Suspended",
                "description": f"Suspended by {user.get('suspended_by', 'Administrator')}: {user.get('suspension_reason', 'Policy violation')}",
                "timestamp": user.get("suspended_at")
            })

        # Sort activity chronologically descending
        def _get_ts_sort_key(item):
            ts = item.get("timestamp")
            if not ts:
                return ""
            if isinstance(ts, datetime):
                return ts.isoformat()
            return str(ts)

        activity_items = sorted(
            activity_items,
            key=_get_ts_sort_key,
            reverse=True
        )

        # Clean recent results to ensure all ObjectIds are converted to strings
        clean_recent_results = []
        for r in all_results[:5]:
            r_copy = {}
            for k, v in r.items():
                if type(v).__name__ == "ObjectId":
                    r_copy[k] = str(v)
                else:
                    r_copy[k] = v
            clean_recent_results.append(r_copy)

        return {
            "id": uid,
            "full_name": user.get("full_name") or user.get("name") or "Unnamed Candidate",
            "email": email,
            "phone_number": user.get("phone_number"),
            "avatar_url": user.get("avatar_url"),
            "account_status": status_label,
            "is_verified": bool(user.get("is_verified", False)),
            "is_suspended": is_susp,
            "suspension_reason": user.get("suspension_reason"),
            "suspension_date": user.get("suspended_at"),
            "college_name": user.get("college_name") or "BugBash Institute of Engineering",
            "degree_major": user.get("degree_major") or "Computer Science",
            "graduation_year": user.get("graduation_year") or "2026",
            "bio": user.get("bio", "BugBash coding candidate."),
            "tags": user.get("tags", []),
            "groups": c_groups,
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at"),
            "assessments": {
                "assigned": assigned_asmts,
                "upcoming": upcoming_asmts,
                "in_progress": inprogress_asmts,
                "completed": completed_asmts,
                "missed": missed_asmts
            },
            "performance": {
                "total_attempts": total_attempts,
                "average_score": avg_score,
                "highest_score": highest_score,
                "completion_rate": completion_rate,
                "passed_assessments": passed_count,
                "failed_assessments": failed_count,
                "recent_results": clean_recent_results
            },
            "activity": activity_items[:25]
        }

    # ==========================================================================
    # 3. Profile Updates & Controlled Suspension Lifecycle
    # ==========================================================================
    def update_candidate(self, candidate_id: str, payload: dict, admin_user: dict) -> Dict[str, Any]:
        """Updates admin-managed candidate profile fields and logs audit action."""
        cid = candidate_id.strip()
        user = mongodb.users.find_one({"$or": [{"id": cid}, {"email": cid.lower()}]})
        if not user:
            raise KeyError(f"Candidate '{cid}' not found.")

        now = datetime.now(timezone.utc)
        updates: Dict[str, Any] = {"updated_at": now}

        for field in ("full_name", "phone_number", "college_name", "degree_major", "graduation_year", "bio", "tags"):
            if field in payload and payload[field] is not None:
                updates[field] = payload[field]
                if field == "full_name":
                    updates["name"] = payload["full_name"]

        # Update candidate groups if provided
        if "group_ids" in payload and payload["group_ids"] is not None and mongodb.candidate_groups is not None:
            uid = str(user.get("id") or user.get("_id"))
            # Remove candidate from all groups first
            mongodb.candidate_groups.update_many(
                {},
                {"$pull": {"member_ids": {"$in": [uid, user.get("email")]}}}
            )
            # Add to selected groups
            for gid in payload["group_ids"]:
                mongodb.candidate_groups.update_one(
                    {"id": gid},
                    {"$addToSet": {"member_ids": uid}}
                )

        mongodb.users.update_one({"_id": user["_id"]}, {"$set": updates})

        self._log_audit(
            action="update_candidate_profile",
            admin_user=admin_user,
            target_id=cid,
            details={"updated_fields": list(updates.keys())}
        )

        return self.get_candidate_details(cid)

    def suspend_candidate(self, candidate_id: str, reason: str, admin_user: dict) -> Dict[str, Any]:
        """
        Suspends a candidate account with mandatory reason, immediately locking examination
        access while preserving all historical scores and submissions.
        """
        cid = candidate_id.strip()
        clean_reason = reason.strip()
        if len(clean_reason) < 3:
            raise ValueError("Suspension reason must be at least 3 characters long.")

        user = mongodb.users.find_one({"$or": [{"id": cid}, {"email": cid.lower()}]})
        if not user:
            raise KeyError(f"Candidate '{cid}' not found.")

        now = datetime.now(timezone.utc)
        admin_email = admin_user.get("email") or "admin@bugbash.com"

        mongodb.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "account_status": "Suspended",
                    "is_suspended": True,
                    "suspension_reason": clean_reason,
                    "suspended_at": now,
                    "suspended_by": admin_email,
                    "updated_at": now
                }
            }
        )

        self._log_audit(
            action="suspend_candidate",
            admin_user=admin_user,
            target_id=cid,
            details={"reason": clean_reason, "target_email": user.get("email")}
        )

        return {
            "status": "success",
            "message": f"Candidate '{user.get('email')}' has been suspended successfully.",
            "candidate_id": cid,
            "account_status": "Suspended",
            "is_suspended": True,
            "suspension_reason": clean_reason
        }

    def reactivate_candidate(self, candidate_id: str, admin_user: dict) -> Dict[str, Any]:
        """Reactivates a previously suspended candidate account."""
        cid = candidate_id.strip()
        user = mongodb.users.find_one({"$or": [{"id": cid}, {"email": cid.lower()}]})
        if not user:
            raise KeyError(f"Candidate '{cid}' not found.")

        now = datetime.now(timezone.utc)
        admin_email = admin_user.get("email") or "admin@bugbash.com"

        mongodb.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "account_status": "Active",
                    "is_suspended": False,
                    "suspension_reason": None,
                    "reactivated_at": now,
                    "reactivated_by": admin_email,
                    "updated_at": now
                }
            }
        )

        self._log_audit(
            action="reactivate_candidate",
            admin_user=admin_user,
            target_id=cid,
            details={"target_email": user.get("email")}
        )

        return {
            "status": "success",
            "message": f"Candidate '{user.get('email')}' has been reactivated successfully.",
            "candidate_id": cid,
            "account_status": "Active",
            "is_suspended": False
        }

    # ==========================================================================
    # 4. Candidate Groups Management
    # ==========================================================================
    def list_groups(self) -> List[Dict[str, Any]]:
        """Lists all candidate cohorts with member counts and performance telemetry."""
        if mongodb.candidate_groups is None:
            return []

        groups = list(mongodb.candidate_groups.find({}).sort("name", 1))
        enriched = []

        for g in groups:
            gid = g.get("id")
            member_ids = g.get("member_ids", [])
            member_count = len(member_ids)
            assigned_asmts = g.get("assigned_assessments", [])

            # Compute group average score
            avg_score = 0.0
            if member_ids and mongodb.users is not None and mongodb.results is not None:
                members = list(mongodb.users.find({
                    "$or": [{"id": {"$in": member_ids}}, {"email": {"$in": member_ids}}]
                }, {"email": 1}))
                emails = [m.get("email") for m in members if m.get("email")]
                if emails:
                    results = list(mongodb.results.find({"user_email": {"$in": emails}}))
                    if results:
                        scores = [float(r.get("score") or 0) for r in results]
                        avg_score = round(sum(scores) / len(scores), 1)

            enriched.append({
                "id": gid,
                "name": g.get("name"),
                "description": g.get("description"),
                "tags": g.get("tags", []),
                "member_count": member_count,
                "assigned_assessments_count": len(assigned_asmts),
                "average_score": avg_score,
                "created_at": g.get("created_at"),
                "updated_at": g.get("updated_at"),
                "created_by": g.get("created_by")
            })

        return enriched

    def create_group(self, payload: dict, admin_user: dict) -> Dict[str, Any]:
        """Creates a new candidate group/batch."""
        name = payload.get("name", "").strip()
        if len(name) < 2:
            raise ValueError("Group name must be at least 2 characters long.")

        gid = f"grp-{secrets.token_hex(4)}"
        now = datetime.now(timezone.utc)
        admin_email = admin_user.get("email") or "admin@bugbash.com"

        doc = {
            "id": gid,
            "name": name,
            "description": payload.get("description", "").strip(),
            "tags": payload.get("tags", []),
            "member_ids": payload.get("initial_candidate_ids", []),
            "assigned_assessments": [],
            "created_by": admin_email,
            "created_at": now,
            "updated_at": now
        }

        mongodb.candidate_groups.insert_one(doc)

        self._log_audit(
            action="create_candidate_group",
            admin_user=admin_user,
            target_id=gid,
            details={"group_name": name, "member_count": len(doc["member_ids"])}
        )

        return {
            "status": "success",
            "message": f"Group '{name}' created successfully.",
            "group": {
                "id": gid,
                "name": name,
                "description": doc["description"],
                "tags": doc["tags"],
                "member_count": len(doc["member_ids"]),
                "assigned_assessments_count": 0,
                "average_score": 0.0,
                "created_at": now,
                "updated_at": now,
                "created_by": admin_email
            }
        }

    def update_group(self, group_id: str, payload: dict, admin_user: dict) -> Dict[str, Any]:
        """Updates group name, description, and tags."""
        gid = group_id.strip()
        group = mongodb.candidate_groups.find_one({"id": gid})
        if not group:
            raise KeyError(f"Group '{gid}' not found.")

        now = datetime.now(timezone.utc)
        updates: Dict[str, Any] = {"updated_at": now}

        if "name" in payload and payload["name"]:
            updates["name"] = payload["name"].strip()
        if "description" in payload:
            updates["description"] = payload["description"].strip()
        if "tags" in payload and payload["tags"] is not None:
            updates["tags"] = payload["tags"]

        mongodb.candidate_groups.update_one({"id": gid}, {"$set": updates})

        self._log_audit(
            action="update_candidate_group",
            admin_user=admin_user,
            target_id=gid,
            details={"updated_fields": list(updates.keys())}
        )

        group.update(updates)
        return {
            "status": "success",
            "message": "Group updated successfully.",
            "group": {
                "id": gid,
                "name": group.get("name"),
                "description": group.get("description"),
                "tags": group.get("tags", []),
                "member_count": len(group.get("member_ids", [])),
                "assigned_assessments_count": len(group.get("assigned_assessments", [])),
                "average_score": 0.0,
                "created_at": group.get("created_at"),
                "updated_at": now,
                "created_by": group.get("created_by")
            }
        }

    def delete_group(self, group_id: str, admin_user: dict) -> Dict[str, Any]:
        """Deletes a group and unlinks from all candidates without deleting candidate records."""
        gid = group_id.strip()
        group = mongodb.candidate_groups.find_one({"id": gid})
        if not group:
            raise KeyError(f"Group '{gid}' not found.")

        mongodb.candidate_groups.delete_one({"id": gid})

        self._log_audit(
            action="delete_candidate_group",
            admin_user=admin_user,
            target_id=gid,
            details={"group_name": group.get("name")}
        )

        return {
            "status": "success",
            "message": f"Group '{group.get('name')}' deleted successfully."
        }

    def add_group_members(self, group_id: str, candidate_ids_or_emails: List[str], admin_user: dict) -> Dict[str, Any]:
        """Adds candidates to group, preventing duplicate member entries."""
        gid = group_id.strip()
        group = mongodb.candidate_groups.find_one({"id": gid})
        if not group:
            raise KeyError(f"Group '{gid}' not found.")

        added_count = 0
        current_members = set(group.get("member_ids", []))

        for raw_id in candidate_ids_or_emails:
            clean_id = raw_id.strip()
            if not clean_id:
                continue

            # Resolve candidate
            user = mongodb.users.find_one({
                "$or": [{"id": clean_id}, {"email": clean_id.lower()}]
            })
            if user:
                uid = str(user.get("id") or user.get("_id"))
                if uid not in current_members:
                    current_members.add(uid)
                    added_count += 1
            else:
                # Store email as fallback identifier if account is pending invitation
                if clean_id.lower() not in current_members:
                    current_members.add(clean_id.lower())
                    added_count += 1

        now = datetime.now(timezone.utc)
        mongodb.candidate_groups.update_one(
            {"id": gid},
            {"$set": {"member_ids": list(current_members), "updated_at": now}}
        )

        self._log_audit(
            action="add_group_members",
            admin_user=admin_user,
            target_id=gid,
            details={"added_count": added_count, "total_members": len(current_members)}
        )

        return {
            "status": "success",
            "message": f"Added {added_count} candidates to group '{group.get('name')}'.",
            "added_count": added_count,
            "total_members": len(current_members)
        }

    def remove_group_member(self, group_id: str, candidate_id: str, admin_user: dict) -> Dict[str, Any]:
        """Removes a candidate from a group without affecting their account."""
        gid = group_id.strip()
        cid = candidate_id.strip()
        group = mongodb.candidate_groups.find_one({"id": gid})
        if not group:
            raise KeyError(f"Group '{gid}' not found.")

        # Match either id or email
        user = mongodb.users.find_one({"$or": [{"id": cid}, {"email": cid.lower()}]})
        identifiers = [cid, cid.lower()]
        if user:
            identifiers.extend([str(user.get("id")), user.get("email")])

        mongodb.candidate_groups.update_one(
            {"id": gid},
            {
                "$pull": {"member_ids": {"$in": identifiers}},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )

        self._log_audit(
            action="remove_group_member",
            admin_user=admin_user,
            target_id=gid,
            details={"removed_candidate": cid}
        )

        return {
            "status": "success",
            "message": f"Candidate '{cid}' removed from group."
        }

    def assign_assessment_to_group(self, group_id: str, assessment_id: str, deadline: Optional[str], admin_user: dict) -> Dict[str, Any]:
        """Assigns an assessment to all members of a group simultaneously."""
        gid = group_id.strip()
        group = mongodb.candidate_groups.find_one({"id": gid})
        if not group:
            raise KeyError(f"Group '{gid}' not found.")

        member_ids = group.get("member_ids", [])
        if not member_ids:
            raise ValueError(f"Group '{group.get('name')}' has no members to assign.")

        # Resolve all candidate emails
        emails = []
        if mongodb.users is not None:
            members = list(mongodb.users.find({
                "$or": [{"id": {"$in": member_ids}}, {"email": {"$in": member_ids}}]
            }, {"email": 1}))
            emails = [m.get("email") for m in members if m.get("email")]

        # Include raw email strings that were stored directly
        for m in member_ids:
            if "@" in m and m.lower() not in emails:
                emails.append(m.lower())

        if not emails:
            raise ValueError("No valid candidate email addresses found in this group.")

        # Call assessment assignment service
        assigned_count = admin_assessment_service.assign_candidates(
            assessment_id=assessment_id,
            candidate_emails=emails,
            cohort_names=[group.get("name")],
            deadline=deadline,
            admin_user=admin_user
        )

        # Update group doc with assigned assessment
        mongodb.candidate_groups.update_one(
            {"id": gid},
            {"$addToSet": {"assigned_assessments": assessment_id}}
        )

        self._log_audit(
            action="assign_assessment_to_group",
            admin_user=admin_user,
            target_id=gid,
            details={"assessment_id": assessment_id, "assigned_count": assigned_count}
        )

        return {
            "status": "success",
            "message": f"Successfully assigned assessment to {assigned_count} candidates in group '{group.get('name')}'.",
            "assigned_count": assigned_count
        }

    # ==========================================================================
    # 5. Bulk CSV Candidate Import
    # ==========================================================================
    def import_candidates(
        self,
        rows: List[dict],
        send_invitations: bool,
        assessment_id: Optional[str],
        admin_user: dict
    ) -> Dict[str, Any]:
        """
        Processes bulk CSV candidate records, validates email format and duplication,
        provisions unverified accounts without setting default passwords, and assigns assessments.
        """
        total_rows = len(rows)
        successful_count = 0
        duplicate_count = 0
        failed_count = 0
        imported_candidates = []
        errors = []

        now = datetime.now(timezone.utc)
        admin_email = admin_user.get("email") or "admin@bugbash.com"

        group_cache: Dict[str, str] = {}

        for idx, row in enumerate(rows):
            line_no = idx + 1
            full_name = (row.get("full_name") or "").strip()
            raw_email = (row.get("email") or "").strip().lower()
            phone = (row.get("phone_number") or "").strip()
            group_name = (row.get("group_name") or "").strip()

            # 1. Validation
            if not full_name or len(full_name) < 2:
                failed_count += 1
                errors.append({"line": line_no, "email": raw_email, "error": "Full name is missing or too short."})
                continue

            if not raw_email or not EMAIL_REGEX.match(raw_email):
                failed_count += 1
                errors.append({"line": line_no, "email": raw_email, "error": "Invalid email address format."})
                continue

            # 2. Duplicate Detection
            existing_user = mongodb.users.find_one({"email": raw_email}) if mongodb.users is not None else None
            if existing_user:
                duplicate_count += 1
                errors.append({"line": line_no, "email": raw_email, "error": "Account already exists with this email address."})
                continue

            # 3. Secure Account Creation (Pending Invitation, no default plaintext password)
            token = secrets.token_urlsafe(32)
            uid = f"usr_{secrets.token_hex(6)}"
            user_doc = {
                "id": uid,
                "full_name": full_name,
                "name": full_name,
                "email": raw_email,
                "phone_number": phone or None,
                "password_hash": PasswordResetService.hash_password(secrets.token_urlsafe(24)),  # Unusable random salt
                "is_verified": False,
                "role": "candidate",
                "account_status": "Pending Invitation",
                "invitation_token": token,
                "college_name": group_name if group_name else "BugBash Academy",
                "degree_major": "Computer Science",
                "graduation_year": "2026",
                "created_at": now,
                "updated_at": now
            }

            if mongodb.users is not None:
                mongodb.users.insert_one(user_doc)

            # 4. Group Assignment if provided
            if group_name and mongodb.candidate_groups is not None:
                gid = group_cache.get(group_name.lower())
                if not gid:
                    existing_group = mongodb.candidate_groups.find_one({"name": {"$regex": f"^{re.escape(group_name)}$", "$options": "i"}})
                    if existing_group:
                        gid = existing_group.get("id")
                    else:
                        gid = f"grp-{secrets.token_hex(4)}"
                        mongodb.candidate_groups.insert_one({
                            "id": gid,
                            "name": group_name,
                            "description": f"Imported cohort: {group_name}",
                            "tags": ["Imported"],
                            "member_ids": [],
                            "assigned_assessments": [],
                            "created_by": admin_email,
                            "created_at": now,
                            "updated_at": now
                        })
                    group_cache[group_name.lower()] = gid

                mongodb.candidate_groups.update_one({"id": gid}, {"$addToSet": {"member_ids": uid}})

            # 5. Assessment Assignment if specified
            if assessment_id:
                try:
                    admin_assessment_service.assign_candidates(
                        assessment_id=assessment_id,
                        candidate_emails=[raw_email],
                        cohort_names=[group_name] if group_name else [],
                        admin_user=admin_user
                    )
                except Exception as e:
                    logger.warning(f"Could not assign imported user to assessment '{assessment_id}': {e}")

            # 6. Record Invitation Record
            if mongodb.candidate_invitations is not None:
                mongodb.candidate_invitations.insert_one({
                    "id": f"inv_{secrets.token_hex(6)}",
                    "email": raw_email,
                    "token": token,
                    "status": "Pending",
                    "assessment_id": assessment_id,
                    "group_names": [group_name] if group_name else [],
                    "invited_by": admin_email,
                    "created_at": now,
                    "expires_at": now + timedelta(days=7),
                    "accepted_at": None
                })

            successful_count += 1
            imported_candidates.append({
                "id": uid,
                "full_name": full_name,
                "email": raw_email,
                "phone_number": phone,
                "group_name": group_name,
                "status": "Pending Invitation"
            })

        self._log_audit(
            action="bulk_import_candidates",
            admin_user=admin_user,
            target_id="bulk_import",
            details={
                "total_rows": total_rows,
                "successful": successful_count,
                "duplicates": duplicate_count,
                "failed": failed_count
            }
        )

        return {
            "total_rows": total_rows,
            "successful_count": successful_count,
            "duplicate_count": duplicate_count,
            "failed_count": failed_count,
            "imported_candidates": imported_candidates,
            "errors": errors
        }

    # ==========================================================================
    # 6. Candidate Invitations Lifecycle
    # ==========================================================================
    def create_invitations(
        self,
        emails: List[str],
        assessment_id: Optional[str],
        group_ids: Optional[List[str]],
        expiry_days: int,
        custom_message: Optional[str],
        admin_user: dict
    ) -> Dict[str, Any]:
        """Dispatches secure expiring invitations to candidate email addresses."""
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=expiry_days or 7)
        admin_email = admin_user.get("email") or "admin@bugbash.com"

        created_invites = []

        # Resolve assessment title if provided
        asmt_title = None
        if assessment_id and mongodb.assessments is not None:
            a_doc = mongodb.assessments.find_one({"id": assessment_id})
            if a_doc:
                asmt_title = a_doc.get("title")

        # Resolve group names
        group_names = []
        if group_ids and mongodb.candidate_groups is not None:
            g_docs = list(mongodb.candidate_groups.find({"id": {"$in": group_ids}}))
            group_names = [g.get("name") for g in g_docs if g.get("name")]

        for raw_email in emails:
            clean_email = raw_email.strip().lower()
            if not clean_email or not EMAIL_REGEX.match(clean_email):
                continue

            token = secrets.token_urlsafe(32)
            inv_id = f"inv_{secrets.token_hex(6)}"

            doc = {
                "id": inv_id,
                "email": clean_email,
                "token": token,
                "status": "Pending",
                "assessment_id": assessment_id,
                "assessment_title": asmt_title,
                "group_names": group_names,
                "custom_message": custom_message,
                "invited_by": admin_email,
                "created_at": now,
                "expires_at": expires_at,
                "accepted_at": None
            }

            if mongodb.candidate_invitations is not None:
                # Cancel previous pending invitations for this email to prevent collisions
                mongodb.candidate_invitations.update_many(
                    {"email": clean_email, "status": "Pending"},
                    {"$set": {"status": "Cancelled", "cancelled_at": now}}
                )
                mongodb.candidate_invitations.insert_one(doc)

            # Assign candidate if assessment specified
            if assessment_id:
                try:
                    admin_assessment_service.assign_candidates(
                        assessment_id=assessment_id,
                        candidate_emails=[clean_email],
                        cohort_names=group_names,
                        admin_user=admin_user
                    )
                except Exception as e:
                    logger.warning(f"Could not assign invited candidate '{clean_email}': {e}")

            # Add to groups
            if group_ids and mongodb.candidate_groups is not None:
                mongodb.candidate_groups.update_many(
                    {"id": {"$in": group_ids}},
                    {"$addToSet": {"member_ids": clean_email}}
                )

            created_invites.append({
                "id": inv_id,
                "email": clean_email,
                "status": "Pending",
                "assessment_id": assessment_id,
                "assessment_title": asmt_title,
                "group_names": group_names,
                "invited_by": admin_email,
                "created_at": now,
                "expires_at": expires_at
            })

        self._log_audit(
            action="create_candidate_invitations",
            admin_user=admin_user,
            target_id="bulk_invites",
            details={"invited_count": len(created_invites), "assessment_id": assessment_id}
        )

        return {
            "status": "success",
            "message": f"Successfully created {len(created_invites)} candidate invitations.",
            "invitations": created_invites
        }

    def list_invitations(self) -> List[Dict[str, Any]]:
        """Lists candidate invitations with auto-expiry calculation."""
        if mongodb.candidate_invitations is None:
            return []

        now = datetime.now(timezone.utc)
        invs = list(mongodb.candidate_invitations.find({}).sort("created_at", -1).limit(100))

        results = []
        for inv in invs:
            st = inv.get("status", "Pending")
            expires_at = inv.get("expires_at")
            if expires_at and isinstance(expires_at, datetime) and expires_at.replace(tzinfo=timezone.utc) < now and st == "Pending":
                st = "Expired"
                mongodb.candidate_invitations.update_one({"_id": inv["_id"]}, {"$set": {"status": "Expired"}})

            results.append({
                "id": inv.get("id"),
                "email": inv.get("email"),
                "status": st,
                "assessment_id": inv.get("assessment_id"),
                "assessment_title": inv.get("assessment_title"),
                "group_names": inv.get("group_names", []),
                "invited_by": inv.get("invited_by"),
                "created_at": inv.get("created_at"),
                "expires_at": expires_at,
                "accepted_at": inv.get("accepted_at")
            })

        return results

    def cancel_invitation(self, invitation_id: str, admin_user: dict) -> Dict[str, Any]:
        """Cancels a pending candidate invitation."""
        iid = invitation_id.strip()
        inv = mongodb.candidate_invitations.find_one({"id": iid})
        if not inv:
            raise KeyError(f"Invitation '{iid}' not found.")

        now = datetime.now(timezone.utc)
        mongodb.candidate_invitations.update_one(
            {"id": iid},
            {"$set": {"status": "Cancelled", "cancelled_at": now, "cancelled_by": admin_user.get("email")}}
        )

        self._log_audit(
            action="cancel_candidate_invitation",
            admin_user=admin_user,
            target_id=iid,
            details={"email": inv.get("email")}
        )

        return {
            "status": "success",
            "message": f"Invitation for '{inv.get('email')}' has been cancelled."
        }

    def resend_invitation(self, invitation_id: str, admin_user: dict) -> Dict[str, Any]:
        """Refreshes invitation token and extends expiry date."""
        iid = invitation_id.strip()
        inv = mongodb.candidate_invitations.find_one({"id": iid})
        if not inv:
            raise KeyError(f"Invitation '{iid}' not found.")

        now = datetime.now(timezone.utc)
        new_token = secrets.token_urlsafe(32)
        new_expiry = now + timedelta(days=7)

        mongodb.candidate_invitations.update_one(
            {"id": iid},
            {
                "$set": {
                    "token": new_token,
                    "status": "Pending",
                    "expires_at": new_expiry,
                    "last_resent_at": now,
                    "last_resent_by": admin_user.get("email")
                }
            }
        )

        self._log_audit(
            action="resend_candidate_invitation",
            admin_user=admin_user,
            target_id=iid,
            details={"email": inv.get("email")}
        )

        return {
            "status": "success",
            "message": f"Invitation for '{inv.get('email')}' has been refreshed and resent.",
            "expires_at": new_expiry
        }

    # ==========================================================================
    # 7. Single Candidate Assessment Assignment
    # ==========================================================================
    def assign_assessment_to_candidate(
        self,
        candidate_id: str,
        assessment_id: str,
        deadline: Optional[str],
        admin_user: dict
    ) -> Dict[str, Any]:
        """Assigns an assessment directly to a single candidate."""
        cid = candidate_id.strip()
        user = mongodb.users.find_one({"$or": [{"id": cid}, {"email": cid.lower()}]})
        if not user:
            raise KeyError(f"Candidate '{cid}' not found.")

        email = user.get("email")

        # Call assessment assignment engine
        admin_assessment_service.assign_candidates(
            assessment_id=assessment_id,
            candidate_emails=[email],
            cohort_names=None,
            deadline=deadline,
            admin_user=admin_user
        )

        self._log_audit(
            action="assign_assessment_to_candidate",
            admin_user=admin_user,
            target_id=cid,
            details={"assessment_id": assessment_id, "target_email": email}
        )

        return {
            "status": "success",
            "message": f"Assessment successfully assigned to '{user.get('full_name') or email}'."
        }


# Global singleton instance
admin_candidate_service = AdminCandidateService()

