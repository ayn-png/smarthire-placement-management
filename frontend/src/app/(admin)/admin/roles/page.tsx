"use client";
import { useEffect, useState, useCallback } from "react";
import { Shield, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn } from "@/components/ui/Animations";
import api from "@/lib/axios";
import { extractErrorMsg, formatDate } from "@/lib/utils";

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  approval_status?: string;
  created_at?: string;
}

const ROLE_COLOR: Record<string, string> = {
  STUDENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PLACEMENT_ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  COLLEGE_MANAGEMENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default function AdminRolesPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("");
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/v1/auth/admin/users", {
        params: { role: filterRole || undefined, page: 1, limit: 200 },
      });
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, [filterRole]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(userId: string, currentActive: boolean) {
    setTogglingId(userId);
    try {
      await api.patch(`/api/v1/auth/admin/users/${userId}/activate`, null, {
        params: { is_active: !currentActive },
      });
      await load();
    } catch (err) {
      alert(extractErrorMsg(err, "Failed to update status"));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Roles & Permissions</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm">{total} users registered</p>
            </div>
          </div>
          <Button onClick={load} variant="secondary"><RefreshCw className="w-4 h-4" /> Refresh</Button>
        </div>
      </FadeIn>

      <div className="flex gap-2 flex-wrap">
        {["", "STUDENT", "PLACEMENT_ADMIN", "COLLEGE_MANAGEMENT"].map((r) => (
          <button key={r || "ALL"} onClick={() => setFilterRole(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterRole === r ? "bg-primary-600 text-white" : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"}`}>
            {r || "All Roles"}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {loading ? (
        <LoadingSpinner className="h-64" size="lg" />
      ) : (
        <FadeIn delay={0.1}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-sm divide-y divide-surface-100 dark:divide-surface-700">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-50 dark:hover:bg-surface-750 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-surface-900 dark:text-white">{u.full_name}</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">{u.email}</p>
                  {u.created_at && <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">Joined {formatDate(u.created_at)}</p>}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLOR[u.role] ?? "bg-surface-100 text-surface-600"}`}>
                  {u.role}
                </span>
                {u.approval_status && u.approval_status !== "APPROVED" && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {u.approval_status}
                  </span>
                )}
                <span className={`text-xs font-medium ${u.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                  {u.is_active ? "Active" : "Inactive"}
                </span>
                <button onClick={() => toggleActive(u.id, u.is_active)} disabled={togglingId === u.id}
                  className="p-1 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors disabled:opacity-50" title={u.is_active ? "Deactivate" : "Activate"}>
                  {u.is_active
                    ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                    : <ToggleLeft className="w-5 h-5 text-surface-400" />}
                </button>
              </div>
            ))}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
