from pydantic import BaseModel
from typing import List, Optional
from app.core.enums import InterviewType


class InterviewQuestionRequest(BaseModel):
    interview_type: InterviewType
    job_title: Optional[str] = None
    skills: List[str] = []
    difficulty: str = "medium"  # easy, medium, hard
    count: int = 10
    offset: int = 0   # For "load more" pagination — skip the first N questions


class InterviewQuestion(BaseModel):
    question: str
    category: str
    difficulty: str
    hint: Optional[str] = None
    sample_answer: Optional[str] = None


class InterviewQuestionsResponse(BaseModel):
    questions: List[InterviewQuestion]
    interview_type: InterviewType
    total: int
    total_available: int = 0  # Total questions in the bank for this type/difficulty
    offset: int = 0           # Current offset (for client-side pagination state)


class MockInterviewMessage(BaseModel):
    role: str  # user | assistant
    content: str


class MockInterviewRequest(BaseModel):
    messages: List[MockInterviewMessage]
    job_title: Optional[str] = None
    skills: List[str] = []


class MockInterviewResponse(BaseModel):
    reply: str
    feedback: Optional[str] = None
    score: Optional[int] = None
