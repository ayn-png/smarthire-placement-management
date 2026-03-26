"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Plus, Edit2, Trash2, Building2, MapPin, Users, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn } from "@/components/ui/Animations";
import { placementDriveService } from "@/services/api";
import { PlacementDrive } from "@/types";
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
};

export default function AdminPlacementDrivesPage() {
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDrive, setEditingDrive] = useState<PlacementDrive | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  useEffect(() => { loadDrives(); }, []);

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
    });
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (editingDrive) {
        await placementDriveService.update(editingDrive.id, form);
      } else {
        await placementDriveService.create(form);
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
                    <span>{drive.drive_date}</span>
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
                <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 flex items-center gap-2">
                  <span className="text-xs text-surface-400">Min CGPA: {drive.min_cgpa}</span>
                  <span className="text-xs text-surface-300 dark:text-surface-600">•</span>
                  <span className="text-xs text-surface-400">{drive.job_ids.length} job{drive.job_ids.length !== 1 ? "s" : ""}</span>
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
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                {editingDrive ? "Edit Drive" : "Create Placement Drive"}
              </h2>
              {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Campus Placement Drive 2025"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Drive Date *</label>
                  <input
                    type="date"
                    value={form.drive_date}
                    onChange={(e) => setForm({ ...form, drive_date: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Venue</label>
                  <input
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Auditorium / Online"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Min CGPA</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={form.min_cgpa}
                    onChange={(e) => setForm({ ...form, min_cgpa: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as PlacementDrive["status"] })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Details about the drive..."
                  />
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
