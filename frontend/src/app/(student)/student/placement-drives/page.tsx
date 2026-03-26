"use client";
import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays, Building2, MapPin, GraduationCap,
  Users, CheckCircle2, AlertTriangle, Clock, XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn } from "@/components/ui/Animations";
import { placementDriveService, applicationService, studentService } from "@/services/api";
import { PlacementDrive, StudentProfile, Application } from "@/types";
import { extractErrorMsg } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  ONGOING:  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  COMPLETED:"bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400",
  CANCELLED:"bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

export default function StudentDrivesPage() {
  const [drives, setDrives]           = useState<PlacementDrive[]>([]);
  const [profile, setProfile]         = useState<StudentProfile | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [applying, setApplying]       = useState<string | null>(null);
  const [error, setError]             = useState("");
  const [successId, setSuccessId]     = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [drivesRes, appsRes] = await Promise.all([
        placementDriveService.list({}),
        applicationService.getMyApplications(),
      ]);
      setDrives(drivesRes.drives.filter((d: PlacementDrive) => d.status !== "CANCELLED"));
      const ids = new Set<string>(
        (appsRes.applications || []).map((a: Application) => a.job_id).filter(Boolean) as string[]
      );
      setAppliedJobIds(ids);

      // Load profile separately (non-fatal)
      try {
        const p = await studentService.getMyProfile();
        setProfile(p);
      } catch { /* profile not yet created */ }
    } catch {
      setError("Failed to load drives. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function isEligible(drive: PlacementDrive): { ok: boolean; reason?: string } {
    if (!profile) return { ok: true }; // If profile not loaded, allow attempting
    if (drive.min_cgpa > 0 && profile.cgpa < drive.min_cgpa)
      return { ok: false, reason: `Min CGPA ${drive.min_cgpa} required (yours: ${profile.cgpa})` };
    if (drive.eligible_branches.length > 0 && !drive.eligible_branches.includes(profile.branch))
      return { ok: false, reason: `Your branch (${profile.branch}) is not eligible` };
    return { ok: true };
  }

  async function handleApply(drive: PlacementDrive) {
    const jobId = drive.job_id || drive.job_ids?.[0];
    if (!jobId) { setError("No job linked to this drive. Please contact the administrator."); return; }
    setApplying(drive.id);
    setError("");
    try {
      await applicationService.apply({ job_id: jobId });
      setAppliedJobIds((prev) => new Set(Array.from(prev).concat(jobId)));
      setSuccessId(drive.id);
      setTimeout(() => setSuccessId(null), 3000);
    } catch (err) {
      setError(extractErrorMsg(err, "Failed to apply. Please try again."));
    } finally {
      setApplying(null);
    }
  }

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow-sm">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Placement Drives</h1>
            <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">
              Browse and apply to campus recruitment drives
            </p>
          </div>
        </div>
      </FadeIn>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {drives.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
            <p className="text-surface-500 dark:text-surface-400 font-medium">No upcoming placement drives</p>
            <p className="text-surface-400 dark:text-surface-500 text-sm mt-1">Check back later for new drives</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drives.map((drive) => {
            const jobId = drive.job_id || drive.job_ids?.[0];
            const isApplied = jobId ? appliedJobIds.has(jobId) : false;
            const eligibility = isEligible(drive);
            const isClosed = drive.status === "COMPLETED";
            const isJustApplied = successId === drive.id;

            return (
              <FadeIn key={drive.id}>
                <motion.div
                  whileHover={{ y: -2 }}
                  className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[drive.status] || STATUS_COLORS.UPCOMING}`}>
                      {drive.status}
                    </span>
                    {drive.drive_type && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400">
                        {drive.drive_type.replace("_", "-")}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-surface-900 dark:text-white mb-1 text-base">{drive.title}</h3>
                  {drive.description && (
                    <p className="text-xs text-surface-500 dark:text-surface-400 mb-3 line-clamp-2">{drive.description}</p>
                  )}

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-surface-500 dark:text-surface-400 mb-4 flex-1">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                      <span className="font-medium">
                        {drive.drive_date}
                        {drive.drive_time ? ` at ${drive.drive_time}` : ""}
                      </span>
                    </div>
                    {drive.company_name && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{drive.company_name}</span>
                      </div>
                    )}
                    {drive.venue && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{drive.venue}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        Min CGPA: {drive.min_cgpa}
                        {drive.eligible_branches.length > 0
                          ? ` · ${drive.eligible_branches.join(", ")}`
                          : " · All branches"}
                      </span>
                    </div>
                    {(drive.openings ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{drive.openings} opening{drive.openings !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>

                  {/* Rounds pills */}
                  {drive.rounds && drive.rounds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {drive.rounds.map((round, idx) => (
                        <span key={idx}
                          className="text-xs px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full border border-violet-200 dark:border-violet-800">
                          {idx + 1}. {round}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Ineligibility notice */}
                  {!eligibility.ok && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {eligibility.reason}
                    </div>
                  )}

                  {/* Apply button */}
                  {isApplied || isJustApplied ? (
                    <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Applied
                    </div>
                  ) : isClosed ? (
                    <div className="flex items-center gap-1.5 text-sm text-surface-400 dark:text-surface-500">
                      <XCircle className="w-4 h-4" />
                      Drive Closed
                    </div>
                  ) : !eligibility.ok ? (
                    <Button variant="secondary" disabled className="w-full text-sm opacity-60">
                      Not Eligible
                    </Button>
                  ) : !jobId ? (
                    <div className="flex items-center gap-1.5 text-sm text-surface-400 dark:text-surface-500">
                      <Clock className="w-4 h-4" />
                      Not yet open
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      className="w-full text-sm"
                      loading={applying === drive.id}
                      onClick={() => handleApply(drive)}
                    >
                      Apply Now
                    </Button>
                  )}
                </motion.div>
              </FadeIn>
            );
          })}
        </div>
      )}
    </div>
  );
}
