from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import asyncio
from datetime import datetime
from app.schemas.placement_drive import PlacementDriveCreate, PlacementDriveUpdate, PlacementDriveResponse
from app.services.placement_drive_service import PlacementDriveService
from app.middleware.auth import get_current_user, require_admin
from app.db.database import get_database

router = APIRouter(prefix="/placement-drives", tags=["Placement Drives"])


def get_service(db=Depends(get_database)) -> PlacementDriveService:
    return PlacementDriveService(db)


@router.post("/", response_model=PlacementDriveResponse, status_code=201)
async def create_drive(
    data: PlacementDriveCreate,
    _: dict = Depends(require_admin),
    service: PlacementDriveService = Depends(get_service),
):
    return await service.create_drive(data)


@router.get("/", response_model=dict)
async def list_drives(
    status: Optional[str] = Query(None),
    company_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_user),
    service: PlacementDriveService = Depends(get_service),
):
    return await service.list_drives(status, company_id, page, limit)


@router.get("/{drive_id}", response_model=PlacementDriveResponse)
async def get_drive(
    drive_id: str,
    _: dict = Depends(get_current_user),
    service: PlacementDriveService = Depends(get_service),
):
    return await service.get_drive(drive_id)


@router.put("/{drive_id}", response_model=PlacementDriveResponse)
async def update_drive(
    drive_id: str,
    data: PlacementDriveUpdate,
    _: dict = Depends(require_admin),
    service: PlacementDriveService = Depends(get_service),
):
    return await service.update_drive(drive_id, data)


@router.delete("/{drive_id}", status_code=204)
async def delete_drive(
    drive_id: str,
    _: dict = Depends(require_admin),
    service: PlacementDriveService = Depends(get_service),
):
    await service.delete_drive(drive_id)


# ── Drive Rounds (sub-resource on placement drives) ─────────────────────────

class DriveRoundCreate(BaseModel):
    round_number: int = Field(..., ge=1, le=20)
    round_name: str = Field(..., min_length=1, max_length=200)
    round_type: str = Field(default="GENERAL", max_length=100)


class DriveRoundUpdate(BaseModel):
    round_name: Optional[str] = Field(default=None, max_length=200)
    round_type: Optional[str] = Field(default=None, max_length=100)
    round_number: Optional[int] = Field(default=None, ge=1, le=20)


class DriveRoundResponse(BaseModel):
    id: str
    drive_id: str
    round_number: int
    round_name: str
    round_type: str
    created_at: str
    updated_at: str


def _serialize_datetime(d: dict) -> dict:
    """Convert any datetime values in a dict to ISO strings in-place."""
    return {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in d.items()}


@router.get("/{drive_id}/rounds", response_model=list)
async def list_drive_rounds(
    drive_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """List all rounds for a placement drive, sorted by round_number."""
    docs = await asyncio.to_thread(
        db.collection("drive_rounds").where("drive_id", "==", drive_id).get
    )
    rounds = []
    for doc in docs:
        if doc.exists:
            d = _serialize_datetime({"id": doc.id, **doc.to_dict()})
            rounds.append(d)
    rounds.sort(key=lambda x: x.get("round_number", 0))
    return rounds


@router.post("/{drive_id}/rounds", response_model=dict, status_code=201)
async def create_drive_round(
    drive_id: str,
    data: DriveRoundCreate,
    current_user: dict = Depends(require_admin),
    db=Depends(get_database),
):
    """Add a round to a placement drive."""
    from app.db.helpers import utcnow
    now = utcnow()
    doc = {
        "drive_id": drive_id,
        "round_number": data.round_number,
        "round_name": data.round_name,
        "round_type": data.round_type,
        "created_at": now,
        "updated_at": now,
    }
    _, ref = await asyncio.to_thread(db.collection("drive_rounds").add, doc)
    created = await asyncio.to_thread(ref.get)
    return _serialize_datetime({"id": created.id, **created.to_dict()})


@router.put("/{drive_id}/rounds/{round_id}", response_model=dict)
async def update_drive_round(
    drive_id: str,
    round_id: str,
    data: DriveRoundUpdate,
    current_user: dict = Depends(require_admin),
    db=Depends(get_database),
):
    """Update a round on a placement drive."""
    from app.db.helpers import utcnow
    ref = db.collection("drive_rounds").document(round_id)
    doc = await asyncio.to_thread(ref.get)
    if not doc.exists or doc.to_dict().get("drive_id") != drive_id:
        raise HTTPException(status_code=404, detail="Round not found")
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = utcnow()
    await asyncio.to_thread(ref.update, update_data)
    updated = await asyncio.to_thread(ref.get)
    return _serialize_datetime({"id": updated.id, **updated.to_dict()})


@router.delete("/{drive_id}/rounds/{round_id}", status_code=204)
async def delete_drive_round(
    drive_id: str,
    round_id: str,
    current_user: dict = Depends(require_admin),
    db=Depends(get_database),
):
    """Delete a round from a placement drive."""
    ref = db.collection("drive_rounds").document(round_id)
    doc = await asyncio.to_thread(ref.get)
    if not doc.exists or doc.to_dict().get("drive_id") != drive_id:
        raise HTTPException(status_code=404, detail="Round not found")
    await asyncio.to_thread(ref.delete)
