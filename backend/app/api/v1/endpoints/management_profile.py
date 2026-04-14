from fastapi import APIRouter, Depends, UploadFile, File
from app.schemas.management_profile import (
    ManagementProfileCreate, ManagementProfileUpdate,
    ManagementProfileResponse, ManagementAvatarUploadResponse,
)
from app.services.management_profile_service import ManagementProfileService
from app.middleware.auth import require_management
from app.db.database import get_database

router = APIRouter(prefix="/management-profile", tags=["Management Profile"])


def get_management_profile_service(db=Depends(get_database)) -> ManagementProfileService:
    return ManagementProfileService(db)


@router.post("/", response_model=ManagementProfileResponse, status_code=201)
async def create_management_profile(
    data: ManagementProfileCreate,
    current_user: dict = Depends(require_management),
    service: ManagementProfileService = Depends(get_management_profile_service),
):
    return await service.create_profile(current_user, data)


@router.get("/me", response_model=ManagementProfileResponse)
async def get_my_management_profile(
    current_user: dict = Depends(require_management),
    service: ManagementProfileService = Depends(get_management_profile_service),
):
    return await service.get_profile(current_user)


@router.put("/me", response_model=ManagementProfileResponse)
async def update_my_management_profile(
    data: ManagementProfileUpdate,
    current_user: dict = Depends(require_management),
    service: ManagementProfileService = Depends(get_management_profile_service),
):
    return await service.update_profile(current_user, data)


@router.post("/avatar", response_model=ManagementAvatarUploadResponse)
async def upload_management_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_management),
    service: ManagementProfileService = Depends(get_management_profile_service),
):
    from app.utils.file_upload import save_avatar
    avatar_url = await save_avatar(file, current_user["id"])
    await service.update_avatar_url(current_user, avatar_url)
    return ManagementAvatarUploadResponse(
        avatar_url=avatar_url,
        message="Avatar uploaded successfully",
    )
