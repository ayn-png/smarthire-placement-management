"use client";
import { useEffect, useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, ExternalLink, FileUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { studentService } from "@/services/api";
import { StudentProfile } from "@/types";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn } from "@/components/ui/Animations";
import AIResumeAnalyzer from "@/components/shared/AIResumeAnalyzer";

export default function ResumePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    studentService.getMyProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleFile(file: File) {
    if (!file) return;
    // Check file extension (more reliable than MIME type which can vary)
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    // Also accept common PDF MIME types
    const validMimeTypes = ['application/pdf', 'application/x-pdf', 'application/acrobat'];
    const hasValidMimeType = validMimeTypes.includes(file.type);

    if (!isPdf && !hasValidMimeType) {
      setMessage({ type: "error", text: "Only PDF files are allowed" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "File size must not exceed 5MB" });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const result = await studentService.uploadResume(file);
      setMessage({ type: "success", text: `Resume "${result.filename}" uploaded successfully!` });
      // Refresh profile to get new resume URL
      const updatedProfile = await studentService.getMyProfile();
      setProfile(updatedProfile);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMessage({ type: "error", text: msg || "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow-sm">
            <FileUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Resume</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">Upload your resume in PDF format (max 5MB)</p>
          </div>
        </div>
      </FadeIn>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
              message.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400"
                : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400"
            }`}
          >
            {message.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {profile && (
        <FadeIn delay={0.1}>
          <Card>
            <motion.div
              whileHover={{ scale: 1.005 }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={`border-2 border-dashed rounded-2xl p-14 text-center transition-all cursor-pointer ${
                dragOver
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-950/20 scale-[1.01]"
                  : "border-surface-300 dark:border-surface-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-surface-50 dark:hover:bg-surface-800/50"
              }`}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <motion.div
                animate={uploading ? { rotate: 360 } : dragOver ? { y: -8 } : { y: 0 }}
                transition={uploading ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: "spring" }}
                className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 flex items-center justify-center"
              >
                <Upload className="w-7 h-7 text-primary-600 dark:text-primary-400" />
              </motion.div>
              <p className="text-surface-800 dark:text-surface-200 font-semibold mb-1">
                {uploading ? "Uploading..." : "Drag & drop your resume here"}
              </p>
              <p className="text-surface-400 dark:text-surface-500 text-sm mb-4">or click to browse files</p>
              <span className="inline-block px-3 py-1 bg-surface-100 dark:bg-surface-700 rounded-full text-xs text-surface-500 dark:text-surface-400">
                PDF only &middot; Max 5MB
              </span>
            </motion.div>
          </Card>
        </FadeIn>
      )}

      {profile?.resume_url && (
        <FadeIn delay={0.2}>
          <Card title="Current Resume">
            <div className="flex items-center gap-4 p-4 bg-primary-50 dark:bg-primary-950/20 rounded-xl border border-primary-100 dark:border-primary-900/30">
              <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">Your Resume</p>
                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{profile.resume_url}</p>
              </div>
              <a
                href={profile.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-semibold flex-shrink-0 px-3 py-1.5 rounded-lg bg-white dark:bg-surface-800 border border-primary-200 dark:border-primary-800/50 hover:shadow-sm transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View
              </a>
            </div>
          </Card>
        </FadeIn>
      )}

      {/* AI Resume Analyzer — add-on */}
      {profile?.resume_url && (
        <FadeIn delay={0.3}>
          <AIResumeAnalyzer hasResume={!!profile.resume_url} />
        </FadeIn>
      )}

      {!profile && (
        <FadeIn delay={0.1}>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-6 text-sm text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-semibold">Profile required before uploading a resume</span>
            </div>
            <p className="text-amber-600 dark:text-amber-500 mb-4 pl-8">
              You need to complete your student profile (including uploading your marksheet) before you can upload a resume.
            </p>
            <div className="pl-8">
              <a
                href="/student/profile"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Go to Profile →
              </a>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
