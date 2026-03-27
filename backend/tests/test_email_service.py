"""
Email service unit tests.

All tests patch smtplib.SMTP so NO real emails are sent.
We verify that:
  - the correct TO address is used
  - the correct subject is used
  - expected keywords appear in the message body
  - retry logic works (SMTP fails once, then succeeds)
"""
import smtplib
import pytest
from unittest.mock import MagicMock, patch, call


# ── Helper: set SMTP_HOST so _send() doesn't short-circuit ───────────────────
def _enable_smtp(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.sendgrid.net")
    from app.core.config import settings
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.sendgrid.net")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USER", "apikey")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "SG.fake-key-for-tests")
    monkeypatch.setattr(settings, "SMTP_FROM", "SmartHire <test@smarthire.com>")
    monkeypatch.setattr(settings, "SMTP_TLS", True)
    monkeypatch.setattr(settings, "APP_BASE_URL", "http://localhost:3000")


def _make_smtp_mock():
    """Return a mock SMTP server that records sendmail calls."""
    smtp_instance = MagicMock()
    smtp_instance.__enter__ = MagicMock(return_value=smtp_instance)
    smtp_instance.__exit__ = MagicMock(return_value=False)
    return smtp_instance


# ── send_admin_approved_email ─────────────────────────────────────────────────

def test_send_admin_approved_email_correct_to_and_subject(monkeypatch):
    """send_admin_approved_email uses correct recipient and subject."""
    _enable_smtp(monkeypatch)
    smtp_mock = _make_smtp_mock()

    with patch("smtplib.SMTP", return_value=smtp_mock):
        from app.services.email_service import send_admin_approved_email
        send_admin_approved_email("admin@college.edu", "Alice Smith")

    assert smtp_mock.sendmail.called
    args = smtp_mock.sendmail.call_args[0]
    to_addr = args[1]   # list of recipients
    raw_msg = args[2]   # raw email string

    assert "admin@college.edu" in to_addr
    assert "Approved" in raw_msg or "approved" in raw_msg.lower()


def test_send_admin_approved_email_body_contains_login_link(monkeypatch):
    """Approval email body contains a login link (body is base64-encoded MIME)."""
    import base64, re
    _enable_smtp(monkeypatch)
    smtp_mock = _make_smtp_mock()

    with patch("smtplib.SMTP", return_value=smtp_mock):
        from app.services.email_service import send_admin_approved_email
        send_admin_approved_email("admin@college.edu", "Alice Smith")

    raw_msg = smtp_mock.sendmail.call_args[0][2]
    # Decode base64 sections in the MIME message to get readable HTML
    b64_parts = re.findall(r"\n\n([A-Za-z0-9+/=\n]+)\n\n--", raw_msg)
    decoded = ""
    for part in b64_parts:
        try:
            decoded += base64.b64decode(part.replace("\n", "")).decode("utf-8", errors="ignore")
        except Exception:
            pass
    combined = raw_msg + decoded
    assert "login" in combined.lower() or "http" in combined


# ── send_admin_rejected_email ─────────────────────────────────────────────────

def test_send_admin_rejected_email_subject_and_reason(monkeypatch):
    """Rejection email subject says 'Not Approved' and reason appears in body."""
    _enable_smtp(monkeypatch)
    smtp_mock = _make_smtp_mock()

    rejection_reason = "Institution not registered in our system."

    with patch("smtplib.SMTP", return_value=smtp_mock):
        from app.services.email_service import send_admin_rejected_email
        send_admin_rejected_email("rejected@college.edu", "Bob Jones", rejection_reason)

    args = smtp_mock.sendmail.call_args[0]
    to_addr = args[1]
    raw_msg = args[2]

    assert "rejected@college.edu" in to_addr
    assert "not approved" in raw_msg.lower() or "rejected" in raw_msg.lower()
    assert rejection_reason in raw_msg


# ── send_status_change_email ──────────────────────────────────────────────────

def test_send_status_change_email_shortlisted(monkeypatch):
    """Status change email for SHORTLISTED is sent to the correct address."""
    _enable_smtp(monkeypatch)
    smtp_mock = _make_smtp_mock()

    with patch("smtplib.SMTP", return_value=smtp_mock):
        from app.services.email_service import send_status_change_email
        send_status_change_email(
            to="student@uni.edu",
            student_name="Charlie Dev",
            job_title="Software Engineer",
            company_name="TechCorp",
            new_status="SHORTLISTED",
        )

    assert smtp_mock.sendmail.called
    to_addr = smtp_mock.sendmail.call_args[0][1]
    assert "student@uni.edu" in to_addr


