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

    const [auth, db] = await Promise.all([getAdminAuth(), getAdminDb()]);

    // 1. Set Firebase custom claim to the actual requested role
    await auth.setCustomUserClaims(userId, { role: requestedRole });

    const now = new Date();

    // 2. Update Firestore user doc
    await db.collection("users").doc(userId).update({
      role: requestedRole,
      isVerifiedAdmin: true,
      is_active: true,
      updated_at: now,
    });

    // 3. Fetch request data for email
    const reqDoc = await db.collection("admin_requests").doc(userId).get();
    const reqData = reqDoc.exists ? (reqDoc.data() ?? {}) : {};

    // 4. Mark admin_requests as approved
    await db.collection("admin_requests").doc(userId).update({
      status: "approved",
      approvedBy: "super_admin",
      approvedAt: now,
    });

    // 5. Send approval email via backend (non-fatal)
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
      await fetch(`${apiUrl}/api/v1/auth/super-admin/requests/${userId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Super-Admin-Secret": process.env.SUPER_ADMIN_SECRET ?? "",
        },
        body: JSON.stringify({ requestedRole }),
      });
    } catch {
      // Non-fatal — Firestore already updated, email is best-effort
    }

    return NextResponse.json({ message: "approved", user_id: userId, email: reqData.email });
  } catch (err) {
    console.error("[super-admin/approve] Error:", err);
    return NextResponse.json({ error: "Failed to approve request" }, { status: 500 });
  }
}
