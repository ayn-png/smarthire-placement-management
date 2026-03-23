"""
Job service — backed by Firestore.
Jobs use auto-generated Firestore document IDs.
All Firestore SDK calls wrapped in asyncio.to_thread().
"""
import asyncio
from datetime import datetime

from app.schemas.job import JobCreate, JobUpdate, JobResponse
from app.core.exceptions import NotFoundException, BadRequestException
from app.core.enums import JobStatus
from app.db.helpers import utcnow


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


class JobService:
    def __init__(self, db):
        self.db = db

    async def create_job(self, data: JobCreate) -> JobResponse:
        # Verify company exists
        if not data.company_id:
            raise BadRequestException("Invalid company ID")
        company_doc = await asyncio.to_thread(
            self.db.collection("companies").document(data.company_id).get
        )
        if not company_doc.exists:
            raise NotFoundException("Company")

        now = utcnow()
        doc = {
            **data.model_dump(),
            "status": JobStatus.OPEN.value,
            "created_at": now,
            "updated_at": now,
        }
        _, doc_ref = await asyncio.to_thread(
            self.db.collection("jobs").add, doc
        )
        doc["id"] = doc_ref.id
        for k, v in doc.items():
            if isinstance(v, datetime):
                doc[k] = v.isoformat()

        return await self._enrich_job(doc)

    async def get_job(self, job_id: str) -> JobResponse:
        if not job_id:
            raise NotFoundException("Job")
        doc = await asyncio.to_thread(
            self.db.collection("jobs").document(job_id).get
        )
        if not doc.exists:
            raise NotFoundException("Job")
        return await self._enrich_job(_doc_to_dict(doc))

    async def update_job(self, job_id: str, data: JobUpdate) -> JobResponse:
        if not job_id:
            raise NotFoundException("Job")

        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        if "status" in update_data and hasattr(update_data["status"], "value"):
            update_data["status"] = update_data["status"].value
        update_data["updated_at"] = utcnow()

        job_ref = self.db.collection("jobs").document(job_id)
        job_doc = await asyncio.to_thread(job_ref.get)
        if not job_doc.exists:
            raise NotFoundException("Job")

        await asyncio.to_thread(job_ref.update, update_data)
        updated = await asyncio.to_thread(job_ref.get)
        return await self._enrich_job(_doc_to_dict(updated))

    async def delete_job(self, job_id: str) -> None:
        if not job_id:
            raise NotFoundException("Job")
        job_ref = self.db.collection("jobs").document(job_id)
        job_doc = await asyncio.to_thread(job_ref.get)
        if not job_doc.exists:
            raise NotFoundException("Job")
        # Block deletion if any applications exist for this job
        apps = await asyncio.to_thread(
            self.db.collection("applications").where("job_id", "==", job_id).limit(1).get
        )
        if list(apps):
            raise BadRequestException(
                "Cannot delete a job that has existing applications. "
                "Change the job status to CLOSED instead."
            )
        await asyncio.to_thread(job_ref.delete)

    async def list_jobs(
        self,
        status: str = None,
        branch: str = None,
        min_cgpa: float = None,
        skills: list = None,
        job_type: str = None,
        page: int = 1,
        limit: int = 20,
    ) -> dict:
        # Start with status filter (most restrictive)
        target_status = status if status else JobStatus.OPEN.value
        docs = await asyncio.to_thread(
            self.db.collection("jobs").where("status", "==", target_status).get
        )

        all_jobs = [_doc_to_dict(d) for d in docs if d.exists]

        # Python-side filters
        if job_type:
            all_jobs = [j for j in all_jobs if j.get("job_type") == job_type]
        if min_cgpa is not None:
            # Jobs with min_cgpa <= student's CGPA are eligible
            all_jobs = [j for j in all_jobs if (j.get("min_cgpa") or 0) <= min_cgpa]
        if branch:
            # Jobs that allow this branch (empty allowed_branches means open to all)
            all_jobs = [
                j for j in all_jobs
                if not j.get("allowed_branches") or branch in j.get("allowed_branches", [])
            ]
        if skills:
            all_jobs = [
                j for j in all_jobs
                if any(s in (j.get("required_skills") or []) for s in skills)
            ]

        # Sort by created_at descending
        all_jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        total = len(all_jobs)
        skip = (page - 1) * limit
        paginated = all_jobs[skip: skip + limit]

        # Enrich with company info in parallel (gather)
        enriched = await asyncio.gather(*[self._enrich_job(j) for j in paginated])
        return {"jobs": list(enriched), "total": total, "page": page, "limit": limit}

    async def _enrich_job(self, doc: dict) -> JobResponse:
        """Fetch company info and attach company_name and company_logo."""
        company_id = doc.get("company_id")
        if company_id:
            company_doc = await asyncio.to_thread(
                self.db.collection("companies").document(company_id).get
            )
            if company_doc.exists:
                company_data = company_doc.to_dict() or {}
                doc["company_name"] = company_data.get("name")
                doc["company_logo"] = company_data.get("logo_url")
            else:
                doc["company_name"] = None
                doc["company_logo"] = None
        else:
            doc["company_name"] = None
            doc["company_logo"] = None

        return JobResponse(**doc)
