"use client";
import { useEffect, useState, useCallback } from "react";
import { UserCheck, UserX, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn } from "@/components/ui/Animations";
import api from "@/lib/axios";
import { extractErrorMsg, formatDate } from "@/lib/utils";

type ReqStatus = "PENDING" | "APPROVED" | "REJECTED";
interface AdminRequest {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  requested_at: string;
  status: ReqStatus;
  reviewed_at?: string;
  rejection_reason?: string;
}

const STATUS_CONFIG: Record<ReqStatus, { color: string; icon: React.ReactNode; label: string }> = {
  PENDING: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <Clock className="w-3 h-3" />, label: "Pending" },
  APPROVED: { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <CheckCircle className="w-3 h-3" />, label: "Approved" },
  REJECTED: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="w-3 h-3" />, label: "Rejected" },
};

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [actionTarget, setActionTarget] = useState<AdminRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actioning, setActioning] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/v1/auth/admin-requests", {
        params: { status_filter: filterStatus || undefined, page: 1, limit: 100 },
      });
      setRequests(data.requests ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to load requests"));
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(userId: string) {
    setActioning(true);
    try {
      await api.patch(`/api/v1/auth/admin-requests/${userId}/approve`);
      setSuccessMsg("Admin account approved successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
      await load();
    } catch (err) {
      alert(extractErrorMsg(err, "Failed to approve"));
    } finally {
      setActioning(false);
    }
  }

  async function handleReject() {
    if (!actionTarget) return;
    setActioning(true);
    try {
      await api.patch(`/api/v1/auth/admin-requests/${actionTarget.user_id}/reject`, {
        reason: rejectReason || null,
      });
      setActionTarget(null);
      setRejectReason("");
      setSuccessMsg("Request rejected.");
      setTimeout(() => setSuccessMsg(""), 4000);
      await load();
    } catch (err) {
      alert(extractErrorMsg(err, "Failed to reject"));
    } finally {
      setActioning(false);
    }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Admin Approval Requests</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm">{total} requests</p>
            </div>
          </div>
          <Button onClick={load} variant="secondary"><RefreshCw className="w-4 h-4" /> Refresh</Button>
        </div>
      </FadeIn>

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-emerald-700 dark:text-emerald-400 text-sm">
          {successMsg}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {["PENDING", "APPROVED", "REJECTED", ""].map((s) => (
          <button key={s || "ALL"} onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterStatus === s ? "bg-primary-600 text-white" : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {loading ? (
        <LoadingSpinner className="h-64" size="lg" />
      ) : requests.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700">
          <UserCheck className="w-10 h-10 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
          <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">No requests found</p>
        </div>
      ) : (
        <FadeIn delay={0.1}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-sm divide-y divide-surface-100 dark:divide-surface-700">
            {requests.map((req) => {
              const cfg = STATUS_CONFIG[req.status];
              return (
                <motion.div key={req.id} whileHover={{ x: 2 }}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-surface-900 dark:text-white">{req.full_name}</p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">{req.email}</p>
                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                      Requested: {formatDate(req.requested_at)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                  {req.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(req.user_id)} disabled={actioning}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => { setActionTarget(req); setRejectReason(""); }} disabled={actioning}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                        <UserX className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </FadeIn>
      )}

      {/* Reject dialog */}
      <AnimatePresence>
        {actionTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-1">Reject Request</h2>
              <p className="text-surface-500 dark:text-surface-400 text-sm mb-4">
                Rejecting <strong>{actionTarget.full_name}</strong> ({actionTarget.email})
              </p>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Reason (optional)</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
                placeholder="e.g. Not affiliated with this institution…"
                className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg text-sm bg-white dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-4" />
              <div className="flex gap-3">
                <Button onClick={handleReject} variant="primary" loading={actioning} className="flex-1 !bg-red-600 hover:!bg-red-700">
                  Confirm Reject
                </Button>
                <Button onClick={() => setActionTarget(null)} variant="secondary" disabled={actioning}>Cancel</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
