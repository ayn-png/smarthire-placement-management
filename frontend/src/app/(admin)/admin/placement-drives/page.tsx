"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Plus, Edit2, Trash2, Building2, MapPin, Users,
  AlertCircle, Target, ClipboardList,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn } from "@/components/ui/Animations";
import { placementDriveService, companyService } from "@/services/api";
import { PlacementDrive, DriveType, GenderPref } from "@/types";
import { extractErrorMsg } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  ONGOING: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  COMPLETED: "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

const EMPTY_FORM = {
  title: "", description: "", company_id: "", drive_date: "",
  venue: "", min_cgpa: 0, status: "UPCOMING" as PlacementDrive["status"],
  eligible_branches: [] as string[], job_ids: [] as string[],
  drive_type: "ON_CAMPUS" as DriveType, drive_time: "",
  batch: "", backlog_allowed: false, max_backlogs: undefined as number | undefined,
  gap_allowed: false, gender_preference: "ANY" as GenderPref,
  rounds: [] as string[],
  openings: 1,
};

export default function AdminPlacementDrivesPage() {
  const router = useRouter();
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDrive, setEditingDrive] = useState<PlacementDrive | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [roundInput, setRoundInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  async function loadDrives() {
    try {
      const res = await placementDriveService.list();
      setDrives(res.drives);
    } catch {
      setError("Failed to load placement drives");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDrives();
    // Load companies for dropdown
    companyService.list({ limit: 100 }).then((res) => {
      setCompanies((res.companies || []).map((c: any) => ({ id: c.id, name: c.name })));
    }).catch(() => {/* non-fatal */});
  }, []);

  function openCreate() {
    setEditingDrive(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setShowModal(true);
  }

  function openEdit(drive: PlacementDrive) {
    setEditingDrive(drive);
    setForm({
      title: drive.title,
      description: drive.description || "",
      company_id: drive.company_id || "",
      drive_date: drive.drive_date,
      venue: drive.venue || "",
      min_cgpa: drive.min_cgpa,
      status: drive.status,
      eligible_branches: drive.eligible_branches,
      job_ids: drive.job_ids,
      drive_type: drive.drive_type || "ON_CAMPUS",
      drive_time: drive.drive_time || "",
      batch: drive.batch || "",
      backlog_allowed: drive.backlog_allowed || false,
      max_backlogs: drive.max_backlogs,
      gap_allowed: drive.gap_allowed || false,
      gender_preference: drive.gender_preference || "ANY",
      rounds: drive.rounds ?? [],
      openings: drive.openings ?? 1,
    });
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.drive_date || !form.company_id || form.eligible_branches.length === 0) {
      setError("Please fill in all required fields: Title, Company, Drive Date, and at least one Branch.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, drive_time: form.drive_time || undefined, batch: form.batch || undefined };
      if (editingDrive) {
        await placementDriveService.update(editingDrive.id, payload);
      } else {
        await placementDriveService.create(payload);
      }
      setShowModal(false);
      loadDrives();
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to save drive"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(driveId: string) {
    try {
      await placementDriveService.delete(driveId);
      setDeleteConfirm(null);
      loadDrives();
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to delete drive"));
    }
  }

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow-sm">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Placement Drives</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">{drives.length} drive{drives.length !== 1 ? "s" : ""} total</p>
            </div>
          </div>
          <Button variant="primary" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> New Drive
          </Button>
        </div>
      </FadeIn>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {drives.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
            <p className="text-surface-500 dark:text-surface-400 font-medium">No placement drives yet</p>
            <p className="text-surface-400 dark:text-surface-500 text-sm mt-1">Create your first drive to get started</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drives.map((drive) => (
            <FadeIn key={drive.id}>
              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[drive.status] || STATUS_COLORS.UPCOMING}`}>
                    {drive.status}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(drive)}
                      className="p-1.5 text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(drive.id)}
                      className="p-1.5 text-surface-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-surface-900 dark:text-white mb-1">{drive.title}</h3>
                {drive.description && <p className="text-xs text-surface-500 dark:text-surface-400 mb-3 line-clamp-2">{drive.description}</p>}
                <div className="space-y-1.5 text-xs text-surface-500 dark:text-surface-400">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>{drive.drive_date}{drive.drive_time ? ` at ${drive.drive_time}` : ""}</span>
                  </div>
                  {drive.company_name && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{drive.company_name}</span>
                    </div>
                  )}
                  {drive.venue && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{drive.venue}</span>
                    </div>
                  )}
                  {drive.eligible_branches.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>{drive.eligible_branches.join(", ")}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-surface-400">Min CGPA: {drive.min_cgpa}</span>
                  <span className="text-xs text-surface-300 dark:text-surface-600">•</span>
                  <span className="text-xs text-surface-400">{drive.job_ids.length} job{drive.job_ids.length !== 1 ? "s" : ""}</span>
                  {drive.drive_type && (
                    <>
                      <span className="text-xs text-surface-300 dark:text-surface-600">•</span>
                      <span className="text-xs text-surface-400">{drive.drive_type.replace("_", " ")}</span>
                    </>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-700 flex gap-2">
                  <button
                    onClick={() => router.push(`/admin/placement-drives/${drive.id}/rounds`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                  >
                    <Target className="w-3.5 h-3.5" /> Rounds
                  </button>
                  <button
                    onClick={() => router.push(`/admin/placement-drives/${drive.id}/applications`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                  >
                    <ClipboardList className="w-3.5 h-3.5" /> Applications
                  </button>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[85vh] overflow-y-auto"
            >
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                {editingDrive ? "Edit Drive" : "Create Placement Drive"}
              </h2>
              {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
              <div className="space-y-3">

                {/* BASIC DETAILS */}
                <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2 mt-1">Basic Details</p>

                {/* Title */}
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Drive Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. TCS Campus Drive 2025" />
                </div>

                {/* Company */}
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Company *</label>
                  <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Select company...</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Drive Type + Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Drive Type *</label>
                    <select value={form.drive_type} onChange={(e) => setForm({ ...form, drive_type: e.target.value as DriveType })}
                      className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="ON_CAMPUS">On-Campus</option>
                      <option value="OFF_CAMPUS">Off-Campus</option>
                      <option value="INTERNSHIP">Internship</option>
                      <option value="PPO">PPO</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PlacementDrive["status"] })}
                      className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                      {["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Date + Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Drive Date *</label>
                    <input type="date" value={form.drive_date} onChange={(e) => setForm({ ...form, drive_date: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Time</label>
                    <input type="time" value={form.drive_time ?? ""} onChange={(e) => setForm({ ...form, drive_time: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>

                {/* Venue + Openings */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Venue</label>
                    <input type="text" value={form.venue ?? ""} onChange={(e) => setForm({ ...form, venue: e.target.value })}
                      placeholder="e.g. Auditorium A / Google Meet"
                      className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Openings *</label>
                    <input type="number" min={1} value={form.openings} onChange={(e) => setForm({ ...form, openings: parseInt(e.target.value) || 1 })}
                      className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
                  <textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Details about the drive..." />
                </div>

                {/* ELIGIBILITY */}
                <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2 mt-3">Eligibility Criteria</p>

                {/* Min CGPA + Batch */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Min CGPA *</label>
                    <input type="number" min={0} max={10} step={0.1} value={form.min_cgpa} onChange={(e) => setForm({ ...form, min_cgpa: parseFloat(e.target.value) || 0 })}
                      className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Batch</label>
                    <select value={form.batch ?? ""} onChange={(e) => setForm({ ...form, batch: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="">Any</option>
                      {["2024", "2025", "2026", "2027"].map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                {/* Allowed Branches */}
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">Allowed Branches *</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["CSE", "IT", "ECE", "EEE", "ME", "CE", "CHE", "MCA", "MBA"].map((branch) => (
                      <label key={branch} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={form.eligible_branches.includes(branch)}
                          onChange={(e) => {
                            const branches = e.target.checked
                              ? [...form.eligible_branches, branch]
                              : form.eligible_branches.filter((b) => b !== branch);
                            setForm({ ...form, eligible_branches: branches });
                          }}
                          className="rounded" />
                        <span className="text-xs text-surface-700 dark:text-surface-300">{branch}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Backlog Allowed */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Backlog Allowed *</p>
                    </div>
                    <div className="flex gap-2">
                      {["Yes", "No"].map((v) => (
                        <button key={v} type="button"
                          onClick={() => setForm({ ...form, backlog_allowed: v === "Yes", max_backlogs: v === "No" ? undefined : form.max_backlogs })}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${(v === "Yes" ? form.backlog_allowed : !form.backlog_allowed) ? "bg-primary-600 text-white" : "bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300"}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.backlog_allowed && (
                    <div>
                      <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Max Backlogs Allowed</label>
                      <input type="number" min={0} value={form.max_backlogs ?? ""} onChange={(e) => setForm({ ...form, max_backlogs: parseInt(e.target.value) || undefined })}
                        className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="0 = unlimited" />
                    </div>
                  )}
                </div>

                {/* Gap Allowed + Gender Preference */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Gap Allowed *</p>
                    <div className="flex gap-2">
                      {["Yes", "No"].map((v) => (
                        <button key={v} type="button"
                          onClick={() => setForm({ ...form, gap_allowed: v === "Yes" })}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${(v === "Yes" ? form.gap_allowed : !form.gap_allowed) ? "bg-primary-600 text-white" : "bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300"}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Gender Preference</label>
                    <select value={form.gender_preference ?? "ANY"} onChange={(e) => setForm({ ...form, gender_preference: e.target.value as GenderPref })}
                      className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="ANY">Any</option>
                      <option value="MALE">Male Only</option>
                      <option value="FEMALE">Female Only</option>
                    </select>
                  </div>
                </div>

                {/* Interview Rounds */}
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300 block mb-2">Interview Rounds</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={roundInput}
                      onChange={(e) => setRoundInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && roundInput.trim()) {
                          e.preventDefault();
                          setForm({ ...form, rounds: [...form.rounds, roundInput.trim()] });
                          setRoundInput("");
                        }
                      }}
                      placeholder="e.g. Aptitude Test"
                      className="flex-1 px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button type="button"
                      onClick={() => {
                        if (roundInput.trim()) {
                          setForm({ ...form, rounds: [...form.rounds, roundInput.trim()] });
                          setRoundInput("");
                        }
                      }}
                      className="px-3 py-2 bg-primary-600 text-white text-sm rounded-xl hover:bg-primary-700 transition-colors font-medium">
                      Add
                    </button>
                  </div>
                  {form.rounds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.rounds.map((r, i) => (
                        <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-lg border border-primary-200 dark:border-primary-800">
                          {r}
                          <button type="button" onClick={() => setForm({ ...form, rounds: form.rounds.filter((_, j) => j !== i) })}
                            className="ml-0.5 text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 font-bold leading-none">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

              </div>
              <div className="flex gap-3 mt-5">
                <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" fullWidth onClick={handleSave} loading={saving}>
                  {editingDrive ? "Save Changes" : "Create Drive"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Delete Drive?</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">
                This will permanently delete this placement drive. Associated jobs and applications will not be affected.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => handleDelete(deleteConfirm)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
