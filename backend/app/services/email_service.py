"""
email_service.py — Feature 1: Email Notifications
-------------------------------------------------------
• Uses Python stdlib smtplib + email.mime (zero new dependencies).
• Every public function is synchronous; call them via FastAPI BackgroundTasks
  so they never block the event loop.
• All SMTP credentials are pulled from Settings (env vars).
• If SMTP_HOST is not configured the functions log a warning and return
  silently — the rest of the application is never affected.
"""

import smtplib
import logging
import logging.handlers
import html as _html
import os
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Dedicated failure logger (writes to logs/email_failures.log) ──────────────
_failure_logger: logging.Logger | None = None

def _get_failure_logger() -> logging.Logger:
    global _failure_logger
    if _failure_logger is not None:
        return _failure_logger

    _failure_logger = logging.getLogger("email.failures")
    if not _failure_logger.handlers:
        log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "logs")
        os.makedirs(log_dir, exist_ok=True)
        handler = logging.handlers.RotatingFileHandler(
            os.path.join(log_dir, "email_failures.log"),
            maxBytes=1_000_000,  # 1 MB per file
            backupCount=3,
            encoding="utf-8",
        )
        handler.setFormatter(logging.Formatter(
            "%(asctime)s | TO=%(to)s | SUBJECT=%(subject)s | ERROR=%(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        ))
        _failure_logger.addHandler(handler)
        _failure_logger.setLevel(logging.ERROR)
        _failure_logger.propagate = False
    return _failure_logger


def _record_failure(to: str, subject: str, exc: Exception) -> None:
    """Write a structured entry to logs/email_failures.log."""
    try:
        fl = _get_failure_logger()
        fl.error(
            str(exc),
            extra={"to": to, "subject": subject},
        )
    except Exception:
        pass  # Never let the logger crash the caller


# ── Internal SMTP helper ──────────────────────────────────────────────────────

def _send(to: str, subject: str, html: str) -> None:
    """Low-level SMTP send with up to 3 attempts. Always call via BackgroundTasks."""
    if not settings.SMTP_HOST:
        logger.warning("SMTP_HOST not configured — email to %s skipped", to)
        return

    _MAX_ATTEMPTS = 3
    last_exc: Exception | None = None

    for attempt in range(_MAX_ATTEMPTS):
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM
            msg["To"] = to
            msg.attach(MIMEText(html, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.ehlo()
                if settings.SMTP_TLS:
                    server.starttls()
                    server.ehlo()
                if settings.SMTP_USER:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, [to], msg.as_string())

            logger.info("Email sent → %s | %s (attempt %d)", to, subject, attempt + 1)
            return  # success — exit immediately
        except smtplib.SMTPRecipientsRefused:
            # Permanent failure — no point retrying
            logger.error("Email FAILED (bad recipient) | to=%s | subject=%s", to, subject)
            _record_failure(to, subject, Exception("SMTPRecipientsRefused"))
            return
        except Exception as exc:
            last_exc = exc
            if attempt < _MAX_ATTEMPTS - 1:
                backoff = 2 ** attempt  # 1s, 2s
                logger.warning(
                    "Email attempt %d/%d failed | to=%s | error=%s | retrying in %ds",
                    attempt + 1, _MAX_ATTEMPTS, to, exc, backoff,
                )
                time.sleep(backoff)

    logger.error(
        "Email FAILED after %d attempts | to=%s | subject=%s | smtp_host=%s | error=%s",
        _MAX_ATTEMPTS, to, subject, settings.SMTP_HOST, last_exc,
    )
    if last_exc:
        _record_failure(to, subject, last_exc)


# ── HTML template helper ──────────────────────────────────────────────────────

def _base_template(title: str, body: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {{ font-family: Arial, sans-serif; background:#f4f4f5; margin:0; padding:0; }}
        .container {{ max-width:600px; margin:32px auto; background:#fff;
                     border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }}
        .header {{ background:linear-gradient(135deg,#6366f1,#8b5cf6);
                   padding:28px 32px; color:#fff; }}
        .header h1 {{ margin:0; font-size:20px; font-weight:700; }}
        .header p  {{ margin:4px 0 0; font-size:13px; opacity:.85; }}
        .body {{ padding:28px 32px; color:#374151; line-height:1.6; font-size:14px; }}
        .badge {{ display:inline-block; padding:4px 12px; border-radius:20px;
                  font-size:12px; font-weight:600; background:#ede9fe; color:#6d28d9; }}
        .btn {{ display:inline-block; margin-top:20px; padding:12px 28px;
                background:#6366f1; color:#fff !important; text-decoration:none;
                border-radius:8px; font-weight:600; font-size:14px; }}
        .footer {{ padding:16px 32px; background:#f9fafb; font-size:11px;
                   color:#9ca3af; border-top:1px solid #f3f4f6; text-align:center; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SmartHire Placement Portal</h1>
          <p>{title}</p>
        </div>
        <div class="body">{body}</div>
        <div class="footer">
          This is an automated message from SmartHire. Please do not reply.
        </div>
      </div>
    </body>
    </html>
    """


# ── Public notification functions (called via BackgroundTasks) ────────────────

def send_status_change_email(
    to: str,
    student_name: str,
    job_title: str,
    company_name: str,
    new_status: str,
    remarks: str | None = None,
) -> None:
    """Notify student when their application status changes."""
    # Escape all user-controlled fields before inserting into HTML
    s_name = _html.escape(student_name or "")
    j_title = _html.escape(job_title or "")
    c_name = _html.escape(company_name or "")

    STATUS_LABELS = {
        "PENDING": ("⏳ Pending Review", "#fef3c7", "#92400e"),
        "UNDER_REVIEW": ("🔍 Under Review", "#dbeafe", "#1e40af"),
        "SHORTLISTED": ("⭐ Shortlisted", "#d1fae5", "#065f46"),
        "INTERVIEW_SCHEDULED": ("📅 Interview Scheduled", "#ede9fe", "#4c1d95"),
        "SELECTED": ("🎉 Selected!", "#d1fae5", "#065f46"),
        "REJECTED": ("❌ Not Selected", "#fee2e2", "#991b1b"),
        "WITHDRAWN": ("↩️ Withdrawn", "#f3f4f6", "#374151"),
    }
    label, bg, color = STATUS_LABELS.get(new_status, (new_status, "#f3f4f6", "#374151"))

    remarks_html = (
        f'<p style="margin-top:12px;padding:12px;background:#f9fafb;'
        f'border-left:3px solid #6366f1;border-radius:4px;">'
        f'<strong>Remarks:</strong> {_html.escape(remarks)}</p>'
    ) if remarks else ""

    body = f"""
    <p>Hi <strong>{s_name}</strong>,</p>
    <p>Your application for <strong>{j_title}</strong> at <strong>{c_name}</strong>
    has been updated:</p>
    <p><span class="badge" style="background:{bg};color:{color};">{label}</span></p>
    {remarks_html}
    <p>Log in to your SmartHire dashboard to view the full details.</p>
    <a class="btn" href="{settings.APP_BASE_URL}/student/applications">View My Applications</a>
    """
    _send(to, f"Application Update — {j_title} at {c_name}", _base_template(
        f"Application status: {label}", body
    ))


def send_interview_scheduled_email(
    to: str,
    student_name: str,
    job_title: str,
    company_name: str,
    interview_date: str,
    interview_link: str | None = None,
    interview_type: str | None = None,
    interview_location: str | None = None,
) -> None:
    """Notify student when an interview is scheduled — includes type and location."""
    s_name = _html.escape(student_name or "")
    j_title = _html.escape(job_title or "")
    c_name = _html.escape(company_name or "")
    i_date = _html.escape(str(interview_date or ""))
    i_location = _html.escape(interview_location or "") if interview_location else None

    INTERVIEW_TYPE_LABELS = {
        "TECHNICAL": "🖥️ Technical Round",
        "HR": "🤝 HR Round",
        "MANAGERIAL": "📊 Managerial Round",
        "CASE_STUDY": "📋 Case Study Round",
    }
    type_label = INTERVIEW_TYPE_LABELS.get(interview_type or "", _html.escape(interview_type or "")) if interview_type else None

    # interview_link is used in an href — only include if it's a safe URL scheme
    safe_link = interview_link if interview_link and interview_link.startswith(("http://", "https://")) else None
    link_html = (
        f'<p style="margin-top:16px;"><a class="btn" href="{_html.escape(safe_link)}">Join Online Interview</a></p>'
    ) if safe_link else ""

    location_html = (
        f'<p style="margin:4px 0;">📍 <strong>Location:</strong> {i_location}</p>'
    ) if i_location else ""

    type_html = (
        f'<p style="margin:4px 0;">🎯 <strong>Interview Type:</strong> {type_label}</p>'
    ) if type_label else ""

    body = f"""
    <p>Hi <strong>{s_name}</strong>,</p>
    <p>Great news! An interview has been scheduled for your application to
    <strong>{j_title}</strong> at <strong>{c_name}</strong>.</p>
    <div style="background:#f5f3ff;border-left:4px solid #6366f1;padding:16px;border-radius:6px;margin:16px 0;">
      <p style="margin:4px 0;">📅 <strong>Date &amp; Time:</strong> {i_date}</p>
      {type_html.strip()}
      {location_html.strip()}
    </div>
    {link_html}
    <p>Prepare thoroughly and log in to your SmartHire dashboard for the latest updates.</p>
    <a class="btn" href="{settings.APP_BASE_URL}/student/applications">View Application</a>
    """
    _send(to, f"Interview Scheduled — {j_title} at {c_name}", _base_template(
        "Interview Scheduled 📅", body
    ))


def send_selection_email(
    to: str,
    student_name: str,
    job_title: str,
    company_name: str,
) -> None:
    """Congratulatory email for SELECTED status."""
    s_name = _html.escape(student_name or "")
    j_title = _html.escape(job_title or "")
    c_name = _html.escape(company_name or "")
    body = f"""
    <p>Hi <strong>{s_name}</strong>,</p>
    <p>🎉 Congratulations! You have been <strong>selected</strong> for the position of
    <strong>{j_title}</strong> at <strong>{c_name}</strong>.</p>
    <p>The placement cell will reach out with the next steps soon.</p>
    <a class="btn" href="{settings.APP_BASE_URL}/student/applications">View Details</a>
    """
    _send(to, f"🎉 Congratulations — Offer from {c_name}!", _base_template(
        "You've been selected!", body
    ))


def send_rejection_email(
    to: str,
    student_name: str,
    job_title: str,
    company_name: str,
    remarks: str | None = None,
) -> None:
    """Polite rejection email."""
    s_name = _html.escape(student_name or "")
    j_title = _html.escape(job_title or "")
    c_name = _html.escape(company_name or "")
    remarks_html = (
        f'<p style="margin-top:12px;padding:12px;background:#f9fafb;'
        f'border-left:3px solid #ef4444;border-radius:4px;">'
        f'<strong>Feedback:</strong> {_html.escape(remarks)}</p>'
    ) if remarks else ""

    body = f"""
    <p>Hi <strong>{s_name}</strong>,</p>
    <p>Thank you for applying to <strong>{j_title}</strong> at
    <strong>{c_name}</strong>. After careful consideration, we regret to
    inform you that you have not been selected for this position.</p>
    {remarks_html}
    <p>Don't be discouraged — keep exploring other opportunities on SmartHire!</p>
    <a class="btn" href="{settings.APP_BASE_URL}/student/jobs">Browse More Jobs</a>
    """
    _send(to, f"Application Update — {j_title} at {c_name}", _base_template(
        "Application Status Update", body
    ))


def send_password_reset_email(to: str, full_name: str, reset_token: str) -> None:
    """Password reset link email (Feature 7)."""
    reset_url = f"{settings.APP_BASE_URL}/reset-password?token={reset_token}"
    f_name = _html.escape(full_name or "")
    body = f"""
    <p>Hi <strong>{f_name}</strong>,</p>
    <p>We received a request to reset your SmartHire password. Click the button
    below to create a new password. This link expires in <strong>30 minutes</strong>.</p>
    <a class="btn" href="{reset_url}">Reset My Password</a>
    <p style="margin-top:20px;font-size:12px;color:#9ca3af;">
      If you did not request a password reset, please ignore this email.
      Your password will not change.
    </p>
    """
    _send(to, "Reset Your SmartHire Password", _base_template(
        "Password Reset Request", body
    ))


def send_email_verification(to: str, full_name: str, verification_link: str) -> None:
    """Branded email verification link sent after signup."""
    f_name = _html.escape(full_name or "")
    body = f"""
    <p>Hi <strong>{f_name}</strong>,</p>
    <p>Welcome to <strong>SmartHire</strong>! Please verify your email address to activate
    your account. Click the button below — the link expires in <strong>24 hours</strong>.</p>
    <a class="btn" href="{verification_link}">Verify My Email</a>
    <p style="margin-top:20px;font-size:12px;color:#9ca3af;">
      If you did not create a SmartHire account, please ignore this email.
    </p>
    """
    _send(to, "Verify your SmartHire email address", _base_template(
        "Email Verification", body
    ))


def send_welcome_email(to: str, full_name: str, role: str) -> None:
    """Welcome email sent on first login after role selection."""
    f_name = _html.escape(full_name or "")
    ROLE_MESSAGES = {
        "STUDENT": (
            "Complete your profile, upload your resume, and start browsing jobs tailored to you.",
            "/student/dashboard",
            "Go to My Dashboard",
        ),
        "PLACEMENT_ADMIN": (
            "Manage students, companies, and placements across the campus.",
            "/admin/dashboard",
            "Go to Admin Dashboard",
        ),
        "COLLEGE_MANAGEMENT": (
            "View real-time analytics and placement reports for your institution.",
            "/management/dashboard",
            "View Analytics",
        ),
    }
    message, dashboard_path, cta_label = ROLE_MESSAGES.get(
        role, ("Get started with SmartHire today.", "/", "Go to Dashboard")
    )

    body = f"""
    <p>Hi <strong>{f_name}</strong>,</p>
    <p>Welcome to <strong>SmartHire</strong> — your smart campus placement portal!</p>
    <p>{message}</p>
    <a class="btn" href="{settings.APP_BASE_URL}{dashboard_path}">{cta_label}</a>
    <p style="margin-top:20px;color:#6b7280;font-size:13px;">
      If you have any questions, reach out to your placement coordinator.
    </p>
    """
    _send(to, "Welcome to SmartHire!", _base_template(
        "Welcome to SmartHire 🎓", body
    ))


def send_otp_email(to: str, full_name: str, otp_code: str) -> None:
    """Send a 6-digit OTP code for password-change verification."""
    f_name = _html.escape(full_name or "")
    code = _html.escape(otp_code or "")
    body = f"""
    <p>Hi <strong>{f_name}</strong>,</p>
    <p>You requested to change your <strong>SmartHire</strong> account password.
       Use the verification code below to confirm your identity:</p>
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background:#f5f3ff;border:2px solid #6366f1;
                  border-radius:12px;padding:20px 40px;">
        <span style="font-size:38px;font-weight:800;letter-spacing:14px;
                     color:#6366f1;font-family:monospace;">{code}</span>
      </div>
    </div>
    <p>This code is valid for <strong>10 minutes</strong>. Never share it with anyone.</p>
    <p style="margin-top:16px;font-size:12px;color:#9ca3af;">
      If you did not request a password change, please
      <a href="{settings.APP_BASE_URL}/forgot-password" style="color:#6366f1;">
        secure your account</a> immediately.
    </p>
    """
    _send(to, "Your SmartHire password-change verification code", _base_template(
        "Password Change Verification", body
    ))


def send_password_reset_link_email(to: str, full_name: str, reset_url: str) -> None:
    """Branded password-reset link sent for the custom forgot-password flow."""
    f_name = _html.escape(full_name or "")
    body = f"""
    <p>Hi <strong>{f_name}</strong>,</p>
    <p>We received a request to reset your SmartHire password.
       Click the button below to set a new password.
       This link expires in <strong>30 minutes</strong>.</p>
    <a class="btn" href="{reset_url}">Reset My Password</a>
    <p style="margin-top:20px;font-size:12px;color:#9ca3af;">
      If you did not request a password reset, please ignore this email.
      Your password will not change.
    </p>
    """
    _send(to, "Reset your SmartHire password", _base_template(
        "Password Reset Request", body
    ))


def send_password_changed_email(to: str, full_name: str) -> None:
    """Security notification sent when a user changes their password."""
    f_name = _html.escape(full_name or "")
    safe_to = _html.escape(to or "")
    body = f"""
    <p>Hi <strong>{f_name}</strong>,</p>
    <p>This is a confirmation that the password for your SmartHire account
    (<strong>{safe_to}</strong>) was recently changed.</p>
    <p>If you made this change, you can safely ignore this email.</p>
    <p>If you did <strong>not</strong> change your password, your account may be compromised.
    Please reset it immediately:</p>
    <a class="btn" href="{settings.APP_BASE_URL}/forgot-password">Reset My Password</a>
    """
    _send(to, "Your SmartHire password was changed", _base_template(
        "Password Changed \U0001f512", body
    ))


# ── Placement Admin Approval Emails ───────────────────────────────────────────

def send_admin_approval_request_to_owner(
    owner_email: str,
    admin_name: str,
    admin_email: str,
    approve_url: str = "",
) -> None:
    """Notify portal owner that a new placement admin is awaiting approval."""
    safe_name = _html.escape(admin_name or "")
    safe_email = _html.escape(admin_email or "")
    safe_approve_url = approve_url or f"{settings.APP_BASE_URL}/management/admin-requests"
    body = f"""
    <p>Hi,</p>
    <p>A new user has requested <strong>Placement Admin</strong> access on SmartHire:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;color:#374151;">Name:</td>
          <td style="padding:8px;">{safe_name}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;color:#374151;">Email:</td>
          <td style="padding:8px;">{safe_email}</td></tr>
    </table>
    <p>Click the button below to <strong>verify and approve</strong> this account instantly:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="{safe_approve_url}"
         style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 36px;
                border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">
        &#10003; Verify &amp; Approve Account
      </a>
    </div>
    <p style="color:#6b7280;font-size:13px;text-align:center;">
      Clicking this button will immediately activate the admin account.<br>
      To reject instead, visit the
      <a href="{settings.APP_BASE_URL}/management/admin-requests" style="color:#6366f1;">Admin Requests</a> page.
    </p>
    """
    _send(owner_email, f"New Admin Request — {safe_name}", _base_template(
        "New Admin Approval Request", body
    ))


def send_admin_approved_email(admin_email: str, admin_name: str) -> None:
    """Tell the placement admin their account has been approved."""
    safe_name = _html.escape(admin_name or "")
    body = f"""
    <p>Hi <strong>{safe_name}</strong>,</p>
    <p>Great news! Your <strong>Placement Admin</strong> account on SmartHire has been
    <span style="color:#059669;font-weight:bold;">approved</span> by the portal owner.</p>
    <p>You can now log in and start managing placements for your institution.</p>
    <a class="btn" href="{settings.APP_BASE_URL}/login">Login to SmartHire</a>
    """
    _send(admin_email, "Your SmartHire Admin Account is Approved!", _base_template(
        "Account Approved \u2713", body
    ))


def send_admin_rejected_email(
    admin_email: str, admin_name: str, reason: str
) -> None:
    """Tell the placement admin their request was not approved."""
    safe_name = _html.escape(admin_name or "")
    safe_reason = _html.escape(reason or "No reason provided.")
    body = f"""
    <p>Hi <strong>{safe_name}</strong>,</p>
    <p>Unfortunately, your Placement Admin account request on SmartHire was
    <span style="color:#dc2626;font-weight:bold;">not approved</span>.</p>
    <p><strong>Reason:</strong> {safe_reason}</p>
    <p>If you believe this is an error, please contact the portal administrator directly.</p>
    """
    _send(admin_email, "SmartHire Admin Request — Not Approved", _base_template(
        "Request Not Approved", body
    ))
