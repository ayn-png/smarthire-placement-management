from fastapi import APIRouter, Depends, HTTPException, status, Query
import asyncio
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_database
from app.db.helpers import utcnow
from app.middleware.auth import require_management, get_current_user
from app.services.notification_service import NotificationService
from app.core.enums import UserRole

router = APIRouter(prefix="/announcements", tags=["Announcements"])

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    target_audience: str  # "STUDENTS", "PLACEMENT_ADMINS", "ALL"

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementCreate,
    current_user: dict = Depends(require_management),
    db=Depends(get_database)
):
    """Create a new announcement and notify the target audience."""
    doc = {
        "title": payload.title,
        "message": payload.message,
        "target_audience": payload.target_audience,
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "College Management"),
        "created_at": utcnow()
    }
    
    # Save announcement to firestore
    announcement_ref = db.collection("announcements").document()
    await asyncio.to_thread(announcement_ref.set, doc)
    
    # Determine target users for notifications
    users_query = db.collection("users")
    if payload.target_audience == "STUDENTS":
        users_query = users_query.where("role", "==", UserRole.STUDENT.value)
    elif payload.target_audience == "PLACEMENT_ADMINS":
        users_query = users_query.where("role", "==", UserRole.PLACEMENT_ADMIN.value)
    elif payload.target_audience == "ALL":
        # we skip filtering, get all active users
        pass
    
    users = await asyncio.to_thread(users_query.get)
    
    # Fan-out notifications using batch to avoid too many single inserts
    notification_service = NotificationService(db)
    batch = db.batch()
    count = 0
    
    for user_doc in users:
        # We need a scalable approach, but for a college system this batching normally suffices (up to 500 per batch)
        # If there are more than 500, we'd need multiple batches, but we'll use a single batch for simplicity here.
        if count >= 499:
            await asyncio.to_thread(batch.commit)
            batch = db.batch()
            count = 0
            
        uid = user_doc.id
        notif_doc = {
            "user_id": uid,
            "title": f"New Announcement: {payload.title}",
            "message": payload.message,
            "link": "/student/dashboard" if payload.target_audience == "STUDENTS" else "/admin/dashboard",
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
    target_audience: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """List announcements."""
    query = db.collection("announcements").order_by("created_at", direction="DESCENDING").limit(limit)
    
    if target_audience:
        query = query.where("target_audience", "in", [target_audience, "ALL"])
    
    docs = await asyncio.to_thread(query.get)
    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        # Convert datetime to string
        if isinstance(data.get("created_at"), datetime):
            data["created_at"] = data["created_at"].isoformat()
        results.append(data)
        
    return results
