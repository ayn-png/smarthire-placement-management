import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { sendApprovalEmail } from "@/lib/mailer";

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  try {
    const body = await request.json().catch(() => ({}));
    const requestedRole: string = body.requestedRole ?? "PLACEMENT_ADMIN";

    const db = await getAdminDb();
    const now = new Date();

    // 1. Fetch request data (for email + name)
    const reqDoc = await db.collection("admin_requests").doc(userId).get();
    const reqData = reqDoc.exists ? (reqDoc.data() ?? {}) : {};
    const adminEmail: string = reqData.email ?? "";
    const adminName: string = reqData.full_name ?? "";

    // 2. Set Firebase custom claim (non-fatal — user may not exist in Auth for test data)
    try {
      const auth = await getAdminAuth();
      await auth.setCustomUserClaims(userId, { role: requestedRole });
    } catch (claimErr) {
      console.warn(
        `[super-admin/approve] setCustomUserClaims skipped for ${userId}:`,
        claimErr instanceof Error ? claimErr.message : claimErr
      );
    }

    // 3. Upsert Firestore user doc
    await db.collection("users").doc(userId).set(
      { role: requestedRole, isVerifiedAdmin: true, is_active: true, updated_at: now },
      { merge: true }
    );

    // 4. Mark admin_requests as approved
    if (reqDoc.exists) {
      await db.collection("admin_requests").doc(userId).update({
        status: "approved",
        approvedBy: "super_admin",
        approvedAt: now,
      });
    } else {
      await db.collection("admin_requests").doc(userId).set({
        userId,
        status: "approved",
        approvedBy: "super_admin",
        approvedAt: now,
        requestedRole,
      });
    }

    // 5. Send approval email directly via nodemailer (no backend round-trip)
    if (adminEmail) {
      try {
        await sendApprovalEmail(adminEmail, adminName);
        console.log(`[super-admin/approve] Email sent to ${adminEmail}`);
      } catch (emailErr) {
        console.error("[super-admin/approve] Email send failed:", emailErr);
        // Non-fatal — approval already applied in Firestore
      }
    } else {
      console.warn(`[super-admin/approve] No email address found for userId ${userId} — skipping email`);
    }

    return NextResponse.json({ message: "approved", user_id: userId, email: adminEmail, name: adminName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[super-admin/approve] Error:", msg);
    return NextResponse.json({ error: "Failed to approve request", detail: msg }, { status: 500 });
  }
}
