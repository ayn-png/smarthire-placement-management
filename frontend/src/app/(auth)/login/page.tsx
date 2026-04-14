"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, RefreshCw } from "lucide-react";
import { signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, getRedirectResult, signInWithRedirect } from "firebase/auth";
import { auth } from "@/lib/firebase";
import GoogleIcon from "@/components/ui/GoogleIcon";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ShakeOnError } from "@/components/ui/Animations";
import { motion, AnimatePresence } from "framer-motion";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

const DASHBOARD_MAP: Record<string, string> = {
  STUDENT: "/student/dashboard",
  PLACEMENT_ADMIN: "/admin/dashboard",
  COLLEGE_MANAGEMENT: "/management/dashboard",
};

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (!result) return;
      const tokenResult = await result.user.getIdTokenResult(true);
      const role = tokenResult.claims.role as string | undefined;
      document.cookie = "__session=1; path=/; SameSite=Lax";
      if (role) {
        document.cookie = `__role=${role}; path=/; SameSite=Lax`;
        try {
          const token = await result.user.getIdToken();
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          await fetch(`${apiUrl}/api/v1/auth/self-sync`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch { /* non-fatal */ }
        router.push(DASHBOARD_MAP[role] ?? "/signup/role-select");
      } else {
        router.push("/signup/role-select");
      }
    }).catch(() => { /* ignore getRedirectResult errors */ });
  }, [router]);

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [lastPassword, setLastPassword] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendVerificationSuccess, setResendVerificationSuccess] = useState(false);
  const [resendVerificationError, setResendVerificationError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError("");
    setUnverifiedEmail(null);
    setLastPassword(data.password);
    setResendVerificationSuccess(false);
    setResendVerificationError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const pendingStatusPromise = fetch(
        `/api/super-admin/check-pending?uid=${userCredential.user.uid}`
      )
        .then(async (response) => {
          if (!response.ok) return null;
          const data = await response.json() as { status?: string };
          return data.status ?? null;
        })
        .catch(() => null);

      // Block unverified users
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        document.cookie = "__role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        setUnverifiedEmail(data.email);
        setServerError("Please verify your email before logging in.");
        return;
      }

      // Use cached claims first for faster login; force refresh only if role is missing.
      let tokenResult = await userCredential.user.getIdTokenResult();
      let role = tokenResult.claims.role as string | undefined;
      if (!role) {
        tokenResult = await userCredential.user.getIdTokenResult(true);
        role = tokenResult.claims.role as string | undefined;
      }

      // ── Pending-admin gate ────────────────────────────────────────────────
      // Pending admins have Firebase claim "STUDENT" until super admin approves.
      // Without this check they would be routed to /student/dashboard.
      if (role === "STUDENT") {
        try {
          const pendingStatus = await pendingStatusPromise;
          if (pendingStatus === "pending") {
            await signOut(auth);
            document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
            document.cookie = "__role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
            setServerError("Your account is not approved yet. Please wait for Super User approval.");
            return;
          }
          if (pendingStatus === "rejected") {
            await signOut(auth);
            document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
            document.cookie = "__role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
            setServerError("Your account request has been rejected. Please contact the portal administrator.");
            return;
          }
        } catch {
          // Non-fatal — if check fails, fall through and treat as normal student
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // Set cookies for middleware
      document.cookie = "__session=1; path=/; SameSite=Lax";
      if (role) {
        document.cookie = `__role=${role}; path=/; SameSite=Lax`;

        // For admin roles, check approval status before redirecting
        if (role === "PLACEMENT_ADMIN" || role === "COLLEGE_MANAGEMENT") {
          try {
            const token = await userCredential.user.getIdToken();
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const syncRes = await fetch(`${apiUrl}/api/v1/auth/self-sync`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (syncRes.status === 403) {
              const body = await syncRes.json().catch(() => ({ detail: "" }));
              const detail: string = body?.detail ?? "";
              await signOut(auth);
              document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
              document.cookie = "__role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
              if (detail.toLowerCase().includes("pending")) {
                setServerError("Your account is not approved yet. Please wait for Super User approval.");
              } else if (detail.toLowerCase().includes("reject")) {
                setServerError(detail);
              } else {
                setServerError("Access denied. Please contact the portal owner.");
              }
              return;
            }
          } catch {
            // Non-fatal — allow redirect if self-sync check fails
          }
        }

        router.push(DASHBOARD_MAP[role] ?? "/signup/role-select");
      } else {
        router.push("/signup/role-select");
      }
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      const code = firebaseErr?.code || "";
      // If Firebase login fails, try super-admin auth as a fallback path.
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        try {
          const saRes = await fetch("/api/super-admin/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: data.email, password: data.password }),
          });
          if (saRes.ok) {
            router.push("/super-admin");
            return;
          }
          const saBody = await saRes.json().catch(() => ({})) as { type?: string };
          if (saBody?.type === "wrong_password") {
            setServerError("Invalid super admin password.");
            return;
          }
        } catch {
          // Ignore fallback errors and show the standard Firebase error below.
        }
      }

      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setServerError("Invalid email or password");
      } else if (code === "auth/too-many-requests") {
        setServerError("Too many failed attempts. Please try again later.");
      } else {
        setServerError(firebaseErr?.message || "Sign in failed. Please try again.");
      }
    }
  }

  async function handleGoogleLogin() {
    setServerError("");
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const tokenResult = await result.user.getIdTokenResult();
      const role = tokenResult.claims.role as string | undefined;

      // Set session cookie
      document.cookie = "__session=1; path=/; SameSite=Lax";

      if (role) {
        document.cookie = `__role=${role}; path=/; SameSite=Lax`;
        // Ensure Firestore user doc exists (idempotent self-sync)
        try {
          const token = await result.user.getIdToken();
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const syncRes = await fetch(`${apiUrl}/api/v1/auth/self-sync`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (syncRes.status === 403 && (role === "PLACEMENT_ADMIN" || role === "COLLEGE_MANAGEMENT")) {
            const body = await syncRes.json().catch(() => ({ detail: "" }));
            const detail: string = body?.detail ?? "";
            await signOut(auth);
            document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
            document.cookie = "__role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
            if (detail.toLowerCase().includes("pending")) {
              setServerError("Your account is not approved yet. Please wait for Super User approval.");
            } else if (detail.toLowerCase().includes("reject")) {
              setServerError(detail);
            } else {
              setServerError("Access denied. Please contact the portal owner.");
            }
            return;
          }
        } catch {
          // Non-fatal — user doc may already exist
        }
        router.push(DASHBOARD_MAP[role] ?? "/signup/role-select");
      } else {
        // New Google user — needs role selection
        router.push("/signup/role-select");
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // User dismissed — silently ignore
      } else if (code === "auth/popup-blocked") {
        setServerError("Popup was blocked by your browser. Redirecting to Google sign-in…");
        setTimeout(() => signInWithRedirect(auth, new GoogleAuthProvider()), 1500);
      } else if (code === "auth/unauthorized-domain") {
        setServerError(
          "This domain is not authorized for Google sign-in. " +
          "Go to Firebase Console → Authentication → Settings → Authorized domains and add your deployment domain."
        );
      } else if (code === "auth/internal-error") {
        // Often caused by domain not added to Firebase authorized domains.
        // Fall back to redirect flow which bypasses popup restrictions.
        setServerError("Google sign-in popup failed. Switching to redirect mode…");
        setTimeout(() => signInWithRedirect(auth, new GoogleAuthProvider()), 1500);
      } else {
        setServerError(`Google sign-in failed (${code || "unknown"}). Please try again.`);
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!unverifiedEmail || !lastPassword) return;
    setResendingVerification(true);
    setResendVerificationSuccess(false);
    setResendVerificationError("");
    try {
      const { signInWithEmailAndPassword: signInTemp, sendEmailVerification, signOut: signOutTemp } = await import("firebase/auth");
      const cred = await signInTemp(auth, unverifiedEmail, lastPassword);
      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}/signup/verify-email`,
        handleCodeInApp: false,
      });
      await signOutTemp(auth);
      setResendVerificationSuccess(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/too-many-requests") {
        setResendVerificationError(
          "Firebase limits 1 email/day per account. Check your Promotions or Updates tab — the email is likely already there."
        );
      } else {
        setResendVerificationError("Failed to send. Please try again in a moment.");
      }
    } finally {
      setResendingVerification(false);
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/10">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl mb-5 shadow-glow-md">
        <GraduationCap className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
      <p className="text-white/50 text-sm mb-8">Sign in to your SmartHire account</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-white/70 text-sm font-medium mb-2">Email Address</label>
          <Input
            type="email"
            placeholder="you@college.edu"
            {...register("email")}
            icon={Mail}
            error={errors.email?.message}
          />
        </div>

        <div>
          <label className="block text-white/70 text-sm font-medium mb-2">Password</label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              {...register("password")}
              icon={Lock}
              error={errors.password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center text-white/70 cursor-pointer">
            <input type="checkbox" className="mr-2 rounded" />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-primary-400 hover:text-primary-300 transition-colors">
            Forgot password?
          </Link>
        </div>

        <AnimatePresence mode="wait">
          {serverError && (
            <ShakeOnError>
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm space-y-2"
              >
                <p>{serverError}</p>
                {unverifiedEmail && (
                  <div className="pt-2 border-t border-red-500/20 space-y-1.5">
                    {resendVerificationSuccess ? (
                      <p className="text-emerald-400 text-xs">
                        Verification email sent — check Primary, Promotions, and Updates tabs.
                      </p>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendingVerification}
                          className="text-primary-400 hover:text-primary-300 text-xs font-medium transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {resendingVerification && <RefreshCw className="w-3 h-3 animate-spin" />}
                          Resend verification email
                        </button>
                        {resendVerificationError && (
                          <p className="text-amber-400 text-xs leading-relaxed">
                            {resendVerificationError}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            </ShakeOnError>
          )}
        </AnimatePresence>

        <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
          Sign In
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </form>

      {/* Google sign-in divider */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/40 text-xs font-medium">or continue with</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {googleLoading ? (
          <RefreshCw className="w-5 h-5 animate-spin text-white/60" />
        ) : (
          <GoogleIcon className="w-5 h-5" />
        )}
        {googleLoading ? "Signing in…" : "Sign in with Google"}
      </button>

      <div className="mt-6 text-center text-sm text-white/50">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
          Sign up
        </Link>
      </div>
    </div>
  );
}