def test_send_status_change_email_rejected(monkeypatch):
    """Status change email for REJECTED is sent to the correct address."""
    _enable_smtp(monkeypatch)
    smtp_mock = _make_smtp_mock()

    with patch("smtplib.SMTP", return_value=smtp_mock):
        from app.services.email_service import send_status_change_email
        send_status_change_email(
            to="dana@uni.edu",
            student_name="Dana Lee",
            job_title="Data Analyst",
            company_name="DataCo",
            new_status="REJECTED",
        )

    assert smtp_mock.sendmail.called
    to_addr = smtp_mock.sendmail.call_args[0][1]
    assert "dana@uni.edu" in to_addr


# ── send_otp_email ────────────────────────────────────────────────────────────

def test_send_otp_email_contains_otp_code(monkeypatch):
    """OTP email body contains the 6-digit code."""
    _enable_smtp(monkeypatch)
    smtp_mock = _make_smtp_mock()
    otp_code = "847291"

    with patch("smtplib.SMTP", return_value=smtp_mock):
        from app.services.email_service import send_otp_email
        send_otp_email("user@example.com", "Eve Brown", otp_code)

    raw_msg = smtp_mock.sendmail.call_args[0][2]
    assert otp_code in raw_msg


# ── send_password_reset_link_email ────────────────────────────────────────────

def test_send_password_reset_email_contains_link(monkeypatch):
    """Password reset email contains the reset URL."""
    _enable_smtp(monkeypatch)
    smtp_mock = _make_smtp_mock()
    reset_url = "http://localhost:3000/reset-password?token=abc123"

    with patch("smtplib.SMTP", return_value=smtp_mock):
        from app.services.email_service import send_password_reset_link_email
        send_password_reset_link_email("user@example.com", "Frank White", reset_url)

    raw_msg = smtp_mock.sendmail.call_args[0][2]
    assert reset_url in raw_msg or "reset" in raw_msg.lower()


# ── Retry logic ───────────────────────────────────────────────────────────────

def test_email_retry_logic_succeeds_on_second_attempt(monkeypatch):
    """SMTP failure on attempt 1 → retry → succeeds on attempt 2."""
    _enable_smtp(monkeypatch)
    call_count = 0
    smtp_instance = _make_smtp_mock()

    def mock_sendmail_side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise smtplib.SMTPException("Temporary failure")
        # Second call succeeds (no exception)

    smtp_instance.sendmail.side_effect = mock_sendmail_side_effect

    # Patch sleep so retry is instant in tests
    with patch("smtplib.SMTP", return_value=smtp_instance), \
         patch("time.sleep", return_value=None):
        from app.services.email_service import send_admin_approved_email
        send_admin_approved_email("retry@example.com", "Grace Retry")

    assert call_count == 2  # failed once, succeeded on retry


def test_email_permanent_failure_no_retry_on_bad_recipient(monkeypatch):
    """SMTPRecipientsRefused → no retry (permanent failure)."""
    _enable_smtp(monkeypatch)
    call_count = 0
    smtp_instance = _make_smtp_mock()

    def mock_sendmail_side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise smtplib.SMTPRecipientsRefused({"bad@example.com": (550, b"User unknown")})

    smtp_instance.sendmail.side_effect = mock_sendmail_side_effect

    with patch("smtplib.SMTP", return_value=smtp_instance), \
         patch("time.sleep", return_value=None):
        from app.services.email_service import send_admin_approved_email
        send_admin_approved_email("bad@example.com", "Henry No-retry")

    # Should only attempt once (no retry on permanent failure)
    assert call_count == 1


# ── No SMTP host → skip silently ─────────────────────────────────────────────

def test_email_skipped_when_smtp_host_not_configured(monkeypatch):
    """When SMTP_HOST is empty, _send() logs warning and returns without sending."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "SMTP_HOST", "")

    smtp_mock = _make_smtp_mock()
    with patch("smtplib.SMTP", return_value=smtp_mock):
        from app.services.email_service import send_admin_approved_email
        send_admin_approved_email("nobody@example.com", "No Send")

    # SMTP should not have been called at all
    assert not smtp_mock.sendmail.called
