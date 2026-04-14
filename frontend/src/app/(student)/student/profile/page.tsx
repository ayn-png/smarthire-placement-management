"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, UserCircle, Camera, Loader2, Lock, ChevronDown, ChevronUp, FileText, Upload, CheckCircle, AlertCircle, ShieldCheck, RefreshCw, Eye, EyeOff, Timer, Mail, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { studentService, authService, verificationService } from "@/services/api";
import api from "@/lib/axios";
import { StudentProfile } from "@/types";
import { getFileUrl, extractErrorMsg } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";
import BranchSelect, { BranchValue, BRANCH_OPTIONS } from "@/components/ui/BranchSelect";

const schema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters").regex(/^[A-Za-z\s]+$/, "Name must contain only letters and spaces"),
  roll_number: z.string()
    .min(1, "Roll number is required")
    .regex(/^\d{9}$/, "Roll number must be exactly 9 digits (numbers only)"),
  branch: z.string().min(1, "Branch required"),
  semester: z.number({ coerce: true }).int().min(1).max(10),
  cgpa: z.number({ coerce: true }).min(0).max(10),
  sgpa: z.number({ coerce: true }).min(0).max(10).optional().or(z.literal("")).transform((v) => v === "" ? undefined : v),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits"),
  date_of_birth: z.string().refine((v) => {
    if (!v) return true;
    const dob = new Date(v);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dob >= today) return false; // cannot be today or future
    // Check age >= 18
    const age = today.getFullYear() - dob.getFullYear()
      - ((today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) ? 1 : 0);
    return age >= 18;
  }, { message: "You must be at least 18 years old" }).optional().or(z.literal("")),
  address: z.string().max(500, "Address must be 500 characters or less").optional(),
  // B-18: LinkedIn must start with https://linkedin.com/ or https://www.linkedin.com/
  linkedin_url: z.string()
    .refine(
      (v) => !v || v.startsWith("https://linkedin.com/") || v.startsWith("https://www.linkedin.com/"),
      { message: "Must be a LinkedIn URL (https://linkedin.com/in/...)" }
    )
    .optional()
    .or(z.literal("")),
  // B-18: GitHub must start with https://github.com/
  github_url: z.string()
    .refine(
      (v) => !v || v.startsWith("https://github.com/"),
      { message: "Must be a GitHub URL (https://github.com/...)" }
    )
    .optional()
    .or(z.literal("")),
  // B-17: about max 1000 chars
  about: z.string().max(1000, "Bio must be 1000 characters or less").optional(),
  skills: z.string().optional(),
  certifications: z.string().optional(),
  marks_10th: z.number().min(0).max(100).optional().or(z.nan().transform(() => undefined)),
  board_10th: z.string().max(100).optional(),
  marks_12th: z.number().min(0).max(100).optional().or(z.nan().transform(() => undefined)),
  board_12th: z.string().max(100).optional(),
  aadhar_last4: z.string().regex(/^\d{4}$/, "Must be exactly 4 digits").optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

