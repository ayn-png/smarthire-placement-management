from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.schemas.interview import InterviewQuestionRequest, InterviewQuestionsResponse, MockInterviewRequest, MockInterviewResponse
from app.services.interview_service import InterviewService
from app.middleware.auth import require_student

router = APIRouter(prefix="/interview", tags=["AI Interview"])
limiter = Limiter(key_func=get_remote_address)


# ── Dependency factory ──────────────────────────────────────────────────────
def get_interview_service() -> InterviewService:
    """
    Return a fresh InterviewService per request via FastAPI DI.
    Keeps the pattern consistent with all other routers and allows
    future constructor injection (e.g. DB, config) without touching endpoints.
    """
    return InterviewService()


# ── Endpoints ───────────────────────────────────────────────────────────────
@router.post("/questions", response_model=InterviewQuestionsResponse)
@limiter.limit("20/hour")
async def get_interview_questions(
    request: Request,
    data: InterviewQuestionRequest,
    current_user: dict = Depends(require_student),
    service: InterviewService = Depends(get_interview_service),
):
    return await service.get_questions(data)


@router.post("/mock-chat", response_model=MockInterviewResponse)
@limiter.limit("30/hour")
async def mock_interview_chat(
    request: Request,
    data: MockInterviewRequest,
    current_user: dict = Depends(require_student),
    service: InterviewService = Depends(get_interview_service),
):
    return await service.mock_interview_chat(data)
