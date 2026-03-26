import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const body = await request.json();
    const resp = await fetch(
      `${BACKEND_URL}/api/v1/auth/super-admin/requests/${params.userId}/reject`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Super-Admin-Secret": process.env.SUPER_ADMIN_SECRET ?? "",
        },
        body: JSON.stringify(body),
      }
    );
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "Failed to reject request" }, { status: 500 });
  }
}