// ── Avatar Upload Widget ────────────────────────────────────────────────────
function AvatarUpload({
  avatarUrl,
  name,
  onUploaded,
}: {
  avatarUrl?: string;
  name?: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(getFileUrl(avatarUrl) || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Sync avatarUrl prop → preview state (fixes blank avatar after async profile load)
  useEffect(() => {
    if (avatarUrl && !uploading) {
      setPreview(getFileUrl(avatarUrl) || null);
    }
  }, [avatarUrl]);

  async function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) { setError("Image must be smaller than 2 MB"); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG, or WebP images are allowed"); return;
    }
    setError("");
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);
    try {
      const { avatar_url } = await studentService.uploadAvatar(file);
      // Update preview to the actual stored Cloudinary URL so the correct
      // URL is shown immediately and persists after navigation.
      setPreview(avatar_url);
      onUploaded(avatar_url);
    } catch (err: unknown) {
      const msg = extractErrorMsg(err, "Upload failed");
      setError(msg);
      setPreview(getFileUrl(avatarUrl) || null);
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const initials = name ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative group cursor-pointer"
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <div className="w-24 h-24 rounded-full ring-4 ring-primary-100 dark:ring-primary-900/40 overflow-hidden bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg">
          {preview ? (
            <img
              src={getFileUrl(preview)}
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={() => setPreview(null)}
            />
          ) : (
            <span className="text-white text-2xl font-bold">{initials}</span>
          )}
        </div>
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
        </div>
        <motion.div
          whileHover={{ scale: 1.1 }}
          className="absolute bottom-0 right-0 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-surface-800 shadow"
        >
          <Camera className="w-3.5 h-3.5 text-white" />
        </motion.div>
      </div>
      <p className="text-xs text-surface-400 dark:text-surface-500 text-center">
        Click or drag &amp; drop to change photo<br />
        <span className="text-[11px]">JPEG / PNG / WebP · max 2 MB</span>
      </p>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
    </div>
  );
}

