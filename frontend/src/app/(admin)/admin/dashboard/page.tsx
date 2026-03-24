"use client";
import { useEffect, useState } from "react";
import { Building2, Briefcase, Users, TrendingUp, Sparkles, AlertTriangle, X } from "lucide-react";
import { motion } from "framer-motion";
import StatsCard from "@/components/shared/StatsCard";
import Card from "@/components/ui/Card";
import { analyticsService, marketJobsService } from "@/services/api";
import { AnalyticsDashboard } from "@/types";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

interface SystemStatus {
  smtp: { configured: boolean; host: string | null };
  openai: { configured: boolean };
  mistral: { configured: boolean };
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [marketStats, setMarketStats] = useState<Array<{ department: string; click_count: number }>>([]);

  useEffect(() => {
    analyticsService.getDashboard()
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setLoading(false));
    analyticsService.getSystemStatus()
      .then(setSystemStatus)
      .catch(() => {});
    // Market Job Interest stats — non-critical, silently skip if no data yet
    marketJobsService.getStats()
      .then((d) => setMarketStats(d.stats))
      .catch(() => {});
  }, []);

  const warnings: { key: string; message: string }[] = [];
  if (systemStatus) {
    if (!systemStatus.smtp.configured)
      warnings.push({ key: "smtp", message: "SMTP is not configured — email notifications are disabled. Set SMTP_HOST and SMTP_USER in your .env file." });
    if (!systemStatus.openai.configured)
      warnings.push({ key: "openai", message: "OPENAI_API_KEY is not set — the AI resume analyzer (OpenAI path) will be unavailable." });
    if (!systemStatus.mistral.configured)
      warnings.push({ key: "mistral", message: "MISTRAL_API_KEY is not set — mock interview chat and AI features powered by Mistral will be unavailable." });
  }
  const activeWarnings = warnings.filter((w) => !dismissedWarnings.has(w.key));

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  const stats = analytics?.statistics;
  const statusData = analytics ? Object.entries(analytics.application_status_distribution).map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v })) : [];

  return (
    <div className="space-y-8">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Placement Dashboard</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">Overview of placement activities</p>
          </div>
        </div>
      </FadeIn>

      {/* NW#4 — System health warnings */}
      {activeWarnings.length > 0 && (
        <FadeIn delay={0.05}>
          <div className="space-y-2">
            {activeWarnings.map((w) => (
              <div key={w.key} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                <span className="flex-1">{w.message}</span>
                <button onClick={() => setDismissedWarnings((prev) => { const next = new Set(prev); next.add(w.key); return next; })} className="flex-shrink-0 text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StaggerItem><StatsCard title="Total Students" value={stats?.total_students || 0} icon={Users} color="blue" /></StaggerItem>
        <StaggerItem><StatsCard title="Students Placed" value={stats?.total_placed || 0} icon={TrendingUp} color="green" /></StaggerItem>
        <StaggerItem><StatsCard title="Companies" value={stats?.total_companies || 0} icon={Building2} color="purple" /></StaggerItem>
        <StaggerItem><StatsCard title="Active Jobs" value={stats?.total_jobs || 0} icon={Briefcase} color="orange" /></StaggerItem>
      </StaggerContainer>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StaggerItem>
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            className="bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-2xl p-6 text-white shadow-glow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <p className="text-primary-100 text-sm font-medium">Placement Rate</p>
            <p className="text-4xl font-bold mt-1 tracking-tight">{stats?.placement_percentage || 0}%</p>
            <p className="text-primary-200 text-xs mt-2">{stats?.total_placed} of {stats?.total_students} students placed</p>
          </motion.div>
        </StaggerItem>
        <StaggerItem>
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <p className="text-green-100 text-sm font-medium">Highest Package</p>
            <p className="text-4xl font-bold mt-1 tracking-tight">{stats?.highest_package ? `₹${stats.highest_package}L` : "—"}</p>
            <p className="text-green-200 text-xs mt-2">Best offer this cycle</p>
          </motion.div>
        </StaggerItem>
        <StaggerItem>
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            className="bg-gradient-to-br from-violet-500 via-purple-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <p className="text-purple-100 text-sm font-medium">Total Applications</p>
            <p className="text-4xl font-bold mt-1 tracking-tight">{stats?.total_applications || 0}</p>
            <p className="text-purple-200 text-xs mt-2">Across all jobs</p>
          </motion.div>
        </StaggerItem>
      </StaggerContainer>

      <FadeIn delay={0.3}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Branch wise chart */}
          <Card title="Branch-wise Placement" subtitle="Placement percentage by branch">
            {analytics?.branch_wise && analytics.branch_wise.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.branch_wise} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-700" />
                  <XAxis dataKey="branch" tick={{ fontSize: 11 }} className="fill-surface-600 dark:fill-surface-400" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-surface-600 dark:fill-surface-400" />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, "Placement Rate"]}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,.12)" }}
                  />
                  <Bar dataKey="placement_percentage" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-surface-400 dark:text-surface-500 text-sm">No data available</div>
            )}
          </Card>

          {/* Application status pie */}
          <Card title="Application Status" subtitle="Distribution of all applications">
            {statusData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {statusData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,.12)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2.5">
                  {statusData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-surface-800 shadow-sm" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      <span className="text-surface-600 dark:text-surface-400 truncate capitalize">{item.name}</span>
                      <span className="ml-auto font-semibold text-surface-800 dark:text-surface-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-surface-400 dark:text-surface-500 text-sm">No application data</div>
            )}
          </Card>
        </div>
      </FadeIn>

      {/* Company-wise hiring */}
      {analytics?.company_wise && analytics.company_wise.length > 0 && (
        <FadeIn delay={0.4}>
          <Card title="Top Hiring Companies">
            <div className="space-y-4">
              {analytics.company_wise.sort((a, b) => b.total_hired - a.total_hired).slice(0, 5).map((c, idx) => (
                <motion.div
                  key={c.company_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="flex items-center gap-4 group"
                >
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-surface-800 dark:text-surface-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{c.company_name}</span>
                  <span className="text-sm text-surface-500 dark:text-surface-400 font-medium">{c.total_hired} hired</span>
                  <div className="w-28 bg-surface-100 dark:bg-surface-700 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (c.total_hired / (analytics.company_wise[0]?.total_hired || 1)) * 100)}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.1 }}
                      className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </FadeIn>
      )}

      {/* Market Job Interest — hidden until at least one click is recorded */}
      {marketStats.length > 0 && (
        <FadeIn delay={0.5}>
          <Card
            title="Market Job Interest"
            subtitle="Student click-throughs to external jobs by department"
          >
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={marketStats}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-surface-200 dark:stroke-surface-700"
                />
                <XAxis
                  dataKey="department"
                  tick={{ fontSize: 11 }}
                  className="fill-surface-600 dark:fill-surface-400"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="fill-surface-600 dark:fill-surface-400"
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(v: number) => [v, "Clicks"]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 40px rgba(0,0,0,.12)",
                  }}
                />
                <Bar dataKey="click_count" fill="#14b8a6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
