import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { sendRejectionEmail } from "@/lib/mailer";

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  try {
    const body = await request.json().catch(() => ({}));
    const reason: string = body.reason ?? "";

    const db = await getAdminDb();
    const now = new Date();

    // 1. Fetch request data for email
    const reqDoc = await db.collection("admin_requests").doc(userId).get();
    const reqData = reqDoc.exists ? (reqDoc.data() ?? {}) : {};
    const adminEmail: string = reqData.email ?? "";
    const adminName: string = reqData.full_name ?? "";

    // 2. Update admin_requests status
    if (reqDoc.exists) {
      await db.collection("admin_requests").doc(userId).update({
        status: "rejected",
        rejectionReason: reason,
        approvedBy: "super_admin",
        approvedAt: now,
      });
    } else {
      await db.collection("admin_requests").doc(userId).set({
        userId,
        status: "rejected",
        rejectionReason: reason,
        approvedBy: "super_admin",
        approvedAt: now,
      });
    }

    // 3. Mark user inactive in users collection (non-fatal)
    try {
      await db.collection("users").doc(userId).set(
        { is_active: false, updated_at: now },
        { merge: true }
      );
    } catch (userErr) {
      console.warn("[super-admin/reject] user doc update failed (non-fatal):", userErr);
    }

    // 4. Send rejection email — surface error in response for debugging
    let emailSent = false;
    let emailError: string | null = null;

    if (adminEmail) {
      try {
        await sendRejectionEmail(adminEmail, adminName, reason);
        emailSent = true;
        console.log(`[super-admin/reject] ✅ Email sent to ${adminEmail}`);
      } catch (emailErr) {
        emailError = emailErr instanceof Error ? emailErr.message : String(emailErr);
        console.error(`[super-admin/reject] ❌ Email FAILED to ${adminEmail}:`, emailError);
      }
    } else {
      emailError = `No email address found for userId ${userId}`;
      console.warn(`[super-admin/reject] ${emailError}`);
    }

    return NextResponse.json({
      message: "rejected",
      user_id: userId,
      email: adminEmail,
      name: adminName,
      emailSent,
      emailError,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[super-admin/reject] Error:", msg);
    return NextResponse.json({ error: "Failed to reject request", detail: msg }, { status: 500 });
  }
}
