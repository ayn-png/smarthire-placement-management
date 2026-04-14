"""
College Management profile service — backed by Firestore.
Collection: management_profiles, document ID = firebase_uid.
"""
import asyncio
from datetime import datetime
from app.schemas.management_profile import (
    ManagementProfileCreate, ManagementProfileUpdate,
    ManagementProfileResponse,
)
from app.core.exceptions import NotFoundException, ConflictException
from app.db.helpers import utcnow


def _doc_to_dict(doc_snapshot) -> dict | None:
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


class ManagementProfileService:
    def __init__(self, db):
        self.db = db

    async def create_profile(
        self, management_user: dict, data: ManagementProfileCreate
    ) -> ManagementProfileResponse:
        user_id = management_user["id"]
        existing = await asyncio.to_thread(
            self.db.collection("management_profiles").document(user_id).get
        )
        if existing.exists:
            existing_data = existing.to_dict() or {}
            if existing_data.get("full_name"):
                raise ConflictException("Management profile already exists")
        now = utcnow()
        doc = {
            **data.model_dump(),
            "email": management_user.get("email", ""),
            "avatar_url": None,
            "created_at": now,
            "updated_at": now,
        }
        await asyncio.to_thread(
            self.db.collection("management_profiles").document(user_id).set, doc
        )
        doc["id"] = user_id
        for k, v in doc.items():
            if isinstance(v, datetime):
                doc[k] = v.isoformat()
        return ManagementProfileResponse(**doc)

    async def get_profile(self, management_user: dict) -> ManagementProfileResponse:
        user_id = management_user["id"]
        doc = await asyncio.to_thread(
            self.db.collection("management_profiles").document(user_id).get
        )
        if not doc.exists:
            raise NotFoundException("Management profile")
        return ManagementProfileResponse(**_doc_to_dict(doc))

    async def update_profile(
        self, management_user: dict, data: ManagementProfileUpdate
    ) -> ManagementProfileResponse:
        user_id = management_user["id"]
        ref = self.db.collection("management_profiles").document(user_id)
        existing = await asyncio.to_thread(ref.get)
        if not existing.exists:
            raise NotFoundException("Management profile")
        update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        update_data["updated_at"] = utcnow()
        await asyncio.to_thread(ref.update, update_data)
        updated = await asyncio.to_thread(ref.get)
        return ManagementProfileResponse(**_doc_to_dict(updated))

    async def update_avatar_url(self, management_user: dict, avatar_url: str) -> None:
        user_id = management_user["id"]
        await asyncio.to_thread(
            self.db.collection("management_profiles").document(user_id).set,
            {"avatar_url": avatar_url, "updated_at": utcnow()},
            merge=True,
        )
