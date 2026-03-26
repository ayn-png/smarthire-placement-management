from fastapi import APIRouter, Depends, UploadFile, File
from app.schemas.admin_profile import (
    PlacementAdminProfileCreate, PlacementAdminProfileUpdate,
    PlacementAdminProfileResponse, AdminAvatarUploadResponse,
)
from app.services.admin_profile_service import AdminProfileService
from app.middleware.auth import require_admin
from app.db.database import get_database

router = APIRouter(prefix="/admin-profile", tags=["Admin Profile"])


def get_admin_profile_service(db=Depends(get_database)) -> AdminProfileService:
    return AdminProfileService(db)


@router.post("/", response_model=PlacementAdminProfileResponse, status_code=201)
async def create_admin_profile(
    data: PlacementAdminProfileCreate,
    current_user: dict = Depends(require_admin),
    service: AdminProfileService = Depends(get_admin_profile_service),
):
    return await service.create_profile(current_user, data)


@router.get("/me", response_model=PlacementAdminProfileResponse)
async def get_my_admin_profile(
    current_user: dict = Depends(require_admin),
    service: AdminProfileService = Depends(get_admin_profile_service),
):
    return await service.get_profile(current_user)


@router.put("/me", response_model=PlacementAdminProfileResponse)
async def update_my_admin_profile(
    data: PlacementAdminProfileUpdate,
    current_user: dict = Depends(require_admin),
    service: AdminProfileService = Depends(get_admin_profile_service),
):
    return await service.update_profile(current_user, data)


@router.post("/avatar", response_model=AdminAvatarUploadResponse)
async def upload_admin_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin),
    service: AdminProfileService = Depends(get_admin_profile_service),
):
    from app.utils.file_upload import save_avatar
    avatar_url = await save_avatar(file, current_user["id"])
    await service.update_avatar_url(current_user, avatar_url)
    return AdminAvatarUploadResponse(
        avatar_url=avatar_url,
        message="Avatar uploaded successfully",
    )
