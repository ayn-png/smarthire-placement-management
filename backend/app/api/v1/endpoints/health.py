from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from app.db.database import get_database
from app.core.config import settings
import logging
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.
    Returns 200 OK if service is running.
    """
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/detailed")
async def detailed_health_check(db=Depends(get_database)):
    """
    Detailed health check with dependency validation.
    Checks database connectivity and critical service configuration.
    Returns 503 if any critical dependency is unavailable.
    """
    health_status = {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {}
    }

    is_healthy = True

    # Check Firestore connectivity
    try:
        import asyncio
        # Test Firestore by reading a dummy document
        test_ref = db.collection("_health_check").document("test")
        test_doc = await asyncio.to_thread(test_ref.get)
        health_status["services"]["firestore"] = {
            "status": "healthy",
            "message": "Firestore connected"
        }
    except Exception as e:
        is_healthy = False
        health_status["services"]["firestore"] = {
            "status": "unhealthy",
            "message": f"Firestore connection failed: {str(e)}"
        }
        logger.error(f"Health check: Firestore ping failed - {e}")

    # Check OpenAI API configuration
    if settings.OPENAI_API_KEY:
        health_status["services"]["openai"] = {
            "status": "configured",
            "message": "OpenAI API key configured"
        }
    else:
        health_status["services"]["openai"] = {
            "status": "not_configured",
            "message": "OpenAI API key not set - resume analysis unavailable"
        }

    # Check Mistral API configuration
    if settings.MISTRAL_API_KEY:
        health_status["services"]["mistral"] = {
            "status": "configured",
            "message": "Mistral API key configured"
        }
    else:
        health_status["services"]["mistral"] = {
            "status": "not_configured",
            "message": "Mistral API key not set - mock interview unavailable"
        }

    # Check Cloudinary configuration
    if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY:
        health_status["services"]["cloudinary"] = {
            "status": "configured",
            "message": "Cloudinary configured"
        }
    else:
        health_status["services"]["cloudinary"] = {
            "status": "not_configured",
            "message": "Cloudinary not fully configured - file uploads may fail"
        }

    # Check Firebase Auth configuration
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON or settings.FIREBASE_SERVICE_ACCOUNT_PATH:
        try:
            from app.core.firebase_init import get_firebase_app
            get_firebase_app()
            health_status["services"]["firebase_auth"] = {
                "status": "configured",
                "message": f"Firebase Auth configured (project: {settings.FIREBASE_PROJECT_ID})"
            }
        except Exception as e:
            is_healthy = False
            health_status["services"]["firebase_auth"] = {
                "status": "misconfigured",
                "message": f"Firebase Auth initialization failed: {str(e)}"
            }
    else:
        is_healthy = False
        health_status["services"]["firebase_auth"] = {
            "status": "misconfigured",
            "message": "Firebase credentials not set - authentication will fail"
        }

    # Check Sentry error tracking
    if settings.SENTRY_DSN:
        health_status["services"]["sentry"] = {
            "status": "configured",
            "message": "Sentry error tracking enabled"
        }
    else:
        health_status["services"]["sentry"] = {
            "status": "not_configured",
            "message": "Sentry not configured - errors won't be tracked"
        }

    # Set overall status
    if not is_healthy:
        health_status["status"] = "unhealthy"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=health_status
        )

    return health_status


@router.get("/health/ready")
async def readiness_check(db=Depends(get_database)):
    """
    Kubernetes-style readiness probe.
    Returns 200 if service is ready to accept traffic.
    Returns 503 if service is not ready.
    """
    try:
        import asyncio
        # Check Firestore is reachable
        test_ref = db.collection("_health_check").document("test")
        await asyncio.to_thread(test_ref.get)

        # Check critical configuration
        if not settings.FIREBASE_SERVICE_ACCOUNT_JSON and not settings.FIREBASE_SERVICE_ACCOUNT_PATH:
            raise Exception("Firebase credentials not configured")

        # Verify Firebase app can be initialized
        from app.core.firebase_init import get_firebase_app
        get_firebase_app()

        return {"ready": True}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ready": False, "reason": str(e)}
        )


@router.get("/health/live")
async def liveness_check():
    """
    Kubernetes-style liveness probe.
    Returns 200 if service is alive (process is running).
    This endpoint should never fail unless the process is dead.
    """
    return {"alive": True}
