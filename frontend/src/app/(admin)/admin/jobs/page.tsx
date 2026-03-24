"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Briefcase, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { jobService, companyService } from "@/services/api";
import { Job, Company, JobType } from "@/types";
import { formatCurrency, getJobTypeBadge, extractErrorMsg } from "@/lib/utils";
import { FadeIn } from "@/components/ui/Animations";
import RequirementsInput from "@/components/ui/RequirementsInput";
import AllowedBranchesSelect from "@/components/ui/AllowedBranchesSelect";
import SkillsMultiSelect from "@/components/ui/SkillsMultiSelect";

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [exportError, setExportError] = useState("");
  const [form, setForm] = useState<{
    title: string; company_id: string; description: string;
    requirements: string[];          // array of requirement strings
    required_skills: string[];        // array of skill strings
    job_type: string; location: string;
    salary_min: string; salary_max: string; min_cgpa: string; openings: string;
    allowed_branches: string[];       // array of branch strings
    application_deadline: string;
  }>({
    title: "", company_id: "", description: "", requirements: [],
    required_skills: [], job_type: "FULL_TIME", location: "",
    salary_min: "", salary_max: "", min_cgpa: "0", openings: "1",
    allowed_branches: [], application_deadline: "",
  });

  useEffect(() => { load(); }, [filterType]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const [jobsData, companiesData] = await Promise.all([
        jobService.list({ limit: 50, status: undefined, job_type: filterType || undefined }),
        companyService.list({ limit: 100 }),
      ]);
      setJobs(jobsData.jobs || []);
      setCompanies(companiesData.companies || []);
    } catch {
      setJobs([]);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingJob(null);
    setSaveError("");
    setForm({ title: "", company_id: "", description: "", requirements: [], required_skills: [], job_type: "FULL_TIME", location: "", salary_min: "", salary_max: "", min_cgpa: "0", openings: "1", allowed_branches: [], application_deadline: "" });
    setShowModal(true);
  }

  function openEdit(job: Job) {
    setEditingJob(job);
    setSaveError("");
    setForm({
      title: job.title, company_id: job.company_id, description: job.description,
      // Split stored string (newline-separated) back into array for editing
      requirements: job.requirements
        ? job.requirements.split("\n").map((s) => s.trim()).filter(Boolean)
        : [],
      required_skills: job.required_skills || [],
      job_type: job.job_type, location: job.location,
      salary_min: job.salary_min?.toString() || "", salary_max: job.salary_max?.toString() || "",
      min_cgpa: job.min_cgpa.toString(), openings: job.openings.toString(),
      allowed_branches: job.allowed_branches || [],
      application_deadline: job.application_deadline || "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaveError("");
    // Client-side validation
    const validationErrors: string[] = [];
    if (!form.title.trim() || form.title.trim().length < 3)
      validationErrors.push("Job title must be at least 3 characters");
    if (!form.company_id)
      validationErrors.push("Company is required");
    if (!form.location.trim())
      validationErrors.push("Location is required");
    if (!form.description.trim() || form.description.trim().length < 20)
      validationErrors.push("Description must be at least 20 characters");
    const cgpa = parseFloat(form.min_cgpa);
    if (isNaN(cgpa) || cgpa < 0 || cgpa > 10)
      validationErrors.push("Min CGPA must be between 0 and 10");
    const openings = parseInt(form.openings);
    if (isNaN(openings) || openings < 1)
      validationErrors.push("Openings must be at least 1");
    const sMin = form.salary_min ? parseFloat(form.salary_min) : undefined;
    const sMax = form.salary_max ? parseFloat(form.salary_max) : undefined;
    if (sMin !== undefined && sMax !== undefined && sMin > sMax)
      validationErrors.push("Minimum salary cannot exceed maximum salary");
    if (form.application_deadline && new Date(form.application_deadline) <= new Date())
      validationErrors.push("Application deadline must be a future date");
    if (validationErrors.length > 0) {
      setSaveError(validationErrors.join(" · "));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        job_type: form.job_type as JobType,
        // Join requirements array to newline-separated string for backend (backend expects str)
        requirements: form.requirements.join("\n"),
        required_skills: form.required_skills,   // already string[]
        allowed_branches: form.allowed_branches,   // already string[]
        salary_min: form.salary_min ? parseFloat(form.salary_min) : undefined,
        salary_max: form.salary_max ? parseFloat(form.salary_max) : undefined,
        min_cgpa: parseFloat(form.min_cgpa),
        openings: parseInt(form.openings),
      };
      if (editingJob) {
        await jobService.update(editingJob.id, payload);
      } else {
        await jobService.create(payload);
      }
      setShowModal(false);
      await load();
    } catch (err: unknown) {
      setSaveError(extractErrorMsg(err, "Failed to save job. Please check your inputs and try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job? This cannot be undone.")) return;
    setDeleteError("");
    try {
      await jobService.delete(id);
      await load();
    } catch (err: unknown) {
      setDeleteError(extractErrorMsg(err, "Failed to delete job. If applications exist, close the job instead."));
    }
  }

  async function toggleStatus(job: Job) {
    const newStatus = job.status === "OPEN" ? "CLOSED" : "OPEN";
    await jobService.update(job.id, { status: newStatus as "OPEN" | "CLOSED" });
    await load();
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const blob = await jobService.exportCsv({ job_type: filterType || undefined });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jobs_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setExportError("Failed to export CSV. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Job Management</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm">{jobs.length} jobs posted</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportCSV} variant="secondary" disabled={exporting}>
              <Download className="w-4 h-4" />{exporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button onClick={openCreate} variant="gradient"><Plus className="w-4 h-4" />Post Job</Button>
          </div>
        </div>
        {(deleteError || exportError) && (
          <div className="mt-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
            <span className="flex-1">{deleteError || exportError}</span>
            <button onClick={() => { setDeleteError(""); setExportError(""); }} className="flex-shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-300 font-bold">×</button>
          </div>
        )}
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="flex gap-3 flex-wrap">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
            <option value="">All Types</option>
            <option value="FULL_TIME">Full Time (Placement)</option>
            <option value="INTERNSHIP">Internship</option>
            <option value="PART_TIME">Part Time</option>
            <option value="CONTRACT">Contract</option>
          </select>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-hidden shadow-sm">
          <table className="w-full text-sm table-premium">
            <thead className="bg-surface-50 dark:bg-surface-750 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Job</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Package</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {jobs.map((job, idx) => (
                <motion.tr
                  key={job.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-surface-900 dark:text-white">{job.title}</div>
                    <div className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1 mt-0.5">
                      <Briefcase className="w-3 h-3" />{job.company_name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getJobTypeBadge(job.job_type)}`}>
                      {job.job_type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-surface-600 dark:text-surface-400 text-xs">{job.location}</td>
                  <td className="px-6 py-4 text-surface-600 dark:text-surface-400 text-xs">
                    {job.salary_max ? `Up to ${formatCurrency(job.salary_max)}` : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleStatus(job)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        job.status === "OPEN" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800" : "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 ring-1 ring-surface-200 dark:ring-surface-600"
                      }`}
                    >
                      {job.status}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(job)} className="p-1.5 text-surface-400 dark:text-surface-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(job.id)} className="p-1.5 text-surface-400 dark:text-surface-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-surface-400 dark:text-surface-500" />
                    </div>
                    <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">No jobs posted yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </FadeIn>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-surface-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-premium"
            >
              <div className="p-6 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between sticky top-0 bg-white dark:bg-surface-800 z-10 rounded-t-2xl">
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">{editingJob ? "Edit Job" : "Post New Job"}</h2>
                <button onClick={() => setShowModal(false)} className="text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 text-2xl leading-none transition-colors">×</button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <Input label="Job Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Software Engineer" />
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Company *</label>
                  <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
                    <option value="">Select company</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Job Type</label>
                  <select value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })}
                    className="w-full px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
                    <option value="FULL_TIME">Full Time</option>
                    <option value="INTERNSHIP">Internship</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </div>
                <Input label="Location *" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                <Input label="Min Salary (LPA)" type="number" value={form.salary_min} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} />
                <Input label="Max Salary (LPA)" type="number" value={form.salary_max} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} />
                <Input label="Min CGPA" type="number" step="0.1" value={form.min_cgpa} onChange={(e) => setForm({ ...form, min_cgpa: e.target.value })} />
                <Input label="Openings" type="number" value={form.openings} onChange={(e) => setForm({ ...form, openings: e.target.value })} />
                <div className="col-span-2">
                  <SkillsMultiSelect
                    value={form.required_skills}
                    onChange={(skills) => setForm({ ...form, required_skills: skills })}
                  />
                </div>
                <div className="col-span-2">
                  <AllowedBranchesSelect
                    label="Allowed Branches (leave empty for all)"
                    value={form.allowed_branches}
                    onChange={(branches) => setForm({ ...form, allowed_branches: branches })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Job Description *</label>
                  <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none transition-colors" />
                </div>
                <div className="col-span-2">
                  <RequirementsInput
                    value={form.requirements}
                    onChange={(reqs) => setForm({ ...form, requirements: reqs })}
                  />
                </div>
                <Input label="Application Deadline" type="date" value={form.application_deadline} onChange={(e) => setForm({ ...form, application_deadline: e.target.value })} />
              </div>
              {saveError && (
                <div className="px-6 pb-2">
                  <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400">
                    {saveError}
                  </div>
                </div>
              )}
              <div className="p-6 border-t border-surface-200 dark:border-surface-700 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => { setShowModal(false); setSaveError(""); }}>Cancel</Button>
                <Button onClick={handleSave} loading={saving} variant="gradient">{editingJob ? "Save Changes" : "Post Job"}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
