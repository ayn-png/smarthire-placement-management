"""
Student service — backed by Firestore.
Document ID for student_profiles = firebase_uid (user_id).
All Firestore SDK calls are synchronous and wrapped in asyncio.to_thread().
"""
import asyncio
from datetime import datetime

from app.schemas.student import (
    StudentProfileCreate, StudentProfileUpdate, StudentProfileResponse,
    PlacedStatusUpdate,
)
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


def _is_complete_profile_doc(doc: dict | None) -> bool:
    return bool(doc and doc.get("full_name") and doc.get("roll_number"))


class StudentService:
    def __init__(self, db):
        self.db = db

    async def create_profile(self, user: dict, data: StudentProfileCreate) -> StudentProfileResponse:
        user_id = user["id"]

        # Fetch any existing document — may be a stub created by avatar/resume
        # uploads (set with merge=True) that only has avatar_url / resume_url.
        existing_doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).get
        )
        existing_data = existing_doc.to_dict() if existing_doc.exists else {}

        # A REAL conflict is when this student already has a complete profile
        # (roll_number + full_name are both set). A stub document produced by
        # avatar/resume pre-uploads does NOT have these fields and is fine
        # to overwrite with the full profile.
        if _is_complete_profile_doc(existing_data):
            raise ConflictException("Profile already exists")

        # Check for duplicate roll number across OTHER students only.
        # Excluding the current user's own doc prevents false conflicts when
        # re-saving or when a partial doc somehow has roll_number already.
        roll_query = await asyncio.to_thread(
            self.db.collection("student_profiles")
            .where("roll_number", "==", data.roll_number)
            .limit(1)
            .get
        )
        roll_docs = list(roll_query)
        if roll_docs and roll_docs[0].id != user_id:
            raise ConflictException("Roll number already registered")

        now = utcnow()
        profile_doc = {
            **data.model_dump(),
            "user_id": user_id,
            "full_name": data.full_name if data.full_name else user.get("full_name", ""),
            "email": user.get("email", ""),
            # Preserve avatar / resume already uploaded before the profile form was saved.
            # Previously these were hardcoded to None, wiping any pre-upload file URL.
            "avatar_url": existing_data.get("avatar_url") or None,
            "resume_url": existing_data.get("resume_url") or None,
            # Preserve original creation timestamp if a stub doc already existed.
            "created_at": existing_data.get("created_at") or now,
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
        profile_doc = _doc_to_dict(doc)
        if not _is_complete_profile_doc(profile_doc):
            raise NotFoundException("Profile")
        return self._to_response(profile_doc)

    async def get_profile_by_id(self, profile_id: str) -> StudentProfileResponse:
        if not profile_id:
            raise NotFoundException("Profile")
        doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(profile_id).get
        )
        if not doc.exists:
            raise NotFoundException("Profile")
        profile_doc = _doc_to_dict(doc)
        if not _is_complete_profile_doc(profile_doc):
            raise NotFoundException("Profile")
        return self._to_response(profile_doc)

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
        if not _is_complete_profile_doc(existing_dict):
            raise NotFoundException("Profile")

        await asyncio.to_thread(profile_ref.update, update_data)

        # Re-fetch updated document
        updated_doc = await asyncio.to_thread(profile_ref.get)
        return self._to_response(_doc_to_dict(updated_doc))

    async def update_resume_url(self, user: dict, resume_url: str) -> None:
        """Update resume URL for student profile. Deletes old Cloudinary file if different."""
        import logging
        from app.utils.file_upload import delete_file

        logger = logging.getLogger(__name__)
        user_id = user["id"]

        # Clean up old resume if any, even when the profile document is still a stub.
        doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).get
        )
        existing_data = doc.to_dict() if doc.exists else {}
        old_resume_url = existing_data.get("resume_url")
        if old_resume_url and old_resume_url != resume_url:
            try:
                if delete_file(old_resume_url):
                    logger.info(f"Deleted old resume: {old_resume_url}")
            except Exception as e:
                logger.error(f"Error deleting old resume {old_resume_url}: {e}")

        # Use merge=True so resume-first flows can create a stub profile document.
        await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).set,
            {"resume_url": resume_url, "updated_at": utcnow()},
            merge=True,
        )

    async def update_avatar_url(self, user: dict, avatar_url: str) -> None:
        """Persist new avatar_url for the student profile.
        Uses set(merge=True) so it never raises NotFound for first-time students
        who upload an avatar before completing their profile form.
        """
        user_id = user["id"]
        await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).set,
            {"avatar_url": avatar_url, "updated_at": utcnow()},
            merge=True,
        )

    async def update_marksheet_url(self, user: dict, marksheet_url: str) -> None:
        """Persist new marksheet_url for the student profile.
        Uses set(merge=True) so it works even before the profile document exists.
        """
        user_id = user["id"]
        await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).set,
            {"marksheet_url": marksheet_url, "updated_at": utcnow()},
            merge=True,
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

        # Filter out stub profiles created by pre-profile uploads.
        # A complete profile must have both full_name and roll_number set
        all_profiles = [
            p for p in all_profiles
            if _is_complete_profile_doc(p)
        ]

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

    async def update_offer_letter_url(self, user: dict, offer_url: str) -> None:
        """Persist offer letter URL for the student profile."""
        user_id = user["id"]
        doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).get
        )
        if not doc.exists:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=422,
                detail="Please complete your student profile before uploading an offer letter.",
            )
        await asyncio.to_thread(
            self.db.collection("student_profiles").document(user_id).update,
            {"offer_letter_url": offer_url, "updated_at": utcnow()},
        )

    async def update_placed_status(self, student_id: str, data: PlacedStatusUpdate, admin_user: dict) -> StudentProfileResponse:
        """Admin marks a student as placed (or unplaced)."""
        import logging
        logger = logging.getLogger(__name__)

        doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(student_id).get
        )
        if not doc.exists:
            raise NotFoundException("Student profile")

        update_payload = {
            "is_placed": data.is_placed,
            "placed_company": data.placed_company,
            "placed_package": data.placed_package,
            "updated_at": utcnow(),
        }
        await asyncio.to_thread(
            self.db.collection("student_profiles").document(student_id).update,
            update_payload,
        )

        # Send in-app notification to the student
        try:
            profile_data = doc.to_dict() or {}
            student_user_id = profile_data.get("user_id", student_id)
            if data.is_placed and data.placed_company:
                from app.services.notification_service import NotificationService
                notif_svc = NotificationService(self.db)
                await notif_svc.create(
                    user_id=student_user_id,
                    title="Congratulations! You are placed!",
                    message=f"You have been marked as placed at {data.placed_company}. Best wishes!",
                    link="/student/profile",
                )
        except Exception as exc:
            logger.warning("Failed to send placed-status notification: %s", exc)

        updated_doc = await asyncio.to_thread(
            self.db.collection("student_profiles").document(student_id).get
        )
        return self._to_response(_doc_to_dict(updated_doc))

    def _to_response(self, doc: dict) -> StudentProfileResponse:
        return StudentProfileResponse(**doc)
