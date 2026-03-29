import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

function requireSuperAdminSession(request: NextRequest): NextResponse | null {
  const session = request.cookies.get("__sa_session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authError = requireSuperAdminSession(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") ?? "pending";

  try {
    const db = await getAdminDb();
    const snap = await db
      .collection("admin_requests")
      .where("status", "==", statusFilter)
      .get();

    const requests = snap.docs.map((doc) => {
      const data = doc.data();
      // Serialize Firestore Timestamps to ISO strings
      const serialized: Record<string, unknown> = { id: doc.id, ...data };
      for (const [k, v] of Object.entries(serialized)) {
        if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: unknown }).toDate === "function") {
          serialized[k] = (v as { toDate: () => Date }).toDate().toISOString();
        }
      }
      return serialized;
    });

    return NextResponse.json({ requests });
  } catch (err) {
    console.error("[super-admin/requests] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch requests. Check server logs." },
      { status: 500 }
    );
  }
}
