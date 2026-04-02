from fastapi import APIRouter, Depends, HTTPException, status, Query
import asyncio
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_database
from app.db.helpers import utcnow
from app.middleware.auth import get_current_user, require_management
from app.core.enums import UserRole
from app.core.exceptions import NotFoundException, ForbiddenException

router = APIRouter(prefix="/complaints", tags=["Complaints"])

class ComplaintCreate(BaseModel):
    title: str
    description: str

class ComplaintUpdate(BaseModel):
    status: str # "Pending" or "Resolved"
    solution: Optional[str] = None

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_complaint(
    payload: ComplaintCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
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
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """List complaints. If Student -> only their own. If Management -> all."""
    query = db.collection("complaints")

    if current_user.get("role") == UserRole.STUDENT.value:
        query = query.where("user_id", "==", current_user["id"])
    elif current_user.get("role") == UserRole.COLLEGE_MANAGEMENT.value:
        pass # management sees all
    else:
        raise ForbiddenException("You don't have access to complaints.")

    if status_filter:
        query = query.where("status", "==", status_filter)

    docs = await asyncio.to_thread(query.get)
    results = []

    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        if isinstance(data.get("created_at"), datetime):
            data["created_at"] = data["created_at"].isoformat()
        if isinstance(data.get("updated_at"), datetime):
            data["updated_at"] = data["updated_at"].isoformat()
        results.append(data)

    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return results

@router.patch("/{complaint_id}")
async def update_complaint(
    complaint_id: str,
    payload: ComplaintUpdate,
    current_user: dict = Depends(require_management),
    db=Depends(get_database)
):
    """Management updates a complaint status and provides a solution."""
    complaint_ref = db.collection("complaints").document(complaint_id)
    doc = await asyncio.to_thread(complaint_ref.get)
    
    if not doc.exists:
        raise NotFoundException("Complaint")
        
    update_data = {
        "status": payload.status,
        "updated_at": utcnow()
    }
    if payload.solution is not None:
        update_data["solution"] = payload.solution
        
    await asyncio.to_thread(complaint_ref.update, update_data)
    
    # Optionally notify the student
    data = doc.to_dict()
    student_id = data.get("user_id")
    notif_doc = {
        "user_id": student_id,
        "title": f"Complaint {payload.status}",
        "message": f"Your complaint '{data.get('title')}' has been marked as {payload.status}.",
        "link": "/student/complaints",
        "read": False,
        "created_at": utcnow()
    }
    notif_ref = db.collection("notifications").document()
    await asyncio.to_thread(notif_ref.set, notif_doc)
    
    return {"message": "Complaint updated successfully."}
