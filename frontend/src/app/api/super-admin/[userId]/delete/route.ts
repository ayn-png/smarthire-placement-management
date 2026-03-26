import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const resp = await fetch(
      `${BACKEND_URL}/api/v1/auth/super-admin/requests/${params.userId}`,
      {
        method: "DELETE",
        headers: {
          "X-Super-Admin-Secret": process.env.SUPER_ADMIN_SECRET ?? "",
        },
      }
    );
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
