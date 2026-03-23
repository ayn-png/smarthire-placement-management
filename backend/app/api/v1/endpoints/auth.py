import asyncio
from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr
from app.schemas.auth import UserResponse, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.services.auth_service import AuthService
from app.middleware.auth import get_current_user
from app.core.firebase_jwt import decode_firebase_token
from app.db.database import get_database
from app.core.config import settings
from app.core.enums import UserRole
from app.db.helpers import utcnow

_bearer = HTTPBearer()


async def _require_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    Lightweight auth dependency: verifies the Firebase ID token is valid and
    returns the decoded payload.  Does NOT require a Firestore user document —
    used for endpoints that are called before the Firestore doc is created
    (e.g. send-verification-email right after createUserWithEmailAndPassword).
    """
    payload = decode_firebase_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return payload


class FirebaseSyncRequest(BaseModel):
    firebase_uid: str
    email: EmailStr
    full_name: str
    role: UserRole


router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


def get_auth_service(db=Depends(get_database)) -> AuthService:
    return AuthService(db)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
):
    return await service.get_me(current_user)


@router.post("/logout")
async def logout(
    response: Response,
    current_user: dict = Depends(get_current_user),
):
    """Client should call Firebase signOut(). This endpoint just confirms logout."""
    return {"message": "Successfully logged out"}


class SendVerificationEmailRequest(BaseModel):
    email: EmailStr
    full_name: str


@router.post("/send-verification-email", status_code=200)
@limiter.limit("5/minute")
async def send_verification_email_endpoint(
    request: Request,
    data: SendVerificationEmailRequest,
    background_tasks: BackgroundTasks,
    _token: dict = Depends(_require_firebase_token),
):
    """
    Generate a Firebase Admin email verification link and send it as a branded email.
    Called by the frontend after createUserWithEmailAndPassword.
    Uses ActionCodeSettings so after clicking the link the user returns to our verify-email page.
    """
    try:
        from app.core.firebase_init import get_firebase_auth
        from app.services.email_service import send_email_verification
        import firebase_admin.auth as firebase_auth_admin

        fb_auth = get_firebase_auth()

        # Pass action_code_settings so Firebase redirects to our verify-email page after verification
        try:
            action_code_settings = firebase_auth_admin.ActionCodeSettings(
                url=f"{settings.APP_BASE_URL}/signup/verify-email",
                handle_code_in_app=False,
            )
            verification_link = await asyncio.to_thread(
                fb_auth.generate_email_verification_link,
                data.email,
                action_code_settings=action_code_settings,
            )
        except Exception:
            # Fallback: generate without continue URL
            verification_link = await asyncio.to_thread(
                fb_auth.generate_email_verification_link, data.email
            )

        background_tasks.add_task(
            send_email_verification,
            data.email,
            data.full_name,
            verification_link,
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"[send-verification-email] Failed: {e}")
        # Non-fatal — signup already succeeded

    return {"message": "Verification email queued"}


@router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
):
    """Change password for the currently logged-in user using OTP verification + Firebase Admin SDK."""
    return await service.change_password(current_user, data, background_tasks)


@router.post("/send-change-password-otp", status_code=200)
@limiter.limit("3/minute")
async def send_change_password_otp(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
):
    """Send a 6-digit OTP to the logged-in user's email for password-change verification."""
    return await service.send_change_password_otp(current_user, background_tasks)


@router.post("/forgot-password", status_code=200)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db=Depends(get_database),
):
    """Request a password reset link via email (no auth required)."""
    service = AuthService(db)
    return await service.forgot_password(data.email, background_tasks)


@router.post("/reset-password-confirm", status_code=200)
@limiter.limit("10/minute")
async def reset_password_confirm(
    request: Request,
    data: ResetPasswordRequest,
    background_tasks: BackgroundTasks,
    db=Depends(get_database),
):
    """Validate reset token and set new password (no auth required)."""
    service = AuthService(db)
    return await service.reset_password_with_token(data.token, data.new_password, background_tasks)


# ── Firebase Sync Endpoint ─────────────────────────────────────────────────────

