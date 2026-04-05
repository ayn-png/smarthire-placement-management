const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

function getApiKey(): string {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    throw new Error(
      "[mailer] SENDGRID_API_KEY is not set. Add it to Render frontend env vars."
    );
  }
  return key;
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

async function sendMail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const resp = await fetch(SENDGRID_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: process.env.SENDGRID_FROM_EMAIL ?? "noreply@smarthire.com", name: "SmartHire" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`[mailer] SendGrid API error ${resp.status}: ${body}`);
  }
}

/** If name looks like an email address, fall back to "Admin" */
function safeName(name: string): string {
  if (!name || name.includes("@")) return "Admin";
  return name.trim();
}

export async function sendApprovalEmail(
  to: string,
  name: string
): Promise<void> {
  const displayName = safeName(name);
  const appUrl = getAppUrl();
  await sendMail(
    to,
    "SmartHire Admin Access Approved ✅",
    `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#16a34a;margin:0;font-size:24px;">✅ Account Approved</h1>
      </div>
      <p style="font-size:15px;color:#111827;">Hi <strong>${displayName}</strong>,</p>
      <p style="font-size:15px;color:#374151;">
        Your <strong>Placement Admin</strong> account on <strong>SmartHire</strong> has been
        <span style="color:#16a34a;font-weight:bold;">approved</span> by the Super User.
      </p>
      <p style="font-size:15px;color:#374151;">
        You can now log in and access your admin dashboard.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${appUrl}/auth/refresh"
           style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
          Login to SmartHire →
        </a>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="margin:0;color:#6b7280;font-size:13px;text-align:center;">— SmartHire Team</p>
    </div>
    `
  );
}

export async function sendRejectionEmail(
  to: string,
  name: string,
  reason: string
): Promise<void> {
  const displayName = safeName(name);
  const safeReason = reason?.trim() || "No specific reason provided.";
  await sendMail(
    to,
    "SmartHire Admin Request — Not Approved",
    `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#dc2626;margin:0;font-size:24px;">❌ Request Not Approved</h1>
      </div>
      <p style="font-size:15px;color:#111827;">Hi <strong>${displayName}</strong>,</p>
      <p style="font-size:15px;color:#374151;">
        Unfortunately, your <strong>Placement Admin</strong> account request on
        <strong>SmartHire</strong> was
        <span style="color:#dc2626;font-weight:bold;">not approved</span> by the Super User.
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin:16px 0;">
        <p style="margin:0;color:#991b1b;font-size:14px;"><strong>Reason:</strong> ${safeReason}</p>
      </div>
      <p style="font-size:13px;color:#6b7280;">
        If you believe this is an error, please contact the portal administrator directly.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="margin:0;color:#6b7280;font-size:13px;text-align:center;">— SmartHire Team</p>
    </div>
    `
  );
}
