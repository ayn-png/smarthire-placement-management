"""
Firebase Admin SDK initialization — singleton pattern.
Initializes the Firebase app once and provides helpers for Firestore and Auth.

Usage:
    from app.core.firebase_init import get_firestore_client, get_firebase_auth

    db = get_firestore_client()          # Firestore sync client
    fb_auth = get_firebase_auth()        # Firebase Auth module
"""

import json
import logging
import firebase_admin
from firebase_admin import credentials, firestore as fb_firestore, auth as fb_auth
from app.core.config import settings

logger = logging.getLogger(__name__)

_app = None


def get_firebase_app():
    """Return (and lazily initialize) the Firebase Admin app singleton."""
    global _app
    if _app is not None:
        return _app

    try:
        if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
            # Prefer JSON string from environment variable (production / CI)
            cred_dict = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            cred = credentials.Certificate(cred_dict)
            logger.info("Firebase Admin SDK: using service account from FIREBASE_SERVICE_ACCOUNT_JSON env var")
        elif settings.FIREBASE_SERVICE_ACCOUNT_PATH:
            cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
            logger.info(f"Firebase Admin SDK: using service account file: {settings.FIREBASE_SERVICE_ACCOUNT_PATH}")
        else:
            raise RuntimeError(
                "No Firebase credentials configured. "
                "Set FIREBASE_SERVICE_ACCOUNT_JSON (full JSON string) "
                "or FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON file) in your .env"
            )

        _app = firebase_admin.initialize_app(cred)
        logger.info(f"Firebase Admin SDK initialized for project: {settings.FIREBASE_PROJECT_ID}")
    except Exception as e:
        logger.error(f"Firebase Admin SDK initialization failed: {e}")
        raise

    return _app


def get_firestore_client():
    """Return a synchronous Firestore client. Wrap all calls in asyncio.to_thread()."""
    get_firebase_app()
    return fb_firestore.client()


def get_firebase_auth():
    """Return the firebase_admin.auth module for token verification and user management."""
    get_firebase_app()
    return fb_auth
