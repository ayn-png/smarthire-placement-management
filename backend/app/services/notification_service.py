"""
Notification service — backed by Firestore.
Notifications use auto-generated Firestore document IDs.
All Firestore SDK calls wrapped in asyncio.to_thread().
"""
import asyncio
from datetime import datetime
from typing import Optional

from app.db.helpers import utcnow
from app.core.exceptions import NotFoundException, ForbiddenException


def _doc_to_dict(doc_snapshot) -> dict | None:
    if not doc_snapshot.exists:
        return None
    data = doc_snapshot.to_dict() or {}
    result = {"id": doc_snapshot.id}
    for k, v in data.items():
        if isinstance(v, datetime):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result


class NotificationService:
    def __init__(self, db):
        self.db = db

    async def create(
        self,
        user_id: str,
        title: str,
        message: str,
        link: Optional[str] = None,
    ) -> None:
        """Insert a new unread notification. Best-effort — never crashes the caller."""
        try:
            doc = {
                "user_id": user_id,
                "title": title,
                "message": message,
                "link": link,
                "read": False,
                "created_at": utcnow(),
            }
            await asyncio.to_thread(self.db.collection("notifications").add, doc)
        except Exception:
            pass

    async def list_for_user(self, user_id: str, page: int = 1, limit: int = 30) -> dict:
        """Return paginated notifications for user, sorted by created_at descending."""
        # Cap at 1000 docs — prevents full-collection load for power users with many notifications
        _MAX_FETCH = 1000
        docs = await asyncio.to_thread(
            self.db.collection("notifications").where("user_id", "==", user_id).limit(_MAX_FETCH).get
        )

        notifications = [_doc_to_dict(d) for d in docs if d.exists]

        # Sort by created_at descending in Python
        notifications.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        total_count = len(notifications)
        unread_count = sum(1 for n in notifications if not n.get("read", False))

        # Paginate
        skip = (page - 1) * limit
        paginated = notifications[skip: skip + limit]

        return {
            "notifications": [self._to_dict(n) for n in paginated],
            "unread_count": unread_count,
            "total_count": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit,
        }

    async def mark_read(self, notification_id: str, user_id: str) -> dict:
        """Mark a single notification as read. 403 if it belongs to another user."""
        if not notification_id:
            raise NotFoundException("Notification")

        notif_ref = self.db.collection("notifications").document(notification_id)
        doc = await asyncio.to_thread(notif_ref.get)
        if not doc.exists:
            raise NotFoundException("Notification")

        doc_data = doc.to_dict()
        if doc_data.get("user_id") != user_id:
            raise ForbiddenException("Cannot access another user's notification")

        await asyncio.to_thread(notif_ref.update, {"read": True})

        result = _doc_to_dict(doc)
        result["read"] = True
        return self._to_dict(result)

    async def mark_all_read(self, user_id: str) -> dict:
        """Mark all unread notifications for the user as read."""
        docs = await asyncio.to_thread(
            self.db.collection("notifications")
            .where("user_id", "==", user_id)
            .where("read", "==", False)
            .get
        )
        unread_docs = list(docs)

        if not unread_docs:
            return {"updated_count": 0, "message": "All notifications already marked as read"}

        # Batch update
        batch = self.db.batch()
        for doc in unread_docs:
            batch.update(doc.reference, {"read": True})
        await asyncio.to_thread(batch.commit)

        return {"updated_count": len(unread_docs), "message": "All notifications marked as read"}

    def _to_dict(self, doc: dict) -> dict:
        return {
            "id": doc.get("id", ""),
            "user_id": doc.get("user_id", ""),
            "title": doc.get("title", ""),
            "message": doc.get("message", ""),
            "link": doc.get("link"),
            "read": doc.get("read", False),
            "created_at": doc.get("created_at", ""),
        }
