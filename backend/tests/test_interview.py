"""Tests for interview endpoints — auth guards + mocked Mistral/LLM calls.

The interview service uses Mistral via LangChain. All LLM calls are mocked
so tests run without a real MISTRAL_API_KEY or network connection.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient
from tests.conftest import auth_headers


SAMPLE_QUESTIONS_REQUEST = {
    "interview_type": "TECHNICAL",
    "difficulty": "medium",
}

SAMPLE_CHAT_REQUEST = {
    "messages": [{"role": "user", "content": "Tell me about yourself"}],
    "interview_type": "TECHNICAL",
    "difficulty": "medium",
}


# ── POST /interview/questions ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_questions_no_auth(client: AsyncClient):
    """POST /interview/questions without auth → 401/403."""
    resp = await client.post(
        "/api/v1/interview/questions",
        json=SAMPLE_QUESTIONS_REQUEST,
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_questions_admin_forbidden(client: AsyncClient):
    """POST /interview/questions as PLACEMENT_ADMIN → 403 (admin-only endpoint is student-only)."""
    resp = await client.post(
        "/api/v1/interview/questions",
        json=SAMPLE_QUESTIONS_REQUEST,
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_questions_as_student_mocked(client: AsyncClient):
    """POST /interview/questions as STUDENT (LLM mocked) → endpoint reachable (not 401/403)."""
    mock_response = MagicMock()
    mock_response.questions = ["Q1: What is polymorphism?", "Q2: Explain inheritance"]

    with patch(
        "app.services.interview_service.InterviewService.get_questions",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        resp = await client.post(
            "/api/v1/interview/questions",
            json=SAMPLE_QUESTIONS_REQUEST,
            headers=auth_headers("STUDENT"),
        )

    # 200 = success; 422 = schema mismatch; 500 = service error with mock
    assert resp.status_code in (200, 422, 500)
    assert resp.status_code not in (401, 403)


# ── POST /interview/mock-chat ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mock_chat_no_auth(client: AsyncClient):
    """POST /interview/mock-chat without auth → 401/403."""
    resp = await client.post(
        "/api/v1/interview/mock-chat",
        json=SAMPLE_CHAT_REQUEST,
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_mock_chat_admin_forbidden(client: AsyncClient):
    """POST /interview/mock-chat as PLACEMENT_ADMIN → 403 (student-only)."""
    resp = await client.post(
        "/api/v1/interview/mock-chat",
        json=SAMPLE_CHAT_REQUEST,
        headers=auth_headers("PLACEMENT_ADMIN"),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_mock_chat_as_student_mocked(client: AsyncClient):
    """POST /interview/mock-chat as STUDENT (LLM mocked) → endpoint reachable (not 401/403)."""
    mock_response = MagicMock()
    mock_response.reply = "Great answer! Here is my feedback..."

    with patch(
        "app.services.interview_service.InterviewService.mock_interview_chat",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        resp = await client.post(
            "/api/v1/interview/mock-chat",
            json=SAMPLE_CHAT_REQUEST,
            headers=auth_headers("STUDENT"),
        )

    # 200 = success; 422 = schema mismatch; 500 = service error with mock
    assert resp.status_code in (200, 422, 500)
    assert resp.status_code not in (401, 403)
