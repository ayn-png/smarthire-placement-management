import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

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

    // 2. Update admin_requests status (update if exists, set if not)
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

    // 3. Update user doc to inactive (non-fatal — doc may not exist for test data)
    try {
      await db.collection("users").doc(userId).set(
        { is_active: false, updated_at: now },
        { merge: true }
      );
    } catch (userErr) {
      console.warn("[super-admin/reject] user doc update failed (non-fatal):", userErr);
    }

    // 4. Send rejection email via backend (non-fatal)
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
      const emailResp = await fetch(`${apiUrl}/api/v1/auth/super-admin/requests/${userId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Super-Admin-Secret": process.env.SUPER_ADMIN_SECRET ?? "",
        },
        body: JSON.stringify({ reason }),
      });
      if (!emailResp.ok) {
        const errBody = await emailResp.text().catch(() => "");
        // ACTUAL ROOT CAUSE surfaced: if SUPER_ADMIN_SECRET does not match on the backend,
        // this returns 403 and the rejection email is NEVER queued.
        // Fix: ensure SUPER_ADMIN_SECRET matches in both frontend (.env.local / Render frontend env)
        // and backend (.env / Render backend env).
        console.error(
          `[super-admin/reject] Backend email endpoint returned HTTP ${emailResp.status} — ` +
          `rejection email NOT sent. Check SUPER_ADMIN_SECRET matches on both services. Body: ${errBody}`
        );
      }
    } catch (emailErr) {
      console.warn("[super-admin/reject] Backend email call failed (network error):", emailErr);
    }

    return NextResponse.json({ message: "rejected", user_id: userId, email: adminEmail, name: adminName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[super-admin/reject] Error:", msg);
    return NextResponse.json({ error: "Failed to reject request", detail: msg }, { status: 500 });
  }
}
