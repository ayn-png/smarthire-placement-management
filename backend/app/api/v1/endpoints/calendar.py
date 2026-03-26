"""
Feature 6 — Google Calendar Integration
Allows students to sync their scheduled interviews to Google Calendar.

Setup:
1. Create OAuth 2.0 credentials in Google Cloud Console with scope:
   https://www.googleapis.com/auth/calendar.events
2. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI in backend/.env
3. Enable Google Calendar API in the Cloud Console
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import asyncio
import logging

from app.middleware.auth import get_current_user, require_student
from app.db.database import get_database
from app.core.config import settings
from app.db.helpers import utcnow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["Calendar"])


def _google_configured() -> bool:
    return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)


class AddEventRequest(BaseModel):
    application_id: str
    timezone: Optional[str] = "Asia/Kolkata"


@router.get("/google/auth-url")
async def get_google_auth_url(
    current_user: dict = Depends(require_student),
):
    """Return the Google OAuth URL so the frontend can redirect the user."""
    if not _google_configured():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google Calendar integration is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
        )
    try:
        from google_auth_oauthlib.flow import Flow  # type: ignore
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                    "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [settings.GOOGLE_OAUTH_REDIRECT_URI],
                }
            },
            scopes=["https://www.googleapis.com/auth/calendar.events"],
        )
        flow.redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            state=current_user["id"],
            prompt="consent",
        )
        return {"auth_url": auth_url}
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="google-auth-oauthlib is not installed. Run: pip install google-auth-oauthlib",
        )


class CallbackRequest(BaseModel):
    code: str


@router.post("/google/callback")
async def google_calendar_callback(
    data: CallbackRequest,
    current_user: dict = Depends(require_student),
    db=Depends(get_database),
):
    """Exchange auth code for tokens and store refresh_token in Firestore."""
    if not _google_configured():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google Calendar integration is not configured.",
        )
    try:
        from google_auth_oauthlib.flow import Flow  # type: ignore

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                    "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [settings.GOOGLE_OAUTH_REDIRECT_URI],
                }
            },
            scopes=["https://www.googleapis.com/auth/calendar.events"],
        )
        flow.redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI
        flow.fetch_token(code=data.code)
        credentials = flow.credentials

        # Store refresh token in Firestore user doc
        refresh_token = credentials.refresh_token
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No refresh token received. Please revoke access and try again.",
            )

        user_id = current_user["id"]

        def _save_token():
            db.collection("users").document(user_id).update({
                "google_calendar_token": refresh_token,
                "google_calendar_connected_at": utcnow().isoformat(),
            })

        await asyncio.to_thread(_save_token)
        return {"connected": True, "message": "Google Calendar connected successfully"}

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="google-auth-oauthlib is not installed.",
        )
    except Exception as exc:
        logger.error("Google Calendar callback error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect Google Calendar: {str(exc)}",
        )


@router.post("/google/add-event")
async def add_interview_to_google_calendar(
    data: AddEventRequest,
    current_user: dict = Depends(require_student),
    db=Depends(get_database),
):
    """Create a Google Calendar event for a scheduled interview."""
    if not _google_configured():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google Calendar integration is not configured.",
        )

    user_id = current_user["id"]

    # Get stored refresh token
    def _get_user_and_app():
        user_doc = db.collection("users").document(user_id).get()
        app_doc = db.collection("applications").document(data.application_id).get()
        return user_doc.to_dict() if user_doc.exists else {}, app_doc.to_dict() if app_doc.exists else None

    user_data, app_data = await asyncio.to_thread(_get_user_and_app)

    refresh_token = user_data.get("google_calendar_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar not connected. Please connect it first.",
        )
    if not app_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    if app_data.get("status") != "INTERVIEW_SCHEDULED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No interview scheduled for this application",
        )

    interview_date_str = app_data.get("interview_date")
    if not interview_date_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No interview date set for this application",
        )

    # Parse interview date
    from datetime import datetime, timedelta
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            start_dt = datetime.strptime(interview_date_str.rstrip("Z").split(".")[0], fmt)
            break
        except ValueError:
            continue
    else:
        raise HTTPException(status_code=400, detail="Invalid interview_date format")

    end_dt = start_dt + timedelta(hours=1)

    # Get company name
    company_name = app_data.get("company_name", "")
    if not company_name and app_data.get("job_id"):
        def _get_job():
            j = db.collection("jobs").document(app_data["job_id"]).get()
            if j.exists:
                jd = j.to_dict()
                c = db.collection("companies").document(jd.get("company_id", "")).get()
                return c.to_dict().get("name", "") if c.exists else ""
            return ""
        company_name = await asyncio.to_thread(_get_job)

    interview_type = app_data.get("interview_type", "")
    interview_link = app_data.get("interview_link", "")
    interview_location = app_data.get("interview_location", "")
    job_title = app_data.get("job_title", "")

    description_parts = [f"Job: {job_title}"] if job_title else []
    if interview_type:
        description_parts.append(f"Type: {interview_type}")
    if interview_link:
        description_parts.append(f"Join link: {interview_link}")
    if interview_location:
        description_parts.append(f"Location: {interview_location}")

    try:
        from google.oauth2.credentials import Credentials  # type: ignore
        from googleapiclient.discovery import build  # type: ignore

        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_OAUTH_CLIENT_ID,
            client_secret=settings.GOOGLE_OAUTH_CLIENT_SECRET,
            scopes=["https://www.googleapis.com/auth/calendar.events"],
        )

        def _create_event():
            service = build("calendar", "v3", credentials=creds)
            event = {
                "summary": f"Interview at {company_name}" if company_name else "Interview",
                "description": "\n".join(description_parts),
                "start": {
                    "dateTime": start_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                    "timeZone": data.timezone,
                },
                "end": {
                    "dateTime": end_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                    "timeZone": data.timezone,
                },
                "reminders": {
                    "useDefault": False,
                    "overrides": [
                        {"method": "popup", "minutes": 60},
                        {"method": "popup", "minutes": 15},
                    ],
                },
            }
            created = service.events().insert(calendarId="primary", body=event).execute()
            return created

        created_event = await asyncio.to_thread(_create_event)
        return {
            "event_id": created_event["id"],
            "event_url": created_event.get("htmlLink"),
            "message": "Interview added to Google Calendar",
        }

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="google-api-python-client is not installed. Run: pip install google-api-python-client google-auth",
        )
    except Exception as exc:
        logger.error("Google Calendar add-event error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Google Calendar event: {str(exc)}",
        )


@router.delete("/google/disconnect")
async def disconnect_google_calendar(
    current_user: dict = Depends(require_student),
    db=Depends(get_database),
):
    """Remove stored Google Calendar tokens from Firestore."""
    user_id = current_user["id"]

    def _remove_token():
        db.collection("users").document(user_id).update({
            "google_calendar_token": None,
            "google_calendar_connected_at": None,
        })

    await asyncio.to_thread(_remove_token)
    return {"disconnected": True, "message": "Google Calendar disconnected"}


@router.get("/google/status")
async def google_calendar_status(
    current_user: dict = Depends(require_student),
    db=Depends(get_database),
):
    """Check if the student has Google Calendar connected."""
    user_id = current_user["id"]

    def _get_status():
        doc = db.collection("users").document(user_id).get()
        if not doc.exists:
            return False, None
        data = doc.to_dict() or {}
        return bool(data.get("google_calendar_token")), data.get("google_calendar_connected_at")

    connected, connected_at = await asyncio.to_thread(_get_status)
    return {
        "connected": connected,
        "connected_at": connected_at,
        "configured": _google_configured(),
    }
