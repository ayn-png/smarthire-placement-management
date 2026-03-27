import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROLE_ROUTES: Record<string, string[]> = {
  STUDENT: ["/student"],
  PLACEMENT_ADMIN: ["/admin"],
  COLLEGE_MANAGEMENT: ["/management"],
};

const DASHBOARD_MAP: Record<string, string> = {
  STUDENT: "/student/dashboard",
  PLACEMENT_ADMIN: "/admin/dashboard",
  COLLEGE_MANAGEMENT: "/management/dashboard",
};

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static public paths
  const publicPaths = ["/forgot-password", "/reset-password", "/verify-email"];
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const session = request.cookies.get("__session")?.value;
  const roleCookie = request.cookies.get("__role")?.value;
  const isLoggedIn = !!session;

  // Super admin route protection
  if (pathname.startsWith("/super-admin")) {
    // Always allow the login page itself
    if (pathname === "/super-admin/login") {
      const saSession = request.cookies.get("__sa_session")?.value;
      // Already logged in — redirect to dashboard
      if (saSession) return NextResponse.redirect(new URL("/super-admin", request.url));
      return NextResponse.next();
    }
    const saSession = request.cookies.get("__sa_session")?.value;
    if (!saSession) {
      return NextResponse.redirect(new URL("/super-admin/login", request.url));
    }
    return NextResponse.next();
  }

  const isProtected = ["/student", "/admin", "/management"].some((p) =>
    pathname.startsWith(p)
  );
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isRoleSelect = pathname === "/signup/role-select";

  // Root redirect
  if (pathname === "/") {
    if (isLoggedIn && roleCookie) {
      return NextResponse.redirect(
        new URL(DASHBOARD_MAP[roleCookie] ?? "/signup/role-select", request.url)
      );
    }
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/signup/role-select", request.url));
    }
    return NextResponse.next();
  }

  // Role-select requires login
  if (isRoleSelect && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Auth pages redirect already-logged-in users to their dashboard
  if (isAuthPage && isLoggedIn) {
    const dest = roleCookie
      ? (DASHBOARD_MAP[roleCookie] ?? "/signup/role-select")
      : "/signup/role-select";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Protected routes require login
  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Enforce role-based route access
  if (isProtected && isLoggedIn && roleCookie) {
    for (const [routeRole, paths] of Object.entries(ROLE_ROUTES)) {
      if (paths.some((p) => pathname.startsWith(p)) && roleCookie !== routeRole) {
        const dest = DASHBOARD_MAP[roleCookie] ?? "/signup/role-select";
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
