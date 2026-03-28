"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const DASHBOARD_MAP: Record<string, string> = {
  STUDENT: "/student/dashboard",
  PLACEMENT_ADMIN: "/admin/dashboard",
  COLLEGE_MANAGEMENT: "/management/dashboard",
  COMPANY: "/company/dashboard",
};

/**
 * /auth/refresh
 *
 * This page is the landing target for the approval email link instead of /login.
 *
 * Problem it solves:
 *   After super admin approves a placement admin, Firebase updates the custom
 *   claim server-side but the user's browser still holds a stale __role cookie
 *   set to "STUDENT" (the pending state). When they click "Login to SmartHire"
 *   in the approval email they hit /login, but middleware intercepts that page
 *   (because __session is still set) and redirects them to /student/dashboard
 *   using the stale cookie — the login page never loads, the force-refresh never
 *   runs, and the new claim is never picked up.
 *
 * Solution:
 *   Middleware does not protect /auth/refresh, so the page always loads.
 *   It calls getIdTokenResult(true) which force-refreshes the token from
 *   Firebase servers, picks up the now-correct claim, writes the __role cookie,
 *   and redirects to the right dashboard. If the user isn't signed in at all,
 *   it redirects to /login so they can authenticate normally.
 */
export default function AuthRefreshPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Verifying your account…");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // only need this once

      if (!user) {
        // Not signed in — send to login
        router.replace("/login");
        return;
      }

      try {
        setStatus("Refreshing your access token…");
        // Force-refresh the token so we get the latest custom claims from Firebase
        const tokenResult = await user.getIdTokenResult(true);
        const role = tokenResult.claims.role as string | undefined;

        // Update cookies
        document.cookie = "__session=1; path=/; SameSite=Lax";
        if (role) {
          document.cookie = `__role=${role}; path=/; SameSite=Lax`;
          setStatus("Access granted! Redirecting to your dashboard…");
          router.replace(DASHBOARD_MAP[role] ?? "/signup/role-select");
        } else {
          // No role yet (shouldn't happen post-approval, but handle gracefully)
          router.replace("/signup/role-select");
        }
      } catch {
        // If token refresh fails for any reason, fall back to login
        setStatus("Something went wrong. Redirecting to login…");
        setTimeout(() => router.replace("/login"), 1500);
      }
    });
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      {/* Simple spinner */}
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-white/60 text-sm">{status}</p>
    </div>
  );
}
