"""
Cloudinary Service - Cloud storage for resumes, avatars, and company logos.

Replaces local filesystem storage with Cloudinary cloud storage.
All uploads are organized in folders: resumes/, avatars/, logos/
"""

import asyncio
import cloudinary
import cloudinary.uploader
import cloudinary.api
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Configure Cloudinary
if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )
    CLOUDINARY_ENABLED = True
    logger.info(f"Cloudinary configured for cloud: {settings.CLOUDINARY_CLOUD_NAME}")
else:
    CLOUDINARY_ENABLED = False
    logger.warning("Cloudinary not configured - missing credentials in .env")


ALLOWED_RESUME_TYPES = ["application/pdf"]
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
MAX_FILE_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024  # Convert to bytes
MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB hard cap for images


async def upload_resume(file: UploadFile, user_id: str) -> str:
    """
    Upload resume PDF to Cloudinary.
    Returns the public URL.
    """
    if not CLOUDINARY_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloud storage not configured",
        )

    # Validate content type — also accept octet-stream when filename ends in .pdf
    # (some browsers/OS combinations send application/octet-stream for PDFs)
    is_pdf_by_type = file.content_type in ALLOWED_RESUME_TYPES
    is_pdf_by_name = (file.filename or "").lower().endswith(".pdf")
    if not is_pdf_by_type and not is_pdf_by_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed for resumes",
        )

    # Read file content to check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit",
        )

    # Validate PDF magic bytes (first 4 bytes must be %PDF)
    if not content[:4] == b"%PDF":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file: the uploaded file does not appear to be a valid PDF",
        )

    try:
        # Upload to Cloudinary (run sync SDK in thread to avoid blocking event loop)
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            content,
            folder="smarthire/resumes",
            public_id=f"resume_{user_id}",
            resource_type="raw",  # For PDF files
            overwrite=True,
            invalidate=True,
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file to cloud storage",
        )


async def upload_avatar(file: UploadFile, user_id: str) -> str:
    """
    Upload profile avatar to Cloudinary.
    Returns the public URL.
    """
    if not CLOUDINARY_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloud storage not configured",
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, or WebP images are allowed for avatars",
        )

    content = await file.read()
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar image must be smaller than 2 MB",
        )

    try:
        # Upload to Cloudinary (run sync SDK in thread to avoid blocking event loop).
        # No eager transformations — they produce derivative URLs that differ from
        # secure_url and fetch_format:"auto" causes the CDN to return 503 while it
        # transcodes.  Width/height/crop applied as direct upload params so the
        # stored image is already resized and secure_url is a plain, stable URL.
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            content,
            folder="smarthire/avatars",
            public_id=f"avatar_{user_id}",
            overwrite=True,
            invalidate=True,
            width=400,
            height=400,
            crop="fill",
            gravity="face",
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Cloudinary avatar upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload avatar to cloud storage",
        )


async def upload_logo(file: UploadFile, company_id: str) -> str:
    """
    Upload company logo to Cloudinary.
    Returns the public URL.
    """
    if not CLOUDINARY_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloud storage not configured",
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, or WebP images are allowed for logos",
        )

    content = await file.read()
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo image must be smaller than 2 MB",
        )

    try:
        # Upload to Cloudinary with transformations (run sync SDK in thread)
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            content,
            folder="smarthire/logos",
            public_id=f"logo_{company_id}",
            overwrite=True,
            invalidate=True,
            transformation=[
                {"width": 400, "height": 400, "crop": "fit"},
                {"quality": "auto"},
                {"fetch_format": "auto"},
            ],
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Cloudinary logo upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload logo to cloud storage",
        )


async def upload_marksheet(file: UploadFile, user_id: str) -> str:
    """
    Upload student marksheet (PDF or image) to Cloudinary.
    Returns the public URL.
    """
    if not CLOUDINARY_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloud storage not configured",
        )

    ALLOWED_MARKSHEET_TYPES = ["application/pdf", "image/jpeg", "image/png"]
    is_pdf_by_type = file.content_type == "application/pdf"
    is_pdf_by_name = (file.filename or "").lower().endswith(".pdf")
    is_image = file.content_type in ["image/jpeg", "image/png"]

    if not (is_pdf_by_type or is_pdf_by_name or is_image):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPEG, or PNG files are allowed for marksheets",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit",
        )

    # Use resource_type="raw" for PDFs, "image" for images
    use_raw = is_pdf_by_type or is_pdf_by_name

    # Validate PDF magic bytes when file is expected to be a PDF
    if use_raw and not content[:4] == b"%PDF":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file: the uploaded file does not appear to be a valid PDF",
        )

    try:
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            content,
            folder="smarthire/marksheets",
            public_id=f"marksheet_{user_id}",
            resource_type="raw" if use_raw else "image",
            overwrite=True,
            invalidate=True,
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Cloudinary marksheet upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload marksheet to cloud storage",
        )


