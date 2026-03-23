"""
Student service — backed by Firestore.
Document ID for student_profiles = firebase_uid (user_id).
All Firestore SDK calls are synchronous and wrapped in asyncio.to_thread().
"""
import asyncio
from datetime import datetime

from app.schemas.student import StudentProfileCreate, StudentProfileUpdate, StudentProfileResponse
from app.core.exceptions import NotFoundException, ConflictException
from app.db.helpers import serialize_doc, utcnow


# Fields that must never be set to None during a profile update
_REQUIRED_PROFILE_FIELDS = {"branch", "semester", "cgpa", "phone"}


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


class StudentService:
    def __init__(self, db):
        self.db = db

    async def create_profile(self, user: dict, data: StudentProfileCreate) -> StudentProfileResponse:
        user_id = user["id"]

        # Check if profile already exists (document ID = user_id)
        existing_doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).get
        )
        if existing_doc.exists:
            raise ConflictException("Profile already exists")

        # Check for duplicate roll number
        roll_query = await asyncio.to_thread(
            self.db.collection("student_profiles")
            .where("roll_number", "==", data.roll_number)
            .limit(1)
            .get
        )
        if list(roll_query):
            raise ConflictException("Roll number already registered")

        if not data.marksheet_url:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="Marksheet upload is required before saving profile")

        now = utcnow()
        profile_doc = {
            **data.model_dump(),
            "user_id": user_id,
            "full_name": data.full_name if data.full_name else user.get("full_name", ""),
            "email": user.get("email", ""),
            "avatar_url": None,
            "resume_url": None,
            "created_at": now,
            "updated_at": now,
        }

        # Use user_id as document ID
        await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).set, profile_doc
        )

        profile_doc["id"] = user_id
        for k, v in profile_doc.items():
            if isinstance(v, datetime):
                profile_doc[k] = v.isoformat()

        return self._to_response(profile_doc)

    async def get_profile(self, user: dict) -> StudentProfileResponse:
        user_id = user["id"]
        doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).get
        )
        if not doc.exists:
            raise NotFoundException("Profile")
        return self._to_response(_doc_to_dict(doc))

    async def get_profile_by_id(self, profile_id: str) -> StudentProfileResponse:
        if not profile_id:
            raise NotFoundException("Profile")
        doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(profile_id).get
        )
        if not doc.exists:
            raise NotFoundException("Profile")
        return self._to_response(_doc_to_dict(doc))

    async def update_profile(self, user: dict, data: StudentProfileUpdate) -> StudentProfileResponse:
        user_id = user["id"]

        update_data: dict = {}
        for field in data.model_fields_set:
            value = getattr(data, field)
            if field in _REQUIRED_PROFILE_FIELDS and value is None:
                continue
            update_data[field] = value

        if not update_data:
            return await self.get_profile(user)

        update_data["updated_at"] = utcnow()

        profile_ref = self.db.collection("student_profiles").document(user_id)
        profile_doc = await asyncio.to_thread(profile_ref.get)
        if not profile_doc.exists:
            raise NotFoundException("Profile")

        existing_dict = profile_doc.to_dict() or {}
        existing_marksheet = existing_dict.get("marksheet_url")
        incoming_marksheet = update_data.get("marksheet_url", existing_marksheet)
        if not existing_marksheet and not incoming_marksheet:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="Marksheet upload is required to update profile")

        await asyncio.to_thread(profile_ref.update, update_data)

        # Re-fetch updated document
        updated_doc = await asyncio.to_thread(profile_ref.get)
        return self._to_response(_doc_to_dict(updated_doc))

    async def update_resume_url(self, user: dict, resume_url: str) -> None:
        """Update resume URL for student profile. Deletes old Cloudinary file if different."""
        import logging
        from app.utils.file_upload import delete_file
        from fastapi import HTTPException

        logger = logging.getLogger(__name__)
        user_id = user["id"]

        # Check profile exists and clean up old resume if any
        doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).get
        )

        # Guard: profile must exist before we can attach a resume to it
        if not doc.exists:
            raise HTTPException(
                status_code=422,
                detail="Please complete your student profile before uploading a resume.",
            )

        old_resume_url = doc.to_dict().get("resume_url")
        if old_resume_url and old_resume_url != resume_url:
            try:
                if delete_file(old_resume_url):
                    logger.info(f"Deleted old resume: {old_resume_url}")
            except Exception as e:
                logger.error(f"Error deleting old resume {old_resume_url}: {e}")

        # Use merge=True (set) so it never raises NotFound even if doc was just created
        await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).set,
            {"resume_url": resume_url, "updated_at": utcnow()},
            merge=True,
        )

    async def update_avatar_url(self, user: dict, avatar_url: str) -> None:
        """Persist new avatar_url for the student profile."""
        user_id = user["id"]
        await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).update,
            {"avatar_url": avatar_url, "updated_at": utcnow()},
        )

    async def update_marksheet_url(self, user: dict, marksheet_url: str) -> None:
        """Persist new marksheet_url for the student profile."""
        user_id = user["id"]
        await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).update,
            {"marksheet_url": marksheet_url, "updated_at": utcnow()},
        )

    async def list_students(
        self,
        branch: str = None,
        min_cgpa: float = None,
        max_cgpa: float = None,
        skills: list = None,
        page: int = 1,
        limit: int = 20,
    ) -> dict:
        # Fetch all profiles from Firestore (branch filter on server if provided)
        if branch:
            docs = await asyncio.to_thread(
                self.db.collection("student_profiles").where("branch", "==", branch).get
            )
        else:
            docs = await asyncio.to_thread(
                self.db.collection("student_profiles").get
            )

        all_profiles = [_doc_to_dict(d) for d in docs if d.exists]

        # Python-side filters for CGPA and skills (Firestore range queries need composite indexes)
        if min_cgpa is not None:
            all_profiles = [p for p in all_profiles if (p.get("cgpa") or 0) >= min_cgpa]
        if max_cgpa is not None:
            all_profiles = [p for p in all_profiles if (p.get("cgpa") or 0) <= max_cgpa]
        if skills:
            all_profiles = [
                p for p in all_profiles
                if any(s in (p.get("skills") or []) for s in skills)
            ]

        # Sort by CGPA descending
        all_profiles.sort(key=lambda x: x.get("cgpa") or 0, reverse=True)

        total = len(all_profiles)
        skip = (page - 1) * limit
        paginated = all_profiles[skip: skip + limit]

        profiles = [self._to_response(p) for p in paginated]
        return {"profiles": profiles, "total": total, "page": page, "limit": limit}

    def _to_response(self, doc: dict) -> StudentProfileResponse:
        return StudentProfileResponse(**doc)
