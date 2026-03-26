from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.schemas.round import RoundCreate, RoundUpdate, RoundResultUpdate, RoundResponse
from app.services.round_service import RoundService
from app.middleware.auth import get_current_user, require_admin, require_student
from app.db.database import get_database

router = APIRouter(prefix="/rounds", tags=["Rounds"])


def get_round_service(db=Depends(get_database)) -> RoundService:
    return RoundService(db)


@router.post("/", response_model=RoundResponse, status_code=201)
async def create_round(
    data: RoundCreate,
    current_user: dict = Depends(require_admin),
    service: RoundService = Depends(get_round_service),
):
    return await service.create_round(current_user, data)


@router.get("/my/upcoming", response_model=list[RoundResponse])
async def get_my_upcoming_rounds(
    current_user: dict = Depends(require_student),
    service: RoundService = Depends(get_round_service),
):
    return await service.list_upcoming_rounds_for_student(current_user["id"])


@router.get("/", response_model=list[RoundResponse])
async def list_rounds(
    application_id: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_admin),
    service: RoundService = Depends(get_round_service),
):
    return await service.list_rounds(application_id, job_id)


@router.get("/{round_id}", response_model=RoundResponse)
async def get_round(
    round_id: str,
    current_user: dict = Depends(get_current_user),
    service: RoundService = Depends(get_round_service),
):
    return await service.get_round(round_id)


@router.put("/{round_id}", response_model=RoundResponse)
async def update_round(
    round_id: str,
    data: RoundUpdate,
    current_user: dict = Depends(require_admin),
    service: RoundService = Depends(get_round_service),
):
    return await service.update_round(round_id, current_user, data)


@router.patch("/{round_id}/result", response_model=RoundResponse)
async def update_round_result(
    round_id: str,
    data: RoundResultUpdate,
    current_user: dict = Depends(require_admin),
    service: RoundService = Depends(get_round_service),
):
    return await service.update_round_result(round_id, current_user, data)


@router.delete("/{round_id}", status_code=204)
async def delete_round(
    round_id: str,
    current_user: dict = Depends(require_admin),
    service: RoundService = Depends(get_round_service),
):
    await service.delete_round(round_id, current_user)
