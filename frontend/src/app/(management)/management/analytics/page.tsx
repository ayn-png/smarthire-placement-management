"use client";
import { useEffect, useState } from "react";
import { analyticsService } from "@/services/api";
import { AnalyticsDashboard } from "@/types";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";

const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6"];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsService.getDashboard().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  const statusData = data ? Object.entries(data.application_status_distribution).map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v })) : [];

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Analytics</h1>
            <p className="text-surface-500 dark:text-surface-400 text-sm">Deep dive into placement data</p>
          </div>
        </div>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StaggerItem>
          <Card title="Application Status Distribution">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-surface-400 dark:text-surface-500 text-sm">No data</div>
            )}
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card title="Branch vs Placement Rate">
            {data?.branch_wise && data.branch_wise.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.branch_wise} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis dataKey="branch" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} formatter={(v: number) => [`${v}`, ""]} />
                  <Bar dataKey="total_students" fill="#c7d2fe" name="Total Students" radius={[6,6,0,0]} />
                  <Bar dataKey="placed_students" fill="#6366f1" name="Placed" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-surface-400 dark:text-surface-500 text-sm">No data</div>
            )}
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {data?.company_wise && data.company_wise.length > 0 && (
        <FadeIn delay={0.2}>
          <Card title="Company-wise Hiring">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-premium">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Company</th>
                    <th className="text-right py-3 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Students Hired</th>
                    <th className="py-3 w-32"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {data.company_wise.sort((a, b) => b.total_hired - a.total_hired).map((c, idx) => (
                    <motion.tr
                      key={c.company_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.04 }}
                      className="hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors"
                    >
                      <td className="py-3 font-medium text-surface-800 dark:text-surface-200">{c.company_name}</td>
                      <td className="py-3 text-right text-primary-700 dark:text-primary-400 font-semibold">{c.total_hired}</td>
                      <td className="py-3 pl-4 w-32">
                        <div className="w-full bg-surface-100 dark:bg-surface-700 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (c.total_hired / (data.company_wise[0]?.total_hired || 1)) * 100)}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.05 }}
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
