"""
Feature 11 — In-App Notification endpoints
GET  /notifications            → list current user's notifications (paginated)
GET  /notifications/stream     → SSE stream for real-time push notifications
PATCH /notifications/{id}/read → mark one as read
PATCH /notifications/read-all  → mark all as read
"""
import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from app.services.notification_service import NotificationService
from app.middleware.auth import get_current_user
from app.db.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def get_notification_service(db=Depends(get_database)) -> NotificationService:
    return NotificationService(db)


@router.get("", response_model=dict)
async def list_notifications(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(30, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    """Return paginated notifications for the current user."""
    return await service.list_for_user(current_user["id"], page, limit)


# NOTE: /read-all must be defined BEFORE /{notification_id}/read to prevent
# FastAPI matching "read-all" as a notification_id path parameter.
@router.patch("/read-all", response_model=dict)
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    """Mark every unread notification for the current user as read."""
    return await service.mark_all_read(current_user["id"])


@router.patch("/{notification_id}/read", response_model=dict)
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    """Mark a single notification as read."""
    return await service.mark_read(notification_id, current_user["id"])


# ── SSE Stream ────────────────────────────────────────────────────────────────
# Polls Firestore every 30 seconds for new notifications created after the
# connection time.  On disconnect the generator exits cleanly.

@router.get("/stream")
async def notification_stream(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """SSE stream for real-time notification push (Firestore-backed)."""
    user_id = current_user["id"]
    # Extract raw token for periodic re-verification
    raw_token: str = request.headers.get("Authorization", "")[len("Bearer "):].strip()

    _TOKEN_RECHECK_INTERVAL = timedelta(minutes=15)

    async def event_generator():
        service = NotificationService(db)

        # Send initial connected event with current unread count
        try:
            initial = await service.list_for_user(user_id, page=1, limit=1)
            yield _sse_event("connected", {"unread_count": initial["unread_count"]})
        except Exception:
            yield _sse_event("connected", {"unread_count": 0})

        # Watermark: only send notifications created AFTER we connected
        last_check = datetime.now(timezone.utc)
        last_token_check = datetime.now(timezone.utc)
        ping_counter = 0

        while True:
            if await request.is_disconnected():
                logger.debug("[SSE] Client disconnected: user=%s", user_id)
                break

            # Re-verify token every 15 minutes to enforce expiry/revocation
            now = datetime.now(timezone.utc)
            if raw_token and (now - last_token_check) >= _TOKEN_RECHECK_INTERVAL:
                try:
                    import firebase_admin.auth as fb_auth
                    await asyncio.to_thread(
                        fb_auth.verify_id_token, raw_token, check_revoked=False
                    )
                    last_token_check = now
                    logger.debug("[SSE] Token re-verified for user=%s", user_id)
                except Exception as exc:
                    logger.info("[SSE] Token invalid/expired for user=%s: %s — closing stream", user_id, exc)
                    yield _sse_event("error", {"detail": "Token expired. Please reconnect."})
                    break

            try:
                # Query Firestore for notifications newer than last_check
                def _poll():
                    return (
                        db.collection("notifications")
                        .where("user_id", "==", user_id)
                        .where("created_at", ">", last_check)
                        .order_by("created_at")
                        .get()
                    )

                new_docs = await asyncio.to_thread(_poll)

                if new_docs:
                    last_check = new_docs[-1].to_dict().get("created_at", last_check)
                    for doc in new_docs:
                        data = doc.to_dict() or {}
                        created = data.get("created_at")
                        payload = {
                            "id": doc.id,
                            "user_id": data.get("user_id", ""),
                            "title": data.get("title", ""),
                            "message": data.get("message", ""),
                            "link": data.get("link"),
                            "read": data.get("read", False),
                            "created_at": created.isoformat() if hasattr(created, "isoformat") else str(created),
                        }
                        yield _sse_event("notification", payload)

                # Keepalive ping every ~90 s (every 3rd 30-second poll)
                ping_counter += 1
                if ping_counter >= 3:
                    ping_counter = 0
                    yield _sse_event("ping", {"ts": datetime.now(timezone.utc).isoformat()})

            except Exception as exc:
                logger.warning("[SSE] Poll error for user %s: %s", user_id, exc)

            await asyncio.sleep(30)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def _sse_event(event: str, data: dict) -> str:
    """Format a single Server-Sent Event frame."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
