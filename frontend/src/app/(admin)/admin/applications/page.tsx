"use client";
import { useEffect, useState, Fragment } from "react";
import { ClipboardList, ChevronDown, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";        // Feature 2
import { applicationService, jobService } from "@/services/api";
import { Application, Job } from "@/types";
import { formatDate, getStatusColor } from "@/lib/utils";
import { FadeIn } from "@/components/ui/Animations";

const STATUSES = ["PENDING","UNDER_REVIEW","SHORTLISTED","INTERVIEW_SCHEDULED","SELECTED","REJECTED"];
const BRANCHES = ["CSE","IT","ECE","EEE","ME","CE","CHE","MCA","MBA","Other"];
const PAGE_LIMIT = 20;

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterJob, setFilterJob] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updateForm, setUpdateForm] = useState<Record<string, { status: string; remarks: string; interview_date: string; interview_link: string }>>({});
  // Feature 9 — bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("SHORTLISTED");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);

  // When filters change: reset to page 1 and load in one shot (avoids cascade double-render)
  useEffect(() => {
    setPage(1);
    load(1);
  }, [filterJob, filterStatus, filterBranch, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // When page changes via pagination (not a filter change): page is already !== 1 here
  useEffect(() => {
    if (page !== 1) load();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(pageOverride?: number) {
    const currentPage = pageOverride ?? page;
    setLoading(true);
    setSelected(new Set());
    try {
      const [appsData, jobsData] = await Promise.all([
        applicationService.listAll({ job_id: filterJob || undefined, status: filterStatus || undefined, branch: filterBranch || undefined, from_date: fromDate || undefined, to_date: toDate || undefined, page: currentPage, limit: PAGE_LIMIT }),
        jobService.list({ limit: 100, status: undefined }),
      ]);
      const apps = appsData.applications || [];
      setApplications(apps);
      setTotal(appsData.total || 0);
      setJobs(jobsData.jobs || []);
      const forms: typeof updateForm = {};
      apps.forEach((a: Application) => {
        forms[a.id] = { status: a.status, remarks: a.remarks || "", interview_date: a.interview_date || "", interview_link: a.interview_link || "" };
      });
      setUpdateForm(forms);
    } catch {
      setApplications([]);
      setJobs([]);
      setTotal(0);
      setUpdateForm({});
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(appId: string) {
    setUpdating(appId);
    try {
      await applicationService.updateStatus(appId, updateForm[appId]);
      await load();
      setExpanded(null);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to update");
    } finally {
      setUpdating(null);
    }
  }

  // Feature 9 — bulk actions
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === applications.length ? new Set() : new Set(applications.map((a) => a.id))
    );
  }

  async function handleBulkUpdate() {
    if (selected.size === 0) return;
    setBulkUpdating(true);
    try {
      const res = await applicationService.bulkUpdateStatus({
        application_ids: Array.from(selected),
        status: bulkStatus,
      });
      // NW#7 — surface failed_ids so the admin knows exactly which ones failed
      if (res.failed_ids && res.failed_ids.length > 0) {
        alert(
          `${res.message}\n\n⚠️ ${res.failed_ids.length} application(s) could not be updated:\n${res.failed_ids.join(", ")}\n\nPlease try updating these individually.`
        );
      } else {
        alert(res.message);
      }
      await load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Bulk update failed");
    } finally {
      setBulkUpdating(false);
    }
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const blob = await applicationService.exportCsv({
        job_id: filterJob || undefined,
        status: filterStatus || undefined,
        branch: filterBranch || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "applications_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Applications Review</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm">{total} applications</p>
            </div>
          </div>
          <Button onClick={handleExportCSV} variant="secondary" disabled={exporting}>
            <Download className="w-4 h-4" />{exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </FadeIn>

      {/* Feature 9 — Bulk action bar */}
      {selected.size > 0 && (
        <FadeIn>
          <div className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/50 rounded-2xl">
            <span className="text-sm font-medium text-primary-800 dark:text-primary-300">{selected.size} selected</span>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
              className="px-3 py-2 border border-primary-300 dark:border-primary-700 rounded-lg text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <Button size="sm" onClick={handleBulkUpdate} loading={bulkUpdating} variant="gradient">
              Update {selected.size} Applications
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="flex gap-3 flex-wrap">
          <select value={filterJob} onChange={(e) => setFilterJob(e.target.value)}
            className="px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
            <option value="">All Jobs</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} – {j.company_name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            className="px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
            <option value="">All Branches</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors" />
          </div>
        </div>
      </FadeIn>

      {applications.length === 0 ? (
        <FadeIn delay={0.15}>
          <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-surface-400 dark:text-surface-500" />
            </div>
            <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">No applications found</p>
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={0.15}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden shadow-sm">
            <table className="w-full text-sm table-premium">
              <thead className="bg-surface-50 dark:bg-surface-750 border-b border-surface-200 dark:border-surface-700">
                <tr>
                  {/* Feature 9 — select-all checkbox */}
                  <th className="pl-4 pr-2 py-3.5 w-10">
                    <input type="checkbox"
                      checked={selected.size === applications.length && applications.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-surface-300 dark:border-surface-600 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Job</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">CGPA</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Applied</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {applications.map((app) => (
                  <Fragment key={app.id}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      className={`hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors ${expanded === app.id ? "bg-primary-50 dark:bg-primary-950/20" : ""}`}
                    >
                      {/* Feature 9 — row checkbox */}
                      <td className="pl-4 pr-2 py-3">
                        <input type="checkbox"
                          checked={selected.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-surface-300 dark:border-surface-600 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-surface-900 dark:text-white">{app.student_name}</div>
                        <div className="text-xs text-surface-500 dark:text-surface-400">{app.student_branch}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-surface-800 dark:text-surface-200">{app.job_title}</div>
                        <div className="text-xs text-surface-500 dark:text-surface-400">{app.company_name}</div>
                      </td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{app.student_cgpa?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-surface-500 dark:text-surface-400 text-xs">{formatDate(app.applied_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(app.status)}`}>
                          {app.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setExpanded(expanded === app.id ? null : app.id)}
                          className="p-1.5 text-surface-400 dark:text-surface-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg transition-colors">
                          <motion.div animate={{ rotate: expanded === app.id ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown className="w-4 h-4" />
                          </motion.div>
                        </button>
                      </td>
                    </motion.tr>
                    <AnimatePresence>
                      {expanded === app.id && updateForm[app.id] && (
                        <motion.tr
                          key={`${app.id}-expanded`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="bg-primary-50/50 dark:bg-primary-950/10"
                        >
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Update Status</label>
                                <select
                                  value={updateForm[app.id].status}
                                  onChange={(e) => setUpdateForm((prev) => ({ ...prev, [app.id]: { ...prev[app.id], status: e.target.value } }))}
                                  className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                                >
                                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Interview Date</label>
                                <input type="date" value={updateForm[app.id].interview_date}
                                  onChange={(e) => setUpdateForm((prev) => ({ ...prev, [app.id]: { ...prev[app.id], interview_date: e.target.value } }))}
                                  className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Interview Link</label>
                                <input type="url" value={updateForm[app.id].interview_link}
                                  onChange={(e) => setUpdateForm((prev) => ({ ...prev, [app.id]: { ...prev[app.id], interview_link: e.target.value } }))}
                                  placeholder="https://meet.google.com/..."
                                  className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-surface-400 dark:placeholder:text-surface-500 transition-colors" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Remarks</label>
                                <input type="text" value={updateForm[app.id].remarks}
                                  onChange={(e) => setUpdateForm((prev) => ({ ...prev, [app.id]: { ...prev[app.id], remarks: e.target.value } }))}
                                  placeholder="Optional remarks..."
                                  className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-surface-400 dark:placeholder:text-surface-500 transition-colors" />
                              </div>
                            </div>
                            <div className="flex justify-end mt-3">
                              <Button size="sm" onClick={() => handleUpdate(app.id)} loading={updating === app.id} variant="gradient">
                                Update Status
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                ))}
              </tbody>
            </table>
            {/* Feature 2 — Pagination */}
            <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-700">
              <Pagination page={page} total={total} limit={PAGE_LIMIT} onPageChange={setPage} syncUrl />
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
