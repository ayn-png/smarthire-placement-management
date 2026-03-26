"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Building2, MapPin, GraduationCap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn } from "@/components/ui/Animations";
import Link from "next/link";
import { placementDriveService } from "@/services/api";
import { PlacementDrive } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  ONGOING: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  COMPLETED: "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

export default function StudentPlacementDrivesPage() {
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    placementDriveService
      .list({ status: undefined })
      .then((res) => setDrives(res.drives.filter((d) => d.status !== "CANCELLED")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
            <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">Campus recruitment events and batch drives</p>
          </div>
        </div>
      </FadeIn>

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
          {drives.map((drive) => (
            <FadeIn key={drive.id}>
              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[drive.status] || STATUS_COLORS.UPCOMING}`}>
                    {drive.status}
                  </span>
                </div>
                <h3 className="font-semibold text-surface-900 dark:text-white mb-1">{drive.title}</h3>
                {drive.description && (
                  <p className="text-xs text-surface-500 dark:text-surface-400 mb-3 line-clamp-2">{drive.description}</p>
                )}
                <div className="space-y-1.5 text-xs text-surface-500 dark:text-surface-400 mb-4">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-primary-500" />
                    <span className="font-medium">{drive.drive_date}</span>
                  </div>
                  {drive.company_name && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{drive.company_name}</span>
                    </div>
                  )}
                  {drive.venue && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{drive.venue}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Min CGPA: {drive.min_cgpa} &middot; {drive.eligible_branches.length > 0 ? drive.eligible_branches.join(", ") : "All branches"}</span>
                  </div>
                </div>
                {drive.job_ids.length > 0 && (
                  <Link
                    href="/student/jobs"
                    className="inline-flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    View {drive.job_ids.length} associated job{drive.job_ids.length !== 1 ? "s" : ""}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
