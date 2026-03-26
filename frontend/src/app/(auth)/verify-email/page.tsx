"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw, LogOut, CheckCircle, AlertCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { sendEmailVerification, signOut } from "firebase/auth";
import Button from "@/components/ui/Button";

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyEmailPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserEmail(user.email);
    }

    // Poll every 5 seconds to detect when the user has verified their email
    pollRef.current = setInterval(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        await currentUser.reload();
        if (currentUser.emailVerified) {
          clearInterval(pollRef.current!);
          // Redirect to role selection or dashboard based on token claims
          const tokenResult = await currentUser.getIdTokenResult();
          const role = tokenResult.claims.role as string | undefined;
          if (role) {
            const dashboardMap: Record<string, string> = {
              STUDENT: "/student/dashboard",
              PLACEMENT_ADMIN: "/admin/dashboard",
              COLLEGE_MANAGEMENT: "/management/dashboard",
            };
            router.push(dashboardMap[role] ?? "/signup/role-select");
          } else {
            router.push("/signup/role-select");
          }
        }
      } catch {
        // Silently ignore reload errors
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [router]);

  async function handleResend() {
    const user = auth.currentUser;
    if (!user) return;
    setResending(true);
    setResendSuccess(false);
    setResendError("");
    try {
      await sendEmailVerification(user, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setResendSuccess(true);
      // Start cooldown
      setCooldown(RESEND_COOLDOWN);
      cooldownRef.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(cooldownRef.current!);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/too-many-requests") {
        setResendError("Too many requests. Check your inbox — the email may already be there.");
      } else {
        setResendError("Failed to resend. Please try again.");
      }
    } finally {
      setResending(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      document.cookie = "__role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/10 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mb-5 shadow-lg">
        <Mail className="w-8 h-8 text-white" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Verify your email</h1>
      <p className="text-white/60 text-sm mb-1">
        We sent a verification email to:
      </p>
      {userEmail && (
        <p className="text-primary-300 font-semibold text-sm mb-6 break-all">{userEmail}</p>
      )}
      <p className="text-white/50 text-sm mb-8">
        Click the link in that email, then return here — we&apos;ll automatically redirect you once verified.
      </p>

      {resendSuccess && (
        <div className="flex items-center gap-2 justify-center text-emerald-400 text-sm mb-4">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Verification email sent! Check your inbox (and Spam folder).
        </div>
      )}
      {resendError && (
        <div className="flex items-center gap-2 justify-center text-red-400 text-sm mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {resendError}
        </div>
      )}

      <div className="space-y-3">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          loading={resending}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
        </Button>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 text-white/50 hover:text-white/70 text-sm transition-colors py-2"
        >
          <LogOut className="w-4 h-4" />
          Sign out and use a different account
        </button>
      </div>
    </div>
  );
}
