"use client";
import { useEffect, useState } from "react";
import { BarChart3, FileText, Sparkles, Download } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { analyticsService } from "@/services/api";
import { formatDate } from "@/lib/utils";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/Animations";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await analyticsService.listReports({ limit: 20 });
      setReports(data.reports || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Failed to load reports");
      setReports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function downloadCsv() {
    setExporting(true);
    try {
      const blob = await analyticsService.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "smarthire_analytics.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  }

  async function generateReport() {
    if (!title.trim()) { toast.error("Enter a report title"); return; }
    setGenerating(true);
    try {
      await analyticsService.createReport({ report_type: "PLACEMENT_SUMMARY", title });
      setTitle("");
      await load();
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Reports</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm">Generate and view placement reports</p>
            </div>
          </div>
          <Button onClick={downloadCsv} loading={exporting} variant="ghost" size="sm">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <div className="flex gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Report title (e.g., Q4 2024 Placement Summary)"
              className="flex-1 px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-surface-400 dark:placeholder:text-surface-500 transition-colors"
            />
            <Button onClick={generateReport} loading={generating} variant="gradient">
              <Sparkles className="w-4 h-4" />
              Generate
            </Button>
          </div>
        </Card>
      </FadeIn>

      <StaggerContainer className="space-y-3">
        {reports.map((report) => (
          <StaggerItem key={report.id}>
            <motion.div whileHover={{ y: -1 }} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 hover:shadow-premium transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-50 dark:bg-primary-950/30 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900 dark:text-white">{report.title}</h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{report.report_type} • Generated {formatDate(report.created_at)}</p>
                  </div>
                </div>
              </div>
              {report.data?.statistics && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Total Students", val: report.data.statistics.total_students },
                    { label: "Placed", val: report.data.statistics.total_placed },
                    { label: "Placement Rate", val: `${report.data.statistics.placement_percentage}%` },
                    { label: "Companies", val: report.data.statistics.total_companies },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-surface-50 dark:bg-surface-750 rounded-xl p-3 text-center">
                      <p className="text-xs text-surface-400 dark:text-surface-500">{label}</p>
                      <p className="text-xl font-bold text-surface-800 dark:text-surface-200 mt-1">{val}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </StaggerItem>
        ))}
        {reports.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-surface-400 dark:text-surface-500" />
            </div>
            <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">No reports generated yet</p>
          </div>
        )}
      </StaggerContainer>
    </div>
  );
}
