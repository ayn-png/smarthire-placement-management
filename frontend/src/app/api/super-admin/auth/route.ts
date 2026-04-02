import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter — 5 attempts / 60s per IP
const attempts = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

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
