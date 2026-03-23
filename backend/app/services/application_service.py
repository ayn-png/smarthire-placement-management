"""
Application service — backed by Firestore.
Applications use auto-generated Firestore document IDs.
All Firestore SDK calls wrapped in asyncio.to_thread().
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Callable

from app.schemas.application import (
    ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse,
    BulkStatusUpdate, BulkStatusUpdateResponse,
)
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException, ForbiddenException
from app.core.enums import ApplicationStatus, JobStatus
from app.db.helpers import utcnow
from app.utils.file_upload import resume_exists

logger = logging.getLogger(__name__)


def _doc_to_dict(doc_snapshot) -> dict | None:
    """Convert a Firestore DocumentSnapshot to a serializable dict."""
    if not doc_snapshot.exists:
        return None
    data = doc_snapshot.to_dict() or {}
    result = {"id": doc_snapshot.id}
    for k, v in data.items():
        if isinstance(v, datetime):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result


class ApplicationService:
    def __init__(self, db):
        self.db = db

    async def apply(self, user: dict, data: ApplicationCreate) -> ApplicationResponse:
        user_id = user["id"]

        # Check student profile exists
        profile_doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).get
        )
        if not profile_doc.exists:
            raise BadRequestException("Please complete your profile before applying")
        profile = profile_doc.to_dict()

        # Validate resume
        resume_url = profile.get("resume_url")
        if not resume_url:
            raise BadRequestException("Please upload your resume before applying")
        if not resume_exists(resume_url):
            raise BadRequestException(
                "Your resume file could not be found on the server. "
                "Please re-upload your resume before applying."
            )

        # Check job exists and is open
        if not data.job_id:
            raise BadRequestException("Invalid job ID")
        job_doc = await asyncio.to_thread(
            self.db.collection("jobs").document(data.job_id).get
        )
        if not job_doc.exists:
            raise NotFoundException("Job")
        job = job_doc.to_dict()

        if job["status"] != JobStatus.OPEN.value:
            raise BadRequestException("This job is no longer accepting applications")

        # Deadline enforcement
        deadline_raw = job.get("application_deadline")
        if deadline_raw:
            try:
                deadline_str = deadline_raw.rstrip("Z").split("+")[0]
                deadline_dt = datetime.fromisoformat(deadline_str).replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) > deadline_dt:
                    raise BadRequestException(
                        f"The application deadline for this job was {deadline_raw}. "
                        "Applications are no longer accepted."
                    )
            except BadRequestException:
                raise
            except Exception as e:
                logger.error(
                    f"Malformed deadline format for job {data.job_id}: '{deadline_raw}'. "
                    f"Error: {str(e)}. Blocking application as a safety measure."
                )
                raise BadRequestException(
                    "This job has an invalid deadline configuration. "
                    "Please contact the administrator."
                )

        # Check eligibility
        if (profile.get("cgpa") or 0) < (job.get("min_cgpa") or 0):
            raise BadRequestException(f"Minimum CGPA {job['min_cgpa']} required for this job")

        allowed_branches = job.get("allowed_branches", [])
        if allowed_branches and profile.get("branch") not in allowed_branches:
            raise BadRequestException("Your branch is not eligible for this job")

        # Check duplicate application
        existing = await asyncio.to_thread(
            self.db.collection("applications")
            .where("student_id", "==", user_id)
            .where("job_id", "==", data.job_id)
            .limit(1)
            .get
        )
        if list(existing):
            raise ConflictException("You have already applied for this job")

        now = utcnow()
        app_doc = {
            "job_id": data.job_id,
            "student_id": user_id,
            "cover_letter": data.cover_letter,
            "status": ApplicationStatus.PENDING.value,
            "remarks": None,
            "interview_date": None,
            "interview_link": None,
            "resume_url": resume_url,
            "applied_at": now,
            "updated_at": now,
        }
        _, doc_ref = await asyncio.to_thread(
            self.db.collection("applications").add, app_doc
        )
        app_doc["id"] = doc_ref.id
        for k, v in app_doc.items():
            if isinstance(v, datetime):
                app_doc[k] = v.isoformat()

        return await self._enrich_application(app_doc)

    async def get_application(self, application_id: str, user: dict = None) -> ApplicationResponse:
        if not application_id:
            raise NotFoundException("Application")
        doc = await asyncio.to_thread(
            self.db.collection("applications").document(application_id).get
        )
        if not doc.exists:
            raise NotFoundException("Application")

        app_data = _doc_to_dict(doc)

        if user and user.get("role") == "STUDENT":
            if app_data["student_id"] != user["id"]:
                raise ForbiddenException()

        return await self._enrich_application(app_data)

    async def get_my_applications(self, user: dict, status: str = None) -> dict:
        user_id = user["id"]
        query = self.db.collection("applications").where("student_id", "==", user_id)
        docs = await asyncio.to_thread(query.get)

        apps = []
        for doc in docs:
            a = _doc_to_dict(doc)
            if status and a.get("status") != status:
                continue
            apps.append(a)

        apps.sort(key=lambda x: x.get("applied_at", ""), reverse=True)
        enriched = await self._enrich_applications_batch(apps)
        return {"applications": enriched, "total": len(enriched)}

    async def update_status(
        self,
        application_id: str,
        data: ApplicationStatusUpdate,
        add_bg_task: Callable | None = None,
    ) -> ApplicationResponse:
        if not application_id:
            raise NotFoundException("Application")

        update_data = {
            "status": data.status.value,
            "updated_at": utcnow(),
        }
        if data.remarks:
            update_data["remarks"] = data.remarks
        if data.interview_date:
            update_data["interview_date"] = data.interview_date
        if data.interview_link:
            update_data["interview_link"] = data.interview_link
        if data.interview_type:
            update_data["interview_type"] = data.interview_type
        if data.interview_location:
            update_data["interview_location"] = data.interview_location

        app_ref = self.db.collection("applications").document(application_id)
        app_doc = await asyncio.to_thread(app_ref.get)
        if not app_doc.exists:
            raise NotFoundException("Application")

        await asyncio.to_thread(app_ref.update, update_data)
        updated = await asyncio.to_thread(app_ref.get)
        enriched = await self._enrich_application(_doc_to_dict(updated))

        if add_bg_task and enriched.student_email:
            self._schedule_status_email(add_bg_task, enriched, data)
        if add_bg_task:
            add_bg_task(self._create_in_app_notification_sync, enriched)

        return enriched

    def _schedule_status_email(self, add_bg_task: Callable, app: ApplicationResponse, data: ApplicationStatusUpdate) -> None:
        from app.services.email_service import (
            send_status_change_email,
            send_interview_scheduled_email,
            send_selection_email,
            send_rejection_email,
        )
        new_status = data.status.value
        kwargs = dict(
            to=app.student_email,
            student_name=app.student_name or "Student",
            job_title=app.job_title or "the position",
            company_name=app.company_name or "the company",
        )
        if new_status == ApplicationStatus.INTERVIEW_SCHEDULED.value and app.interview_date:
            add_bg_task(
                send_interview_scheduled_email,
                **kwargs,
                interview_date=app.interview_date,
                interview_link=app.interview_link,
                interview_type=getattr(app, "interview_type", None),
                interview_location=getattr(app, "interview_location", None),
            )
        elif new_status == ApplicationStatus.SELECTED.value:
            add_bg_task(send_selection_email, **kwargs)
        elif new_status == ApplicationStatus.REJECTED.value:
            add_bg_task(send_rejection_email, **kwargs, remarks=data.remarks)
        else:
            add_bg_task(send_status_change_email, **kwargs, new_status=new_status, remarks=data.remarks)

    async def withdraw_application(self, application_id: str, user: dict) -> ApplicationResponse:
        if not application_id:
            raise NotFoundException("Application")
        user_id = user["id"]

        app_ref = self.db.collection("applications").document(application_id)
        app_doc = await asyncio.to_thread(app_ref.get)
        if not app_doc.exists:
            raise NotFoundException("Application")

        app_data = app_doc.to_dict()
        if app_data.get("student_id") != user_id:
            raise NotFoundException("Application")

        if app_data.get("status") in [ApplicationStatus.SELECTED.value, ApplicationStatus.REJECTED.value]:
            raise BadRequestException("Cannot withdraw a finalized application")

        await asyncio.to_thread(
            app_ref.update,
            {"status": ApplicationStatus.WITHDRAWN.value, "updated_at": utcnow()},
        )
        updated = await asyncio.to_thread(app_ref.get)
        return await self._enrich_application(_doc_to_dict(updated))

    async def list_applications(
        self,
        job_id: str = None,
        status: str = None,
        branch: str = None,
        min_cgpa: float = None,
        from_date: str = None,
        to_date: str = None,
        page: int = 1,
        limit: int = 20,
    ) -> dict:
        # Fetch from Firestore with basic filters
        query = self.db.collection("applications")
        if job_id:
            query = query.where("job_id", "==", job_id)
        if status:
            query = query.where("status", "==", status)

        docs = await asyncio.to_thread(query.get)
        all_apps = [_doc_to_dict(d) for d in docs if d.exists]

        # Python-side date range filter
        if from_date or to_date:
            try:
                from_dt = datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc) if from_date else None
                to_dt = datetime.fromisoformat(to_date).replace(
                    tzinfo=timezone.utc, hour=23, minute=59, second=59
                ) if to_date else None
            except ValueError:
                from_dt = to_dt = None

            if from_dt or to_dt:
                filtered = []
                for a in all_apps:
                    applied_at_str = a.get("applied_at")
                    if applied_at_str:
                        try:
                            applied_dt = datetime.fromisoformat(applied_at_str)
                            if applied_dt.tzinfo is None:
                                applied_dt = applied_dt.replace(tzinfo=timezone.utc)
                            if from_dt and applied_dt < from_dt:
                                continue
                            if to_dt and applied_dt > to_dt:
                                continue
                        except ValueError:
                            pass
                    filtered.append(a)
                all_apps = filtered

        # Profile-level filters (branch, CGPA) — fetch profiles for remaining apps
        if branch or min_cgpa is not None:
            filtered = []
            # Gather unique student_ids
            student_ids = list({a["student_id"] for a in all_apps if a.get("student_id")})
            # Fetch profiles in batches of 30
            profiles_map = {}
            for i in range(0, len(student_ids), 30):
                batch_ids = student_ids[i: i + 30]
                profile_docs = await asyncio.to_thread(
                    self.db.collection("student_profiles")
                    .where("user_id", "in", batch_ids)
                    .get
                )
                for pdoc in profile_docs:
                    pdata = pdoc.to_dict() or {}
                    profiles_map[pdata.get("user_id", pdoc.id)] = pdata

            for a in all_apps:
                p = profiles_map.get(a.get("student_id"), {})
                if branch and p.get("branch") != branch:
                    continue
                if min_cgpa is not None and (p.get("cgpa") or 0) < min_cgpa:
                    continue
                filtered.append(a)
            all_apps = filtered

        # Sort by applied_at descending
        all_apps.sort(key=lambda x: x.get("applied_at", ""), reverse=True)

        total = len(all_apps)
        skip = (page - 1) * limit
        paginated = all_apps[skip: skip + limit]

        enriched = await self._enrich_applications_batch(paginated)
        return {"applications": enriched, "total": total, "page": page, "limit": limit}

    async def bulk_update_status(
        self,
        data: BulkStatusUpdate,
        add_bg_task: Callable | None = None,
    ) -> BulkStatusUpdateResponse:
        failed: list[str] = []
        valid_refs: list = []  # (app_ref, app_doc) pairs for existing docs

        # Phase 1: fetch all docs, separate existing from missing
        for app_id in data.application_ids:
            if not app_id:
                failed.append(app_id)
                continue
            app_ref = self.db.collection("applications").document(app_id)
            try:
                app_doc = await asyncio.to_thread(app_ref.get)
                if not app_doc.exists:
                    failed.append(app_id)
                else:
                    valid_refs.append((app_ref, app_doc))
            except Exception:
                failed.append(app_id)

        if not valid_refs:
            return BulkStatusUpdateResponse(
                updated_count=0,
                failed_ids=failed,
                message=f"Updated 0 of {len(data.application_ids)} applications.",
            )

        # Phase 2: batch-write all status updates (atomically, in groups of 500)
        update_payload = {
            "status": data.status.value,
            "updated_at": utcnow(),
        }
        if data.remarks:
            update_payload["remarks"] = data.remarks

        _BATCH_LIMIT = 500
        batch_failed: list[str] = []
        for i in range(0, len(valid_refs), _BATCH_LIMIT):
            chunk = valid_refs[i: i + _BATCH_LIMIT]
            batch = self.db.batch()
            for ref, _ in chunk:
                batch.update(ref, update_payload)
            try:
                await asyncio.to_thread(batch.commit)
            except Exception:
                # If a batch fails, mark all IDs in it as failed
                for ref, _ in chunk:
                    batch_failed.append(ref.id)
                    valid_refs_ids = {r.id for r, _ in valid_refs}
                # Remove failed batch refs from valid_refs so we don't notify them
                valid_refs = [(r, d) for r, d in valid_refs if r.id not in set(batch_failed)]

        failed.extend(batch_failed)
        updated = len(valid_refs)

        # Phase 3: fire background notifications for successfully updated docs
        if add_bg_task and valid_refs:
            status_update = ApplicationStatusUpdate(
                status=data.status,
                remarks=data.remarks,
            )
            for ref, _ in valid_refs:
                try:
                    updated_doc = await asyncio.to_thread(ref.get)
                    enriched = await self._enrich_application(_doc_to_dict(updated_doc))
                    if enriched.student_email:
                        self._schedule_status_email(add_bg_task, enriched, status_update)
                    add_bg_task(self._create_in_app_notification_sync, enriched)
                except Exception:
                    pass

        return BulkStatusUpdateResponse(
            updated_count=updated,
            failed_ids=failed,
            message=f"Updated {updated} of {len(data.application_ids)} applications.",
        )

    async def _create_in_app_notification_sync(self, enriched: "ApplicationResponse") -> None:
        try:
            from app.services.notification_service import NotificationService
            status_val = enriched.status
            job_label = enriched.job_title or "a position"
            company_label = enriched.company_name or "a company"

            STATUS_TITLES = {
                "PENDING": "Application Received",
                "UNDER_REVIEW": "Application Under Review",
                "SHORTLISTED": "You've Been Shortlisted! 🎉",
                "INTERVIEW_SCHEDULED": "Interview Scheduled 📅",
                "SELECTED": "Congratulations — You're Selected! 🏆",
                "REJECTED": "Application Update",
                "WITHDRAWN": "Application Withdrawn",
            }
            title = STATUS_TITLES.get(status_val, "Application Status Update")
            message = f"Your application for {job_label} at {company_label} has been updated to: {status_val.replace('_', ' ').title()}."

            ns = NotificationService(self.db)
            await ns.create(
                user_id=enriched.student_id,
                title=title,
                message=message,
                link="/student/applications",
            )
        except Exception:
            pass

    async def _enrich_applications_batch(self, apps: list[dict]) -> list[ApplicationResponse]:
        """Batch-fetch all related docs for a list of applications (eliminates N+1).

        Instead of making up to 3 sequential Firestore reads per application row,
        this method collects all unique IDs, fires one parallel read per collection,
        then assembles results from in-memory lookup dicts.
        """
        if not apps:
            return []

        job_ids = list({a["job_id"] for a in apps if a.get("job_id")})
        company_ids: list[str] = []  # populated after job lookup
        student_ids = list({a["student_id"] for a in apps if a.get("student_id")})

        async def _fetch_by_ids(col: str, ids: list) -> dict:
            """Fetch a set of documents by ID in parallel, return {id: data} map."""
            result: dict = {}
            if not ids:
                return result
            tasks = [
                asyncio.to_thread(self.db.collection(col).document(id_).get)
                for id_ in ids
            ]
            docs = await asyncio.gather(*tasks)
            for d in docs:
                if d.exists:
                    result[d.id] = d.to_dict() or {}
            return result

        # Fetch jobs and student profiles in parallel first
        jobs_map, profiles_map = await asyncio.gather(
            _fetch_by_ids("jobs", job_ids),
            _fetch_by_ids("student_profiles", student_ids),
        )

        # Derive unique company_ids from the fetched job docs
        company_ids = list({
            job.get("company_id", "")
            for job in jobs_map.values()
            if job.get("company_id")
        })
        companies_map = await _fetch_by_ids("companies", company_ids)

        enriched = []
        for app in apps:
            a = dict(app)
            job = jobs_map.get(a.get("job_id", ""), {})
            company_id = a.get("company_id") or job.get("company_id", "")
            company = companies_map.get(company_id, {})
            student = profiles_map.get(a.get("student_id", ""), {})

            a["job_title"] = job.get("title", a.get("job_title"))
            a["company_name"] = company.get("name", a.get("company_name"))
            a["student_name"] = student.get("full_name", a.get("student_name"))
            a["student_email"] = student.get("email", a.get("student_email"))
            a["student_cgpa"] = student.get("cgpa", a.get("student_cgpa"))
            a["student_branch"] = student.get("branch", a.get("student_branch"))
            enriched.append(ApplicationResponse(**a))
        return enriched

    async def _enrich_application(self, doc: dict) -> ApplicationResponse:
        # Enrich with job info
        job_id = doc.get("job_id")
        if job_id:
            job_doc = await asyncio.to_thread(
                self.db.collection("jobs").document(job_id).get
            )
            if job_doc.exists:
                job = job_doc.to_dict()
                doc["job_title"] = job.get("title")
                company_id = job.get("company_id")
                if company_id:
                    company_doc = await asyncio.to_thread(
                        self.db.collection("companies").document(company_id).get
                    )
                    doc["company_name"] = company_doc.to_dict().get("name") if company_doc.exists else None
                else:
                    doc["company_name"] = None
            else:
                doc["job_title"] = None
                doc["company_name"] = None

        # Enrich with student info
        student_id = doc.get("student_id")
        if student_id:
            profile_doc = await asyncio.to_thread(
                self.db.collection("student_profiles").document(student_id).get
            )
            if profile_doc.exists:
                profile = profile_doc.to_dict()
                doc["student_name"] = profile.get("full_name")
                doc["student_email"] = profile.get("email")
                doc["student_cgpa"] = profile.get("cgpa")
                doc["student_branch"] = profile.get("branch")
            else:
                doc["student_name"] = None
                doc["student_email"] = None
                doc["student_cgpa"] = None
                doc["student_branch"] = None

        return ApplicationResponse(**doc)
