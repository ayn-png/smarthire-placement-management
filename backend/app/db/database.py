"""
Firestore database client for FastAPI dependency injection.

All Firestore SDK calls are synchronous — wrap them in asyncio.to_thread()
to avoid blocking the FastAPI event loop.

Usage in endpoints/services:
    db = Depends(get_database)
    # Then in async functions:
    doc = await asyncio.to_thread(db.collection("users").document(uid).get)
"""

import asyncio
import functools
import logging
from app.core.firebase_init import get_firestore_client

logger = logging.getLogger(__name__)


def get_database():
    """FastAPI dependency — returns the Firestore client."""
    return get_firestore_client()


async def run_in_thread(fn, *args, **kwargs):
    """
    Helper to run a synchronous Firestore SDK call in a thread pool
    so it doesn't block the async event loop.

    Usage:
        results = await run_in_thread(db.collection("users").where("email", "==", email).get)
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, functools.partial(fn, *args, **kwargs))


# Legacy stubs — kept so any remaining imports don't crash
async def connect_db():
    """No-op: Firestore doesn't need an explicit connection."""
    from app.core.firebase_init import get_firebase_app
    get_firebase_app()
    logger.info("Firebase/Firestore ready")


async def disconnect_db():
    """No-op: Firestore doesn't need explicit disconnect."""
    logger.info("Firebase/Firestore client released")
