"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap, LogOut, CheckCircle2, XCircle, Clock,
  Users, RefreshCw, ChevronDown,
} from "lucide-react";

interface AdminRequest {
  id: string;
  userId: string;
  email: string;
  full_name: string;
  requestedRole: string;
  status: string;
  createdAt: string | { _seconds: number } | null;
  approvedBy?: string | null;
  rejectionReason?: string | null;
}

const TABS = ["pending", "approved", "rejected"] as const;
type Tab = (typeof TABS)[number];

const ROLE_LABELS: Record<string, string> = {
  PLACEMENT_ADMIN: "Placement Admin",
  COLLEGE_MANAGEMENT: "College Management",
};

function formatDate(val: string | { _seconds: number } | null | undefined): string {
  if (!val) return "—";
  if (typeof val === "object" && "_seconds" in val) {
    return new Date(val._seconds * 1000).toLocaleString();
  }
  try {
    return new Date(val as string).toLocaleString();
  } catch {
    return String(val);
  }
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadRequests(statusTab = tab) {
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/requests?status=${statusTab}`);
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch {
      showToast("Failed to load requests", false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleApprove(req: AdminRequest) {
    setActionLoading(req.id);
    try {
      const res = await fetch(`/api/super-admin/${req.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedRole: req.requestedRole }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast(`${req.full_name} approved successfully!`);
      loadRequests(tab);
    } catch {
      showToast("Failed to approve request", false);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(req: AdminRequest) {
    if (!rejectReason.trim()) {
      showToast("Please enter a rejection reason", false);
      return;
    }
    setActionLoading(req.id);
    try {
      const res = await fetch(`/api/super-admin/${req.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast(`${req.full_name} rejected.`);
      setRejectingId(null);
      setRejectReason("");
      loadRequests(tab);
    } catch {
      showToast("Failed to reject request", false);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/super-admin/logout", { method: "POST" });
    router.push("/login");
  }

  const tabCounts = {
    pending: tab === "pending" ? requests.length : "—",
    approved: tab === "approved" ? requests.length : "—",
    rejected: tab === "rejected" ? requests.length : "—",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all
            ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
        >
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base">SmartHire</h1>
            <p className="text-slate-400 text-xs">Super Admin Dashboard</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors px-3 py-2 rounded-lg hover:bg-slate-800"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Admin Requests</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Approve or reject placement admin and college management registrations
            </p>
          </div>
          <button
            onClick={() => loadRequests(tab)}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                tab === t
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t}
              {tab === t && requests.length > 0 && (
                <span className="ml-2 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                  {requests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="ml-3 text-slate-400">Loading...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No {tab} requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{req.full_name}</h3>
                      <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-800">
                        {ROLE_LABELS[req.requestedRole] ?? req.requestedRole}
                      </span>
                      {req.status === "pending" && (
                        <span className="text-xs bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                      {req.status === "approved" && (
                        <span className="text-xs bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      )}
                      {req.status === "rejected" && (
                        <span className="text-xs bg-red-900/40 text-red-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm mt-1">{req.email}</p>
                    <p className="text-slate-600 text-xs mt-1">
                      Requested: {formatDate(req.createdAt)}
                    </p>
                    {req.rejectionReason && (
                      <p className="text-red-400 text-xs mt-1">
                        Reason: {req.rejectionReason}
                      </p>
                    )}
                  </div>

                  {/* Actions — only for pending */}
                  {req.status === "pending" && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        disabled={actionLoading === req.id}
                        onClick={() => handleApprove(req)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-xl font-medium transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {actionLoading === req.id ? "..." : "Approve"}
                      </button>
                      <button
                        disabled={actionLoading === req.id}
                        onClick={() =>
                          setRejectingId(rejectingId === req.id ? null : req.id)
                        }
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-900/40 hover:bg-red-900/70 border border-red-800 text-red-300 text-sm rounded-xl font-medium transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${rejectingId === req.id ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                  )}
                </div>

                {/* Reject reason input */}
                {rejectingId === req.id && (
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                      onKeyDown={(e) => e.key === "Enter" && handleReject(req)}
                    />
                    <button
                      onClick={() => handleReject(req)}
                      disabled={actionLoading === req.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-xl font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason(""); }}
                      className="px-3 py-2 text-slate-400 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
