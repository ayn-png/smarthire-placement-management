"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, Mail, ArrowRight, CheckCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { motion, AnimatePresence } from "framer-motion";
import { ShakeOnError } from "@/components/ui/Animations";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError("");
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, data.email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      // auth/user-not-found → still show success (don't reveal email existence)
      // auth/too-many-requests → also still show success to avoid spamming
      // Silently ignore all errors to prevent email enumeration attacks
    }
    // Always show success — don't reveal whether email exists
    setSentEmail(data.email);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/10">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl mb-5 shadow-glow-md"
          >
            <CheckCircle className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-white"
          >
            Check your email
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/50 text-sm mt-1.5"
          >
            We sent a password reset link to{" "}
            <span className="text-white/80">{sentEmail}</span>
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <p className="text-white/50 text-sm text-center">
            Click the link in the email to reset your password. The link expires after 30 minutes.
          </p>
          <p className="text-center text-sm text-white/40">
            Didn&apos;t receive it?{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
            >
              Try again
            </button>
          </p>
          <div className="text-center">
            <Link href="/login" className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors">
              ← Back to login
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/10">
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl mb-5 shadow-glow-md"
        >
          <GraduationCap className="w-8 h-8 text-white" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-white"
        >
          Reset your password
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/50 text-sm mt-1.5"
        >
          Enter your email and we&apos;ll send you a reset link
        </motion.p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5"
      >
        <AnimatePresence>
          {serverError && (
            <ShakeOnError trigger={!!serverError}>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm backdrop-blur-sm"
              >
                {serverError}
              </motion.div>
            </ShakeOnError>
          )}
        </AnimatePresence>

        <div className="relative">
          <Mail className="absolute left-3.5 top-[38px] w-4 h-4 text-white/30" />
          <div className="[&_label]:text-white/70 [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input]:placeholder:text-white/25 [&_input:focus]:border-primary-500/50 [&_input:focus]:ring-primary-500/10">
            <Input
              {...register("email")}
              label="Email address"
              type="email"
              placeholder="you@example.com"
              className="pl-10"
              error={errors.email?.message}
            />
          </div>
        </div>

        <Button
          type="submit"
          loading={isSubmitting}
          disabled={isSubmitting}
          className="w-full"
          size="lg"
          variant="gradient"
        >
          Send Reset Link
          {!isSubmitting && <ArrowRight className="w-4 h-4 ml-1" />}
        </Button>
      </motion.form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center text-sm text-white/40 mt-6"
      >
        Remember your password?{" "}
        <Link href="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
          Sign in
        </Link>
      </motion.p>
    </div>
  );
}
