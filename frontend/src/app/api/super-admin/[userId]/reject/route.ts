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

    // 2. Update admin_requests status
    await db.collection("admin_requests").doc(userId).update({
      status: "rejected",
      rejectionReason: reason,
      approvedBy: "super_admin",
      approvedAt: now,
    });

    // 3. Update user doc
    await db.collection("users").doc(userId).update({
      is_active: false,
      updated_at: now,
    }).catch(() => {
      // User doc might not exist if firebase-sync never ran — ok
    });

    // 4. Send rejection email via backend (non-fatal)
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
      await fetch(`${apiUrl}/api/v1/auth/super-admin/requests/${userId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Super-Admin-Secret": process.env.SUPER_ADMIN_SECRET ?? "",
        },
        body: JSON.stringify({ reason }),
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ message: "rejected", user_id: userId, email: reqData.email });
  } catch (err) {
    console.error("[super-admin/reject] Error:", err);
    return NextResponse.json({ error: "Failed to reject request" }, { status: 500 });
  }
}
