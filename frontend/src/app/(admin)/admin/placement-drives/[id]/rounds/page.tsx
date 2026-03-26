"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Edit2, Trash2, GripVertical, Target, Loader2, ChevronUp, ChevronDown, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import api from "@/lib/axios";
import { extractErrorMsg } from "@/lib/utils";

const ROUND_TYPES = ["APTITUDE", "CODING", "TECHNICAL", "HR", "GROUP_DISCUSSION", "WRITTEN", "OTHER"];

interface DriveRound {
  id: string;
  drive_id: string;
  round_number: number;
  round_name: string;
  round_type: string;
  created_at: string;
  updated_at: string;
}

interface RoundStats {
  total: number;
  cleared: number;
  rejected: number;
  in_progress: number;
}

export default function DriveRoundsPage() {
  const params = useParams();
  const router = useRouter();
  const driveId = params.id as string;

  const [drive, setDrive] = useState<any>(null);
  const [rounds, setRounds] = useState<DriveRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRound, setEditingRound] = useState<DriveRound | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [roundStats, setRoundStats] = useState<Record<number, RoundStats>>({});
  const [form, setForm] = useState({ round_name: "", round_type: "APTITUDE" });

  const loadData = useCallback(async () => {
    try {
      const [driveRes, roundsRes] = await Promise.all([
        api.get(`/placement-drives/${driveId}`),
        api.get(`/placement-drives/${driveId}/rounds`),
      ]);
      setDrive(driveRes.data);
      setRounds(roundsRes.data || []);
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to load drive rounds"));
    } finally {
      setLoading(false);
    }
  }, [driveId]);

  // Load application stats for each round
  const loadStats = useCallback(async () => {
    if (!drive?.job_id && !drive?.job_ids?.[0]) return;
    const jobId = drive.job_id || drive.job_ids?.[0];
    try {
      const res = await api.get("/applications/", { params: { job_id: jobId, limit: 1000 } });
      const apps = res.data?.applications || [];

      const stats: Record<number, RoundStats> = {};
      rounds.forEach(r => {
        const n = r.round_number;
        stats[n] = { total: apps.length, cleared: 0, rejected: 0, in_progress: 0 };
      });

      // Count by status for a simple approximation
      // SHORTLISTED / INTERVIEW_SCHEDULED = in progress
      // SELECTED = cleared last round
      // REJECTED = rejected
      apps.forEach((app: any) => {
        rounds.forEach(r => {
          const n = r.round_number;
          if (!stats[n]) return;
          if (app.status === "REJECTED") stats[n].rejected++;
          else if (app.status === "SELECTED") stats[n].cleared++;
          else if (["SHORTLISTED", "INTERVIEW_SCHEDULED", "UNDER_REVIEW"].includes(app.status)) stats[n].in_progress++;
        });
      });
      setRoundStats(stats);
    } catch { /* non-fatal */ }
  }, [drive, rounds]);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll for stats every 15 seconds
  useEffect(() => {
    if (!drive) return;
    loadStats();
    const interval = setInterval(loadStats, 15000);
    return () => clearInterval(interval);
  }, [drive, rounds, loadStats]);

  async function handleAddRound() {
    if (!form.round_name.trim()) return;
    setSaving(true);
    try {
      const nextNumber = rounds.length > 0 ? Math.max(...rounds.map(r => r.round_number)) + 1 : 1;
      await api.post(`/placement-drives/${driveId}/rounds`, {
        round_number: nextNumber,
        round_name: form.round_name.trim(),
        round_type: form.round_type,
      });
      setForm({ round_name: "", round_type: "APTITUDE" });
      setShowAddModal(false);
      loadData();
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to add round"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateRound() {
    if (!editingRound || !form.round_name.trim()) return;
    setSaving(true);
    try {
      await api.put(`/placement-drives/${driveId}/rounds/${editingRound.id}`, {
        round_name: form.round_name.trim(),
        round_type: form.round_type,
      });
      setEditingRound(null);
      loadData();
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to update round"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRound(roundId: string) {
    try {
      await api.delete(`/placement-drives/${driveId}/rounds/${roundId}`);
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to delete round"));
    }
  }

  async function moveRound(roundId: string, direction: "up" | "down") {
    const round = rounds.find(r => r.id === roundId);
    if (!round) return;
    const newNumber = direction === "up" ? round.round_number - 1 : round.round_number + 1;
    if (newNumber < 1 || newNumber > rounds.length) return;
    try {
      // Swap with the round that currently has that number
      const swapRound = rounds.find(r => r.round_number === newNumber);
      if (swapRound) {
        await Promise.all([
          api.put(`/placement-drives/${driveId}/rounds/${round.id}`, { round_number: newNumber }),
          api.put(`/placement-drives/${driveId}/rounds/${swapRound.id}`, { round_number: round.round_number }),
        ]);
      } else {
        await api.put(`/placement-drives/${driveId}/rounds/${round.id}`, { round_number: newNumber });
      }
      loadData();
    } catch { /* non-fatal */ }
  }

  function openEdit(round: DriveRound) {
    setEditingRound(round);
    setForm({ round_name: round.round_name, round_type: round.round_type });
  }

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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow-sm">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Rounds Management</h1>
            <p className="text-surface-500 dark:text-surface-400 text-sm">{drive?.title || "Loading..."} · {rounds.length} round{rounds.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => { setForm({ round_name: "", round_type: "APTITUDE" }); setShowAddModal(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Round
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      {/* Rounds List */}
      {rounds.length === 0 ? (
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-12 text-center">
          <Target className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
          <p className="text-surface-500 dark:text-surface-400 font-medium">No rounds defined yet</p>
          <p className="text-surface-400 dark:text-surface-500 text-sm mt-1">Add the first round to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round, idx) => {
            const stats = roundStats[round.round_number];
            return (
              <motion.div
                key={round.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  {/* Round number badge */}
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 dark:text-primary-300 font-bold text-sm">{round.round_number}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-surface-900 dark:text-white">{round.round_name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400">
                        {round.round_type}
                      </span>
                    </div>

                    {/* Stats row */}
                    {stats && (
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs text-surface-500 dark:text-surface-400">
                          <Users className="w-3.5 h-3.5" />
                          <span>{stats.total} total</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{stats.cleared} cleared</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{stats.in_progress} in progress</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{stats.rejected} rejected</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => moveRound(round.id, "up")}
                      disabled={idx === 0}
                      className="p-1.5 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 disabled:opacity-30 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveRound(round.id, "down")}
                      disabled={idx === rounds.length - 1}
                      className="p-1.5 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 disabled:opacity-30 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(round)}
                      className="p-1.5 text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(round.id)}
                      className="p-1.5 text-surface-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Round Modal */}
      <AnimatePresence>
        {(showAddModal || editingRound) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowAddModal(false); setEditingRound(null); } }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                {editingRound ? "Edit Round" : "Add Round"}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Round Name *</label>
                  <input
                    value={form.round_name}
                    onChange={(e) => setForm({ ...form, round_name: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. Aptitude Test"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Round Type</label>
                  <select
                    value={form.round_type}
                    onChange={(e) => setForm({ ...form, round_type: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {ROUND_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <Button variant="secondary" fullWidth onClick={() => { setShowAddModal(false); setEditingRound(null); }}>Cancel</Button>
                <Button variant="primary" fullWidth loading={saving} onClick={editingRound ? handleUpdateRound : handleAddRound}>
                  {editingRound ? "Save Changes" : "Add Round"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Delete Round?</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">This round will be permanently deleted.</p>
              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button variant="primary" fullWidth onClick={() => handleDeleteRound(deleteConfirm)} className="bg-red-600 hover:bg-red-700">Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
