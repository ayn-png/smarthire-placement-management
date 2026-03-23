"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { motion, AnimatePresence } from "framer-motion";
import { ShakeOnError } from "@/components/ui/Animations";

const schema = z
  .object({
    full_name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email"),
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

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setServerError("");
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      await updateProfile(userCredential.user, {
        displayName: data.full_name.trim(),
      });
      // Send verification email via Firebase (reliable, proper SPF/DKIM)
      let emailSent = false;
      try {
        const { sendEmailVerification } = await import("firebase/auth");
        await sendEmailVerification(userCredential.user, {
          url: `${window.location.origin}/signup/verify-email`,
          handleCodeInApp: false,
        });
        emailSent = true;
      } catch (verifyErr: unknown) {
        const code = (verifyErr as { code?: string })?.code || "";
        // auth/too-many-requests = Firebase already sent one today → treat as sent
        if (code === "auth/too-many-requests") emailSent = true;
        // Any other error: email wasn't sent — verify page will auto-retry
      }
      // Set session cookie and hold user on verification gate
      document.cookie = "__session=1; path=/; SameSite=Lax";
      // Pass emailSent=false so verify page knows to auto-retry sending
      router.push(`/signup/verify-email${emailSent ? "" : "?emailSent=false"}`);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      const code = firebaseErr?.code || "";
      if (code === "auth/email-already-in-use") {
        setServerError("An account with this email already exists.");
      } else if (code === "auth/weak-password") {
        setServerError("Password is too weak. Please choose a stronger password.");
      } else {
        setServerError(firebaseErr?.message || "Registration failed. Please try again.");
      }
    }
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
          Create account
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/50 text-sm mt-1.5"
        >
          Join SmartHire
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

        <div className="space-y-4">
          <div className="[&_label]:text-white/70 [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input]:placeholder:text-white/25 [&_input:focus]:border-primary-500/50 [&_input:focus]:ring-primary-500/10">
            <Input
              {...register("full_name")}
              label="Full Name"
              placeholder="John Doe"
              error={errors.full_name?.message}
            />
          </div>

          <div className="[&_label]:text-white/70 [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input]:placeholder:text-white/25 [&_input:focus]:border-primary-500/50 [&_input:focus]:ring-primary-500/10">
            <Input
              {...register("email")}
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3.5 top-[38px] w-4 h-4 text-white/30" />
            <div className="[&_label]:text-white/70 [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input]:placeholder:text-white/25 [&_input:focus]:border-primary-500/50 [&_input:focus]:ring-primary-500/10">
              <Input
                {...register("password")}
                label="Password"
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
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
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
          Continue
          {!isSubmitting && <ArrowRight className="w-4 h-4 ml-1" />}
        </Button>
      </motion.form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-sm text-white/40 mt-7"
      >
        Already have an account?{" "}
        <Link href="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
          Sign in
        </Link>
      </motion.p>
    </div>
  );
}