@router.post("/firebase-sync", status_code=201)
async def firebase_sync(
    data: FirebaseSyncRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db=Depends(get_database),
):
    """
    Internal endpoint — called by Next.js /api/set-role after Firebase custom claim is set.
    Creates or updates the user document in Firestore, and creates company doc if role=COMPANY.
    """
    if request.headers.get("X-Internal-Secret") != settings.INTERNAL_API_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    now = utcnow()

    # Upsert user document (document ID = firebase_uid)
    user_ref = db.collection("users").document(data.firebase_uid)
    user_doc = await asyncio.to_thread(user_ref.get)

    user_data = {
        "email": data.email,
        "full_name": data.full_name,
        "role": data.role.value,
        "is_active": True,
        "updated_at": now,
    }

    is_new_user = not user_doc.exists
    if user_doc.exists:
        await asyncio.to_thread(user_ref.update, user_data)
    else:
        user_data["created_at"] = now
        await asyncio.to_thread(user_ref.set, user_data)

    # Send welcome email for new users (non-fatal)
    if is_new_user:
        from app.services.email_service import send_welcome_email
        background_tasks.add_task(
            send_welcome_email,
            data.email,
            data.full_name,
            data.role.value,
        )

    return {"message": "User synced successfully", "uid": data.firebase_uid}


# ── Admin User Management ─────────────────────────────────────────────────────

@router.get("/admin/users", response_model=dict)
async def list_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Admin-only: List all registered users with optional filters."""
    if current_user.get("role") not in [UserRole.PLACEMENT_ADMIN.value, UserRole.COLLEGE_MANAGEMENT.value]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    # Fetch all users from Firestore and filter in Python
    all_docs = await asyncio.to_thread(db.collection("users").get)
    users = []
    for doc in all_docs:
        u = {"id": doc.id, **doc.to_dict()}
        if role and u.get("role") != role:
            continue
        if is_active is not None and u.get("is_active", True) != is_active:
            continue
        u.pop("hashed_password", None)
        # Serialize datetime fields
        for k, v in u.items():
            if isinstance(v, datetime):
                u[k] = v.isoformat()
        users.append(u)

    # Sort by created_at descending
    users.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    total = len(users)
    skip = (page - 1) * limit
    paginated = users[skip: skip + limit]

    return {"users": paginated, "total": total, "page": page, "limit": limit}


@router.patch("/admin/users/{user_id}/activate", response_model=dict)
async def set_user_active(
    user_id: str,
    is_active: bool,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Admin-only: Activate or deactivate a user account."""
    if current_user.get("role") not in [UserRole.PLACEMENT_ADMIN.value, UserRole.COLLEGE_MANAGEMENT.value]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    user_ref = db.collection("users").document(user_id)
    user_doc = await asyncio.to_thread(user_ref.get)
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await asyncio.to_thread(
        user_ref.update, {"is_active": is_active, "updated_at": utcnow()}
    )

    action = "activated" if is_active else "deactivated"
    return {"message": f"User {action} successfully", "user_id": user_id, "is_active": is_active}


@router.patch("/admin/users/{user_id}/role", response_model=dict)
async def update_user_role(
    user_id: str,
    role: UserRole,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """Admin-only: Update a user's role."""
    if current_user.get("role") not in [UserRole.PLACEMENT_ADMIN.value]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Placement Admin access required")

    if current_user.get("id") == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own role")

    user_ref = db.collection("users").document(user_id)
    user_doc = await asyncio.to_thread(user_ref.get)
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await asyncio.to_thread(
        user_ref.update, {"role": role.value, "updated_at": utcnow()}
    )

    # Also update Firebase custom claim
    try:
        from app.core.firebase_init import get_firebase_auth
        fb_auth = get_firebase_auth()
        await asyncio.to_thread(
            fb_auth.set_custom_user_claims, user_id, {"role": role.value}
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to update Firebase custom claim for {user_id}: {e}")

    return {"message": f"User role updated to {role.value}", "user_id": user_id, "role": role.value}
