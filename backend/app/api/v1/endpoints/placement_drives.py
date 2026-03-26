from fastapi import APIRouter, Depends, Query
from typing import Optional
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
