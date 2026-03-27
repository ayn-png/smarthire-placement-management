import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  try {
    const [auth, db] = await Promise.all([getAdminAuth(), getAdminDb()]);

    // 1. Delete from Firebase Auth
    await auth.deleteUser(userId).catch((err: unknown) => {
      // If user not found in Auth that's fine — continue with Firestore cleanup
      const code = (err as { code?: string })?.code;
      if (code !== "auth/user-not-found") throw err;
    });

    // 2. Delete from Firestore users collection
    await db.collection("users").doc(userId).delete().catch(() => { /* ok */ });

    // 3. Mark admin_requests as deleted (keep for audit trail)
    await db.collection("admin_requests").doc(userId).update({
      status: "deleted",
      deletedAt: new Date(),
    }).catch(() => { /* ok if doc doesn't exist */ });

    // 4. Clean up student_profiles if exists
    await db.collection("student_profiles").doc(userId).delete().catch(() => { /* ok */ });

    return NextResponse.json({ message: "deleted", user_id: userId });
  } catch (err) {
    console.error("[super-admin/delete] Error:", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
