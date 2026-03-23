"use client";
import { useEffect, useState } from "react";
import { ClipboardList, Calendar, Building2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { applicationService } from "@/services/api";
import { Application, ApplicationStatus } from "@/types";
import { formatDate, getStatusColor } from "@/lib/utils";
import { FadeIn } from "@/components/ui/Animations";

const STATUS_STEPS: ApplicationStatus[] = [
  "PENDING", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "SELECTED"
];

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  // FIX 4 — `filter` added to deps so server-side filtering fires on every tab
  // change, not just on initial mount. `setLoading(true)` called at the top of
  // `load()` so the spinner appears while switching between status tabs.
  // The redundant client-side `const filtered = ...` variable has been removed;
  // `applications` (already filtered by the API) is used directly in JSX.
  useEffect(() => {
    load();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const data = await applicationService.getMyApplications(filter || undefined);
      setApplications(data.applications || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw(id: string) {
    if (!confirm("Are you sure you want to withdraw this application?")) return;
    setWithdrawing(id);
    try {
      await applicationService.withdraw(id);
      await load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to withdraw");
    } finally {
      setWithdrawing(null);
    }
  }

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow-sm">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">My Applications</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">{applications.length} total applications</p>
          </div>
        </div>
      </FadeIn>

      {/* Filter tabs */}
      <FadeIn delay={0.1}>
        <div className="flex gap-2 flex-wrap">
          {["", "PENDING", "SHORTLISTED", "INTERVIEW_SCHEDULED", "SELECTED", "REJECTED"].map((s) => (
            <motion.button
              key={s}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === s
                  ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow-sm"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {s ? s.replace(/_/g, " ") : "All"}
            </motion.button>
          ))}
        </div>
      </FadeIn>

      {/* FIX 4 — `applications` used directly; no client-side re-filter needed */}
      {applications.length === 0 ? (
        <FadeIn delay={0.15}>
          <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
              <ClipboardList className="w-7 h-7 text-surface-400 dark:text-surface-500" />
            </div>
            <p className="text-surface-500 dark:text-surface-400 font-medium">No applications found</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-4">
          {applications.map((app, idx) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 hover:shadow-lg dark:hover:shadow-surface-900/50 transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-surface-900 dark:text-white text-lg">{app.job_title}</h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(app.status)}`}>
                      {app.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-surface-500 dark:text-surface-400 text-sm flex-wrap">
                    <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{app.company_name}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Applied {formatDate(app.applied_at)}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar for active apps */}
              {!["REJECTED", "WITHDRAWN"].includes(app.status) && (
                <div className="mt-5">
                  <div className="flex items-center">
                    {STATUS_STEPS.map((step, idx) => {
                      const currentIdx = STATUS_STEPS.indexOf(app.status as ApplicationStatus);
                      const isComplete = idx <= currentIdx;
                      const isActive = idx === currentIdx;
                      return (
                        <div key={step} className="flex items-center flex-1">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring" }}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                              isComplete
                                ? "bg-gradient-to-br from-primary-500 to-primary-600 border-primary-500 text-white shadow-sm"
                                : "border-surface-300 dark:border-surface-600 text-surface-400 dark:text-surface-500"
                            } ${isActive ? "ring-4 ring-primary-500/20" : ""}`}
                          >
                            {isComplete ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              idx + 1
                            )}
                          </motion.div>
                          {idx < STATUS_STEPS.length - 1 && (
                            <div className="flex-1 h-0.5 mx-1 rounded-full overflow-hidden bg-surface-200 dark:bg-surface-700">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: isComplete && idx < currentIdx ? "100%" : "0%" }}
                                transition={{ duration: 0.5 }}
                                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2">
                    {STATUS_STEPS.map((step) => (
                      <span key={step} className="text-[10px] text-surface-400 dark:text-surface-500 font-medium" style={{ width: `${100/STATUS_STEPS.length}%`, textAlign: "center" }}>
                        {step.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {app.remarks && (
                <div className="mt-4 bg-primary-50 dark:bg-primary-950/20 rounded-xl px-4 py-3 text-sm text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-900/30">
                  <span className="font-semibold">Remarks:</span> {app.remarks}
                </div>
              )}

              {/* Fix: interview_date block is now gated on the current status.
                  Previously, if a student was REJECTED after an interview was
                  scheduled, the interview_date field remained set in the DB and
                  the "Interview on …" block still rendered alongside the
                  rejection status — showing conflicting messages.
                  Now it only shows when status is INTERVIEW_SCHEDULED or SELECTED. */}
              {app.interview_date &&
                ["INTERVIEW_SCHEDULED", "SELECTED"].includes(app.status) && (
                <div className="mt-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-3 border border-emerald-100 dark:border-emerald-900/30">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>Interview on {formatDate(app.interview_date)}</span>
                  {app.interview_link && (
                    <a href={app.interview_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 ml-auto hover:underline font-semibold">
                      <ExternalLink className="w-3.5 h-3.5" />Join
                    </a>
                  )}
                </div>
              )}

              {["PENDING", "UNDER_REVIEW", "SHORTLISTED"].includes(app.status) && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={withdrawing === app.id}
                    onClick={() => handleWithdraw(app.id)}
                  >
                    Withdraw Application
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
