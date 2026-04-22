"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Search, Users, CheckCircle, Trophy, Filter, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import api from "@/lib/axios";
import { extractErrorMsg, getStatusColor, formatDate } from "@/lib/utils";
import { Application } from "@/types";

// All statuses for filter display (backward compat with existing data)
const ALL_STATUSES = ["PENDING", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "SELECTED", "REJECTED"];
// Simplified statuses for the update action dropdowns
const DRIVE_APP_STATUSES = ["PENDING", "SHORTLISTED", "SELECTED", "REJECTED"];
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Applied",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  SELECTED: "Selected",
  REJECTED: "Rejected",
};
const BRANCHES = ["CSE", "IT", "AI", "ECE", "EEE", "ME", "CE", "CHE", "MCA", "MBA", "Other"];

export default function DriveApplicationsPage() {
  const params = useParams();
  const router = useRouter();
  const driveId = params.id as string;

  const [drive, setDrive] = useState<any>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("SHORTLISTED");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const driveRes = await api.get(`/placement-drives/${driveId}`);
      setDrive(driveRes.data);
      const jobId = driveRes.data?.job_id || driveRes.data?.job_ids?.[0];
      if (!jobId) {
        setApplications([]);
        setLoading(false);
        return;
      }
      const appsRes = await api.get("/applications/", {
        params: { job_id: jobId, limit: 500 },
      });
      setApplications(appsRes.data?.applications || []);
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to load applications"));
    } finally {
      setLoading(false);
    }
  }, [driveId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function updateStatus(appId: string, newStatus: string) {
    setUpdating(appId);
    try {
      await api.patch(`/applications/${appId}/status`, { status: newStatus });
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus as any } : a));
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to update status"));
    } finally {
      setUpdating(null);
    }
  }

  async function handleBulkUpdate() {
    if (selected.size === 0) return;
    setBulkUpdating(true);
    try {
      await api.patch("/applications/bulk-status", {
        application_ids: Array.from(selected),
        status: bulkStatus,
      });
      setApplications(prev => prev.map(a => selected.has(a.id) ? { ...a, status: bulkStatus as any } : a));
      setSelected(new Set());
    } catch (err) {
      setError(extractErrorMsg(err, "Bulk update failed"));
    } finally {
      setBulkUpdating(false);
    }
  }

  // Filter applications
  const filtered = applications.filter(a => {
    const matchSearch = !search ||
      a.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.student_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || a.status === filterStatus;
    const matchBranch = !filterBranch || a.student_branch === filterBranch;
    return matchSearch && matchStatus && matchBranch;
  });

  // Stats
  const stats = {
    total: applications.length,
    shortlisted: applications.filter(a => ["SHORTLISTED", "INTERVIEW_SCHEDULED"].includes(a.status)).length,
    selected: applications.filter(a => a.status === "SELECTED").length,
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/admin/placement-drives")}
          className="p-2 text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-white rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-glow-sm">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Applications</h1>
            <p className="text-surface-500 dark:text-surface-400 text-sm">{drive?.title || "Loading..."} · {applications.length} applicant{applications.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Applied", value: stats.total, icon: Users, color: "blue" },
          { label: "Shortlisted", value: stats.shortlisted, icon: CheckCircle, color: "amber" },
          { label: "Selected", value: stats.selected, icon: Trophy, color: "emerald" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                color === "blue" ? "bg-blue-100 dark:bg-blue-900/30" :
                color === "amber" ? "bg-amber-100 dark:bg-amber-900/30" :
                "bg-emerald-100 dark:bg-emerald-900/30"
              }`}>
                <Icon className={`w-5 h-5 ${
                  color === "blue" ? "text-blue-600 dark:text-blue-400" :
                  color === "amber" ? "text-amber-600 dark:text-amber-400" :
                  "text-emerald-600 dark:text-emerald-400"
                }`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-900 dark:text-white">{value}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
        </select>
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Branches</option>
          {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800/50">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">{selected.size} selected</span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="px-3 py-1.5 border border-primary-300 dark:border-primary-700 rounded-lg text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none"
          >
            {DRIVE_APP_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
          </select>
          <Button variant="primary" onClick={handleBulkUpdate} loading={bulkUpdating}>
            Update Status
          </Button>
          <Button variant="secondary" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Applications Table */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
            <p className="text-surface-500 dark:text-surface-400 font-medium">
              {applications.length === 0 ? "No applications yet" : "No results match your filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50">
                  <th className="text-left px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map(a => a.id)) : new Set())}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Branch</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">CGPA</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Applied</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(app.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          e.target.checked ? next.add(app.id) : next.delete(app.id);
                          setSelected(next);
                        }}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{app.student_name || "—"}</p>
                        <p className="text-xs text-surface-400 dark:text-surface-500">{app.student_email || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">{app.student_branch || "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-surface-900 dark:text-white">{app.student_cgpa?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-surface-500 dark:text-surface-400">{formatDate(app.applied_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(app.status)}`}>
                        {STATUS_LABELS[app.status] || app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {updating === app.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <select
                          value={app.status}
                          onChange={(e) => updateStatus(app.id, e.target.value)}
                          className="px-2 py-1.5 border border-surface-300 dark:border-surface-600 rounded-lg text-xs bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          {DRIVE_APP_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
