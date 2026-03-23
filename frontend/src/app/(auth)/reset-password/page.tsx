"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, Eye, EyeOff, ArrowRight, KeyRound, CheckCircle } from "lucide-react";
import { authService } from "@/services/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { motion, AnimatePresence } from "framer-motion";
import { ShakeOnError } from "@/components/ui/Animations";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Minimum 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/\d/, "Must contain at least one digit")
      .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Must contain at least one special character"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (confirmPassword !== password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

type FormData = z.infer<typeof schema>;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Redirect after success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => router.push("/login"), 2500);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  // If no token, show invalid link screen immediately
  if (!token) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl mb-5">
          <KeyRound className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Invalid Reset Link</h1>
        <p className="text-white/50 text-sm mb-6">
          This password reset link is missing or invalid. Please request a new one.
        </p>
        <Link href="/forgot-password" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
          Request a new reset link
        </Link>
      </div>
    );
  }

  async function onSubmit(data: FormData) {
    setServerError("");
    try {
      await authService.resetPasswordWithToken({ token, new_password: data.password });
      setSuccess(true);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } }; message?: string };
      const detail = apiErr?.response?.data?.detail || "";
      if (detail.includes("expired")) {
        setServerError("This reset link has expired. Please request a new one.");
      } else if (detail.includes("Invalid") || detail.includes("invalid")) {
        setServerError("This reset link is invalid or already used.");
      } else {
        setServerError(detail || apiErr?.message || "Could not reset password. Please try again.");
      }
    }
  }

  if (success) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/10 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl mb-5"
        >
          <CheckCircle className="w-8 h-8 text-white" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-2">Password Reset!</h1>
        <p className="text-white/50 text-sm">Redirecting you to login&hellip;</p>
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
          <KeyRound className="w-8 h-8 text-white" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-white"
        >
          Set new password
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/50 text-sm mt-1.5"
        >
          Choose a new password for your account
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
                {(serverError.includes("expired") || serverError.includes("invalid")) && (
                  <div className="mt-2">
                    <Link href="/forgot-password" className="text-primary-400 hover:text-primary-300 font-medium underline">
                      Request a new reset link
                    </Link>
                  </div>
                )}
              </motion.div>
            </ShakeOnError>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3.5 top-[38px] w-4 h-4 text-white/30" />
            <div className="[&_label]:text-white/70 [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input]:placeholder:text-white/25 [&_input:focus]:border-primary-500/50 [&_input:focus]:ring-primary-500/10">
              <Input
                {...register("password")}
                label="New Password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 chars, uppercase, digit, special"
                className="pl-10 pr-10"
                error={errors.password?.message}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-[38px] text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-3.5 top-[38px] w-4 h-4 text-white/30" />
            <div className="[&_label]:text-white/70 [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input]:placeholder:text-white/25 [&_input:focus]:border-primary-500/50 [&_input:focus]:ring-primary-500/10">
              <Input
                {...register("confirmPassword")}
                label="Confirm New Password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your new password"
                className="pl-10 pr-10"
                error={errors.confirmPassword?.message}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-[38px] text-white/30 hover:text-white/60 transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
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
          Reset Password
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/10 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500/40 border-t-primary-500 rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
