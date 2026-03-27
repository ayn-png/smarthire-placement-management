"use client";
import { useEffect, useState, useCallback } from "react";
import { Target, CheckCircle, XCircle, Clock, Calendar, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn } from "@/components/ui/Animations";
import api from "@/lib/axios";
import { extractErrorMsg, formatDate } from "@/lib/utils";

type RoundResult = "PENDING" | "PASS" | "FAIL";
type RoundType = "WRITTEN" | "TECHNICAL" | "HR" | "GROUP_DISCUSSION" | "APTITUDE";

interface Round {
  id: string;
  application_id: string;
  job_id: string;
  student_id: string;
  student_name?: string;
  job_title?: string;
  round_number: number;
  round_name: string;
  round_type: RoundType;
  scheduled_date: string;
  venue?: string;
  meeting_link?: string;
  result: RoundResult;
  admin_notes?: string;
}

const RESULT_COLOR: Record<RoundResult, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PASS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  FAIL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterJobId, setFilterJobId] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (filterJobId) params.job_id = filterJobId;
      const { data } = await api.get("/api/v1/rounds/", { params });
      setRounds(data.rounds ?? []);
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to load rounds"));
    } finally {
      setLoading(false);
    }
  }, [filterJobId]);

  useEffect(() => { load(); }, [load]);

  async function updateResult(roundId: string, result: RoundResult, notes: string) {
    setUpdatingId(roundId);
    try {
      await api.patch(`/api/v1/rounds/${roundId}/result`, { result, admin_notes: notes || null });
      await load();
    } catch (err) {
      alert(extractErrorMsg(err, "Failed to update result"));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-sm">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Interview Rounds</h1>
            <p className="text-surface-500 dark:text-surface-400 text-sm">{rounds.length} rounds scheduled</p>
          </div>
        </div>
      </FadeIn>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {loading ? (
        <LoadingSpinner className="h-64" size="lg" />
      ) : rounds.length === 0 ? (
        <FadeIn>
          <div className="text-center py-20 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700">
            <Target className="w-10 h-10 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
            <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">No rounds scheduled yet</p>
            <p className="text-surface-400 dark:text-surface-500 text-xs mt-1">Rounds are created from the Applications page</p>
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={0.1}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-700">
                  {["Round", "Type", "Student", "Scheduled", "Venue / Link", "Result", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 dark:border-surface-750 last:border-0 hover:bg-surface-50 dark:hover:bg-surface-750">
                    <td className="px-4 py-3">
                      <p className="font-medium text-surface-900 dark:text-white">{r.round_name}</p>
                      <p className="text-xs text-surface-400">Round {r.round_number}</p>
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{r.round_type.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{r.student_name ?? r.student_id}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-surface-600 dark:text-surface-400">
                        <Calendar className="w-3 h-3" /> {formatDate(r.scheduled_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.meeting_link ? (
                        <a href={r.meeting_link} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline text-xs">
                          <LinkIcon className="w-3 h-3" /> Join
                        </a>
                      ) : r.venue ? (
                        <span className="text-surface-600 dark:text-surface-400 text-xs">{r.venue}</span>
                      ) : <span className="text-surface-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_COLOR[r.result]}`}>
                        {r.result}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => updateResult(r.id, "PASS", "")} disabled={updatingId === r.id}
                          className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors disabled:opacity-50" title="Mark Pass">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => updateResult(r.id, "FAIL", "")} disabled={updatingId === r.id}
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50" title="Mark Fail">
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => updateResult(r.id, "PENDING", "")} disabled={updatingId === r.id}
                          className="p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors disabled:opacity-50" title="Reset to Pending">
                          <Clock className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
