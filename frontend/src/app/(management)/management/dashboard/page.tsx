"use client";
import { useEffect, useState } from "react";
import { Users, TrendingUp, Building2, Briefcase, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import StatsCard from "@/components/shared/StatsCard";
import Card from "@/components/ui/Card";
import { analyticsService } from "@/services/api";
import { AnalyticsDashboard } from "@/types";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ManagementDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsService.getDashboard().then(setAnalytics).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  const stats = analytics?.statistics;
  const monthlyData = analytics?.monthly_applications.map((m) => ({
    month: MONTHS[m.month - 1],
    applications: m.count,
  })) || [];

  return (
    <div className="space-y-8">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow-sm">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">College Management Overview</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">Comprehensive placement analytics and insights</p>
          </div>
        </div>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StaggerItem><StatsCard title="Total Students" value={stats?.total_students || 0} icon={Users} color="blue" /></StaggerItem>
        <StaggerItem><StatsCard title="Students Placed" value={stats?.total_placed || 0} icon={TrendingUp} color="green" /></StaggerItem>
        <StaggerItem><StatsCard title="Partner Companies" value={stats?.total_companies || 0} icon={Building2} color="purple" /></StaggerItem>
        <StaggerItem><StatsCard title="Total Jobs Posted" value={stats?.total_jobs || 0} icon={Briefcase} color="orange" /></StaggerItem>
      </StaggerContainer>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Placement Rate", value: `${stats?.placement_percentage || 0}%`, gradient: "from-primary-500 via-primary-600 to-indigo-700", desc: "Overall campus placement" },
          { label: "Avg Package", value: stats?.avg_package ? `₹${stats.avg_package.toFixed(1)}L` : "—", gradient: "from-emerald-500 via-emerald-600 to-green-700", desc: "Average CTC offered" },
          { label: "Highest Package", value: stats?.highest_package ? `₹${stats.highest_package}L` : "—", gradient: "from-violet-500 via-purple-600 to-purple-700", desc: "Best offer this year" },
        ].map(({ label, value, gradient, desc }) => (
          <StaggerItem key={label}>
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white shadow-lg relative overflow-hidden`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <p className="text-sm font-medium text-white/80">{label}</p>
              <p className="text-4xl font-bold mt-2 tracking-tight">{value}</p>
              <p className="text-sm text-white/60 mt-1">{desc}</p>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <FadeIn delay={0.3}>
        <Card title="Monthly Application Trends" subtitle="Number of applications per month">
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200 dark:stroke-surface-700" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-surface-600 dark:fill-surface-400" />
                <YAxis tick={{ fontSize: 12 }} className="fill-surface-600 dark:fill-surface-400" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,.12)" }} />
                <Line type="monotone" dataKey="applications" stroke="url(#lineGradient)" strokeWidth={3} dot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7, fill: "#6366f1" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-surface-400 dark:text-surface-500 text-sm">No data available</div>
          )}
        </Card>
      </FadeIn>

      {analytics?.branch_wise && analytics.branch_wise.length > 0 && (
        <FadeIn delay={0.4}>
          <Card title="Branch-wise Placement Summary">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left py-3 text-surface-500 dark:text-surface-400 font-medium text-xs uppercase tracking-wider">Branch</th>
                    <th className="text-right py-3 text-surface-500 dark:text-surface-400 font-medium text-xs uppercase tracking-wider">Total</th>
                    <th className="text-right py-3 text-surface-500 dark:text-surface-400 font-medium text-xs uppercase tracking-wider">Placed</th>
                    <th className="text-right py-3 text-surface-500 dark:text-surface-400 font-medium text-xs uppercase tracking-wider">Rate</th>
                    <th className="py-3 w-32"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {analytics.branch_wise.map((b, idx) => (
                    <motion.tr
                      key={b.branch}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                    >
                      <td className="py-3.5 font-medium text-surface-800 dark:text-surface-200">{b.branch}</td>
                      <td className="py-3.5 text-right text-surface-600 dark:text-surface-400">{b.total_students}</td>
                      <td className="py-3.5 text-right text-emerald-600 dark:text-emerald-400 font-medium">{b.placed_students}</td>
                      <td className="py-3.5 text-right font-semibold text-primary-600 dark:text-primary-400">{b.placement_percentage}%</td>
                      <td className="py-3.5 pl-4">
                        <div className="w-28 bg-surface-100 dark:bg-surface-700 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${b.placement_percentage}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.08 }}
                            className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full"
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
