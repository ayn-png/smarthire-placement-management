"""
Leaderboard endpoint — returns top students ranked by CGPA.

Collection: student_profiles (NOT "students" — that collection does not exist)
Fields used:
  - full_name       (string)
  - branch          (string)
  - cgpa            (float, top-level)
  - is_placed       (bool)
  - skills          (list[str])
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status
import asyncio
from typing import Optional

from app.db.database import get_database
from app.middleware.auth import get_current_user
from app.core.enums import UserRole

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

_ALLOWED_ROLES = {
    UserRole.STUDENT.value,
    UserRole.PLACEMENT_ADMIN.value,
    UserRole.COLLEGE_MANAGEMENT.value,
}


@router.get("")
async def get_leaderboard(
    limit: int = Query(20, ge=1, le=100, description="Max entries to return"),
    department: Optional[str] = Query(None, description="Filter by department/branch name"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Returns top students ranked by CGPA (score = CGPA × 10).

    - **Students, Placement Admins, College Management** can view.
    - Department filter uses the `branch` field on `student_profiles`.
    """
    role = current_user.get("role")
    if role not in _ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students, placement admins, and college management can view the leaderboard.",
        )

    # Correct collection: student_profiles
    query = db.collection("student_profiles")

    if department:
        # Correct field: branch (not personal.department)
        query = query.where("branch", "==", department)

    docs = await asyncio.to_thread(query.get)
    results = []

    for doc in docs:
        data = doc.to_dict() or {}

        # Correct field: top-level `cgpa` (not nested academic.cgpa)
        raw_cgpa = data.get("cgpa", 0.0)
        try:
            cgpa = float(raw_cgpa) if raw_cgpa is not None else 0.0
        except (TypeError, ValueError):
            cgpa = 0.0

        total_score = round(cgpa * 10, 2)

        results.append({
            "id": doc.id,
            "name": data.get("full_name", "Unknown"),
            "department": data.get("branch", "Unknown"),
            "cgpa": cgpa,
            "total_score": total_score,
            "placement_status": "Placed" if data.get("is_placed") else "Open",
            "skills": data.get("skills", []),
        })

    # Sort descending by total_score
    results.sort(key=lambda x: x["total_score"], reverse=True)

    return results[:limit]
