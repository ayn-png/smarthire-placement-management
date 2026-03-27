import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

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

    // 1. Fetch request data (for email + role info)
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

    // 3. Upsert Firestore user doc — set(merge) handles missing docs
    await db.collection("users").doc(userId).set(
      {
        role: requestedRole,
        isVerifiedAdmin: true,
        is_active: true,
        updated_at: now,
      },
      { merge: true }
    );

    // 4. Mark admin_requests as approved (update if exists, set if not)
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

    // 5. Send approval email via backend (non-fatal)
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
      const emailResp = await fetch(`${apiUrl}/api/v1/auth/super-admin/requests/${userId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Super-Admin-Secret": process.env.SUPER_ADMIN_SECRET ?? "",
        },
        body: JSON.stringify({ requestedRole }),
      });
      if (!emailResp.ok) {
        const errBody = await emailResp.text().catch(() => "");
        // ACTUAL ROOT CAUSE surfaced: if SUPER_ADMIN_SECRET does not match on the backend,
        // this returns 403 and the approval email is NEVER queued.
        // Fix: ensure SUPER_ADMIN_SECRET matches in both frontend (.env.local / Render frontend env)
        // and backend (.env / Render backend env).
        console.error(
          `[super-admin/approve] Backend email endpoint returned HTTP ${emailResp.status} — ` +
          `approval email NOT sent. Check SUPER_ADMIN_SECRET matches on both services. Body: ${errBody}`
        );
      }
    } catch (emailErr) {
      console.warn("[super-admin/approve] Backend email call failed (network error):", emailErr);
    }

    return NextResponse.json({ message: "approved", user_id: userId, email: adminEmail, name: adminName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[super-admin/approve] Error:", msg);
    return NextResponse.json({ error: "Failed to approve request", detail: msg }, { status: 500 });
  }
}
