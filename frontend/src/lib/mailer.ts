import nodemailer from "nodemailer";

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASSWORD!,
    },
  });
}

const FROM = process.env.SMTP_FROM ?? "SmartHire <aalamaynn@gmail.com>";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://smarthire-frontend-i3ww.onrender.com";

export async function sendApprovalEmail(to: string, name: string): Promise<void> {
  const safeName = name || "Admin";
  await getTransport().sendMail({
    from: FROM,
    to,
    subject: "Your SmartHire Admin Account is Approved!",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#16a34a;margin-bottom:8px;">Account Approved ✓</h2>
        <p>Hi <strong>${safeName}</strong>,</p>
        <p>Your <strong>Placement Admin</strong> account on <strong>SmartHire</strong> has been
           <span style="color:#16a34a;font-weight:bold;">approved</span> by the Super Admin.</p>
        <p>You can now log in and access your admin dashboard.</p>
        <p style="margin-top:24px;">
          <a href="${APP_URL}/login"
             style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Login to SmartHire
          </a>
        </p>
        <p style="margin-top:24px;color:#6b7280;font-size:13px;">— SmartHire Team</p>
      </div>
    `,
  });
}

export async function sendRejectionEmail(
  to: string,
  name: string,
  reason: string
): Promise<void> {
  const safeName = name || "Admin";
  const safeReason = reason || "No reason provided.";
  await getTransport().sendMail({
    from: FROM,
    to,
    subject: "SmartHire Admin Request — Not Approved",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#dc2626;margin-bottom:8px;">Request Not Approved</h2>
        <p>Hi <strong>${safeName}</strong>,</p>
        <p>Unfortunately, your Placement Admin account request on <strong>SmartHire</strong> was
           <span style="color:#dc2626;font-weight:bold;">not approved</span> by the Super Admin.</p>
        <p><strong>Reason:</strong> ${safeReason}</p>
        <p style="color:#6b7280;font-size:13px;">
          If you believe this is an error, please contact the portal administrator directly.
        </p>
        <p style="margin-top:24px;color:#6b7280;font-size:13px;">— SmartHire Team</p>
      </div>
    `,
  });
}
