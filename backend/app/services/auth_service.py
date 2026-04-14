"""
Auth service — Firebase Auth + Firestore.
Handles: OTP generation/validation, forgot-password token flow, password change.
"""
import asyncio
import random
import string
import uuid
import logging
from datetime import datetime, timezone, timedelta

from app.schemas.auth import UserResponse, ChangePasswordRequest, ResetPasswordRequest, ChangeEmailRequest, SendChangeEmailOtpRequest
from app.core.exceptions import NotFoundException
from app.db.helpers import serialize_doc, utcnow

logger = logging.getLogger(__name__)

_OTP_EXPIRY_MINUTES = 10
_RESET_TOKEN_EXPIRY_MINUTES = 30
_OTP_COLLECTION = "otp_tokens"
_RESET_COLLECTION = "password_reset_tokens"


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


class AuthService:
    def __init__(self, db):
        self.db = db

    async def get_me(self, user: dict) -> UserResponse:
        """Return the current user as a UserResponse."""
        doc = {}
        for k, v in user.items():
            if isinstance(v, datetime):
                doc[k] = v.isoformat()
            else:
                doc[k] = v
        return UserResponse(
            id=doc.get("id", ""),
            email=doc.get("email", ""),
            full_name=doc.get("full_name", ""),
            role=doc.get("role", ""),
            is_active=doc.get("is_active", True),
            created_at=doc.get("created_at"),
        )

    # ── OTP for Password Change ───────────────────────────────────────────────

    async def send_change_password_otp(
        self, current_user: dict, background_tasks=None
    ) -> dict:
        """
        Generate a 6-digit OTP, store it in Firestore, and email it to the user.
        Returns a message; the actual code is only sent via email.
        """
        from fastapi import HTTPException, status as http_status

        user_id = current_user.get("id")
        email = current_user.get("email")
        full_name = current_user.get("full_name", "User")
        if not user_id or not email:
            raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        # Rate-limit: check if an unexpired OTP already exists and was created < 60s ago
        doc_id = f"{user_id}_change_pwd"
        otp_ref = self.db.collection(_OTP_COLLECTION).document(doc_id)
        existing = await asyncio.to_thread(otp_ref.get)
        if existing.exists:
            ex_data = existing.to_dict() or {}
            created = ex_data.get("created_at")
            if created and isinstance(created, datetime):
                # Handle both timezone-aware and naive datetimes from Firestore
                if created.tzinfo is None:
                    created_aware = created.replace(tzinfo=timezone.utc)
                else:
                    created_aware = created
                age = (datetime.now(timezone.utc) - created_aware).total_seconds()
                if age < 60:
                    raise HTTPException(
                        status_code=http_status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Please wait 60 seconds before requesting a new code.",
                    )

        otp_code = _generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=_OTP_EXPIRY_MINUTES)

        await asyncio.to_thread(otp_ref.set, {
            "user_id": user_id,
            "email": email,
            "code": otp_code,
            "expires_at": expires_at,
            "created_at": utcnow(),
        })

        if background_tasks and email:
            from app.services.email_service import send_otp_email
            background_tasks.add_task(send_otp_email, email, full_name, otp_code)

        masked = email[:2] + "***" + email[email.index("@"):] if "@" in email else "***"
        return {"message": f"Verification code sent to {masked}"}

    async def change_password(
        self, current_user: dict, data: ChangePasswordRequest, background_tasks=None
    ) -> dict:
        """
        Validate OTP then change password via Firebase Admin SDK.
        OTP document is deleted after a successful change.
        """
        from fastapi import HTTPException, status as http_status
        from app.core.firebase_init import get_firebase_auth

        user_id = current_user.get("id")
        if not user_id:
            raise NotFoundException("User")

        # Validate OTP
        doc_id = f"{user_id}_change_pwd"
        otp_ref = self.db.collection(_OTP_COLLECTION).document(doc_id)
        otp_doc = await asyncio.to_thread(otp_ref.get)

        if not otp_doc.exists:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="No verification code found. Please request a new one.",
            )

        otp_data = otp_doc.to_dict() or {}
        expires_at = otp_data.get("expires_at")
        stored_code = otp_data.get("code", "")
        now = datetime.now(timezone.utc)

        # Check expiry
        if expires_at:
            exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
            if now > exp:
                await asyncio.to_thread(otp_ref.delete)
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="Verification code has expired. Please request a new one.",
                )

        # Validate code
        if data.otp_code != stored_code:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code.",
            )

        # Change password via Firebase Admin
        try:
            fb_auth = get_firebase_auth()
            await asyncio.to_thread(
                fb_auth.update_user, user_id, password=data.new_password
            )
        except Exception as e:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to update password: {str(e)}",
            )

        # Delete used OTP
        await asyncio.to_thread(otp_ref.delete)

        # Send confirmation email (non-fatal)
        if background_tasks and current_user.get("email"):
            from app.services.email_service import send_password_changed_email
            background_tasks.add_task(
                send_password_changed_email,
                current_user["email"],
                current_user.get("full_name", "User"),
            )

        return {"message": "Password changed successfully"}

    # ── OTP for Email Change ──────────────────────────────────────────────────

    async def send_change_email_otp(
        self, current_user: dict, new_email: str, background_tasks=None
    ) -> dict:
        """
        Generate a 6-digit OTP and email it to the NEW email address to verify ownership.
        Stores the OTP in Firestore under {user_id}_change_email.
        """
        from fastapi import HTTPException, status as http_status

        user_id = current_user.get("id")
        current_email = current_user.get("email", "")
        full_name = current_user.get("full_name", "User")
        if not user_id:
            raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        # Validate: new email must differ from current
        if new_email.lower() == current_email.lower():
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="New email is the same as your current email.",
            )

        # Check if new email is already taken by another user
        existing_users = await asyncio.to_thread(
            lambda: list(self.db.collection("users").where("email", "==", new_email).stream())
        )
        for u in existing_users:
            if u.id != user_id:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="This email address is already registered to another account.",
                )

        # Rate-limit: 60 seconds between requests
        doc_id = f"{user_id}_change_email"
        otp_ref = self.db.collection(_OTP_COLLECTION).document(doc_id)
        existing = await asyncio.to_thread(otp_ref.get)
        if existing.exists:
            ex_data = existing.to_dict() or {}
            created = ex_data.get("created_at")
            if created and isinstance(created, datetime):
                created_aware = created if created.tzinfo else created.replace(tzinfo=timezone.utc)
                age = (datetime.now(timezone.utc) - created_aware).total_seconds()
                if age < 60:
                    raise HTTPException(
                        status_code=http_status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Please wait 60 seconds before requesting a new code.",
                    )

        otp_code = _generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=_OTP_EXPIRY_MINUTES)

        await asyncio.to_thread(otp_ref.set, {
            "user_id": user_id,
            "current_email": current_email,
            "new_email": new_email,
            "code": otp_code,
            "expires_at": expires_at,
            "created_at": utcnow(),
        })

        if background_tasks:
            from app.services.email_service import send_otp_email
            background_tasks.add_task(send_otp_email, new_email, full_name, otp_code)

        masked = new_email[:2] + "***" + new_email[new_email.index("@"):] if "@" in new_email else "***"
        return {"message": f"Verification code sent to {masked}"}

    async def change_email(
        self, current_user: dict, data: ChangeEmailRequest, background_tasks=None
    ) -> dict:
        """
        Validate OTP then update email in Firebase Auth and Firestore users doc.
        """
        from fastapi import HTTPException, status as http_status
        from app.core.firebase_init import get_firebase_auth

        user_id = current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        doc_id = f"{user_id}_change_email"
        otp_ref = self.db.collection(_OTP_COLLECTION).document(doc_id)
        otp_doc = await asyncio.to_thread(otp_ref.get)

        if not otp_doc.exists:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="No verification code found. Please request a new one.",
            )

        otp_data = otp_doc.to_dict() or {}
        expires_at = otp_data.get("expires_at")
        stored_code = otp_data.get("code", "")
        stored_new_email = otp_data.get("new_email", "")
        now = datetime.now(timezone.utc)

        # Check expiry
        if expires_at:
            exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
            if now > exp:
                await asyncio.to_thread(otp_ref.delete)
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="Verification code has expired. Please request a new one.",
                )

        # Validate OTP code
        if data.otp_code != stored_code:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code.",
            )

        # Validate new_email matches what OTP was issued for
        if data.new_email.lower() != stored_new_email.lower():
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Email mismatch. Please restart the email change process.",
            )

        old_email = current_user.get("email", "")

        # Update Firebase Auth email
        try:
            fb_auth = get_firebase_auth()
            await asyncio.to_thread(fb_auth.update_user, user_id, email=data.new_email)
        except Exception as e:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to update email: {str(e)}",
            )

        # Update Firestore users doc
        user_ref = self.db.collection("users").document(user_id)
        await asyncio.to_thread(user_ref.update, {"email": data.new_email, "updated_at": utcnow()})

        # Delete used OTP
        await asyncio.to_thread(otp_ref.delete)

        return {"message": "Email updated successfully. Please log in again with your new email."}

    # ── Forgot Password (custom token flow) ──────────────────────────────────

    async def forgot_password(self, email: str, background_tasks=None) -> dict:
        """
        Generate a reset token, store in Firestore, send branded email.
        Always returns success to avoid revealing whether the email exists.
        """
        from app.core.firebase_init import get_firebase_auth
        from app.core.config import settings

        try:
            fb_auth = get_firebase_auth()
            firebase_user = await asyncio.to_thread(
                fb_auth.get_user_by_email, email
            )
            user_id = firebase_user.uid
            display_name = firebase_user.display_name or "User"
        except Exception:
            # User not found — return success silently (don't reveal email existence)
            logger.info("[forgot_password] Email not found: %s", email)
            return {"message": "If an account with that email exists, a reset link has been sent."}

        token = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=_RESET_TOKEN_EXPIRY_MINUTES)

        token_ref = self.db.collection(_RESET_COLLECTION).document(token)
        await asyncio.to_thread(token_ref.set, {
            "user_id": user_id,
            "email": email,
            "expires_at": expires_at,
            "created_at": utcnow(),
        })

        reset_url = f"{settings.APP_BASE_URL}/reset-password?token={token}"

        if background_tasks:
            from app.services.email_service import send_password_reset_link_email
            background_tasks.add_task(
                send_password_reset_link_email, email, display_name, reset_url
            )

        return {"message": "If an account with that email exists, a reset link has been sent."}

    async def reset_password_with_token(
        self, token: str, new_password: str, background_tasks=None
    ) -> dict:
        """
        Validate reset token, update password via Firebase Admin, delete the token.
        """
        from fastapi import HTTPException, status as http_status
        from app.core.firebase_init import get_firebase_auth

        token_ref = self.db.collection(_RESET_COLLECTION).document(token)
        token_doc = await asyncio.to_thread(token_ref.get)

        if not token_doc.exists:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset link. Please request a new one.",
            )

        token_data = token_doc.to_dict() or {}
        expires_at = token_data.get("expires_at")
        now = datetime.now(timezone.utc)

        if expires_at:
            exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
            if now > exp:
                await asyncio.to_thread(token_ref.delete)
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="This reset link has expired. Please request a new one.",
                )

        user_id = token_data.get("user_id")
        email = token_data.get("email", "")

        try:
            fb_auth = get_firebase_auth()
            await asyncio.to_thread(fb_auth.update_user, user_id, password=new_password)
        except Exception as e:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to reset password: {str(e)}",
            )

        # Delete used token
        await asyncio.to_thread(token_ref.delete)

        # Send confirmation email
        if background_tasks and email:
            try:
                fb_auth = get_firebase_auth()
                firebase_user = await asyncio.to_thread(fb_auth.get_user, user_id)
                full_name = firebase_user.display_name or "User"
            except Exception:
                full_name = "User"
            from app.services.email_service import send_password_changed_email
            background_tasks.add_task(send_password_changed_email, email, full_name)

        return {"message": "Password reset successfully. You can now log in with your new password."}
