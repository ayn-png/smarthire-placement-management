from fastapi import APIRouter, Depends, HTTPException, status, Query
import asyncio
from typing import List, Optional

from app.db.database import get_database
from app.middleware.auth import require_management, get_current_user
from app.core.exceptions import ForbiddenException

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

@router.get("")
async def get_leaderboard(
    limit: int = 20,
    department: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Returns top students for the leaderboard based on CGPA and placement status.
    College Management & Students can view this.
    """
    students_ref = db.collection("students")
    query = students_ref
    
    if department:
        query = query.where("personal.department", "==", department)
        
    # We want to fetch all and sort in memory if the composite index doesn't exist.
    # We'll just fetch active students.
    docs = await asyncio.to_thread(query.get)
    results = []
    
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        
        # Calculate a basic "score" for the leaderboard ranking
        cgpa = data.get("academic", {}).get("cgpa", 0.0)
        
        # We also might have mock interview scores
        # We can simulate a score based on CGPA + some mock interview stat if present
        mock_score = data.get("mock_interviews_avg", 0)
        
        total_score = float(cgpa) * 10 + mock_score
        
        results.append({
            "id": data["id"],
            "name": data.get("personal", {}).get("full_name", "Unknown"),
            "department": data.get("personal", {}).get("department", "Unknown"),
            "cgpa": cgpa,
            "mock_score": mock_score,
            "total_score": round(total_score, 2),
            "placement_status": data.get("placement_status", "Open"),
            "skills": data.get("skills", []),
        })
        
    # Sort results by total_score descending
    results.sort(key=lambda x: x["total_score"], reverse=True)
    
    return results[:limit]
