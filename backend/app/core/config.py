from pydantic_settings import BaseSettings
from typing import List
import os
import sys


class Settings(BaseSettings):
    # Firebase replaces MongoDB
    FIREBASE_PROJECT_ID: str = "smarthire-82a1b"
    # Path to service account JSON file (relative to backend/ directory)
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "firebase-service-account.json"
    # Alternative: full JSON string as env var (takes precedence if set)
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""

    SECRET_KEY: str = "changeme-in-production-must-be-32-chars-min"
    REFRESH_SECRET_KEY: str = "refresh-changeme-in-production-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 5
    ENVIRONMENT: str = "development"

    # Email / SMTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "SmartHire <noreply@smarthire.com>"
    SMTP_TLS: bool = True

    # App base URL (used in password-reset links)
    APP_BASE_URL: str = "http://localhost:3000"

    # AI Resume Analyzer - OpenAI (used by /ai/analyze-existing-resume)
    OPENAI_API_KEY: str = ""
    # OpenRouter - fallback when OpenAI quota is exceeded (OpenAI-compatible API)
    OPENROUTER_API_KEY: str = ""

    # Mistral AI - used by mock interview chat (/interview/mock-chat)
    MISTRAL_API_KEY: str = ""

    # LangSmith Tracing & Monitoring for Multi-Agent System
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_ENDPOINT: str = "https://api.smith.langchain.com"
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_PROJECT: str = "smarthire-portal"

    # Cloudinary - Cloud Storage for Files
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Internal secret for Next.js → FastAPI server-to-server calls
    INTERNAL_API_SECRET: str = "change-this-internal-secret"

    # Sentry Error Tracking (optional)
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    def validate_production_config(self):
        """Validate critical security settings in production."""
        if self.ENVIRONMENT == "production":
            errors = []

            if len(self.SECRET_KEY) < 32:
                errors.append("SECRET_KEY must be at least 32 characters in production")
            if "changeme" in self.SECRET_KEY.lower():
                errors.append("SECRET_KEY contains 'changeme' - must be changed in production")

            if not self.CLOUDINARY_CLOUD_NAME or not self.CLOUDINARY_API_KEY:
                errors.append("Cloudinary credentials must be configured in production")

            if not self.FIREBASE_PROJECT_ID:
                errors.append("FIREBASE_PROJECT_ID must be set in production")

            if not self.FIREBASE_SERVICE_ACCOUNT_JSON and not self.FIREBASE_SERVICE_ACCOUNT_PATH:
                errors.append("Firebase service account credentials must be configured in production")

            if "change-this" in self.INTERNAL_API_SECRET:
                errors.append("INTERNAL_API_SECRET must be changed in production")

            if errors:
                print("\n" + "=" * 80)
                print("CRITICAL SECURITY ERRORS - Application will not start")
                print("=" * 80)
                for error in errors:
                    print(f"  ❌ {error}")
                print("=" * 80)
                print("\nPlease fix these issues in your .env file before running in production.\n")
                sys.exit(1)

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Validate production configuration on startup
settings.validate_production_config()
