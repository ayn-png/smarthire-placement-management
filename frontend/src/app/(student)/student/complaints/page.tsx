"use client";
import { useState, useEffect } from "react";
import {
  AlertCircle, Clock, CheckCircle2, ChevronDown, ChevronUp, PlusCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { complaintsService, Complaint } from "@/services/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { toast } from "react-hot-toast";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const PAGE_LIMIT = 20;

interface FormErrors {
  title?: string;
  description?: string;
}

export default function StudentComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ title: "", description: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, [page]);

  const fetchComplaints = async () => {
    if (page === 1) setLoading(true);
    try {
      const res = await complaintsService.list({ page, limit: PAGE_LIMIT });
      setComplaints(res.complaints);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load complaints");
    } finally {
      setLoading(false);
    }
  };

  // Field-level validation matching backend constraints exactly
  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!form.title.trim()) {
      errs.title = "Title is required.";
    } else if (form.title.trim().length < 5) {
      errs.title = "Title must be at least 5 characters.";
    } else if (form.title.length > MAX_TITLE) {
      errs.title = `Title must be at most ${MAX_TITLE} characters.`;
    }
    if (!form.description.trim()) {
      errs.description = "Description is required.";
    } else if (form.description.trim().length < 10) {
      errs.description = "Description must be at least 10 characters.";
    } else if (form.description.length > MAX_DESCRIPTION) {
      errs.description = `Description must be at most ${MAX_DESCRIPTION} characters.`;
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await complaintsService.create({ title: form.title.trim(), description: form.description.trim() });
      toast.success("Complaint submitted successfully");
      setForm({ title: "", description: "" });
      setErrors({});
      setShowForm(false);
      setPage(1);
      fetchComplaints();
    } catch {
      toast.error("Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  if (loading && page === 1) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <FadeIn className="flex justify-between items-end">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-glow-sm">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Help & Support</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">
              Raise issues or track your previous complaints
              {total > 0 && <span className="ml-1 font-semibold">({total} total)</span>}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2">
          {showForm ? "View Issues" : <><PlusCircle className="w-4 h-4" /> Raise Issue</>}
        </Button>
      </FadeIn>

      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="max-w-2xl mx-auto border-primary-500/30 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-4">New Issue</h2>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Title */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                      Subject
                    </label>
                    <span
                      className={`text-xs ${form.title.length > MAX_TITLE ? "text-red-500 font-semibold" : "text-surface-400"}`}
                    >
                      {form.title.length}/{MAX_TITLE}
                    </span>
                  </div>
                  <Input
                    value={form.title}
                    maxLength={MAX_TITLE}
                    onChange={(e) => {
                      setForm({ ...form, title: e.target.value });
                      if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                    }}
                    placeholder="Brief title of the issue"
                    className={errors.title ? "border-red-500 focus:border-red-500" : ""}
                  />
                  {errors.title && (
                    <p className="text-xs text-red-500 mt-1">{errors.title}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                      Description
                    </label>
                    <span
                      className={`text-xs ${form.description.length > MAX_DESCRIPTION ? "text-red-500 font-semibold" : "text-surface-400"}`}
                    >
                      {form.description.length}/{MAX_DESCRIPTION}
                    </span>
                  </div>
                  <textarea
                    className={`w-full h-40 bg-surface-50 dark:bg-surface-900 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all resize-none text-sm ${
                      errors.description
                        ? "border-red-500"
                        : "border-surface-200 dark:border-surface-700"
                    }`}
                    value={form.description}
                    maxLength={MAX_DESCRIPTION}
                    onChange={(e) => {
                      setForm({ ...form, description: e.target.value });
                      if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                    }}
                    placeholder="Describe your issue in detail so management can assist you better..."
                  />
                  {errors.description && (
                    <p className="text-xs text-red-500 mt-1">{errors.description}</p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" type="button" onClick={() => { setShowForm(false); setErrors({}); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Complaint"}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            {complaints.length === 0 ? (
              <div className="text-center py-16 bg-surface-50 dark:bg-surface-800/50 rounded-2xl border border-surface-200 dark:border-surface-700/50">
                <AlertCircle className="w-12 h-12 text-surface-400 mx-auto mb-3 opacity-50" />
                <p className="text-surface-500 dark:text-surface-400 font-medium">
                  You haven&apos;t raised any issues
                </p>
                <Button variant="ghost" className="mt-4" onClick={() => setShowForm(true)}>
                  Raise Your First Issue
                </Button>
              </div>
            ) : (
              <>
                <StaggerContainer>
                  {complaints.map((comp) => (
                    <StaggerItem key={comp.id}>
                      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden shadow-sm transition-all hover:border-primary-500/30">
                        <div
                          className="p-4 sm:p-5 flex justify-between items-center cursor-pointer select-none"
                          onClick={() => setExpandedId(expandedId === comp.id ? null : comp.id)}
                        >
                          <div className="flex-1 pr-4">
                            <h3 className="font-semibold text-surface-900 dark:text-white text-base truncate">
                              {comp.title}
                            </h3>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500 dark:text-surface-400">
                              <span>{new Date(comp.created_at).toLocaleDateString()}</span>
                              <span className="w-1 h-1 rounded-full bg-surface-300 dark:bg-surface-600" />
                              {comp.status === "Pending" ? (
                                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500 font-medium">
                                  <Clock className="w-3.5 h-3.5" /> Pending
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-surface-100 dark:bg-surface-700 flex justify-center items-center text-surface-500 transition-transform">
                            {expandedId === comp.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedId === comp.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-surface-50 dark:bg-surface-900/50 border-t border-surface-100 dark:border-surface-800"
                            >
                              <div className="p-4 sm:p-5 space-y-4">
                                <div>
                                  <h4 className="text-xs font-bold text-surface-400 mb-1 uppercase tracking-wider">
                                    Description
                                  </h4>
                                  <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap">
                                    {comp.description}
                                  </p>
                                </div>
                                {comp.status === "Resolved" && comp.solution && (
                                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3 opacity-20">
                                      <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                                    </div>
                                    <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-500 mb-2 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> RESOLUTION
                                    </h4>
                                    <p className="text-sm text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap relative z-10">
                                      {comp.solution}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="text-sm px-4 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 disabled:opacity-40 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                    >
                      ← Previous
                    </button>
                    <span className="text-sm text-surface-500">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="text-sm px-4 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 disabled:opacity-40 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
