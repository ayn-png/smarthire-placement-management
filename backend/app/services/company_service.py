"""
Company service — backed by Firestore.
Companies use auto-generated Firestore document IDs.
All Firestore SDK calls wrapped in asyncio.to_thread().
"""
import asyncio
from datetime import datetime

from app.schemas.job import CompanyCreate, CompanyUpdate, CompanyResponse
from app.core.exceptions import NotFoundException, ConflictException
from app.db.helpers import utcnow


def _doc_to_dict(doc_snapshot) -> dict | None:
    """Convert a Firestore DocumentSnapshot to a serializable dict."""
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


class CompanyService:
    def __init__(self, db):
        self.db = db

    async def create_company(self, data: CompanyCreate) -> CompanyResponse:
        # Check for duplicate company name
        existing = await asyncio.to_thread(
            self.db.collection("companies").where("name", "==", data.name).limit(1).get
        )
        if list(existing):
            raise ConflictException("Company with this name already exists")

        now = utcnow()
        doc = {
            **data.model_dump(),
            "logo_url": None,
            "created_at": now,
            "updated_at": now,
        }
        _, doc_ref = await asyncio.to_thread(
            self.db.collection("companies").add, doc
        )
        doc["id"] = doc_ref.id
        for k, v in doc.items():
            if isinstance(v, datetime):
                doc[k] = v.isoformat()
        return CompanyResponse(**doc)

    async def get_company(self, company_id: str) -> CompanyResponse:
        if not company_id:
            raise NotFoundException("Company")
        doc = await asyncio.to_thread(
            self.db.collection("companies").document(company_id).get
        )
        if not doc.exists:
            raise NotFoundException("Company")
        return CompanyResponse(**_doc_to_dict(doc))

    async def update_company(self, company_id: str, data: CompanyUpdate) -> CompanyResponse:
        if not company_id:
            raise NotFoundException("Company")
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        update_data["updated_at"] = utcnow()

        company_ref = self.db.collection("companies").document(company_id)
        company_doc = await asyncio.to_thread(company_ref.get)
        if not company_doc.exists:
            raise NotFoundException("Company")

        await asyncio.to_thread(company_ref.update, update_data)
        updated = await asyncio.to_thread(company_ref.get)
        return CompanyResponse(**_doc_to_dict(updated))

    async def delete_company(self, company_id: str) -> None:
        if not company_id:
            raise NotFoundException("Company")
        company_ref = self.db.collection("companies").document(company_id)
        doc = await asyncio.to_thread(company_ref.get)
        if not doc.exists:
            raise NotFoundException("Company")
        await asyncio.to_thread(company_ref.delete)

    async def list_companies(self, industry: str = None, page: int = 1, limit: int = 20) -> dict:
        if industry:
            docs = await asyncio.to_thread(
                self.db.collection("companies").where("industry", "==", industry).get
            )
        else:
            docs = await asyncio.to_thread(self.db.collection("companies").get)

        companies = []
        for doc in docs:
            c = _doc_to_dict(doc)
            if c:
                companies.append(CompanyResponse(**c))

        # Sort by name ascending
        companies.sort(key=lambda x: x.name or "")
        total = len(companies)
        skip = (page - 1) * limit
        paginated = companies[skip: skip + limit]

        return {"companies": paginated, "total": total, "page": page, "limit": limit}
