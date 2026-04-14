"use client";
import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Clock, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { complaintsService, Complaint } from "@/services/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";
import { toast } from "react-hot-toast";

const MAX_SOLUTION = 3000;

export default function ManagementComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_LIMIT = 20;

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [solution, setSolution] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, [filter, page]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await complaintsService.list(
        filter !== "ALL"
          ? { status: filter, page, limit: PAGE_LIMIT }
          : { page, limit: PAGE_LIMIT }
      );
      setComplaints(res.complaints);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load complaints");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedComplaint) return;
    if (!solution.trim()) {
      toast.error("Please provide a solution or remark");
      return;
    }
    if (solution.length > MAX_SOLUTION) {
      toast.error(`Solution must be at most ${MAX_SOLUTION} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      await complaintsService.update(selectedComplaint.id, { status: "Resolved", solution });
      toast.success("Complaint resolved successfully!");
      setSolution("");
      setSelectedComplaint(null);
      fetchComplaints();
    } catch {
      toast.error("Failed to resolve complaint");
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div className="space-y-6 lg:flex lg:space-y-0 lg:gap-6 h-[calc(100vh-8rem)]">
      {/* Left Panel — List */}
      <div className="w-full lg:w-1/3 flex flex-col h-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-glow-sm">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-surface-900 dark:text-white">Issue Tracking</h1>
              <p className="text-surface-500 dark:text-surface-400 text-xs mt-0.5">
                Manage student complaints
                {total > 0 && <span className="ml-1 font-semibold">({total} total)</span>}
              </p>
            </div>
          </div>
          {/* Filter tabs */}
          <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-xl">
            {["ALL", "Pending", "Resolved"].map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1); setSelectedComplaint(null); }}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                  filter === f
                    ? "bg-white dark:bg-surface-600 text-surface-900 dark:text-white shadow-sm"
                    : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-surface-100 dark:bg-surface-800 rounded-2xl" />
              ))}
            </div>
          ) : complaints.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-surface-400">
              <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">No complaints found</p>
            </div>
          ) : (
            <StaggerContainer>
              {complaints.map((comp) => (
                <StaggerItem key={comp.id}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedComplaint(comp); setSolution(comp.solution || ""); }}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      selectedComplaint?.id === comp.id
                        ? "bg-primary-50 dark:bg-primary-500/10 border-primary-500"
                        : "bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 hover:border-primary-500/50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-semibold text-surface-900 dark:text-white line-clamp-1">
                        {comp.title}
                      </h3>
                      {comp.status === "Pending" ? (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500 text-xs font-medium shrink-0 ml-2">
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500 text-xs font-medium shrink-0 ml-2">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-1">
                      {comp.user_name} • {new Date(comp.created_at).toLocaleDateString()}
                    </p>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 disabled:opacity-40 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-xs text-surface-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-xs px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 disabled:opacity-40 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Right Panel — Detail */}
      <div className="w-full lg:w-2/3 h-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-3xl p-6 shadow-sm overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedComplaint ? (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <div className="flex items-center gap-3 text-surface-500 dark:text-surface-400 text-sm mb-2">
                  <span className="font-semibold text-surface-900 dark:text-white">
                    {selectedComplaint.user_name}
                  </span>
                  • {selectedComplaint.user_email} •{" "}
                  {new Date(selectedComplaint.created_at).toLocaleString()}
                </div>
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-4">
                  {selectedComplaint.title}
                </h2>
                <div className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-2xl text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap border border-surface-200 dark:border-surface-700">
                  {selectedComplaint.description}
                </div>
              </div>

              {selectedComplaint.status === "Pending" ? (
                <div className="pt-6 border-t border-surface-200 dark:border-surface-800">
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">
                    Provide Solution
                  </h3>
                  <div className="relative">
                    <textarea
                      className="w-full h-32 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all resize-none mb-1"
                      placeholder="Type the official response or resolution to this issue..."
                      maxLength={MAX_SOLUTION}
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                    />
                    <span
                      className={`absolute bottom-3 right-3 text-xs ${
                        solution.length >= MAX_SOLUTION ? "text-red-500 font-semibold" : "text-surface-400"
                      }`}
                    >
                      {solution.length}/{MAX_SOLUTION}
                    </span>
                  </div>
                  <div className="flex justify-end gap-3 mt-3">
                    <Button variant="ghost" onClick={() => setSelectedComplaint(null)}>Cancel</Button>
                    <Button onClick={handleResolve} disabled={submitting} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Mark as Resolved
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-6 border-t border-surface-200 dark:border-surface-800">
                  <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-500 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Resolution Completed
                  </h3>
                  <div className="p-5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl text-sm text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap">
                    {selectedComplaint.solution || "No written remarks provided."}
                  </div>
                  <p className="text-xs text-surface-500 mt-3 text-right">
                    Resolved at: {new Date(selectedComplaint.updated_at).toLocaleString()}
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center text-surface-400 dark:text-surface-500"
            >
              <Search className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a complaint to view details</p>
              <p className="text-sm mt-1">Review, respond, and resolve student issues</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
