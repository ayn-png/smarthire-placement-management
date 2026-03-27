import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const superEmail = process.env.SUPER_ADMIN_EMAIL ?? "";
    const superPassword = process.env.SUPER_ADMIN_PASSWORD ?? "";

    // Super admin credentials not configured on this server
    if (!superEmail || !superPassword) {
      return NextResponse.json({
        type: "not_configured",
        error: "Super admin credentials are not configured. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables.",
      }, { status: 503 });
    }

    // Email doesn't match super-admin at all — let caller fall through to Firebase
    if (!email || email !== superEmail) {
      return NextResponse.json({ type: "not_super_admin" }, { status: 401 });
    }

    // Email matches but password is wrong — stop here, don't try Firebase
    if (!password || password !== superPassword) {
      return NextResponse.json({ type: "wrong_password", error: "Invalid super admin password" }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set("__sa_session", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
