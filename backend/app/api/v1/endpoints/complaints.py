from fastapi import APIRouter, Depends, HTTPException, status, Query
import asyncio
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime

from app.db.database import get_database
from app.db.helpers import utcnow
from app.middleware.auth import get_current_user, require_management
from app.core.enums import UserRole
from app.core.exceptions import NotFoundException, ForbiddenException

router = APIRouter(prefix="/complaints", tags=["Complaints"])


class ComplaintCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200, description="Brief issue title (5–200 chars)")
    description: str = Field(..., min_length=10, max_length=2000, description="Issue details (10–2000 chars)")


class ComplaintUpdate(BaseModel):
    status: Literal["Pending", "Resolved"] = Field(..., description="New status for the complaint")
    solution: Optional[str] = Field(None, max_length=3000, description="Resolution text (max 3000 chars)")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_complaint(
    payload: ComplaintCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Student creates a new complaint/issue."""
    if current_user.get("role") != UserRole.STUDENT.value:
        raise ForbiddenException("Only students can raise complaints.")

    doc = {
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Student"),
        "user_email": current_user.get("email", ""),
        "title": payload.title,
        "description": payload.description,
        "status": "Pending",
        "solution": "",
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }

    complaint_ref = db.collection("complaints").document()
    await asyncio.to_thread(complaint_ref.set, doc)

    return {"id": complaint_ref.id, "message": "Complaint raised successfully."}


@router.get("")
async def list_complaints(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """List complaints.

    - **Student**: only their own complaints.
    - **College Management**: all complaints.
    - Other roles: 403.
    """
    query = db.collection("complaints")
    role = current_user.get("role")

    if role == UserRole.STUDENT.value:
        query = query.where("user_id", "==", current_user["id"])
    elif role == UserRole.COLLEGE_MANAGEMENT.value:
        pass  # Management sees all
    elif role == UserRole.PLACEMENT_ADMIN.value:
        pass  # Admins also see all (read-only oversight)
    else:
        raise ForbiddenException("You don't have access to complaints.")

    if status_filter:
        query = query.where("status", "==", status_filter)

    docs = await asyncio.to_thread(query.get)
    results = []

    for doc in docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        created = data.get("created_at")
        updated = data.get("updated_at")
        if isinstance(created, datetime):
            data["created_at"] = created.isoformat()
        if isinstance(updated, datetime):
            data["updated_at"] = updated.isoformat()
        results.append(data)

    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    total = len(results)
    skip = (page - 1) * limit
    paginated = results[skip: skip + limit]

    return {
        "complaints": paginated,
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.patch("/{complaint_id}")
async def update_complaint(
    complaint_id: str,
    payload: ComplaintUpdate,
    current_user: dict = Depends(require_management),
    db=Depends(get_database),
):
    """Management updates a complaint status and optionally provides a solution."""
    complaint_ref = db.collection("complaints").document(complaint_id)
    doc = await asyncio.to_thread(complaint_ref.get)

    if not doc.exists:
        raise NotFoundException("Complaint")

    update_data: dict = {
        "status": payload.status,
        "updated_at": utcnow(),
    }
    if payload.solution is not None:
        update_data["solution"] = payload.solution

    await asyncio.to_thread(complaint_ref.update, update_data)

    # Notify the student
    data = doc.to_dict() or {}
    student_id = data.get("user_id")
    if student_id:
        notif_doc = {
            "user_id": student_id,
            "title": f"Complaint {payload.status}",
            "message": f"Your complaint '{data.get('title')}' has been marked as {payload.status}.",
            "link": "/student/complaints",
            "read": False,
            "created_at": utcnow(),
        }
        notif_ref = db.collection("notifications").document()
        await asyncio.to_thread(notif_ref.set, notif_doc)

    return {"message": "Complaint updated successfully."}
