import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") ?? "pending";

  try {
    const resp = await fetch(
      `${BACKEND_URL}/api/v1/auth/super-admin/requests?status_filter=${statusFilter}`,
      {
        headers: {
          "X-Super-Admin-Secret": process.env.SUPER_ADMIN_SECRET ?? "",
        },
        cache: "no-store",
      }
    );
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}
