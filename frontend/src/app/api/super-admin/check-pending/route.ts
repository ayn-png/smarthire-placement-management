import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

/**
 * GET /api/super-admin/check-pending?uid=XXX
 *
 * Checks whether a given Firebase UID has an entry in the `admin_requests`
 * collection (pending/rejected/approved). Used by the login page to block
 * pending admins who currently hold a "STUDENT" Firebase custom claim while
 * awaiting super-admin approval.
 *
 * No auth required — the UID is the user's own UID just obtained from a
 * successful Firebase sign-in, so there is no sensitive data exposure.
 */
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ status: null });

  try {
    const db = await getAdminDb();
    const doc = await db.collection("admin_requests").doc(uid).get();

    if (!doc.exists) return NextResponse.json({ status: null });

    const data = doc.data() ?? {};
    return NextResponse.json({
      status: data.status ?? null,
      requestedRole: data.requestedRole ?? null,
    });
  } catch (err) {
    console.error("[check-pending] Firestore error:", err);
    // Return null status — login page treats this as non-fatal (falls through)
    return NextResponse.json({ status: null });
  }
}
