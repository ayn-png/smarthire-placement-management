"use client";
import { useEffect, useState } from "react";
import { Search, Filter, Download, User, Calendar, Briefcase, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { marketJobsService } from "@/services/api";
import { FadeIn } from "@/components/ui/Animations";
import { formatDate } from "@/lib/utils";

export default function AdminMarketJobsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [branch, setBranch] = useState("");
  const [minCgpa, setMinCgpa] = useState("");

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
    setLoading(true);
    try {
      const data = await marketJobsService.getAdminApplications({
        branch: branch || undefined,
        min_cgpa: minCgpa ? parseFloat(minCgpa) : undefined,
      });
      setApplications(data.applications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = applications.filter(app => 
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.job_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-glow-sm">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Market Job Applications</h1>
              <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">Track external application signals from students</p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-surface-400" />
            <Input 
              placeholder="Search name, email, job ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full h-10 px-3 border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">All Branches</option>
            <option value="CSE">CSE</option>
            <option value="IT">IT</option>
            <option value="AI">AI</option>
            <option value="ECE">ECE</option>
            <option value="ME">ME</option>
          </select>
          <Input 
            type="number" 
            placeholder="Min CGPA" 
            value={minCgpa}
            onChange={(e) => setMinCgpa(e.target.value)}
          />
          <Button onClick={loadApplications} variant="secondary">
            <Filter className="w-4 h-4 mr-2" />
            Apply Filters
          </Button>
        </div>
      </Card>

      {loading ? (
        <LoadingSpinner className="h-64" />
      ) : (
        <Card className="overflow-hidden border-none shadow-glow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-100 dark:border-surface-700">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-500">Student</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-500">Branch</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-500">CGPA</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-500">Job ID (Slug)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-500">Applied At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {filtered.map((app, idx) => (
                  <motion.tr 
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center text-surface-600 dark:text-surface-300 font-bold shrink-0">
                          {app.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-surface-900 dark:text-white truncate">{app.name}</p>
                          <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{app.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{app.branch}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{app.cgpa.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs bg-surface-100 dark:bg-surface-800 px-2 py-1 rounded text-surface-600 dark:text-surface-400 font-mono">
                        {app.job_id}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(app.applied_at)}
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-surface-500">
                      No applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