async def upload_offer_letter(file: UploadFile, user_id: str) -> str:
    """
    Upload student offer letter PDF to Cloudinary.
    Returns the public URL.
    """
    if not CLOUDINARY_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloud storage not configured",
        )

    is_pdf_by_type = file.content_type in ["application/pdf", "application/x-pdf", "application/acrobat"]
    is_pdf_by_name = (file.filename or "").lower().endswith(".pdf")
    if not (is_pdf_by_type or is_pdf_by_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed for offer letters",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit",
        )

    if not content[:4] == b"%PDF":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file: the uploaded file does not appear to be a valid PDF",
        )

    try:
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            content,
            folder="smarthire/offer_letters",
            public_id=f"offer_letter_{user_id}",
            resource_type="raw",
            overwrite=True,
            invalidate=True,
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Cloudinary offer letter upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload offer letter to cloud storage",
        )


async def upload_marksheet_10th(file: UploadFile, user_id: str) -> str:
    """Upload 10th standard marksheet to Cloudinary."""
    if not CLOUDINARY_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloud storage not configured",
        )

    content = await file.read()
    content_type = file.content_type or ""
    filename = file.filename or ""

    allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    is_pdf = content_type == "application/pdf" or filename.lower().endswith(".pdf")

    if content_type not in allowed_types and not filename.lower().endswith((".pdf", ".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, and PNG files are accepted")

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB}MB")

    if is_pdf and len(content) >= 4 and content[:4] != b"%PDF":
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    resource_type = "raw" if is_pdf else "image"

    try:
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            content,
            folder="smarthire/marksheets_10th",
            public_id=f"marksheet10_{user_id}",
            resource_type=resource_type,
            overwrite=True,
            invalidate=True,
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Cloudinary 10th marksheet upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload 10th marksheet to cloud storage",
        )


async def upload_marksheet_12th(file: UploadFile, user_id: str) -> str:
    """Upload 12th standard marksheet to Cloudinary."""
    if not CLOUDINARY_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloud storage not configured",
        )

    content = await file.read()
    content_type = file.content_type or ""
    filename = file.filename or ""

    allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    is_pdf = content_type == "application/pdf" or filename.lower().endswith(".pdf")

    if content_type not in allowed_types and not filename.lower().endswith((".pdf", ".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, and PNG files are accepted")

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB}MB")

    if is_pdf and len(content) >= 4 and content[:4] != b"%PDF":
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    resource_type = "raw" if is_pdf else "image"

    try:
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            content,
            folder="smarthire/marksheets_12th",
            public_id=f"marksheet12_{user_id}",
            resource_type=resource_type,
            overwrite=True,
            invalidate=True,
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Cloudinary 12th marksheet upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload 12th marksheet to cloud storage",
        )


async def upload_aadhar_doc(file: UploadFile, user_id: str) -> str:
    """Upload Aadhar/Govt ID document to Cloudinary."""
    if not CLOUDINARY_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloud storage not configured",
        )

    content = await file.read()
    content_type = file.content_type or ""
    filename = file.filename or ""

    allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    is_pdf = content_type == "application/pdf" or filename.lower().endswith(".pdf")

    if content_type not in allowed_types and not filename.lower().endswith((".pdf", ".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, and PNG files are accepted")

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB}MB")

    if is_pdf and len(content) >= 4 and content[:4] != b"%PDF":
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    resource_type = "raw" if is_pdf else "image"

    try:
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            content,
            folder="smarthire/aadhar_docs",
            public_id=f"aadhar_{user_id}",
            resource_type=resource_type,
            overwrite=True,
            invalidate=True,
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Cloudinary Aadhar doc upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload Aadhar document to cloud storage",
        )


def delete_file(file_url: str) -> bool:
    """
    Delete a file from Cloudinary given its URL.
    Returns True if successful, False otherwise.
    Note: This is a sync function; call it from a thread or background task.
    """
    if not CLOUDINARY_ENABLED:
        return False

    try:
        # Extract public_id from Cloudinary URL
        # Format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{folder}/{public_id}.{ext}
        parts = file_url.split("/")
        if "cloudinary.com" not in file_url:
            return False

        # Find the public_id (everything after upload/)
        upload_idx = parts.index("upload")
        public_id_parts = parts[upload_idx + 2:]  # Skip version number
        public_id = "/".join(public_id_parts).rsplit(".", 1)[0]  # Remove extension

        # Determine resource type
        resource_type = "raw" if ("/resumes/" in file_url or "/marksheets/" in file_url) else "image"

        cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        logger.info(f"Deleted Cloudinary file: {public_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete Cloudinary file: {e}")
        return False
