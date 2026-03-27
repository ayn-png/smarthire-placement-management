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

    // 4. Send rejection email directly via nodemailer (no backend round-trip)
    if (adminEmail) {
      try {
        await sendRejectionEmail(adminEmail, adminName, reason);
        console.log(`[super-admin/reject] Email sent to ${adminEmail}`);
      } catch (emailErr) {
        console.error("[super-admin/reject] Email send failed:", emailErr);
        // Non-fatal — rejection already applied in Firestore
      }
    } else {
      console.warn(`[super-admin/reject] No email address found for userId ${userId} — skipping email`);
    }

    return NextResponse.json({ message: "rejected", user_id: userId, email: adminEmail, name: adminName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[super-admin/reject] Error:", msg);
    return NextResponse.json({ error: "Failed to reject request", detail: msg }, { status: 500 });
  }
}
