from fastapi import APIRouter, Depends, HTTPException, status, Query
import asyncio
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime

from app.db.database import get_database
from app.db.helpers import utcnow
from app.middleware.auth import require_management, get_current_user
from app.services.notification_service import NotificationService
from app.core.enums import UserRole

router = APIRouter(prefix="/announcements", tags=["Announcements"])


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200, description="Announcement title (3–200 chars)")
    message: str = Field(..., min_length=10, max_length=5000, description="Announcement body (10–5000 chars)")
    target_audience: Literal["STUDENTS", "PLACEMENT_ADMINS", "ALL"] = Field(
        ..., description="Who receives this announcement"
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementCreate,
    current_user: dict = Depends(require_management),
    db=Depends(get_database),
):
    """Create a new announcement and notify the target audience (Management only)."""
    doc = {
        "title": payload.title,
        "message": payload.message,
        "target_audience": payload.target_audience,
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "College Management"),
        "created_at": utcnow(),
    }

    # Save announcement to Firestore
    announcement_ref = db.collection("announcements").document()
    await asyncio.to_thread(announcement_ref.set, doc)

    # Determine target users for notifications
    users_query = db.collection("users")
    if payload.target_audience == "STUDENTS":
        users_query = users_query.where("role", "==", UserRole.STUDENT.value)
    elif payload.target_audience == "PLACEMENT_ADMINS":
        users_query = users_query.where("role", "==", UserRole.PLACEMENT_ADMIN.value)
    # "ALL" — no filter; every active user

    users = await asyncio.to_thread(users_query.get)

    # Fan-out notifications in batches of 499 (Firestore write batch limit is 500)
    batch = db.batch()
    count = 0

    for user_doc in users:
        if count >= 499:
            await asyncio.to_thread(batch.commit)
            batch = db.batch()
            count = 0

        user_data = user_doc.to_dict() or {}
        user_role = user_data.get("role", UserRole.STUDENT.value)

        # Determine the correct dashboard link per recipient role
        if user_role == UserRole.PLACEMENT_ADMIN.value:
            link = "/admin/dashboard"
        elif user_role == UserRole.COLLEGE_MANAGEMENT.value:
            link = "/management/dashboard"
        else:
            link = "/student/dashboard"

        notif_doc = {
            "user_id": user_doc.id,
            "title": f"New Announcement: {payload.title}",
            "message": payload.message,
            "link": link,
            "read": False,
            "created_at": utcnow(),
        }
        notif_ref = db.collection("notifications").document()
        batch.set(notif_ref, notif_doc)
        count += 1

    if count > 0:
        await asyncio.to_thread(batch.commit)

    return {"id": announcement_ref.id, "message": "Announcement created and notifications sent"}


@router.get("")
async def list_announcements(
    target_audience: Optional[str] = Query(None, description="Filter by audience type"),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """List announcements, newest first. All authenticated roles can view."""
    query = db.collection("announcements")

    if target_audience:
        query = query.where("target_audience", "in", [target_audience, "ALL"])

    # Sort descending by created_at in Firestore to avoid full Python sort
    try:
        import google.cloud.firestore as gcf
        query = query.order_by("created_at", direction=gcf.Query.DESCENDING).limit(limit)
    except Exception:
        # Fallback: apply limit only; sort in Python below
        query = query.limit(limit)

    docs = await asyncio.to_thread(query.get)
    results = []
    for doc in docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        created = data.get("created_at")
        if isinstance(created, datetime):
            data["created_at"] = created.isoformat()
        results.append(data)

    # Python sort as fallback / tie-breaker
    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return results


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: str,
    current_user: dict = Depends(require_management),
    db=Depends(get_database),
):
    """Delete an announcement by ID (Management only)."""
    ref = db.collection("announcements").document(announcement_id)
    doc = await asyncio.to_thread(ref.get)
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Announcement not found")
    await asyncio.to_thread(ref.delete)
