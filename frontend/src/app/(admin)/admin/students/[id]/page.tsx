"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Mail, Phone, GraduationCap, Star, MapPin,
  Linkedin, Github, FileText, User, BookOpen, Award, Eye, EyeOff,
  BadgeCheck, ExternalLink, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { studentService } from "@/services/api";
import { StudentProfile } from "@/types";
import { getFileUrl, extractErrorMsg } from "@/lib/utils";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";

export default function AdminStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showResume, setShowResume] = useState(false);
  const [showPlacedModal, setShowPlacedModal] = useState(false);
  const [placedForm, setPlacedForm] = useState({ placed_company: "", placed_package: "" });
  const [placedSaving, setPlacedSaving] = useState(false);
  const [placedError, setPlacedError] = useState("");

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

  async function handleMarkPlaced() {
    setPlacedSaving(true);
    setPlacedError("");
    try {
      await studentService.markPlaced(id, {
        is_placed: true,
        placed_company: placedForm.placed_company || undefined,
        placed_package: placedForm.placed_package ? parseFloat(placedForm.placed_package) : undefined,
      });
      const updated = await studentService.getStudentById(id);
      setProfile(updated);
      setShowPlacedModal(false);
    } catch (err) {
      setPlacedError(extractErrorMsg(err, "Failed to mark as placed"));
    } finally {
      setPlacedSaving(false);
    }
  }

  const initials = profile.full_name
    ? profile.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const avatarUrl = getFileUrl((profile as StudentProfile & { avatar_url?: string }).avatar_url);
  const resumeUrl = getFileUrl(profile.resume_url);

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3">
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
          {!profile.is_placed && (
            <Button variant="primary" onClick={() => { setPlacedForm({ placed_company: "", placed_package: "" }); setPlacedError(""); setShowPlacedModal(true); }}>
              <BadgeCheck className="w-4 h-4 mr-2" /> Mark as Placed
            </Button>
          )}
          {profile.is_placed && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-medium">
              <BadgeCheck className="w-4 h-4" /> Placed
            </span>
          )}
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

        {/* ── Placement Status ──────────────────────────────────────────────── */}
        {profile.is_placed && (
          <StaggerItem>
            <Card title="Placement Status">
              <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                <BadgeCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Student is placed</p>
                  {profile.placed_company && <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-0.5">Company: {profile.placed_company}</p>}
                  {profile.placed_package && <p className="text-sm text-emerald-600 dark:text-emerald-500">Package: ₹{profile.placed_package} LPA</p>}
                </div>
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
                {profile.offer_letter_url && (
                  <a href={profile.offer_letter_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
                    <ExternalLink className="w-4 h-4" /> Offer Letter
                  </a>
                )}
                {!resumeUrl && !(profile as StudentProfile & { linkedin_url?: string }).linkedin_url && !(profile as StudentProfile & { github_url?: string }).github_url && !profile.offer_letter_url && (
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

      {/* Mark as Placed Modal */}
      <AnimatePresence>
        {showPlacedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowPlacedModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-1">Mark as Placed</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                Record placement details for <span className="font-medium text-surface-700 dark:text-surface-300">{profile.full_name}</span>.
              </p>
              {placedError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400 mb-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{placedError}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Company Name</label>
                  <input
                    value={placedForm.placed_company}
                    onChange={(e) => setPlacedForm({ ...placedForm, placed_company: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. Google, Infosys..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Package (LPA)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={placedForm.placed_package}
                    onChange={(e) => setPlacedForm({ ...placedForm, placed_package: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. 12.5"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <Button variant="secondary" fullWidth onClick={() => setShowPlacedModal(false)}>Cancel</Button>
                <Button variant="primary" fullWidth onClick={handleMarkPlaced} loading={placedSaving}>
                  Confirm Placed
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
