"use client";
import { useEffect, useState } from "react";
import { Search, MapPin, Building2, ChevronRight, X, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { jobService, applicationService, studentService } from "@/services/api";
import { Job, StudentProfile } from "@/types";
import { formatSalaryRange, getJobTypeBadge } from "@/lib/utils";
import { FadeIn } from "@/components/ui/Animations";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [jobType, setJobType] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [applyMessage, setApplyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    loadJobs();
    loadMyApplications();
    studentService.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  // FIX 12 — auto-select a job when arriving from the dashboard "Apply" link
  // (?jobId=<id>). Uses window.location.search to stay SSR-safe without
  // requiring a Suspense boundary for useSearchParams().
  useEffect(() => {
    if (typeof window === "undefined" || jobs.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("jobId");
    if (!jobId) return;
    const target = jobs.find((j) => j.id === jobId);
    if (target) {
      setSelectedJob(target);
      setApplyMessage(null);
      setCoverLetter("");
    }
  }, [jobs]);

  async function loadJobs(params?: Record<string, unknown>) {
    setLoading(true);
    try {
      const data = await jobService.list({ job_type: jobType || undefined, ...params });
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyApplications() {
    try {
      const data = await applicationService.getMyApplications();
      const appliedSet = new Set(data.applications.map((a) => a.job_id));
      setAppliedJobs(appliedSet);
    } catch {}
  }

  async function applyToJob() {
    if (!selectedJob) return;
    setApplying(true);
    setApplyMessage(null);
    try {
      await applicationService.apply({ job_id: selectedJob.id, cover_letter: coverLetter });
      setAppliedJobs((prev) => new Set(Array.from(prev).concat(selectedJob.id)));
      setApplyMessage({ type: "success", text: "Application submitted successfully!" });
      setCoverLetter("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setApplyMessage({ type: "error", text: msg || "Failed to apply" });
    } finally {
      setApplying(false);
    }
  }

  function getEligibility(job: Job) {
    const isExpired = job.application_deadline
      ? new Date(job.application_deadline) < new Date()
      : false;
    const isClosed = job.status !== "OPEN";
    const cgpaOk = !job.min_cgpa || (profile?.cgpa ?? 0) >= job.min_cgpa;
    const branchOk =
      !job.allowed_branches?.length ||
      job.allowed_branches.includes(profile?.branch ?? "");
    const canApply = !isExpired && !isClosed && cgpaOk && branchOk;
    return { isExpired, isClosed, cgpaOk, branchOk, canApply };
  }

  const filteredJobs = jobs.filter((j) =>
    j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (j.company_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-sm">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Job Listings</h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">{total} opportunities available</p>
          </div>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-surface-400 dark:text-surface-500" />
            <input
              type="text"
              placeholder="Search jobs or companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 placeholder:text-surface-400 dark:placeholder:text-surface-500 transition-colors"
            />
          </div>
          <select
            value={jobType}
            onChange={(e) => { setJobType(e.target.value); loadJobs({ job_type: e.target.value || undefined }); }}
            className="px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-colors"
          >
            <option value="">All Types</option>
            <option value="FULL_TIME">Full Time</option>
            <option value="INTERNSHIP">Internship</option>
            <option value="PART_TIME">Part Time</option>
            <option value="CONTRACT">Contract</option>
          </select>
        </div>
      </FadeIn>

      {loading ? (
        <LoadingSpinner className="h-64" size="lg" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredJobs.map((job, idx) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              whileHover={{ y: -2 }}
              onClick={() => { setSelectedJob(job); setApplyMessage(null); setCoverLetter(""); }}
              className={`bg-white dark:bg-surface-800 rounded-2xl border-2 p-5 cursor-pointer transition-all hover:shadow-lg dark:hover:shadow-surface-900/50 ${
                selectedJob?.id === job.id
                  ? "border-primary-500 shadow-lg ring-2 ring-primary-500/20"
                  : "border-surface-200 dark:border-surface-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-surface-900 dark:text-white">{job.title}</h3>
                  <div className="flex items-center gap-1.5 text-surface-500 dark:text-surface-400 text-sm mt-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {job.company_name}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {appliedJobs.has(job.id) && (
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full font-medium">Applied</span>
                  )}
                  {(() => { const { isExpired, isClosed, cgpaOk, branchOk } = getEligibility(job); return (
                    <>
                      {isExpired && <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full font-medium">Expired</span>}
                      {isClosed && !isExpired && <span className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 px-2.5 py-1 rounded-full font-medium">Closed</span>}
                      {!cgpaOk && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full font-medium">CGPA {job.min_cgpa}+</span>}
                      {!branchOk && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full font-medium">Branch mismatch</span>}
                    </>
                  ); })()}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getJobTypeBadge(job.job_type)}`}>
                  {job.job_type.replace("_", " ")}
                </span>
                <span className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{job.location}
                </span>
                {(job.salary_min || job.salary_max) && (
                  /* Fix: removed DollarSign ($) icon — formatSalaryRange already
                     includes the ₹ symbol, so combining both produced "$ ₹5 LPA" */
                  <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                    {formatSalaryRange(job.salary_min, job.salary_max)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
                <span className="text-xs text-surface-400 dark:text-surface-500">Min CGPA: {job.min_cgpa} | {job.openings} opening(s)</span>
                <ChevronRight className="w-4 h-4 text-surface-400 dark:text-surface-500" />
              </div>
            </motion.div>
          ))}
          {filteredJobs.length === 0 && (
            <div className="col-span-2 text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                <Search className="w-7 h-7 text-surface-400 dark:text-surface-500" />
              </div>
              <p className="text-surface-500 dark:text-surface-400 font-medium">No jobs found matching your criteria</p>
            </div>
          )}
        </div>
      )}

      {/* Job Detail Modal */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedJob(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-surface-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-surface-200 dark:border-surface-700"
            >
              <div className="p-6 border-b border-surface-200 dark:border-surface-700 sticky top-0 bg-white dark:bg-surface-800 z-10">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-surface-900 dark:text-white">{selectedJob.title}</h2>
                    <p className="text-surface-500 dark:text-surface-400">{selectedJob.company_name} &middot; {selectedJob.location}</p>
                  </div>
                  <button onClick={() => setSelectedJob(null)} className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getJobTypeBadge(selectedJob.job_type)}`}>
                    {selectedJob.job_type.replace("_", " ")}
                  </span>
                  {(selectedJob.salary_min || selectedJob.salary_max) && (
                    <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full">
                      {formatSalaryRange(selectedJob.salary_min, selectedJob.salary_max)}
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-surface-800 dark:text-surface-200 mb-1.5">Description</h4>
                  <p className="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-line leading-relaxed">{selectedJob.description}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-surface-800 dark:text-surface-200 mb-1.5">Requirements</h4>
                  <p className="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-line leading-relaxed">{selectedJob.requirements}</p>
                </div>
                {selectedJob.required_skills.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-surface-800 dark:text-surface-200 mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedJob.required_skills.map((s) => (
                        <span key={s} className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 px-3 py-1 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-4">
                    <p className="text-surface-400 dark:text-surface-500 text-xs font-medium uppercase tracking-wide">Min CGPA</p>
                    <p className="font-bold text-surface-800 dark:text-surface-200 text-lg mt-1">{selectedJob.min_cgpa}</p>
                  </div>
                  <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-4">
                    <p className="text-surface-400 dark:text-surface-500 text-xs font-medium uppercase tracking-wide">Openings</p>
                    <p className="font-bold text-surface-800 dark:text-surface-200 text-lg mt-1">{selectedJob.openings}</p>
                  </div>
                </div>

                {!appliedJobs.has(selectedJob.id) ? (
                  <div className="space-y-3 pt-2">
                    {/* Eligibility warnings */}
                    {(() => {
                      const { isExpired, isClosed, cgpaOk, branchOk, canApply } = getEligibility(selectedJob);
                      if (canApply) return null;
                      return (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 space-y-1.5">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Not eligible to apply</p>
                          {isExpired && <p className="text-sm text-amber-700 dark:text-amber-400">⏰ Application deadline has passed</p>}
                          {isClosed && <p className="text-sm text-amber-700 dark:text-amber-400">🔒 This position is no longer accepting applications</p>}
                          {!cgpaOk && <p className="text-sm text-amber-700 dark:text-amber-400">📊 Requires CGPA {selectedJob.min_cgpa}+ (yours: {profile?.cgpa ?? "—"})</p>}
                          {!branchOk && <p className="text-sm text-amber-700 dark:text-amber-400">🎓 Your branch ({profile?.branch ?? "—"}) is not eligible for this role</p>}
                        </div>
                      );
                    })()}
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Cover Letter (optional)</label>
                      <textarea
                        rows={4}
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        placeholder="Why are you interested in this role?..."
                        maxLength={3000}
                        className="w-full px-4 py-3 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 resize-none placeholder:text-surface-400 dark:placeholder:text-surface-500 transition-colors"
                      />
                      <p className="text-xs text-surface-400 dark:text-surface-500 text-right mt-1">{coverLetter.length}/3000</p>
                    </div>
                    <AnimatePresence>
                      {applyMessage && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className={`text-sm px-4 py-3 rounded-xl ${
                            applyMessage.type === "success"
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                              : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                          }`}
                        >
                          {applyMessage.text}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <Button
                      onClick={applyToJob}
                      loading={applying}
                      disabled={applying || !getEligibility(selectedJob).canApply}
                      className="w-full"
                      size="lg"
                      variant="gradient"
                    >
                      Apply Now
                    </Button>
                  </div>
                ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 text-center text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ You have already applied for this job
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
