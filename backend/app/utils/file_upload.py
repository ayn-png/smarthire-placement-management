import os
import uuid
import aiofiles
import logging
import httpx
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings
from app.services import cloudinary_service

logger = logging.getLogger(__name__)

ALLOWED_RESUME_TYPES = ["application/pdf"]
ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]
MAX_FILE_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024  # Convert to bytes
MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB hard cap for avatars

# FIX 6 — Resolve the backend/ root directory once at import time so that
# all file helpers use absolute paths regardless of the process CWD.
# __file__ = backend/app/utils/file_upload.py  →  three dirname() calls → backend/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def save_resume(file: UploadFile, user_id: str) -> str:
    """
    Validate and save uploaded resume PDF to Cloudinary.
    Returns the Cloudinary URL.
    """
    # Use Cloudinary service
    return await cloudinary_service.upload_resume(file, user_id)


async def save_avatar(file: UploadFile, user_id: str) -> str:
    """
    Validate and save uploaded profile avatar to Cloudinary.
    Returns the Cloudinary URL.
    Feature 8 — Profile Photo Upload
    """
    # Use Cloudinary service
    return await cloudinary_service.upload_avatar(file, user_id)


async def save_logo(file: UploadFile, company_id: str) -> str:
    """
    Validate and save an uploaded company logo to Cloudinary.
    Returns the Cloudinary URL.
    NW#6 — Company Logo Upload
    """
    # Use Cloudinary service
    return await cloudinary_service.upload_logo(file, company_id)


async def save_marksheet(file: UploadFile, user_id: str) -> str:
    """
    Validate and save uploaded marksheet (PDF or image) to Cloudinary.
    Returns the Cloudinary URL.
    """
    return await cloudinary_service.upload_marksheet(file, user_id)


def resume_exists(file_url: str) -> bool:
    """
    Return True if the resume file exists.
    For Cloudinary URLs, verifies the file exists by making a HEAD request.
    For legacy local files, checks disk.
    """
    try:
        # Cloudinary URLs start with https://res.cloudinary.com
        if "cloudinary.com" in file_url:
            # FIXED: Actually verify Cloudinary file exists with HEAD request
            try:
                # Use httpx synchronously for file existence check
                with httpx.Client(timeout=5.0) as client:
                    response = client.head(file_url, follow_redirects=True)
                    if response.status_code == 200:
                        return True
                    else:
                        logger.warning(
                            f"Cloudinary file not found or inaccessible: {file_url} "
                            f"(status: {response.status_code})"
                        )
                        return False
            except httpx.RequestError as e:
                logger.error(f"Failed to verify Cloudinary URL {file_url}: {str(e)}")
                return False

        # Legacy local file check
        relative_path = file_url.lstrip("/")
        abs_path = os.path.join(BASE_DIR, relative_path)
        return os.path.isfile(abs_path)
    except Exception as e:
        logger.error(f"Error checking file existence for {file_url}: {str(e)}")
        return False


def delete_file(file_url: str) -> bool:
    """
    Delete a file given its URL.
    Handles both Cloudinary URLs and legacy local files.
    """
    try:
        # Cloudinary file
        if "cloudinary.com" in file_url:
            return cloudinary_service.delete_file(file_url)

        # Legacy local file
        relative_path = file_url.lstrip("/")
        abs_path = os.path.join(BASE_DIR, relative_path)
        if os.path.isfile(abs_path):
            os.remove(abs_path)
            return True
    except Exception:
        pass
    return False
