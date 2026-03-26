"use client";
import { useEffect, useState } from "react";
import { ClipboardList, Calendar, Building2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Button from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/Animations";
import { applicationService } from "@/services/api";
import { Application, ApplicationStatus } from "@/types";
import { formatDate, getStatusColor, extractErrorMsg } from "@/lib/utils";
import { db } from "@/lib/firestore";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_STEPS: ApplicationStatus[] = [
  "PENDING", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "SELECTED"
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Applied",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_SCHEDULED: "Interview",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

function toIso(val: unknown): string {
  if (!val) return "";
  if (typeof val === "object" && val !== null && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return String(val);
}

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState("");
  const [withdrawing, setWithdrawing]   = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "applications"),
      where("student_id", "==", user.uid),
      orderBy("applied_at", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const apps = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            applied_at: toIso(data.applied_at),
            updated_at: toIso(data.updated_at),
          } as Application;
        });
        setApplications(apps);
        setLoading(false);
      },
      () => {
        // onSnapshot error — fall back to REST
        applicationService.getMyApplications().then((res) => {
          setApplications(res.applications || []);
        }).finally(() => setLoading(false));
      }
    );

    return () => unsub();
  }, [user?.uid]);

  async function handleWithdraw(id: string) {
    if (!confirm("Are you sure you want to withdraw this application?")) return;
    setWithdrawing(id);
    try {
      await applicationService.withdraw(id);
      // onSnapshot will update the list automatically
    } catch (err: unknown) {
      alert(extractErrorMsg(err, "Failed to withdraw"));
    } finally {
      setWithdrawing(null);
    }
  }

  const filtered = filter ? applications.filter((a) => a.status === filter) : applications;

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow-sm">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">My Applications</h1>
              <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm flex items-center gap-1.5">
                {applications.length} total
                <span className="inline-flex items-center gap-1 text-emerald-500 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  live
                </span>
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Filter tabs */}
      <FadeIn delay={0.1}>
        <div className="flex gap-2 flex-wrap">
          {["", "PENDING", "SHORTLISTED", "SELECTED", "REJECTED"].map((s) => (
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
              {s ? (STATUS_LABEL[s] ?? s.replace(/_/g, " ")) : "All"}
            </motion.button>
          ))}
        </div>
      </FadeIn>

      {filtered.length === 0 ? (
        <FadeIn delay={0.15}>
          <Card>
            <div className="text-center py-16">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
              <p className="text-surface-500 dark:text-surface-400 font-medium">No applications found</p>
              <p className="text-surface-400 dark:text-surface-500 text-sm mt-1">
                {filter ? "Try a different status filter" : "Browse drives to apply for positions"}
              </p>
            </div>
          </Card>
        </FadeIn>
      ) : (
        <div className="space-y-4">
          {filtered.map((app) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-6 hover:shadow-lg dark:hover:shadow-surface-900/50 transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-surface-900 dark:text-white text-lg truncate">{app.job_title}</h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${getStatusColor(app.status)}`}>
                      {STATUS_LABEL[app.status] ?? app.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-surface-500 dark:text-surface-400 text-sm flex-wrap">
                    {app.company_name && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />{app.company_name}
                      </span>
                    )}
                    {app.applied_at && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />Applied {formatDate(app.applied_at)}
                      </span>
                    )}
                    {app.updated_at && app.updated_at !== app.applied_at && (
                      <span className="flex items-center gap-1.5 text-primary-500 dark:text-primary-400">
                        <RefreshCw className="w-3 h-3" />Updated {formatDate(app.updated_at)}
                      </span>
                    )}
                  </div>
                  {app.remarks && (
                    <p className="mt-2 text-xs text-surface-500 dark:text-surface-400 bg-surface-50 dark:bg-surface-700/50 px-3 py-1.5 rounded-lg">
                      {app.remarks}
                    </p>
                  )}
                </div>

                {/* Withdraw */}
                {app.status === "PENDING" && (
                  <Button
                    variant="ghost"
                    className="text-xs text-red-500 hover:text-red-600 flex-shrink-0"
                    loading={withdrawing === app.id}
                    onClick={() => handleWithdraw(app.id)}
                  >
                    Withdraw
                  </Button>
                )}
              </div>

              {/* Progress bar for active (non-terminal) apps */}
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
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                              isComplete
                                ? "bg-gradient-to-br from-primary-500 to-primary-600 border-primary-500 text-white shadow-sm"
                                : "border-surface-300 dark:border-surface-600 text-surface-400"
                            } ${isActive ? "ring-4 ring-primary-500/20" : ""}`}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </motion.div>
                          {idx < STATUS_STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-1 transition-colors ${
                              idx < currentIdx ? "bg-primary-500" : "bg-surface-200 dark:bg-surface-700"
                            }`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    {STATUS_STEPS.map((step) => (
                      <span key={step} className="text-xs text-surface-400 dark:text-surface-500 text-center flex-1 px-0.5 truncate">
                        {STATUS_LABEL[step] ?? step}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejected / Withdrawn state */}
              {app.status === "REJECTED" && (
                <div className="mt-4 flex items-center gap-1.5 text-red-500 dark:text-red-400 text-sm">
                  <XCircle className="w-4 h-4" /> Application was not selected
                </div>
              )}
              {app.status === "SELECTED" && (
                <div className="mt-4 flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Congratulations! You have been selected.
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
