"use client";
import { useEffect, useState } from "react";
import { Briefcase, ClipboardList, CheckCircle, Clock, User, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import StatsCard from "@/components/shared/StatsCard";
import Card from "@/components/ui/Card";
import { studentService, jobService, applicationService } from "@/services/api";
import { StudentProfile, Application, Job } from "@/types";
import { formatDate, getStatusColor } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { getUserName } from "@/lib/auth";
import { FadeIn } from "@/components/ui/Animations";

export default function StudentDashboard() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const name = getUserName();

  useEffect(() => {
    async function load() {
      try {
        const [profileData, appsData, jobsData] = await Promise.allSettled([
          studentService.getMyProfile(),
          applicationService.getMyApplications(),
          jobService.list({ limit: 5 }),
        ]);
        if (profileData.status === "fulfilled") setProfile(profileData.value);
        if (appsData.status === "fulfilled") setApplications(appsData.value.applications || []);
        if (jobsData.status === "fulfilled") setRecentJobs(jobsData.value.jobs || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  const activeApps = applications.filter((a) =>
    ["PENDING", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED"].includes(a.status)
  ).length;
  const selectedApps = applications.filter((a) => a.status === "SELECTED").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <FadeIn>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-500 via-primary-600 to-violet-600 p-6 md:p-8 text-white shadow-glow-md">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary-200" />
              <span className="text-primary-200 text-sm font-medium">Student Dashboard</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Welcome back, {name?.split(" ")[0]}! 👋</h1>
            <p className="text-primary-100 mt-1">Here&apos;s your placement activity overview</p>
          </div>
        </div>
      </FadeIn>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Applications" value={applications.length} icon={ClipboardList} color="blue" />
        <StatsCard title="Active Applications" value={activeApps} icon={Clock} color="orange" />
        <StatsCard title="Offers Received" value={selectedApps} icon={CheckCircle} color="green" />
        <StatsCard title="Available Jobs" value={recentJobs.length} icon={Briefcase} color="purple" />
      </div>

      {/* Profile incomplete warning */}
      {!profile && (
        <FadeIn delay={0.2}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5 flex items-center gap-4"
          >
            <div className="w-11 h-11 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Complete your profile</p>
              <p className="text-xs text-amber-600 dark:text-amber-400/70 mt-0.5">Set up your profile to start applying for jobs</p>
            </div>
            <Link href="/student/profile" className="flex items-center gap-1 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors group">
              Set up <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </FadeIn>
      )}

      <FadeIn delay={0.25}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Applications */}
          <Card title="Recent Applications" subtitle="Your latest job applications">
            {applications.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                  <ClipboardList className="w-7 h-7 text-surface-400 dark:text-surface-500" />
                </div>
                <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">No applications yet</p>
                <Link href="/student/jobs" className="text-primary-600 dark:text-primary-400 text-sm hover:underline mt-2 inline-flex items-center gap-1 font-medium">
                  Browse jobs <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {applications.slice(0, 5).map((app) => (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-between py-3 px-3 -mx-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{app.job_title}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">{app.company_name} &middot; {formatDate(app.applied_at)}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(app.status)}`}>
                      {app.status.replace("_", " ")}
                    </span>
                  </motion.div>
                ))}
                <Link href="/student/applications" className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 pt-2 font-medium">
                  View all applications <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </Card>

          {/* Recent Jobs */}
          <Card title="Latest Job Openings" subtitle="Newly posted opportunities">
            {recentJobs.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                  <Briefcase className="w-7 h-7 text-surface-400 dark:text-surface-500" />
                </div>
                <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">No jobs available</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-between py-3 px-3 -mx-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{job.title}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">{job.company_name} &middot; {job.location}</p>
                    </div>
                    {/* FIX 12 — include jobId so the jobs page can auto-open this listing */}
                    <Link
                      href={`/student/jobs?jobId=${job.id}`}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-semibold px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                    >
                      Apply
                    </Link>
                  </motion.div>
                ))}
                <Link href="/student/jobs" className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 pt-2 font-medium">
                  View all jobs <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </Card>
        </div>
      </FadeIn>

      {/* Quick Actions */}
      <FadeIn delay={0.35}>
        <Card title="Quick Actions">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { href: "/student/jobs", label: "Browse Jobs", icon: Briefcase, gradient: "from-blue-500 to-blue-600" },
              { href: "/student/profile", label: "Update Profile", icon: User, gradient: "from-emerald-500 to-green-600" },
              { href: "/student/resume", label: "Upload Resume", icon: ClipboardList, gradient: "from-violet-500 to-purple-600" },
              { href: "/student/interview", label: "Practice Interview", icon: CheckCircle, gradient: "from-orange-500 to-amber-600" },
            ].map(({ href, label, icon: Icon, gradient }) => (
              <Link key={href} href={href}>
                <motion.div
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:shadow-lg dark:hover:shadow-surface-900/50 transition-shadow cursor-pointer group"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 text-center">{label}</span>
                </motion.div>
              </Link>
            ))}
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
