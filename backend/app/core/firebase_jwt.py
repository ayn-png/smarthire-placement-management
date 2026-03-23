"""
Firebase ID Token verification for FastAPI.

Firebase Auth issues RS256-signed ID tokens. This module verifies them
using the Firebase Admin SDK (which fetches Google's public keys automatically).

Usage:
    from app.core.firebase_jwt import decode_firebase_token

    payload = decode_firebase_token(raw_token)
    # payload["uid"]       → Firebase UID (e.g. "abc123...")
    # payload["email"]     → user's email
    # payload["role"]      → custom claim set via Firebase Admin set_custom_user_claims()
"""

import logging
from firebase_admin import auth as fb_auth
from app.core.firebase_init import get_firebase_app

logger = logging.getLogger(__name__)


def decode_firebase_token(token: str) -> dict | None:
    """
    Verify a Firebase ID token.
    Returns the decoded payload dict on success, or None on any failure.

    Relevant claims:
      uid    — Firebase user ID string
      email  — user's email address
      role   — custom claim set after role-select (via /api/set-role)
    """
    try:
        get_firebase_app()
        # check_revoked=False for performance; set True if you need immediate revocation
        decoded = fb_auth.verify_id_token(token, check_revoked=False)
        return decoded
    except fb_auth.RevokedIdTokenError:
        logger.debug("Firebase token has been revoked")
        return None
    except fb_auth.ExpiredIdTokenError:
        logger.debug("Firebase token has expired")
        return None
    except fb_auth.InvalidIdTokenError as e:
        logger.debug(f"Invalid Firebase token: {e}")
        return None
    except Exception as e:
        logger.warning(f"Firebase token verification failed: {e}")
        return None
