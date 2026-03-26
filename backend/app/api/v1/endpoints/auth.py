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
from app.core.exceptions import CredentialsException
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
    PLACEMENT_ADMIN accounts are set to PENDING approval until approved by portal owner.
    """
    if request.headers.get("X-Internal-Secret") != settings.INTERNAL_API_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    now = utcnow()
    is_admin_role = data.role in [UserRole.PLACEMENT_ADMIN, UserRole.COLLEGE_MANAGEMENT]

    # Handle admin role requests — create pending admin_requests doc, store user as STUDENT pending approval
    if is_admin_role:
        # Duplicate guard: don't overwrite already-approved or deleted users
        existing_req = await asyncio.to_thread(
            db.collection("admin_requests").document(data.firebase_uid).get
        )
        if existing_req.exists:
            existing_status = (existing_req.to_dict() or {}).get("status", "")
            if existing_status in ("approved", "deleted"):
                return {"message": "admin_request_exists", "status": existing_status}

        admin_request_doc = {
            "userId": data.firebase_uid,
            "email": data.email,
            "full_name": data.full_name,
            "requestedRole": data.role.value,
            "status": "pending",
            "createdAt": now,
            "approvedBy": None,
            "approvedAt": None,
        }
        await asyncio.to_thread(
            db.collection("admin_requests").document(data.firebase_uid).set,
            admin_request_doc,
        )

        user_doc = {
            "email": data.email,
            "full_name": data.full_name,
            "role": "STUDENT",
            "isVerifiedAdmin": False,
            "is_active": False,
            "created_at": now,
            "updated_at": now,
        }
        await asyncio.to_thread(
            db.collection("users").document(data.firebase_uid).set,
            user_doc,
        )

        # Also write to legacy admin_approval_requests for backward compat
        import secrets as _secrets
        approval_ref = db.collection("admin_approval_requests").document(data.firebase_uid)
        approval_doc = await asyncio.to_thread(approval_ref.get)
        if not approval_doc.exists:
            approval_token = _secrets.token_urlsafe(32)
            await asyncio.to_thread(approval_ref.set, {
                "user_id": data.firebase_uid,
                "email": data.email,
                "full_name": data.full_name,
                "requested_at": now,
                "status": "PENDING",
                "reviewed_at": None,
                "reviewed_by": None,
                "rejection_reason": None,
                "approval_token": approval_token,
            })
        else:
            existing_data = approval_doc.to_dict() or {}
            approval_token = existing_data.get("approval_token") or _secrets.token_urlsafe(32)
            if not existing_data.get("approval_token"):
                await asyncio.to_thread(approval_ref.update, {"approval_token": approval_token})

        # Build one-click verify URL pointing to the backend
        _base_url = str(request.base_url).rstrip("/")
        verify_url = f"{_base_url}/api/v1/auth/admin-requests/{data.firebase_uid}/verify?token={approval_token}"

        # Notify portal owner (non-fatal)
        if settings.OWNER_EMAIL:
            from app.services.email_service import send_admin_approval_request_to_owner
            background_tasks.add_task(
                send_admin_approval_request_to_owner,
                settings.OWNER_EMAIL,
                data.full_name,
                data.email,
                verify_url,
            )

        return {"message": "admin_request_created", "status": "pending"}

    # ── Non-admin roles (STUDENT, COMPANY, etc.) ──────────────────────────────

    # Upsert user document (document ID = firebase_uid)
    user_ref = db.collection("users").document(data.firebase_uid)
    user_doc = await asyncio.to_thread(user_ref.get)

    user_data = {
        "email": data.email,
        "full_name": data.full_name,
        "role": data.role.value,
        "is_active": True,
        "approval_status": "APPROVED",
        "updated_at": now,
    }

    is_new_user = not user_doc.exists
    if user_doc.exists:
        await asyncio.to_thread(user_ref.update, user_data)
    else:
        user_data["created_at"] = now
        await asyncio.to_thread(user_ref.set, user_data)

    # Welcome email for new non-admin users (non-fatal)
    if is_new_user:
        from app.services.email_service import send_welcome_email
        background_tasks.add_task(
            send_welcome_email,
            data.email,
            data.full_name,
            data.role.value,
        )

    return {"message": "User synced successfully", "uid": data.firebase_uid, "approval_status": "APPROVED"}


# ── Self-Sync ─────────────────────────────────────────────────────────────────

@router.post("/self-sync", status_code=200)
async def self_sync_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db=Depends(get_database),
):
    """
    Self-healing endpoint called by the frontend when any authenticated request
    returns 401, meaning the Firestore users/{uid} document is missing.

    This happens when /api/set-role called /auth/firebase-sync but the request
    failed silently (e.g. INTERNAL_API_SECRET mismatch → 403, or backend was
    temporarily down). The user has a valid Firebase account + custom role claim
    but no matching Firestore document, so every protected endpoint returns 401.

    This endpoint verifies the Firebase ID token directly (bypassing the normal
    require_student middleware that needs the doc to already exist), reads the
    role from the token's custom claims, and upserts the users/{uid} document.
    """
    payload = decode_firebase_token(credentials.credentials)
    if not payload:
        raise CredentialsException()

    uid = payload.get("uid")
    role_claim = payload.get("role")
    if not uid or not role_claim:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token is missing the role custom claim. Please complete role selection at /signup/role-select.",
        )

    user_ref = db.collection("users").document(uid)
    user_doc = await asyncio.to_thread(user_ref.get)

    # Block admin roles that haven't been verified by super admin yet
    if user_doc.exists:
        user_data = user_doc.to_dict() or {}
        role_in_db = user_data.get("role", "")
        if role_in_db in ["PLACEMENT_ADMIN", "COLLEGE_MANAGEMENT"]:
            if not user_data.get("isVerifiedAdmin", False):
                raise HTTPException(
                    status_code=403,
                    detail="Account pending approval by portal owner",
                )

    if not user_doc.exists:
        now = utcnow()
        await asyncio.to_thread(user_ref.set, {
            "email": payload.get("email", ""),
            "full_name": payload.get("name", payload.get("email", "")),
            "role": role_claim,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })

    return {"message": "synced", "uid": uid, "role": role_claim}


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


# ── Admin Approval Requests ────────────────────────────────────────────────────

class AdminApprovalRejectRequest(BaseModel):
    reason: Optional[str] = None


@router.get("/admin-requests", response_model=dict)
async def list_admin_requests(
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """COLLEGE_MANAGEMENT only: List placement admin approval requests."""
    if current_user.get("role") != UserRole.COLLEGE_MANAGEMENT.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="College Management access required")

    docs = await asyncio.to_thread(db.collection("admin_approval_requests").get)
    requests = []
    for doc in docs:
        r = {"id": doc.id, **doc.to_dict()}
        for k, v in list(r.items()):
            if isinstance(v, datetime):
                r[k] = v.isoformat()
        if status_filter and r.get("status") != status_filter:
            continue
        requests.append(r)

    requests.sort(key=lambda x: x.get("requested_at", ""), reverse=True)
    total = len(requests)
    skip = (page - 1) * limit
    return {"requests": requests[skip: skip + limit], "total": total, "page": page, "limit": limit}


@router.patch("/admin-requests/{user_id}/approve", response_model=dict)
async def approve_admin_request(
    user_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """COLLEGE_MANAGEMENT only: Approve a placement admin account."""
    if current_user.get("role") != UserRole.COLLEGE_MANAGEMENT.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="College Management access required")

    user_ref = db.collection("users").document(user_id)
    user_doc = await asyncio.to_thread(user_ref.get)
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    now = utcnow()
    await asyncio.to_thread(user_ref.update, {
        "approval_status": "APPROVED",
        "is_active": True,
        "approval_reviewed_at": now,
        "approval_reviewed_by": current_user.get("id"),
        "updated_at": now,
    })

    # Update approval request doc
    req_ref = db.collection("admin_approval_requests").document(user_id)
    await asyncio.to_thread(req_ref.update, {
        "status": "APPROVED",
        "reviewed_at": now,
        "reviewed_by": current_user.get("id"),
    })

    # Re-assert Firebase custom claim
    try:
        from app.core.firebase_init import get_firebase_auth
        fb_auth = get_firebase_auth()
        await asyncio.to_thread(
            fb_auth.set_custom_user_claims, user_id, {"role": UserRole.PLACEMENT_ADMIN.value}
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to set custom claim for {user_id}: {e}")

    # Send approval email
    user_data = user_doc.to_dict() or {}
    from app.services.email_service import send_admin_approved_email
    background_tasks.add_task(send_admin_approved_email, user_data.get("email", ""), user_data.get("full_name", ""))

    return {"message": "Admin approved successfully", "user_id": user_id}


@router.patch("/admin-requests/{user_id}/reject", response_model=dict)
async def reject_admin_request(
    user_id: str,
    data: AdminApprovalRejectRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """COLLEGE_MANAGEMENT only: Reject a placement admin account request."""
    if current_user.get("role") != UserRole.COLLEGE_MANAGEMENT.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="College Management access required")

    user_ref = db.collection("users").document(user_id)
    user_doc = await asyncio.to_thread(user_ref.get)
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    now = utcnow()
    await asyncio.to_thread(user_ref.update, {
        "approval_status": "REJECTED",
        "is_active": False,
        "rejection_reason": data.reason,
        "approval_reviewed_at": now,
        "approval_reviewed_by": current_user.get("id"),
        "updated_at": now,
    })

    await asyncio.to_thread(db.collection("admin_approval_requests").document(user_id).update, {
        "status": "REJECTED",
        "rejection_reason": data.reason,
        "reviewed_at": now,
        "reviewed_by": current_user.get("id"),
    })

    # Send rejection email
    user_data = user_doc.to_dict() or {}
    from app.services.email_service import send_admin_rejected_email
    background_tasks.add_task(
        send_admin_rejected_email,
        user_data.get("email", ""),
        user_data.get("full_name", ""),
        data.reason or "No reason provided",
    )

    return {"message": "Admin request rejected", "user_id": user_id}


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


# ── Email-Based Admin Verification (public, no auth) ──────────────────────────

def _html_page(title: str, body: str, ok: bool = True) -> str:
    """Return a simple HTML page for the email-based verify endpoint."""
    color = "#22c55e" if ok else "#ef4444"
    icon = "&#10003;" if ok else "&#10007;"
    return (
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
        f"<title>{title}</title>"
        "<style>"
        "body{font-family:system-ui,sans-serif;display:flex;align-items:center;"
        "justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f8fafc}"
        ".card{background:#1e293b;border-radius:16px;padding:48px 40px;max-width:500px;"
        "width:90%;text-align:center;border:1px solid #334155;box-shadow:0 20px 60px #0004}"
        f"h1{{color:{color};font-size:1.5rem;margin:12px 0}}"
        "p{color:#94a3b8;line-height:1.6;margin:8px 0}"
        ".icon{font-size:3.5rem;margin-bottom:4px}"
        "</style></head>"
        f"<body><div class=\"card\"><div class=\"icon\">{icon}</div>"
        f"<h1>{title}</h1><p>{body}</p></div></body></html>"
    )


@router.get("/admin-requests/{user_id}/verify")
async def verify_admin_by_email(
    user_id: str,
    token: str,
    background_tasks: BackgroundTasks,
    db=Depends(get_database),
):
    """
    Public (no auth) endpoint embedded in the owner approval email.
    Validates the one-time token, approves the admin, returns HTML confirmation.
    """
    from fastapi.responses import HTMLResponse

    req_ref = db.collection("admin_approval_requests").document(user_id)
    req_doc = await asyncio.to_thread(req_ref.get)

    if not req_doc.exists:
        return HTMLResponse(
            _html_page("Not Found", "No approval request found for this account.", ok=False),
            status_code=404,
        )

    req_data = req_doc.to_dict() or {}

    # Already approved — idempotent
    if req_data.get("status") == "APPROVED":
        admin_name = req_data.get("full_name", "This admin")
        return HTMLResponse(
            _html_page("Already Approved", f"{admin_name} is already approved and can log in."),
            status_code=200,
        )

    # Validate one-time token
    stored_token = req_data.get("approval_token", "")
    if not stored_token or stored_token != token:
        return HTMLResponse(
            _html_page(
                "Invalid or Expired Link",
                "This verification link is invalid or has already been used.<br>"
                "Please contact the admin if you need a new link.",
                ok=False,
            ),
            status_code=403,
        )

    # Approve the account
    now = utcnow()
    user_ref = db.collection("users").document(user_id)
    user_doc_snap = await asyncio.to_thread(user_ref.get)
    if not user_doc_snap.exists:
        return HTMLResponse(
            _html_page("User Not Found", "The user account no longer exists.", ok=False),
            status_code=404,
        )

    await asyncio.to_thread(user_ref.update, {
        "approval_status": "APPROVED",
        "is_active": True,
        "approval_reviewed_at": now,
        "updated_at": now,
    })
    # Invalidate the token after use
    await asyncio.to_thread(req_ref.update, {
        "status": "APPROVED",
        "reviewed_at": now,
        "approval_token": None,
    })

    # Set Firebase custom claim so the admin can log in
    try:
        from app.core.firebase_init import get_firebase_auth
        fb_auth = get_firebase_auth()
        await asyncio.to_thread(
            fb_auth.set_custom_user_claims, user_id, {"role": UserRole.PLACEMENT_ADMIN.value}
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("verify_admin: claim set failed for %s: %s", user_id, exc)

    # Send confirmation email to the newly approved admin
    from app.services.email_service import send_admin_approved_email
    background_tasks.add_task(
        send_admin_approved_email,
        req_data.get("email", ""),
        req_data.get("full_name", ""),
    )

    admin_name = req_data.get("full_name", "The admin")
    admin_email = req_data.get("email", "")
    return HTMLResponse(
        _html_page(
            "Account Approved!",
            f"<strong>{admin_name}</strong> ({admin_email}) has been approved.<br>"
            "They will receive a confirmation email and can now log in to SmartHire.",
        ),
        status_code=200,
    )


# ── Super Admin Endpoints ────────────────────────────────────────────────────

def _check_super_admin_secret(request: Request):
    """Verify the X-Super-Admin-Secret header matches the configured secret."""
    if request.headers.get("X-Super-Admin-Secret") != settings.SUPER_ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/super-admin/requests")
async def list_super_admin_requests(
    request: Request,
    status_filter: str = "pending",
    db=Depends(get_database),
):
    """List admin_requests — super admin only (X-Super-Admin-Secret header required)."""
    _check_super_admin_secret(request)
    docs = await asyncio.to_thread(
        lambda: list(db.collection("admin_requests").where("status", "==", status_filter).stream())
    )

    def _serialize(d):
        row = {"id": d.id, **d.to_dict()}
        for k, v in row.items():
            if isinstance(v, datetime):
                row[k] = v.isoformat()
        return row

    return {"requests": [_serialize(d) for d in docs]}


@router.post("/super-admin/requests/{user_id}/approve")
async def super_admin_approve_request(
    user_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db=Depends(get_database),
):
    """Approve an admin request — super admin only."""
    _check_super_admin_secret(request)
    body = await request.json()
    requested_role = body.get("requestedRole", "PLACEMENT_ADMIN")
    now = utcnow()

    from app.core.firebase_init import get_firebase_auth
    from app.services.email_service import send_admin_approved_email
    fb_auth = get_firebase_auth()

    # Set Firebase custom claim to the actual requested role
    await asyncio.to_thread(fb_auth.set_custom_user_claims, user_id, {"role": requested_role})

    # Update user doc
    await asyncio.to_thread(db.collection("users").document(user_id).update, {
        "role": requested_role,
        "isVerifiedAdmin": True,
        "is_active": True,
        "updated_at": now,
    })

    # Fetch request data for email
    req_doc = await asyncio.to_thread(db.collection("admin_requests").document(user_id).get)
    req_data = req_doc.to_dict() or {} if req_doc.exists else {}

    # Update admin_requests doc
    await asyncio.to_thread(db.collection("admin_requests").document(user_id).update, {
        "status": "approved",
        "approvedBy": "super_admin",
        "approvedAt": now,
    })

    background_tasks.add_task(
        send_admin_approved_email,
        req_data.get("email", ""),
        req_data.get("full_name", ""),
    )
    return {"message": "approved", "user_id": user_id}


@router.post("/super-admin/requests/{user_id}/reject")
async def super_admin_reject_request(
    user_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db=Depends(get_database),
):
    """Reject an admin request — super admin only."""
    _check_super_admin_secret(request)
    body = await request.json()
    reason = body.get("reason", "")
    now = utcnow()

    from app.services.email_service import send_admin_rejected_email

    # Fetch request data for email
    req_doc = await asyncio.to_thread(db.collection("admin_requests").document(user_id).get)
    req_data = req_doc.to_dict() or {} if req_doc.exists else {}

    # Update admin_requests doc
    await asyncio.to_thread(db.collection("admin_requests").document(user_id).update, {
        "status": "rejected",
        "approvedBy": "super_admin",
        "approvedAt": now,
        "rejectionReason": reason,
    })

    # Mark user inactive
    await asyncio.to_thread(db.collection("users").document(user_id).update, {
        "is_active": False,
        "updated_at": now,
    })

    background_tasks.add_task(
        send_admin_rejected_email,
        req_data.get("email", ""),
        req_data.get("full_name", ""),
        reason,
    )
    return {"message": "rejected", "user_id": user_id}


@router.delete("/super-admin/requests/{user_id}")
async def super_admin_delete_user(
    user_id: str,
    request: Request,
    db=Depends(get_database),
):
    """Delete an admin user — removes from Firebase Auth and Firestore. Super admin only."""
    _check_super_admin_secret(request)

    # 1. Delete from Firebase Auth (non-fatal if user doesn't exist)
    try:
        from app.core.firebase_init import get_firebase_auth
        fb_auth = get_firebase_auth()
        await asyncio.to_thread(fb_auth.delete_user, user_id)
    except Exception:
        pass  # User may not exist in Firebase Auth; continue cleanup

    # 2. Delete Firestore user doc
    await asyncio.to_thread(db.collection("users").document(user_id).delete)

    # 3. Mark admin_requests as "deleted" (keep for audit trail)
    try:
        await asyncio.to_thread(
            db.collection("admin_requests").document(user_id).update,
            {"status": "deleted", "deletedAt": utcnow()},
        )
    except Exception:
        pass  # Doc may not exist; non-fatal

    return {"message": "deleted", "user_id": user_id}
