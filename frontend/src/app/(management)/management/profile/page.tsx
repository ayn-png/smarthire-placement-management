"use client";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User, Phone, Briefcase, Building2, Camera, Save, Loader2,
  Mail, Pencil, ChevronUp, ShieldCheck, Timer, AlertCircle, Lock, Eye, EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/axios";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { managementProfileService, authService } from "@/services/api";
import { extractErrorMsg } from "@/lib/utils";

function useCountdown(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (!active) { setRemaining(seconds); return; }
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining((r) => { if (r <= 1) { clearInterval(id); return 0; } return r - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [active, seconds]);
  return remaining;
}

const schema = z.object({
  full_name: z.string().min(2, "Full name required"),
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  designation: z.string().min(2, "Designation required"),
  department: z.string().min(2, "Department required"),
});
type FormData = z.infer<typeof schema>;

export default function ManagementProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Email change state ─────────────────────────────────────────────────────
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailOtpCountdownActive, setEmailOtpCountdownActive] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

  const emailOtpSecondsLeft = useCountdown(600, emailOtpCountdownActive);
  const emailOtpMinutes = Math.floor(emailOtpSecondsLeft / 60);
  const emailOtpSeconds = emailOtpSecondsLeft % 60;
  const emailOtpExpired = emailOtpCountdownActive && emailOtpSecondsLeft === 0;

  // ── Password change state ──────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [otpCountdownActive, setOtpCountdownActive] = useState(false);

  const otpSecondsLeft = useCountdown(600, otpCountdownActive);
  const otpMinutes = Math.floor(otpSecondsLeft / 60);
  const otpSecs = otpSecondsLeft % 60;
  const otpExpired = otpCountdownActive && otpSecondsLeft === 0;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await managementProfileService.get();
      setProfile(res.data);
      reset({
        full_name: res.data.full_name ?? "",
        phone: res.data.phone ?? "",
        designation: res.data.designation ?? "",
        department: res.data.department ?? "",
      });
    } catch {
      // Profile doesn't exist yet
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (profile) {
        const res = await managementProfileService.update(data);
        setProfile(res.data);
      } else {
        const res = await managementProfileService.create(data);
        setProfile(res.data);
      }
      setSuccess("Profile saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const res = await managementProfileService.uploadAvatar(file);
      setProfile((p: any) => ({ ...p, avatar_url: (res.data as any).avatar_url }));
    } catch {
      setError("Avatar upload failed");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSendEmailOtp() {
    setEmailError("");
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError("Enter a valid email address"); return;
    }
    setEmailOtpSending(true);
    try {
      await authService.sendChangeEmailOtp(newEmail);
      setEmailOtpSent(true);
      setEmailOtpCountdownActive(true);
      setEmailOtpCode("");
    } catch (err: unknown) {
      setEmailError(extractErrorMsg(err, "Failed to send verification code"));
    } finally {
      setEmailOtpSending(false);
    }
  }

  async function handleChangeEmail() {
    setEmailError("");
    if (!emailOtpCode || emailOtpCode.length !== 6) {
      setEmailError("Enter the 6-digit verification code"); return;
    }
    if (emailOtpExpired) {
      setEmailError("Verification code has expired. Please request a new one."); return;
    }
    setEmailSaving(true);
    try {
      await authService.changeEmail({ new_email: newEmail, otp_code: emailOtpCode });
      setEmailSuccess(true);
      setEmailOtpSent(false);
      setEmailOtpCountdownActive(false);
      setEmailOtpCode("");
      setNewEmail("");
      setTimeout(() => { setEmailSuccess(false); setEmailOpen(false); }, 4000);
    } catch (err: unknown) {
      setEmailError(extractErrorMsg(err, "Failed to change email"));
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleSendOtp() {
    setPwError("");
    setOtpSending(true);
    try {
      await authService.sendChangePasswordOtp();
      setOtpSent(true);
      setOtpCountdownActive(true);
      setOtpCode("");
    } catch (err: unknown) {
      setPwError(extractErrorMsg(err, "Failed to send verification code"));
    } finally {
      setOtpSending(false);
    }
  }

  async function handleChangePassword() {
    setPwError("");
    if (!otpCode || otpCode.length !== 6) { setPwError("Enter the 6-digit verification code"); return; }
    if (!newPassword || newPassword.length < 8) { setPwError("New password must be at least 8 characters"); return; }
    if (!/\d/.test(newPassword)) { setPwError("New password must contain at least one digit"); return; }
    if (newPassword !== confirmPassword) { setPwError("Passwords do not match"); return; }
    if (otpExpired) { setPwError("Verification code has expired. Please request a new one."); return; }
    setPwSaving(true);
    try {
      await authService.changePasswordWithOtp({ otp_code: otpCode, new_password: newPassword });
      setPwSuccess(true);
      setOtpSent(false);
      setOtpCountdownActive(false);
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (err: unknown) {
      setPwError(extractErrorMsg(err, "Failed to change password"));
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  const currentEmail = profile?.email ?? user?.email ?? "";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-gray-500 dark:text-white/50 text-sm mt-1">Manage your college management profile</p>
      </div>

      {/* Avatar section */}
      <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-5">
          <div className="relative">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-primary-500/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-400">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ?? user?.displayName?.charAt(0)?.toUpperCase() ?? "M"}
                </span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center hover:bg-primary-700 transition-colors"
            >
              {avatarUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-white" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <p className="text-gray-900 dark:text-white font-semibold">{profile?.full_name ?? user?.displayName ?? "Your Name"}</p>
            <p className="text-gray-500 dark:text-white/50 text-sm">{currentEmail}</p>
            <p className="text-gray-400 dark:text-white/40 text-xs mt-0.5">{profile?.designation ?? "College Management"}</p>
          </div>
        </div>
      </div>

      {/* Profile form */}
      <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-gray-200 dark:border-white/10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Profile Details</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 dark:text-white/70 text-sm font-medium mb-1.5">Full Name</label>
              <Input type="text" placeholder="Your full name" {...register("full_name")} icon={User} error={errors.full_name?.message} />
            </div>
            <div>
              <label className="block text-gray-700 dark:text-white/70 text-sm font-medium mb-1.5">Phone Number</label>
              <Input type="text" placeholder="10-digit phone" {...register("phone")} icon={Phone} error={errors.phone?.message} />
            </div>
          </div>
          <div>
            <label className="block text-gray-700 dark:text-white/70 text-sm font-medium mb-1.5">Designation</label>
            <Input type="text" placeholder="e.g. Dean of Academics" {...register("designation")} icon={Briefcase} error={errors.designation?.message} />
          </div>
          <div>
            <label className="block text-gray-700 dark:text-white/70 text-sm font-medium mb-1.5">Department</label>
            <Input type="text" placeholder="e.g. Academic Affairs" {...register("department")} icon={Building2} error={errors.department?.message} />
          </div>

          {/* Email Change Section */}
          <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => { setEmailOpen((o) => !o); setEmailError(""); setEmailSuccess(false); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-blue-500" />
                <div className="text-left">
                  <span className="text-sm font-medium text-gray-700 dark:text-white/70">Email Address</span>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{currentEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-blue-500 font-medium">Change</span>
                {emailOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <Pencil className="w-3.5 h-3.5 text-gray-400" />}
              </div>
            </button>

            <AnimatePresence>
              {emailOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gray-100 dark:border-white/10">
                    {emailSuccess && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm">
                        Email changed successfully. Please log in again with your new email.
                      </div>
                    )}
                    {emailError && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{emailError}</div>
                    )}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 dark:text-white/50">1. Enter your new email address</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => { setNewEmail(e.target.value); setEmailOtpSent(false); setEmailOtpCountdownActive(false); }}
                          placeholder="new@example.com"
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <Button
                          onClick={handleSendEmailOtp}
                          loading={emailOtpSending}
                          disabled={emailOtpSending || (emailOtpSent && emailOtpSecondsLeft > 540)}
                          variant="secondary"
                          size="sm"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {emailOtpSent ? (emailOtpSecondsLeft > 540 ? `Resend in ${60 - (600 - emailOtpSecondsLeft)}s` : "Resend") : "Send Code"}
                        </Button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {emailOtpSent && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-gray-600 dark:text-white/50">2. Enter the verification code</p>
                            {!emailOtpExpired && emailOtpCountdownActive && (
                              <span className={`ml-auto text-xs flex items-center gap-1 ${emailOtpSecondsLeft < 60 ? "text-red-500" : "text-gray-400"}`}>
                                <Timer className="w-3 h-3" />{emailOtpMinutes}:{emailOtpSeconds.toString().padStart(2, "0")}
                              </span>
                            )}
                            {emailOtpExpired && (
                              <span className="ml-auto text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Expired
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={emailOtpCode}
                            onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="000000"
                            className={`w-[160px] px-4 py-2.5 text-center text-xl font-mono tracking-[0.5em] border rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors ${emailOtpExpired ? "border-red-300 focus:ring-red-500" : "border-gray-300 dark:border-white/20 focus:ring-blue-500"}`}
                          />
                          <p className="text-xs text-gray-400 dark:text-white/30">Check your new email inbox for the 6-digit code</p>
                          <div className="flex justify-end pt-1">
                            <Button
                              loading={emailSaving}
                              disabled={emailSaving || emailOtpExpired || emailOtpCode.length < 6}
                              onClick={handleChangeEmail}
                              variant="primary"
                              size="sm"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              Update Email
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm">{success}</div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>
          )}

          <Button type="submit" variant="primary" loading={saving} fullWidth={false}>
            <Save className="w-4 h-4 mr-2" />
            {profile ? "Save Changes" : "Create Profile"}
          </Button>
        </form>
      </div>

      {/* ── Change Password (OTP-based) ──────────────────────────────────── */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => { setPwOpen((o) => !o); setPwError(""); setPwSuccess(false); setOtpSent(false); setOtpCountdownActive(false); setOtpCode(""); setNewPassword(""); setConfirmPassword(""); }}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">Change Password</span>
          </div>
          {pwOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <Pencil className="w-4 h-4 text-gray-400" />}
        </button>

        <AnimatePresence>
          {pwOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 space-y-4 border-t border-gray-100 dark:border-white/10 pt-4">
                {pwSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm">
                    Password changed successfully
                  </div>
                )}
                {pwError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{pwError}</div>
                )}

                {/* Step 1 — Send OTP */}
                <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-white/50">1. Get a verification code</p>
                  <p className="text-xs text-gray-400 dark:text-white/30">
                    We&apos;ll send a 6-digit code to your registered email. Valid for 10 minutes.
                  </p>
                  <Button
                    onClick={handleSendOtp}
                    loading={otpSending}
                    disabled={otpSending || (otpSent && otpSecondsLeft > 540)}
                    variant="secondary"
                    size="sm"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {otpSent ? (otpSecondsLeft > 540 ? `Resend in ${60 - (600 - otpSecondsLeft)}s` : "Resend Code") : "Send Verification Code"}
                  </Button>
                </div>

                <AnimatePresence>
                  {otpSent && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-3"
                    >
                      {/* Step 2 — Enter OTP */}
                      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-gray-600 dark:text-white/50">2. Enter verification code</p>
                          {!otpExpired && otpCountdownActive && (
                            <span className={`ml-auto text-xs flex items-center gap-1 ${otpSecondsLeft < 60 ? "text-red-500" : "text-gray-400"}`}>
                              <Timer className="w-3 h-3" />{otpMinutes}:{otpSecs.toString().padStart(2, "0")}
                            </span>
                          )}
                          {otpExpired && (
                            <span className="ml-auto text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Expired
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="000000"
                          className={`w-[160px] px-4 py-2.5 text-center text-xl font-mono tracking-[0.5em] border rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors ${otpExpired ? "border-red-300 focus:ring-red-500" : "border-gray-300 dark:border-white/20 focus:ring-primary-500"}`}
                        />
                      </div>

                      {/* Step 3 — New password */}
                      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-medium text-gray-600 dark:text-white/50">3. Set new password</p>
                        <div className="relative">
                          <Input
                            label="New Password"
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min 8 chars, at least 1 digit"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((v) => !v)}
                            className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            label="Confirm New Password"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          loading={pwSaving}
                          disabled={pwSaving || otpExpired || otpCode.length < 6}
                          onClick={handleChangePassword}
                          variant="primary"
                        >
                          <Lock className="w-4 h-4" />
                          Update Password
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
