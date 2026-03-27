"""
SmartHire Backend — pytest fixtures and shared configuration.

All Firestore + Firebase Auth calls are mocked so tests run without
a real Firebase project or network connection.
"""
import asyncio
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

# ── Patch Firebase BEFORE importing the app ───────────────────────────────────
# These patches prevent real Firebase calls during tests

STUDENT_UID = "test-student-uid-001"
ADMIN_UID   = "test-admin-uid-002"
SA_UID      = "test-super-admin-uid-003"

def _make_fake_token(uid: str, role: str) -> dict:
    return {"uid": uid, "role": role, "email": f"{role.lower()}@test.com"}


@pytest.fixture(scope="session", autouse=True)
def patch_firebase():
    """Patch Firebase Admin SDK globally for all tests."""
    # Import submodules first so patch() can find them as attributes
    import firebase_admin.auth as _fb_auth
    import firebase_admin.firestore as _fb_fs

    fake_auth = MagicMock()
    token_map = {
        "Bearer fake-token-STUDENT":          _make_fake_token(STUDENT_UID, "STUDENT"),
        "fake-token-STUDENT":                 _make_fake_token(STUDENT_UID, "STUDENT"),
        "Bearer fake-token-PLACEMENT_ADMIN":  _make_fake_token(ADMIN_UID, "PLACEMENT_ADMIN"),
        "fake-token-PLACEMENT_ADMIN":         _make_fake_token(ADMIN_UID, "PLACEMENT_ADMIN"),
    }
    fake_auth.verify_id_token = MagicMock(
        side_effect=lambda token, **kw: token_map.get(token, _make_fake_token(STUDENT_UID, "STUDENT"))
    )
    fake_auth.set_custom_user_claims = MagicMock()
    fake_auth.delete_user = MagicMock()
    fake_auth.get_user = MagicMock(return_value=MagicMock(email="test@test.com", uid=STUDENT_UID))

    # In-memory Firestore fake — pre-seed test user documents so auth middleware
    # finds them and doesn't raise CredentialsException (401)
    _store: dict = {
        f"users/{STUDENT_UID}": {
            "role": "STUDENT",
            "is_active": True,
            "email": "student@test.com",
            "full_name": "Test Student",
            "firebase_uid": STUDENT_UID,
        },
        f"users/{ADMIN_UID}": {
            "role": "PLACEMENT_ADMIN",
            "is_active": True,
            "email": "admin@test.com",
            "full_name": "Test Admin",
            "firebase_uid": ADMIN_UID,
        },
        f"users/{SA_UID}": {
            "role": "SUPER_ADMIN",
            "is_active": True,
            "email": "superadmin@test.com",
            "full_name": "Test Super Admin",
            "firebase_uid": SA_UID,
        },
    }

    def _doc_ref(collection, doc_id):
        key = f"{collection}/{doc_id}"
        ref = MagicMock()
        ref.id = doc_id
        ref.get = MagicMock(return_value=_make_doc(key))
        ref.set = MagicMock(side_effect=lambda data, **kw: _store.update(
            {key: dict(_store.get(key, {}), **data) if kw.get("merge") else data}
        ))
        ref.update = MagicMock(side_effect=lambda data: _store.update({key: dict(_store.get(key, {}), **data)}))
        ref.delete = MagicMock(side_effect=lambda: _store.pop(key, None))
        return ref

    def _make_doc(key):
        snap = MagicMock()
        snap.exists = key in _store
        snap.to_dict = MagicMock(return_value=_store.get(key, {}))
        snap.id = key.split("/")[-1]
        return snap

    fake_db = MagicMock()
    fake_db.collection.side_effect = lambda name: _make_collection(name)

    def _make_collection(name):
        col = MagicMock()
        col.document.side_effect = lambda doc_id: _doc_ref(name, doc_id)
        col.where.return_value = col
        col.order_by.return_value = col
        col.limit.return_value = col
        col.stream.return_value = iter([])
        col.get.return_value = []
        return col

    # Patch decode_firebase_token at the middleware's import site
    def fake_decode_token(token: str) -> dict | None:
        return token_map.get(token, token_map.get(f"Bearer {token}"))

    # Wrap get_firestore_client so every service module gets the fake db
    def fake_get_firestore():
        return fake_db

    with (
        patch.object(_fb_auth, "verify_id_token", fake_auth.verify_id_token),
        patch.object(_fb_auth, "set_custom_user_claims", fake_auth.set_custom_user_claims),
        patch.object(_fb_auth, "delete_user", fake_auth.delete_user),
        patch.object(_fb_auth, "get_user", fake_auth.get_user),
        patch("app.core.firebase_jwt.decode_firebase_token", side_effect=fake_decode_token),
        patch("app.middleware.auth.decode_firebase_token", side_effect=fake_decode_token),
        # Patch at the source module AND at every import site that bound it at load time
        patch("app.core.firebase_init.get_firestore_client", side_effect=fake_get_firestore),
        patch("app.db.database.get_firestore_client", side_effect=fake_get_firestore),
        patch("app.core.firebase_init.get_firebase_auth", return_value=fake_auth),
        patch("app.core.firebase_init.get_firebase_app", return_value=MagicMock()),
        # Do NOT patch asyncio.to_thread — let it run normally with mock Firestore objects
    ):
        yield


@pytest_asyncio.fixture
async def client():
    """Async HTTP test client wrapping the FastAPI app (follows 307 redirects)."""
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as ac:
        yield ac


def auth_headers(role: str = "STUDENT") -> dict:
    """Return Authorization headers for a given role."""
    return {"Authorization": f"Bearer fake-token-{role}"}


def internal_secret_headers() -> dict:
    """Return X-Internal-Secret header for server-to-server calls."""
    from app.core.config import settings
    return {"X-Internal-Secret": settings.INTERNAL_API_SECRET}


def super_admin_headers() -> dict:
    """Return X-Super-Admin-Secret header for super admin calls."""
    from app.core.config import settings
    return {"X-Super-Admin-Secret": settings.SUPER_ADMIN_SECRET}
