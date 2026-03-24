from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, students, companies, jobs, applications, analytics,
    interview, ai_resume, notifications, resume_analyzer, multi_agent,
    health, market_jobs,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)  # Health checks (no auth required)
api_router.include_router(auth.router)
api_router.include_router(students.router)
api_router.include_router(companies.router)
api_router.include_router(jobs.router)
api_router.include_router(applications.router)
api_router.include_router(analytics.router)
api_router.include_router(interview.router)
api_router.include_router(ai_resume.router)
api_router.include_router(resume_analyzer.router)
api_router.include_router(notifications.router)
api_router.include_router(multi_agent.router)   # Multi-Agent AI System with LangGraph
api_router.include_router(market_jobs.router)   # Market Jobs — isolated external module
