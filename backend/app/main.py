from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
import os
import logging
from logging.handlers import RotatingFileHandler
import time
import uuid
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.api.v1 import api_router

# Configure logging with rotation (100MB per file, 10 backups)
log_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

# File handler with rotation
os.makedirs("logs", exist_ok=True)
file_handler = RotatingFileHandler(
    "logs/app.log",
    maxBytes=100 * 1024 * 1024,  # 100MB
    backupCount=10
)
file_handler.setFormatter(log_formatter)

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    handlers=[console_handler, file_handler]
)
logger = logging.getLogger(__name__)

# Initialize Sentry error tracking (if configured)
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.SENTRY_ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            integrations=[
                StarletteIntegration(),
                FastApiIntegration(),
            ],
        )
        logger.info(f"Sentry error tracking enabled (env: {settings.SENTRY_ENVIRONMENT})")
    except ImportError:
        logger.warning("Sentry DSN configured but sentry-sdk not installed. Run: pip install sentry-sdk")
else:
    logger.info("Sentry error tracking disabled (no DSN configured)")

# Rate limiter configuration
limiter = Limiter(key_func=get_remote_address)


# Request Logging Middleware
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.time()
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} - "
            f"Client: {request.client.host if request.client else 'unknown'}"
        )

        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error(f"[{request_id}] Unhandled exception: {exc}", exc_info=True)
            response = JSONResponse({"detail": "Internal server error"}, status_code=500)

        duration = time.time() - start_time
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} - "
            f"Status: {response.status_code} - Duration: {duration:.3f}s"
        )

        response.headers["X-Request-ID"] = request_id
        return response


# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error(f"Unhandled exception in security middleware: {exc}", exc_info=True)
            response = JSONResponse({"detail": "Internal server error"}, status_code=500)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — Initialize Firebase Admin SDK
    try:
        from app.core.firebase_init import get_firebase_app
        get_firebase_app()
        logger.info("Firebase Admin SDK initialized — Firestore ready")
    except Exception as e:
        logger.error(f"Firebase initialization failed: {e}")
        logger.error("Ensure firebase-service-account.json exists or FIREBASE_SERVICE_ACCOUNT_JSON is set")
        raise

    # Initialize LangSmith configuration for Multi-Agent System
    from app.core.langsmith_config import langsmith_config
    if langsmith_config["enabled"]:
        logger.info(f"LangSmith tracing enabled for project: {langsmith_config['project']}")
    else:
        logger.info("LangSmith tracing disabled (no API key configured)")

    # Log AI service configuration status
    if settings.MISTRAL_API_KEY:
        logger.info("Mistral AI configured - Mock interview chat AI enabled")
    else:
        logger.warning("MISTRAL_API_KEY is not set - mock interview chat will use rule-based fallback")

    if settings.OPENAI_API_KEY:
        logger.info("OpenAI configured - Resume analysis AI enabled")
    else:
        logger.warning("OPENAI_API_KEY is not set - resume analysis unavailable")

    # Security warnings
    if "change-this" in settings.INTERNAL_API_SECRET:
        logger.warning(
            "⚠️  SECURITY: INTERNAL_API_SECRET is using the default insecure value. "
            "Set a strong random secret in your .env file before deploying."
        )

    logger.info("Application startup complete - Firebase/Firestore + Cloudinary enabled")
    yield
    # Shutdown
    logger.info("Application shutdown complete")


_is_production = settings.ENVIRONMENT == "production"
app = FastAPI(
    title="College Placement Management System",
    description="Enterprise-grade college placement management with AI interview preparation",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if _is_production else "/api/docs",
    redoc_url=None if _is_production else "/api/redoc",
    openapi_url=None if _is_production else "/api/openapi.json",
)

# Add rate limiter state and JSON error handler
app.state.limiter = limiter


async def _json_rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return a structured JSON 429 response instead of SlowAPI's default HTML page."""
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}. Please slow down and try again later.",
            "retry_after": getattr(exc, "retry_after", None),
        },
        headers={"Retry-After": str(getattr(exc, "retry_after", 60))},
    )


app.add_exception_handler(RateLimitExceeded, _json_rate_limit_handler)

# Add request logging middleware (before CORS so all requests are logged)
app.add_middleware(RequestLoggingMiddleware)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add GZip compression for responses > 1000 bytes
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

# Include all API routers
app.include_router(api_router)


# Global exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}


logger.info("CORS Allowed Origins: %s", settings.allowed_origins_list)