// ── Marksheet Upload Widget ─────────────────────────────────────────────────
function MarksheetUpload({
  marksheetUrl,
  onUploaded,
  extractedFields,
}: {
  marksheetUrl?: string | null;
  extractedFields?: string[];
  onUploaded: (url: string, extracted: {
    roll_number: string | null;
    full_name: string | null;
    semester: number | null;
    branch: string | null;
    sgpa: number | null;
    cgpa: number | null;
  }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(!!marksheetUrl);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) { setError("File must be smaller than 5 MB"); return; }
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    const isOk = allowed.includes(file.type) || file.name.toLowerCase().endsWith(".pdf");
    if (!isOk) { setError("Only PDF, JPEG, or PNG files are allowed"); return; }

    setError("");
    setUploading(true);
    setExtracting(false);

    try {
      setExtracting(true);
      const result = await studentService.uploadMarksheet(file);
      setUploaded(true);
      onUploaded(result.marksheet_url, result.extracted_data);
    } catch (err: unknown) {
      const msg = extractErrorMsg(err, "Upload failed");
      setError(msg);
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 ${
          uploaded
            ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800/50"
        }`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {extracting ? "Uploading & extracting data with AI…" : "Uploading…"}
            </p>
          </div>
        ) : uploaded ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Marksheet uploaded</p>
            <p className="text-xs text-surface-400 dark:text-surface-500">Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 text-surface-400 dark:text-surface-500" />
            <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Upload your latest marksheet
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500">
              PDF, JPEG, or PNG · max 5 MB
            </p>
            <div className="flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <Upload className="w-3.5 h-3.5 text-primary-500" />
              <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                AI will auto-fill Roll No, Name, Branch, SGPA &amp; CGPA
              </span>
            </div>
          </div>
        )}
      </div>

      {!uploaded && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Marksheet is required to save your profile
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {/* AI extraction feedback banner */}
      {uploaded && !uploading && (
        extractedFields && extractedFields.length > 0 ? (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              <span className="font-semibold">AI auto-filled:</span> {extractedFields.join(", ")}
            </p>
          </div>
        ) : extractedFields && extractedFields.length === 0 ? (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              AI couldn&apos;t auto-fill fields — please fill them manually
            </p>
          </div>
        ) : null
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,.pdf"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

// ── Branch normalizer (safety net for LLM returning full-form names) ─────────
const BRANCH_NORM: Record<string, BranchValue> = {
  "computer science engineering": "CSE",
  "computer science and engineering": "CSE",
  "computer science": "CSE",
  "b.tech cse": "CSE",
  "b.e. cs": "CSE",
  "cse": "CSE",
  "cs": "CSE",
  "information technology": "IT",
  "b.tech it": "IT",
  "it": "IT",
  "electronics and communication engineering": "ECE",
  "electronics and communication": "ECE",
  "electronics & communication engineering": "ECE",
  "e&c": "ECE",
  "electronics": "ECE",
  "ece": "ECE",
  "electrical and electronics engineering": "EE",
  "electrical & electronics engineering": "EE",
  "electrical engineering": "EE",
  "eee": "EE",
  "electrical": "EE",
  "ee": "EE",
  "mechanical engineering": "ME",
  "mechanical": "ME",
  "me": "ME",
  "civil engineering": "CE",
  "civil": "CE",
  "ce": "CE",
  "artificial intelligence": "AI",
  "artificial intelligence and machine learning": "AI",
  "ai & ml": "AI",
  "ai and ml": "AI",
  "b.tech ai": "AI",
  "b.e. ai": "AI",
  "ai": "AI",
};

const VALID_BRANCH_CODES: BranchValue[] = ["CSE", "ECE", "ME", "CE", "EE", "IT", "AI", "Other"];

function normalizeBranch(raw: string | null | undefined): BranchValue | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (VALID_BRANCH_CODES.includes(trimmed as BranchValue)) return trimmed as BranchValue;
  const lc = trimmed.toLowerCase();
  if (BRANCH_NORM[lc]) return BRANCH_NORM[lc];
  for (const [pattern, code] of Object.entries(BRANCH_NORM)) {
    if (lc.includes(pattern)) return code;
  }
  return "Other";
}

// ── OTP Countdown Hook ──────────────────────────────────────────────────────
function useCountdown(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (!active) { setRemaining(seconds); return; }
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(id); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, seconds]);

  return remaining;
}

// ── Main Profile Page ───────────────────────────────────────────────────────
export default function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [marksheetUrl, setMarksheetUrl] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<string[] | undefined>(undefined);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  // ── Password change state ───────────────────────────────────────────────
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

  // 10-minute countdown for OTP validity (password change)
  const otpSecondsLeft = useCountdown(600, otpCountdownActive);
  const otpMinutes = Math.floor(otpSecondsLeft / 60);
  const otpSeconds = otpSecondsLeft % 60;
  const otpExpired = otpCountdownActive && otpSecondsLeft === 0;

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

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const watchedAbout = watch("about");

  useEffect(() => {
    studentService.getMyProfile()
      .then((p) => {
        setProfile(p);
        setMarksheetUrl(p.marksheet_url || null);
        reset({
          ...p,
          sgpa: p.sgpa ?? undefined,
          skills: p.skills?.join(", ") || "",
          certifications: p.certifications?.join(", ") || "",
          marks_10th: p.marks_10th ?? undefined,
          board_10th: p.board_10th ?? "",
          marks_12th: p.marks_12th ?? undefined,
          board_12th: p.board_12th ?? "",
          aadhar_last4: p.aadhar_last4 ?? "",
        });
      })
      .then(async () => {
        try {
          const vRes = await verificationService.getMyStatus();
          setVerificationStatus(vRes.data?.status ?? null);
        } catch { /* not verified yet */ }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reset]);

  function handleMarksheetUploaded(url: string, extracted: {
    roll_number: string | null;
    full_name: string | null;
    semester: number | null;
    branch: string | null;
    sgpa: number | null;
    cgpa: number | null;
  }) {
    setMarksheetUrl(url);
    const filled: string[] = [];

    if (extracted.roll_number) { setValue("roll_number", extracted.roll_number); filled.push("Roll Number"); }
    if (extracted.full_name) { setValue("full_name", extracted.full_name); filled.push("Name"); }
    if (extracted.semester) { setValue("semester", extracted.semester); filled.push("Semester"); }
    const branch = normalizeBranch(extracted.branch);
    if (branch) { setValue("branch", branch); filled.push("Branch"); }
    if (extracted.sgpa !== null && extracted.sgpa !== undefined) { setValue("sgpa", extracted.sgpa); filled.push("SGPA"); }
    if (extracted.cgpa !== null && extracted.cgpa !== undefined) { setValue("cgpa", extracted.cgpa); filled.push("CGPA"); }

    setExtractedFields(filled);
  }

  async function onSubmit(data: FormData) {
    if (!marksheetUrl) {
      alert("Please upload your marksheet before saving your profile.");
      return;
    }

    const payload = {
      ...data,
      sgpa: data.sgpa !== undefined && data.sgpa !== null ? Number(data.sgpa) : undefined,
      marksheet_url: marksheetUrl,
      skills: data.skills ? data.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
      certifications: data.certifications ? data.certifications.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };
    try {
      if (profile) {
        const updated = await studentService.updateProfile(payload);
        setProfile(updated);
      } else {
        const created = await studentService.createProfile(payload);
        setProfile(created);
      }
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      alert(extractErrorMsg(err, "Failed to save profile"));
    }
  }

  // Send OTP
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

  // Submit OTP + new password
  async function handleChangePassword() {
    setPwError("");

    if (!otpCode || otpCode.length !== 6) {
      setPwError("Enter the 6-digit verification code"); return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPwError("New password must be at least 8 characters"); return;
    }
    if (!/\d/.test(newPassword)) {
      setPwError("New password must contain at least one digit"); return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match"); return;
    }
    if (otpExpired) {
      setPwError("Verification code has expired. Please request a new one."); return;
    }

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

  function handlePwClose() {
    setPwOpen((o) => !o);
    setPwError("");
    setPwSuccess(false);
    setOtpSent(false);
    setOtpCountdownActive(false);
    setOtpCode("");
    setNewPassword("");
    setConfirmPassword("");
  }

  // ── Email change handlers ──────────────────────────────────────────────────
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

  function handleEmailClose() {
    setEmailOpen((o) => !o);
    setEmailError("");
    setEmailSuccess(false);
    setEmailOtpSent(false);
    setEmailOtpCountdownActive(false);
    setEmailOtpCode("");
    setNewEmail("");
  }

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-sm">
            <UserCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">My Profile</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">Manage your academic and personal information</p>
          </div>
        </div>
      </FadeIn>

      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
          >
            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            Profile saved successfully
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Card */}
      <FadeIn delay={0.05}>
        <Card title="Profile Photo">
          <AvatarUpload
            avatarUrl={profile?.avatar_url}
            name={profile?.full_name}
            onUploaded={(url) => setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev)}
          />
        </Card>
      </FadeIn>

      {/* Marksheet Upload Card */}
      <FadeIn delay={0.08}>
        <Card title="Marksheet Upload">
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-3">
            Upload your latest semester marksheet. Our AI will automatically extract your details.
          </p>
          <MarksheetUpload
            marksheetUrl={marksheetUrl}
            extractedFields={extractedFields}
            onUploaded={handleMarksheetUploaded}
          />
        </Card>
      </FadeIn>

      {/* Edit Profile toggle — shown only when profile exists and not editing */}
      {profile && !isEditing && (
        <FadeIn delay={0.1}>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsEditing(true)}
            >
              Edit Profile
            </Button>
          </div>
        </FadeIn>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
        style={{ display: profile && !isEditing ? "none" : undefined }}
      >
        <StaggerContainer className="space-y-6">

          {/* Personal Info */}
          <StaggerItem>
            <Card title="Personal Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Input {...register("full_name")} label="Full Name *" placeholder="John Doe" error={errors.full_name?.message} />
                </div>
                <Input {...register("phone")} label="Phone Number * (10 digits)" placeholder="9876543210" error={errors.phone?.message} />
                <Input {...register("date_of_birth")} label="Date of Birth" type="date" error={errors.date_of_birth?.message} />
                <div className="md:col-span-2">
                  <Input {...register("address")} label="Address" placeholder="Your address" error={errors.address?.message} />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">About Me</label>
                    <span className={`text-xs ${(watchedAbout?.length ?? 0) > 900 ? "text-amber-500" : "text-surface-400 dark:text-surface-500"}`}>
                      {watchedAbout?.length ?? 0}/1000
                    </span>
                  </div>
                  <textarea
                    {...register("about")}
                    rows={3}
                    maxLength={1000}
                    placeholder="Brief description about yourself..."
                    className={`w-full px-4 py-3 border rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 resize-none placeholder:text-surface-400 dark:placeholder:text-surface-500 transition-colors ${errors.about ? "border-red-400 dark:border-red-500" : "border-surface-300 dark:border-surface-600"}`}
                  />
                  {errors.about && <p className="mt-1 text-xs text-red-500">{errors.about.message}</p>}
                </div>
              </div>
            </Card>
          </StaggerItem>

          {/* Academic Information */}
          <StaggerItem>
            <Card title="Academic Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  {...register("roll_number")}
                  label="Roll Number *"
                  placeholder="123456789"
                  error={errors.roll_number?.message}
                />
                <Controller
                  name="branch"
                  control={control}
                  render={({ field }) => (
                    <BranchSelect
                      label="Branch *"
                      value={(field.value as BranchValue) ?? ""}
                      onChange={(val) => field.onChange(val)}
                      error={errors.branch?.message}
                    />
                  )}
                />
                <Input {...register("semester")} label="Semester *" type="number" min={1} max={10} error={errors.semester?.message} />
                <Input {...register("cgpa")} label="CGPA *" type="number" step="0.01" min={0} max={10} placeholder="8.50" error={errors.cgpa?.message} />
                <Input
                  {...register("sgpa")}
                  label="SGPA (Semester GPA)"
                  type="number"
                  step="0.01"
                  min={0}
                  max={10}
                  placeholder="Auto-filled from marksheet"
                  error={errors.sgpa?.message}
                />
              </div>

              <div className="pt-4 border-t border-surface-200 dark:border-surface-700 space-y-4">
                {/* 10th Standard */}
                <div>
                  <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">10th Standard</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Percentage / CGPA</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="e.g. 85.5"
                        {...register("marks_10th", { valueAsNumber: true })}
                        className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Board</label>
                      <input
                        type="text"
                        placeholder="e.g. CBSE, ICSE, State Board"
                        {...register("board_10th")}
                        className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 12th Standard */}
                <div>
                  <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">12th Standard</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Percentage / CGPA</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="e.g. 78.0"
                        {...register("marks_12th", { valueAsNumber: true })}
                        className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Board</label>
                      <input
                        type="text"
                        placeholder="e.g. CBSE, ICSE, State Board"
                        {...register("board_12th")}
                        className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card title="Skills & Certifications">
              <div className="space-y-4">
                <div>
                  <Input
                    {...register("skills")}
                    label="Skills (comma-separated)"
                    placeholder="Python, React, Node.js, SQL"
                    error={errors.skills?.message}
                  />
                  <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">Separate skills with commas</p>
                </div>
                <Input
                  {...register("certifications")}
                  label="Certifications (comma-separated)"
                  placeholder="AWS, Google Cloud, Microsoft Azure"
                  error={errors.certifications?.message}
                />
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card title="Social Links">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input {...register("linkedin_url")} label="LinkedIn URL" placeholder="https://linkedin.com/in/username" error={errors.linkedin_url?.message} />
                  <Input {...register("github_url")} label="GitHub URL" placeholder="https://github.com/username" error={errors.github_url?.message} />
                </div>

                {/* Identity Verification — Aadhar */}
                <div className="pt-4 border-t border-surface-200 dark:border-surface-700">
                  <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">Identity Verification</h4>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Aadhar Last 4 Digits
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="e.g. 1234"
                      {...register("aadhar_last4")}
                      className="w-32 px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 tracking-widest font-mono"
                    />
                    {errors.aadhar_last4 && <p className="text-red-500 text-xs mt-1">{errors.aadhar_last4.message}</p>}
                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                      Only the last 4 digits are stored. Upload your Aadhar document in the Resume section for full verification.
                    </p>
                  </div>

                  {/* Verification Status */}
                  {verificationStatus && (
                    <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                      verificationStatus === "VERIFIED"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : verificationStatus === "PENDING"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}>
                      {verificationStatus === "VERIFIED" ? "✓ Identity Verified"
                        : verificationStatus === "PENDING" ? "⏳ Verification Pending"
                        : "✗ Verification Rejected"}
                    </div>
                  )}
                  {!verificationStatus && profile?.aadhar_doc_url && (
                    <p className="mt-2 text-xs text-white/40">Upload complete — submit for identity verification from the verification portal</p>
                  )}
                </div>
              </div>
            </Card>
          </StaggerItem>
        </StaggerContainer>

        <FadeIn delay={0.5}>
          <div className="flex justify-end gap-3">
            {profile && isEditing && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setIsEditing(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" loading={isSubmitting} size="lg" variant="gradient">
              <Save className="w-4 h-4" />
              {profile ? "Save Changes" : "Create Profile"}
            </Button>
          </div>
        </FadeIn>
      </form>

      {/* ── Change Email (OTP-based) ───────────────────────────────────────── */}
      <FadeIn delay={0.55}>
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
          <button
            type="button"
            onClick={handleEmailClose}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <span className="font-semibold text-surface-900 dark:text-white">Email Address</span>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{profile?.email ?? ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium hidden sm:block">Change</span>
              {emailOpen ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <Pencil className="w-4 h-4 text-surface-400" />}
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
                <div className="px-6 pb-6 space-y-4 border-t border-surface-100 dark:border-surface-700 pt-4">

                  {emailSuccess && (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 px-4 py-2.5 rounded-xl text-sm">
                      <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      Email changed successfully. Please log in again with your new email.
                    </div>
                  )}

                  {emailError && (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 px-4 py-2.5 rounded-xl">{emailError}</p>
                  )}

                  {/* Step 1 — Enter new email + send OTP */}
                  <div className="bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-600 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold flex-shrink-0">1</div>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Enter your new email address</p>
                    </div>
                    <p className="text-xs text-surface-500 dark:text-surface-400 pl-8">
                      We&apos;ll send a 6-digit verification code to this address to confirm you own it.
                    </p>
                    <div className="pl-8 flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => { setNewEmail(e.target.value); setEmailOtpSent(false); setEmailOtpCountdownActive(false); }}
                        placeholder="new@example.com"
                        className="flex-1 px-3 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-xl bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button
                        onClick={handleSendEmailOtp}
                        loading={emailOtpSending}
                        disabled={emailOtpSending || (emailOtpSent && emailOtpSecondsLeft > 540)}
                        variant="secondary"
                        size="sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {emailOtpSent
                          ? emailOtpSecondsLeft > 540
                            ? `Resend in ${60 - (600 - emailOtpSecondsLeft)}s`
                            : "Resend Code"
                          : "Send Code"}
                      </Button>
                    </div>
                  </div>

                  {/* Step 2 — Enter OTP */}
                  <AnimatePresence>
                    {emailOtpSent && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4">
                          <div className="bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-600 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold flex-shrink-0">2</div>
                              <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Enter the verification code</p>
                              {!emailOtpExpired && emailOtpCountdownActive && (
                                <div className="ml-auto flex items-center gap-1 text-xs text-surface-400">
                                  <Timer className="w-3 h-3" />
                                  <span className={emailOtpSecondsLeft < 60 ? "text-red-500 font-semibold" : ""}>
                                    {emailOtpMinutes}:{emailOtpSeconds.toString().padStart(2, "0")}
                                  </span>
                                </div>
                              )}
                              {emailOtpExpired && (
                                <span className="ml-auto text-xs text-red-500 font-medium flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Expired
                                </span>
                              )}
                            </div>
                            <div className="pl-8">
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={emailOtpCode}
                                onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="000000"
                                className={`w-full max-w-[180px] px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border rounded-xl bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                  emailOtpExpired
                                    ? "border-red-300 dark:border-red-700 focus:ring-red-500"
                                    : "border-surface-300 dark:border-surface-600 focus:ring-blue-500"
                                }`}
                              />
                              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1.5">
                                Check your new email inbox for the 6-digit code
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button
                              loading={emailSaving}
                              disabled={emailSaving || emailOtpExpired || emailOtpCode.length < 6}
                              onClick={handleChangeEmail}
                              variant="primary"
                            >
                              <Mail className="w-4 h-4" />
                              Update Email
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FadeIn>

      {/* ── Change Password (OTP-based) ─────────────────────────────────────── */}
      <FadeIn delay={0.6}>
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
          <button
            type="button"
            onClick={handlePwClose}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="font-semibold text-surface-900 dark:text-white">Change Password</span>
            </div>
            {pwOpen ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
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
                <div className="px-6 pb-6 space-y-4 border-t border-surface-100 dark:border-surface-700 pt-4">

                  {/* Success banner */}
                  {pwSuccess && (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 px-4 py-2.5 rounded-xl text-sm">
                      <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      Password changed successfully
                    </div>
                  )}

                  {/* Error banner */}
                  {pwError && (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 px-4 py-2.5 rounded-xl">{pwError}</p>
                  )}

                  {/* Step 1 — Send OTP */}
                  <div className="bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-600 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-bold flex-shrink-0">1</div>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        Get a verification code
                      </p>
                    </div>
                    <p className="text-xs text-surface-500 dark:text-surface-400 pl-8">
                      We&apos;ll send a 6-digit code to your registered email address. Valid for 10 minutes.
                    </p>
                    <div className="pl-8">
                      <Button
                        onClick={handleSendOtp}
                        loading={otpSending}
                        disabled={otpSending || (otpSent && otpSecondsLeft > 540)}
                        variant="secondary"
                        size="sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {otpSent ? (
                          otpSecondsLeft > 540
                            ? `Resend in ${60 - (600 - otpSecondsLeft)}s`
                            : "Resend Code"
                        ) : "Send Verification Code"}
                      </Button>
                    </div>
                  </div>

                  {/* Step 2 — Enter OTP and new password (only shown after OTP sent) */}
                  <AnimatePresence>
                    {otpSent && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4">
                          <div className="bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-600 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-bold flex-shrink-0">2</div>
                              <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                                Enter verification code
                              </p>
                              {!otpExpired && otpCountdownActive && (
                                <div className="ml-auto flex items-center gap-1 text-xs text-surface-400">
                                  <Timer className="w-3 h-3" />
                                  <span className={otpSecondsLeft < 60 ? "text-red-500 font-semibold" : ""}>
                                    {otpMinutes}:{otpSeconds.toString().padStart(2, "0")}
                                  </span>
                                </div>
                              )}
                              {otpExpired && (
                                <span className="ml-auto text-xs text-red-500 font-medium flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Expired
                                </span>
                              )}
                            </div>
                            <div className="pl-8">
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="000000"
                                className={`w-full max-w-[180px] px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border rounded-xl bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                                  otpExpired
                                    ? "border-red-300 dark:border-red-700 focus:ring-red-500"
                                    : "border-surface-300 dark:border-surface-600 focus:ring-primary-500"
                                }`}
                              />
                              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1.5">
                                Check your email for the 6-digit code
                              </p>
                            </div>
                          </div>

                          <div className="bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-600 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-bold flex-shrink-0">3</div>
                              <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                                Set new password
                              </p>
                            </div>
                            <div className="pl-8 space-y-3">
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
                                  className="absolute right-3 top-[34px] text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
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
                                  className="absolute right-3 top-[34px] text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                                >
                                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
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
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FadeIn>
    </div>
  );
}
