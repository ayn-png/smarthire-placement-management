"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Mail, Phone, GraduationCap, Star, MapPin,
  Linkedin, Github, FileText, User, BookOpen, Award, Eye, EyeOff,
} from "lucide-react";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { studentService } from "@/services/api";
import { StudentProfile } from "@/types";
import { getFileUrl } from "@/lib/utils";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";

export default function AdminStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showResume, setShowResume] = useState(false);

  useEffect(() => {
    studentService
      .getStudentById(id)
      .then(setProfile)
      .catch(() => setError("Student profile not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;
  if (error || !profile)
    return (
      <div className="text-center py-20">
        <p className="text-surface-500 dark:text-surface-400">{error || "Profile not found"}</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
      </div>
    );

  const initials = profile.full_name
    ? profile.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const avatarUrl = getFileUrl((profile as StudentProfile & { avatar_url?: string }).avatar_url);
  const resumeUrl = getFileUrl(profile.resume_url);

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border border-surface-200 dark:border-surface-700 flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-surface-600 dark:text-surface-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Student Profile</h1>
            <p className="text-surface-500 dark:text-surface-400 text-sm">Full profile view (admin)</p>
          </div>
        </div>
      </FadeIn>

      <StaggerContainer className="space-y-6">
        {/* ── Identity card ─────────────────────────────────────────────────── */}
        <StaggerItem>
          <motion.div whileHover={{ y: -1 }} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-2xl ring-4 ring-primary-100 dark:ring-primary-900/40 overflow-hidden bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={profile.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-2xl font-bold">{initials}</span>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-surface-900 dark:text-white">{profile.full_name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium">{profile.branch}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 font-medium">Sem {profile.semester}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 font-medium">{profile.roll_number}</span>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-surface-500 dark:text-surface-400">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{profile.email}</span>
                  {profile.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{profile.phone}</span>}
                </div>
              </div>

              {/* CGPA badge */}
              <div className="flex-shrink-0 text-center bg-amber-50 dark:bg-amber-900/20 rounded-2xl px-5 py-3 border border-amber-100 dark:border-amber-800/30">
                <div className="flex items-center gap-1 justify-center">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{profile.cgpa?.toFixed(2)}</span>
                </div>
                <p className="text-xs text-amber-500 dark:text-amber-500 mt-0.5">CGPA</p>
              </div>
            </div>
          </motion.div>
        </StaggerItem>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Academic Info ──────────────────────────────────────────────── */}
          <StaggerItem>
            <Card title="Academic Information">
              <div className="space-y-3">
                {[
                  { label: "Roll Number", value: profile.roll_number, icon: BookOpen },
                  { label: "Branch", value: profile.branch, icon: GraduationCap },
                  { label: "Semester", value: `Semester ${profile.semester}`, icon: BookOpen },
                  { label: "CGPA", value: profile.cgpa?.toFixed(2), icon: Star },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                    <span className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
                      <Icon className="w-4 h-4" />{label}
                    </span>
                    <span className="text-sm font-medium text-surface-800 dark:text-surface-200">{value || "—"}</span>
                  </div>
                ))}
              </div>
            </Card>
          </StaggerItem>

          {/* ── Personal Info ──────────────────────────────────────────────── */}
          <StaggerItem>
            <Card title="Personal Information">
              <div className="space-y-3">
                {[
                  { label: "Date of Birth", value: (profile as StudentProfile & { date_of_birth?: string }).date_of_birth, icon: User },
                  { label: "Address", value: (profile as StudentProfile & { address?: string }).address, icon: MapPin },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-start justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0 gap-4">
                    <span className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400 flex-shrink-0">
                      <Icon className="w-4 h-4" />{label}
                    </span>
                    <span className="text-sm font-medium text-surface-800 dark:text-surface-200 text-right">{value || "—"}</span>
                  </div>
                ))}
                {profile.about && (
                  <div className="pt-2">
                    <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">About</p>
                    <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{profile.about}</p>
                  </div>
                )}
              </div>
            </Card>
          </StaggerItem>
        </div>

        {/* ── Skills ────────────────────────────────────────────────────────── */}
        {profile.skills?.length > 0 && (
          <StaggerItem>
            <Card title="Skills">
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span key={skill} className="px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-full text-sm font-medium border border-primary-100 dark:border-primary-800/30">
                    {skill}
                  </span>
                ))}
              </div>
            </Card>
          </StaggerItem>
        )}

        {/* ── Certifications ────────────────────────────────────────────────── */}
        {(profile as StudentProfile & { certifications?: string[] }).certifications?.length > 0 && (
          <StaggerItem>
            <Card title="Certifications">
              <div className="flex flex-wrap gap-2">
                {(profile as StudentProfile & { certifications?: string[] }).certifications!.map((cert) => (
                  <span key={cert} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-medium border border-emerald-100 dark:border-emerald-800/30 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" />{cert}
                  </span>
                ))}
              </div>
            </Card>
          </StaggerItem>
        )}

        {/* ── Links & Resume ────────────────────────────────────────────────── */}
        <StaggerItem>
          <Card title="Links & Documents">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {resumeUrl && (
                  <>
                    {/* Toggle inline viewer */}
                    <button
                      onClick={() => setShowResume((v) => !v)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                    >
                      {showResume ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showResume ? "Hide Resume" : "View Resume"}
                    </button>
                    {/* Download / open in new tab */}
                    <a href={resumeUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-800 dark:text-surface-200 text-sm font-medium rounded-xl transition-colors shadow-sm border border-surface-200 dark:border-surface-600">
                      <FileText className="w-4 h-4" /> Download
                    </a>
                  </>
                )}
                {(profile as StudentProfile & { linkedin_url?: string }).linkedin_url && (
                  <a href={(profile as StudentProfile & { linkedin_url?: string }).linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </a>
                )}
                {(profile as StudentProfile & { github_url?: string }).github_url && (
                  <a href={(profile as StudentProfile & { github_url?: string }).github_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 dark:bg-surface-700 hover:bg-surface-900 dark:hover:bg-surface-600 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
                    <Github className="w-4 h-4" /> GitHub
                  </a>
                )}
                {!resumeUrl && !(profile as StudentProfile & { linkedin_url?: string }).linkedin_url && !(profile as StudentProfile & { github_url?: string }).github_url && (
                  <p className="text-sm text-surface-400 dark:text-surface-500">No links or resume uploaded</p>
                )}
              </div>

              {/* Inline PDF viewer — shown when admin clicks "View Resume" */}
              {resumeUrl && showResume && (
                <div className="rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700 shadow-sm">
                  <iframe
                    src={resumeUrl}
                    title={`${profile.full_name} — Resume`}
                    className="w-full"
                    style={{ height: "780px", border: "none" }}
                  />
                </div>
              )}
            </div>
          </Card>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
