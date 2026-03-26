"""
Round service — backed by Firestore.
Rounds track interview/test stages per application.
"""
import asyncio
from datetime import datetime
from app.schemas.round import RoundCreate, RoundUpdate, RoundResultUpdate, RoundResponse
from app.core.exceptions import NotFoundException
from app.db.helpers import utcnow


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


class RoundService:
    def __init__(self, db):
        self.db = db

    async def create_round(self, admin_user: dict, data: RoundCreate) -> RoundResponse:
        now = utcnow()
        doc = {
            **data.model_dump(),
            "result": "PENDING",
            "admin_notes": None,
            "created_at": now,
            "updated_at": now,
        }
        _, ref = await asyncio.to_thread(
            self.db.collection("rounds").add, doc
        )
        # Send in-app notification to student
        try:
            from app.services.notification_service import NotificationService
            notif_svc = NotificationService(self.db)
            await notif_svc.create(
                user_id=data.student_id,
                title=f"New Round Scheduled: {data.round_name}",
                message=f"A {data.round_type.replace('_', ' ').title()} round has been scheduled for {data.scheduled_date[:10]}.",
                link="/student/interviews",
            )
        except Exception:
            pass
        created = await asyncio.to_thread(ref.get)
        return self._to_response(_doc_to_dict(created))

    async def list_rounds(
        self, application_id: str | None = None, job_id: str | None = None
    ) -> list[RoundResponse]:
        if application_id:
            docs = await asyncio.to_thread(
                self.db.collection("rounds").where("application_id", "==", application_id).get
            )
        elif job_id:
            docs = await asyncio.to_thread(
                self.db.collection("rounds").where("job_id", "==", job_id).get
            )
        else:
            docs = await asyncio.to_thread(self.db.collection("rounds").get)
        rounds = [_doc_to_dict(d) for d in docs if d.exists]
        rounds.sort(key=lambda x: (x.get("round_number", 0),))
        return [self._to_response(r) for r in rounds]

    async def get_round(self, round_id: str) -> RoundResponse:
        doc = await asyncio.to_thread(
            self.db.collection("rounds").document(round_id).get
        )
        if not doc.exists:
            raise NotFoundException("Round")
        return self._to_response(_doc_to_dict(doc))

    async def update_round(self, round_id: str, admin_user: dict, data: RoundUpdate) -> RoundResponse:
        ref = self.db.collection("rounds").document(round_id)
        doc = await asyncio.to_thread(ref.get)
        if not doc.exists:
            raise NotFoundException("Round")
        update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        update_data["updated_at"] = utcnow()
        await asyncio.to_thread(ref.update, update_data)
        updated = await asyncio.to_thread(ref.get)
        return self._to_response(_doc_to_dict(updated))

    async def update_round_result(
        self, round_id: str, admin_user: dict, data: RoundResultUpdate
    ) -> RoundResponse:
        ref = self.db.collection("rounds").document(round_id)
        doc = await asyncio.to_thread(ref.get)
        if not doc.exists:
            raise NotFoundException("Round")
        doc_data = doc.to_dict() or {}
        await asyncio.to_thread(
            ref.update,
            {
                "result": data.result,
                "admin_notes": data.admin_notes,
                "updated_at": utcnow(),
            },
        )
        # Notify student
        try:
            student_id = doc_data.get("student_id")
            round_name = doc_data.get("round_name", "round")
            if student_id and data.result in ("PASS", "FAIL"):
                from app.services.notification_service import NotificationService
                notif_svc = NotificationService(self.db)
                if data.result == "PASS":
                    title = f"You passed {round_name}!"
                    message = f"Congratulations! You passed the {round_name}."
                else:
                    title = f"Result for {round_name}"
                    message = f"Thank you for participating in the {round_name}. Better luck next time!"
                await notif_svc.create(
                    user_id=student_id,
                    title=title,
                    message=message,
                    link="/student/interviews",
                )
        except Exception:
            pass
        updated = await asyncio.to_thread(ref.get)
        return self._to_response(_doc_to_dict(updated))

    async def delete_round(self, round_id: str, admin_user: dict) -> None:
        ref = self.db.collection("rounds").document(round_id)
        doc = await asyncio.to_thread(ref.get)
        if not doc.exists:
            raise NotFoundException("Round")
        await asyncio.to_thread(ref.delete)

    async def list_upcoming_rounds_for_student(self, student_id: str) -> list[RoundResponse]:
        """Student's upcoming rounds (result=PENDING), sorted by scheduled_date."""
        docs = await asyncio.to_thread(
            self.db.collection("rounds")
            .where("student_id", "==", student_id)
            .where("result", "==", "PENDING")
            .get
        )
        rounds = [_doc_to_dict(d) for d in docs if d.exists]
        rounds.sort(key=lambda x: x.get("scheduled_date", ""))
        return [self._to_response(r) for r in rounds]

    def _to_response(self, doc: dict) -> RoundResponse:
        return RoundResponse(
            id=doc.get("id", ""),
            application_id=doc.get("application_id", ""),
            job_id=doc.get("job_id", ""),
            student_id=doc.get("student_id", ""),
            round_number=doc.get("round_number", 1),
            round_name=doc.get("round_name", ""),
            round_type=doc.get("round_type", "TECHNICAL"),
            scheduled_date=doc.get("scheduled_date", ""),
            venue=doc.get("venue"),
            meeting_link=doc.get("meeting_link"),
            result=doc.get("result", "PENDING"),
            admin_notes=doc.get("admin_notes"),
            created_at=doc.get("created_at", ""),
            updated_at=doc.get("updated_at", ""),
        )
