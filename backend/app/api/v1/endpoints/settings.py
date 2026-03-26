"""
System settings endpoint — COLLEGE_MANAGEMENT can update; admin and management can read.
Settings are stored in Firestore `system_settings/config`.
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from pydantic import BaseModel
from app.middleware.auth import require_admin_or_management, require_management
from app.db.database import get_database
from app.db.helpers import utcnow

router = APIRouter(prefix="/settings", tags=["Settings"])


class SystemSettings(BaseModel):
    owner_email: Optional[str] = None
    max_file_size_mb: Optional[int] = None
    notify_new_jobs_email: Optional[bool] = None
    notification_batch_limit: Optional[int] = None
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


@router.get("/", response_model=SystemSettings)
async def get_settings(
    current_user: dict = Depends(require_admin_or_management),
    db=Depends(get_database),
):
    doc = await asyncio.to_thread(
        db.collection("system_settings").document("config").get
    )
    if not doc.exists:
        # Return defaults if no settings saved yet
        from app.core.config import settings
        return SystemSettings(
            owner_email=settings.OWNER_EMAIL,
            max_file_size_mb=settings.MAX_FILE_SIZE_MB,
            notify_new_jobs_email=settings.NOTIFY_NEW_JOBS_EMAIL,
            notification_batch_limit=settings.NOTIFICATION_BATCH_LIMIT,
        )
    data = doc.to_dict() or {}
    from datetime import datetime
    for k, v in data.items():
        if isinstance(v, datetime):
            data[k] = v.isoformat()
    return SystemSettings(**data)


@router.patch("/", response_model=SystemSettings)
async def update_settings(
    body: SystemSettings,
    current_user: dict = Depends(require_management),
    db=Depends(get_database),
):
    update_data = body.model_dump(exclude_none=True, exclude={"updated_at", "updated_by"})
    update_data["updated_at"] = utcnow()
    update_data["updated_by"] = current_user.get("id", "")

    await asyncio.to_thread(
        db.collection("system_settings").document("config").set,
        update_data,
        merge=True,
    )

    updated_doc = await asyncio.to_thread(
        db.collection("system_settings").document("config").get
    )
    data = updated_doc.to_dict() or {}
    from datetime import datetime
    for k, v in data.items():
        if isinstance(v, datetime):
            data[k] = v.isoformat()
    return SystemSettings(**data)
