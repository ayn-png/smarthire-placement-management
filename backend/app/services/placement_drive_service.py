"""
Placement Drive service — backed by Firestore.
All Firestore SDK calls are synchronous and wrapped in asyncio.to_thread().
"""
import asyncio
from datetime import datetime

from app.schemas.placement_drive import PlacementDriveCreate, PlacementDriveUpdate, PlacementDriveResponse
from app.core.exceptions import NotFoundException
from app.db.helpers import utcnow


def _doc_to_dict(doc_snapshot) -> dict | None:
    if not doc_snapshot.exists:
        return None
    data = doc_snapshot.to_dict() or {}
    result = {"id": doc_snapshot.id}
    for k, v in data.items():
        result[k] = v.isoformat() if isinstance(v, datetime) else v
    return result


class PlacementDriveService:
    def __init__(self, db):
        self.db = db
        self._col = db.collection("placement_drives")

    async def create_drive(self, data: PlacementDriveCreate) -> PlacementDriveResponse:
        now = utcnow()
        doc = {
            **data.model_dump(),
            "created_at": now,
            "updated_at": now,
        }

        def _create():
            ref = self._col.document()
            ref.set(doc)
            return ref.id

        drive_id = await asyncio.to_thread(_create)
        doc["id"] = drive_id
        doc["created_at"] = doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"]
        doc["updated_at"] = doc["updated_at"].isoformat() if isinstance(doc["updated_at"], datetime) else doc["updated_at"]

        # Auto-create associated job in jobs collection
        job_doc = {
            "title": data.title,
            "company_id": data.company_id or "",
            "description": data.description or data.title,
            "requirements": (
                f"Min CGPA: {data.min_cgpa}. "
                f"Branches: {', '.join(data.eligible_branches) if data.eligible_branches else 'All'}"
            ),
            "required_skills": [],
            "job_type": "INTERNSHIP" if data.drive_type == "INTERNSHIP" else "FULL_TIME",
            "location": data.venue_type or "OFFLINE",
            "salary_min": None,
            "salary_max": None,
            "min_cgpa": data.min_cgpa,
            "allowed_branches": data.eligible_branches or [],
            "openings": data.openings,
            "application_deadline": data.drive_date,
            "status": "OPEN",
            "drive_id": drive_id,  # backlink to drive
            "created_at": now,
            "updated_at": now,
        }
        _, job_ref = await asyncio.to_thread(self.db.collection("jobs").add, job_doc)
        job_id = job_ref.id

        # Update the drive document with the job_id
        await asyncio.to_thread(
            self._col.document(drive_id).update,
            {"job_id": job_id, "job_ids": [job_id]}
        )
        doc["job_id"] = job_id
        doc["job_ids"] = [job_id]

        # Enrich with company name
        if data.company_id:
            doc["company_name"] = await self._get_company_name(data.company_id)

        return PlacementDriveResponse(**doc)

    async def get_drive(self, drive_id: str) -> PlacementDriveResponse:
        doc = await asyncio.to_thread(self._col.document(drive_id).get)
        if not doc.exists:
            raise NotFoundException("Placement Drive")
        d = _doc_to_dict(doc)
        if d.get("company_id"):
            d["company_name"] = await self._get_company_name(d["company_id"])
        return PlacementDriveResponse(**d)

    async def list_drives(
        self,
        status: str = None,
        company_id: str = None,
        page: int = 1,
        limit: int = 20,
    ) -> dict:
        docs = await asyncio.to_thread(self._col.get)
        drives = [_doc_to_dict(d) for d in docs if d.exists]

        if status:
            drives = [d for d in drives if d.get("status") == status]
        if company_id:
            drives = [d for d in drives if d.get("company_id") == company_id]

        drives.sort(key=lambda x: x.get("drive_date", ""), reverse=False)

        total = len(drives)
        skip = (page - 1) * limit
        paginated = drives[skip: skip + limit]

        # Enrich company names in batch
        company_ids = list({d["company_id"] for d in paginated if d.get("company_id")})
        company_names: dict[str, str] = {}
        for cid in company_ids:
            company_names[cid] = await self._get_company_name(cid)
        for d in paginated:
            d["company_name"] = company_names.get(d.get("company_id", ""), None)

        return {
            "drives": [PlacementDriveResponse(**d) for d in paginated],
            "total": total,
            "page": page,
            "limit": limit,
        }

    async def update_drive(self, drive_id: str, data: PlacementDriveUpdate) -> PlacementDriveResponse:
        update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        if not update_data:
            return await self.get_drive(drive_id)

        update_data["updated_at"] = utcnow()

        ref = self._col.document(drive_id)
        doc = await asyncio.to_thread(ref.get)
        if not doc.exists:
            raise NotFoundException("Placement Drive")

        await asyncio.to_thread(ref.update, update_data)
        return await self.get_drive(drive_id)

    async def delete_drive(self, drive_id: str) -> None:
        ref = self._col.document(drive_id)
        doc = await asyncio.to_thread(ref.get)
        if not doc.exists:
            raise NotFoundException("Placement Drive")
        await asyncio.to_thread(ref.delete)

    async def _get_company_name(self, company_id: str) -> str:
        try:
            doc = await asyncio.to_thread(
                self.db.collection("companies").document(company_id).get
            )
            if doc.exists:
                return doc.to_dict().get("name", "")
        except Exception:
            pass
        return ""
