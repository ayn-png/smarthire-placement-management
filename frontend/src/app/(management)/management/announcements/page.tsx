"use client";
import { useState, useEffect, useRef } from "react";
import { BellRing, Send, Trash2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { announcementsService, Announcement } from "@/services/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";
import { toast } from "react-hot-toast";

const MAX_TITLE = 200;
const MAX_MESSAGE = 5000;

type TargetAudience = "STUDENTS" | "PLACEMENT_ADMINS" | "ALL";

interface FormState {
  title: string;
  message: string;
  target_audience: TargetAudience;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({
    title: "",
    message: "",
    target_audience: "STUDENTS",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await announcementsService.list();
      setAnnouncements(data);
    } catch {
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  // Validate & open confirmation modal
  const handleBroadcastClick = (e: React.FormEvent) => {
    e.preventDefault();
    const titleErr = validateTitle(form.title);
    const msgErr = validateMessage(form.message);
    if (titleErr) { toast.error(titleErr); return; }
    if (msgErr) { toast.error(msgErr); return; }
    setConfirmOpen(true);
  };

  // Actual submit after confirmation
  const handleConfirmBroadcast = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      await announcementsService.create(form);
      toast.success("Announcement broadcasted successfully!");
      setForm({ title: "", message: "", target_audience: "STUDENTS" });
      fetchAnnouncements();
    } catch {
      toast.error("Failed to send announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await announcementsService.delete(id);
      toast.success("Announcement deleted");
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Failed to delete announcement");
    } finally {
      setDeletingId(null);
    }
  };

  // Inline validators matching backend constraints
  const validateTitle = (v: string): string | null => {
    if (!v.trim()) return "Title is required.";
    if (v.trim().length < 3) return "Title must be at least 3 characters.";
    if (v.length > MAX_TITLE) return `Title must be at most ${MAX_TITLE} characters.`;
    return null;
  };
  const validateMessage = (v: string): string | null => {
    if (!v.trim()) return "Message is required.";
    if (v.trim().length < 10) return "Message must be at least 10 characters.";
    if (v.length > MAX_MESSAGE) return `Message must be at most ${MAX_MESSAGE} characters.`;
    return null;
  };

  const audienceLabel: Record<TargetAudience, string> = {
    STUDENTS: "Students",
    PLACEMENT_ADMINS: "Placement Admins",
    ALL: "Everyone",
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-glow-sm">
            <BellRing className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Announcements</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">
              Broadcast important updates to students and placement admins.
            </p>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <FadeIn delay={0.1} className="lg:col-span-1">
          <Card className="sticky top-6">
            <h2 className="text-lg font-semibold mb-4 text-surface-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-primary-500" /> New Broadcast
            </h2>
            <form onSubmit={handleBroadcastClick} className="space-y-4" noValidate>
              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Target Audience
                </label>
                <select
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all mt-1"
                  value={form.target_audience}
                  onChange={(e) => setForm({ ...form, target_audience: e.target.value as TargetAudience })}
                >
                  <option value="STUDENTS">Students</option>
                  <option value="PLACEMENT_ADMINS">Placement Admins</option>
                  <option value="ALL">Everyone</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Title
                  </label>
                  <span className={`text-xs ${form.title.length > MAX_TITLE ? "text-red-500 font-semibold" : "text-surface-400"}`}>
                    {form.title.length}/{MAX_TITLE}
                  </span>
                </div>
                <Input
                  value={form.title}
                  maxLength={MAX_TITLE}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Upcoming Google Drive"
                />
              </div>

              {/* Message */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Message
                  </label>
                  <span className={`text-xs ${form.message.length > MAX_MESSAGE ? "text-red-500 font-semibold" : "text-surface-400"}`}>
                    {form.message.length}/{MAX_MESSAGE}
                  </span>
                </div>
                <textarea
                  className="w-full h-32 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all resize-none"
                  value={form.message}
                  maxLength={MAX_MESSAGE}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Enter the comprehensive details of the announcement..."
                />
              </div>

              <Button
                type="submit"
                className="w-full flex justify-center items-center gap-2"
                disabled={submitting}
              >
                {submitting ? "Broadcasting..." : "Broadcast Announcement"}
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </Card>
        </FadeIn>

        {/* Announcements List */}
        <StaggerContainer className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
            Previous Announcements
          </h2>
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-surface-100 dark:bg-surface-800 rounded-xl" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-12 bg-surface-50 dark:bg-surface-800/50 rounded-2xl border border-surface-200 dark:border-surface-700/50">
              <BellRing className="w-12 h-12 text-surface-400 mx-auto mb-3 opacity-50" />
              <p className="text-surface-500 dark:text-surface-400 font-medium">No announcements yet</p>
            </div>
          ) : (
            announcements.map((ann) => (
              <StaggerItem key={ann.id}>
                <motion.div
                  whileHover={{ y: -2 }}
                  className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2 gap-3">
                    <h3 className="text-base font-semibold text-surface-900 dark:text-white flex-1">
                      {ann.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400">
                        {audienceLabel[ann.target_audience] ?? ann.target_audience}
                      </span>
                      <button
                        onClick={() => handleDelete(ann.id)}
                        disabled={deletingId === ann.id}
                        title="Delete announcement"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-surface-600 dark:text-surface-300 mt-2 whitespace-pre-wrap">
                    {ann.message}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-surface-400 dark:text-surface-500">
                    <span>By {ann.created_by_name || "Management"}</span>
                    <span>{new Date(ann.created_at).toLocaleString()}</span>
                  </div>
                </motion.div>
              </StaggerItem>
            ))
          )}
        </StaggerContainer>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            key="confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-surface-200 dark:border-surface-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">Confirm Broadcast</h3>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-300 mb-2">
                You are about to send <strong>"{form.title}"</strong> to{" "}
                <strong>{audienceLabel[form.target_audience]}</strong>.
              </p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mb-6">
                This will push notifications to all matching users. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmBroadcast} className="flex items-center gap-2">
                  <Send className="w-4 h-4" /> Broadcast
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
