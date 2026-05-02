"""Targeted regression tests for resume existence checks and ATS extraction."""

import pytest

from app.services.resume_analyzer import ResumeAnalyzerService
from app.utils.file_upload import resume_exists


def test_resume_exists_uses_cloudinary_get_stream(monkeypatch):
    calls = {}

    class FakeResponse:
        status_code = 200

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    class FakeStream:
        def __enter__(self):
            return FakeResponse()

        def __exit__(self, exc_type, exc, tb):
            return False

    class FakeClient:
        def __init__(self, *args, **kwargs):
            calls["init_kwargs"] = kwargs

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def stream(self, method, url):
            calls["method"] = method
            calls["url"] = url
            return FakeStream()

    monkeypatch.setattr("app.utils.file_upload.httpx.Client", FakeClient)

    assert resume_exists("https://res.cloudinary.com/demo/raw/upload/v1/smarthire/resumes/resume_test.pdf") is True
    assert calls["method"] == "GET"


@pytest.mark.asyncio
async def test_resume_analyzer_extract_text_delegates_to_shared_ocr(monkeypatch, tmp_path):
    file_path = tmp_path / "resume.pdf"
    file_path.write_bytes(b"%PDF-1.4\nfake pdf bytes")

    called = {}

    def fake_extract_resume_text_with_ocr(path):
        called["path"] = path
        return "John Doe resume text with enough content to satisfy validation."

    monkeypatch.setattr(
        "app.services.resume_analyzer.extract_resume_text_with_ocr",
        fake_extract_resume_text_with_ocr,
    )

    service = object.__new__(ResumeAnalyzerService)
    text = await service.extract_text_from_pdf(str(file_path))

    assert called["path"] == str(file_path)
    assert "John Doe" in text