"use client";
import { useEffect, useState } from "react";
import { analyticsService } from "@/services/api";
import { AnalyticsDashboard } from "@/types";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";

const statColors = [
  { bg: "bg-primary-50 dark:bg-primary-950/30", text: "text-primary-700 dark:text-primary-400", ring: "ring-primary-100 dark:ring-primary-900/30" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-100 dark:ring-emerald-900/30" },
  { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", ring: "ring-orange-100 dark:ring-orange-900/30" },
  { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400", ring: "ring-purple-100 dark:ring-purple-900/30" },
  { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-400", ring: "ring-indigo-100 dark:ring-indigo-900/30" },
  { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-400", ring: "ring-pink-100 dark:ring-pink-900/30" },
  { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-700 dark:text-teal-400", ring: "ring-teal-100 dark:ring-teal-900/30" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", ring: "ring-amber-100 dark:ring-amber-900/30" },
  { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", ring: "ring-red-100 dark:ring-red-900/30" },
];

export default function StatisticsPage() {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsService.getDashboard().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;
  const s = data?.statistics;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Placement Statistics</h1>
            <p className="text-surface-500 dark:text-surface-400 text-sm">Comprehensive placement statistics for this year</p>
          </div>
        </div>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Total Registered Students", value: s?.total_students || 0 },
          { label: "Students Placed", value: s?.total_placed || 0 },
          { label: "Not Yet Placed", value: (s?.total_students || 0) - (s?.total_placed || 0) },
          { label: "Placement Percentage", value: `${s?.placement_percentage || 0}%` },
          { label: "Partner Companies", value: s?.total_companies || 0 },
          { label: "Job Openings Posted", value: s?.total_jobs || 0 },
          { label: "Total Applications", value: s?.total_applications || 0 },
          { label: "Average Package (LPA)", value: s?.avg_package ? `₹${s.avg_package.toFixed(2)}L` : "—" },
          { label: "Highest Package (LPA)", value: s?.highest_package ? `₹${s.highest_package}L` : "—" },
        ].map(({ label, value }, idx) => (
          <StaggerItem key={label}>
            <motion.div
              whileHover={{ y: -2, scale: 1.01 }}
              className={`rounded-2xl p-6 ${statColors[idx].bg} ring-1 ${statColors[idx].ring} transition-shadow hover:shadow-md`}
            >
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400">{label}</p>
              <p className={`text-3xl font-bold mt-2 ${statColors[idx].text}`}>{value}</p>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {data?.branch_wise && data.branch_wise.length > 0 && (
        <FadeIn delay={0.3}>
          <Card title="Branch-wise Statistics">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-premium">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    {["Branch", "Total Students", "Placed", "Unplaced", "Placement %"].map((h) => (
                      <th key={h} className="text-left py-3.5 px-4 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.branch_wise.map((b, idx) => (
                    <motion.tr
                      key={b.branch}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.04 }}
                      className="border-b border-surface-100 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-surface-900 dark:text-white">{b.branch}</td>
                      <td className="py-3 px-4 text-surface-600 dark:text-surface-400">{b.total_students}</td>
                      <td className="py-3 px-4 text-emerald-700 dark:text-emerald-400 font-medium">{b.placed_students}</td>
                      <td className="py-3 px-4 text-orange-600 dark:text-orange-400">{b.total_students - b.placed_students}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-surface-100 dark:bg-surface-700 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${b.placement_percentage}%` }}
                              transition={{ duration: 0.8, delay: idx * 0.05 }}
                              className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full"
                            />
                          </div>
                          <span className="text-primary-700 dark:text-primary-400 font-semibold text-xs">{b.placement_percentage}%</span>
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
