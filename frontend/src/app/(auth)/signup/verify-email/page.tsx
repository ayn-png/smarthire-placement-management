"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { MailCheck, RefreshCw, ArrowRight, CheckCircle, AlertCircle, Loader2, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";

// ── Inner component that reads search params ──────────────────────────────────
function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // "false" means signup couldn't send the email — we auto-retry on load
  const emailSentParam = searchParams.get("emailSent");

  const [email, setEmail] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);

  // Whether Firebase has finished loading the auth state from storage
  const [authLoaded, setAuthLoaded] = useState(false);

  // Feedback shown when the user clicks Continue but email is still unverified
  const [notVerifiedMsg, setNotVerifiedMsg] = useState("");

  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Tracks whether the auto-resend on page load has already fired
  const [autoResendDone, setAutoResendDone] = useState(false);

  // ── Wait for Firebase auth state to fully load ──────────────────────────────
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setAuthLoaded(true);
      if (user) {
        setEmail(user.email);
        if (user.emailVerified) {
          setVerified(true);
          setTimeout(() => router.push("/signup/role-select"), 1500);
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  // ── Resend cooldown countdown ──────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // ── Core verification check ────────────────────────────────────────────────
  const checkVerification = useCallback(async () => {
    if (!authLoaded) return;
    const user = auth.currentUser;
    if (!user) { router.push("/login"); return; }

    setChecking(true);
    setNotVerifiedMsg("");
    try {
      await user.reload();
      const freshUser = auth.currentUser;
      if (freshUser?.emailVerified) {
        setVerified(true);
        setTimeout(() => router.push("/signup/role-select"), 1500);
      } else {
        setNotVerifiedMsg(
          "Your email hasn't been verified yet. Click the link in the email, then press Continue."
        );
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "";
      setNotVerifiedMsg(
        msg.includes("network")
          ? "Network error — please check your connection and try again."
          : "Could not check verification status. Please try again."
      );
    } finally {
      setChecking(false);
    }
  }, [router, authLoaded]);

  // ── Resend verification email ──────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    setResendError("");
    setResendSuccess(false);
    const user = auth.currentUser;
    if (!user) return;
    setResending(true);
    try {
      const { sendEmailVerification } = await import("firebase/auth");
      await sendEmailVerification(user, {
        url: `${window.location.origin}/signup/verify-email`,
        handleCodeInApp: false,
      });
      setResendSuccess(true);
      setResendCooldown(60);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/too-many-requests") {
        setResendError(
          "Firebase limits 1 verification email per account per day. A previous email is already on its way — check your inbox including the Promotions and Updates tabs."
        );
        setResendCooldown(3600); // show cooldown for 1 hour
      } else {
        setResendError("Failed to resend. Please try again in a moment.");
      }
    } finally {
      setResending(false);
    }
  }, []);

  // ── Auto-resend on load if signup couldn't send the initial email ──────────
  useEffect(() => {
    if (!authLoaded || autoResendDone || emailSentParam !== "false") return;
    setAutoResendDone(true);
    const t = setTimeout(() => { handleResend(); }, 1500);
    return () => clearTimeout(t);
  }, [authLoaded, autoResendDone, emailSentParam, handleResend]);

  // ── Auto-check when the tab regains focus ─────────────────────────────────
  useEffect(() => {
    window.addEventListener("focus", checkVerification);
    return () => window.removeEventListener("focus", checkVerification);
  }, [checkVerification]);

  // ── Verified success screen ────────────────────────────────────────────────
  if (verified) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/10 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-5 shadow-glow-md"
        >
          <CheckCircle className="w-8 h-8 text-white" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-2xl font-bold text-white mb-2"
        >
          Email Verified!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-white/50 text-sm"
        >
          Redirecting you to select your role&hellip;
        </motion.p>
      </div>
    );
  }

  // ── Main page ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/10">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl mb-5 shadow-glow-md"
        >
          <MailCheck className="w-8 h-8 text-white" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-white"
        >
          Check your inbox
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/50 text-sm mt-1.5"
        >
          We sent a verification link to{" "}
          <span className="text-white/80 font-medium">
            {email ?? "your email address"}
          </span>
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        {/* Auto-retry banner: shown when signup failed to send the email */}
        <AnimatePresence>
          {emailSentParam === "false" && !autoResendDone && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-3 rounded-xl text-sm"
            >
              <Loader2 className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" />
              <span>Sending verification email…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gmail tabs tip — always visible */}
        <div className="flex items-start gap-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 px-4 py-3 rounded-xl text-sm">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Gmail users:</strong> Check your <strong>Promotions</strong> and{" "}
            <strong>Updates</strong> tabs — the email often lands there instead of Primary.
          </span>
        </div>

        {/* Step-by-step guide */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2.5">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wide mb-1">
            How to verify
          </p>
          {[
            "Check Primary, Promotions, and Updates tabs in your inbox",
            'Open the email from SmartHire and click "Verify My Email"',
            "Come back here and click Continue below",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400 text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <span className="text-white/60 text-sm leading-relaxed">{step}</span>
            </div>
          ))}
        </div>

        {/* "Not verified yet" feedback */}
        <AnimatePresence>
          {notVerifiedMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-3 rounded-xl text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{notVerifiedMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue button */}
        <Button
          onClick={checkVerification}
          loading={checking}
          disabled={checking || !authLoaded}
          className="w-full"
          size="lg"
          variant="gradient"
        >
          {!authLoaded ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading…</>
          ) : checking ? (
            "Checking…"
          ) : (
            <>Continue <ArrowRight className="w-4 h-4 ml-1" /></>
          )}
        </Button>

        {/* Resend section */}
        <div className="text-center space-y-2">
          <AnimatePresence mode="wait">
            {resendSuccess && (
              <motion.p
                key="ok"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-emerald-400 text-sm"
              >
                Verification email sent — check Primary, Promotions, and Updates tabs.
              </motion.p>
            )}
            {resendError && (
              <motion.p
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-amber-400 text-sm text-left leading-relaxed"
              >
                {resendError}
              </motion.p>
            )}
          </AnimatePresence>

          <p className="text-sm text-white/40">
            Didn&apos;t receive it?{" "}
            {resendCooldown > 0 ? (
              <span className="text-white/30">
                {resendCooldown >= 3600
                  ? "Try again tomorrow"
                  : `Resend in ${resendCooldown}s`}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || !authLoaded}
                className="text-primary-400 hover:text-primary-300 font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1"
              >
                {resending && <RefreshCw className="w-3 h-3 animate-spin" />}
                Resend email
              </button>
            )}
          </p>

          <p className="text-xs text-white/25">
            Wrong account?{" "}
            <button
              type="button"
              onClick={async () => {
                await signOut(auth);
                document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
                document.cookie = "__role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
                router.push("/login");
              }}
              className="text-white/40 hover:text-white/60 underline transition-colors"
            >
              Sign out
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ── Wrap in Suspense because useSearchParams() requires it in Next.js 14 ──────
export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
