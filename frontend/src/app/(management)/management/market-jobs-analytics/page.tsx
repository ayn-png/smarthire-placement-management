"use client";
import { useEffect, useState } from "react";
import { 
  Users, 
  Handshake, 
  TrendingUp, 
  BarChart3, 
  PieChart as PieChartIcon, 
  ArrowUpRight 
} from "lucide-react";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { marketJobsService } from "@/services/api";
import { FadeIn } from "@/components/ui/Animations";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function ManagementMarketJobsAnalytics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await marketJobsService.getManagementAnalytics();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner className="h-screen" />;
  if (!stats) return <div className="p-8 text-center text-red-500">Failed to load analytics.</div>;

  const branchData = Object.entries(stats.branch_distribution || {}).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-glow-sm">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Market Job Analytics</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">Strategic insights into external hiring trends</p>
          </div>
        </div>
      </FadeIn>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Handshake className="w-12 h-12" />
          </div>
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400">Total Applications</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h2 className="text-3xl font-bold text-surface-900 dark:text-white">{stats.total_applications}</h2>
            <span className="text-sm font-medium text-emerald-500 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> Growth
            </span>
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Users className="w-12 h-12" />
          </div>
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400">Unique Students</p>
          <h2 className="text-3xl font-bold text-surface-900 dark:text-white mt-1">{stats.unique_students}</h2>
        </Card>

        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-12 h-12" />
          </div>
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400">Avg. Student CGPA</p>
          <h2 className="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-1">{stats.avg_cgpa.toFixed(2)}</h2>
        </Card>

        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <BarChart3 className="w-12 h-12" />
          </div>
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400">Branch Participation</p>
          <h2 className="text-3xl font-bold text-surface-900 dark:text-white mt-1">{branchData.length}</h2>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch Distribution Bar Chart */}
        <Card className="p-6 border-none shadow-glow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-surface-900 dark:text-white">Applications by Branch</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "12px", color: "#fff" }}
                  itemStyle={{ color: "#818cf8" }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {branchData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Proportional Distribution Pie Chart */}
        <Card className="p-6 border-none shadow-glow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-surface-900 dark:text-white">Proportional Distribution</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={branchData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {branchData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "12px", color: "#fff" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 justify-center mt-4">
            {branchData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-xs text-surface-500 dark:text-surface-400 font-medium">{entry.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
