"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Search,
  MapPin,
  Building2,
  Globe,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { marketJobsService } from "@/services/api";
import { MarketJob } from "@/types";
import { extractErrorMsg } from "@/lib/utils";
import { FadeIn } from "@/components/ui/Animations";

const LIMIT = 12;

export default function MarketJobsPage() {
  const [jobs, setJobs] = useState<MarketJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Debounce search by 500 ms — reset to page 1 on new query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when remote filter changes
  const handleRemoteToggle = (checked: boolean) => {
    setRemoteOnly(checked);
    setPage(1);
  };

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketJobsService.list({
        search: debouncedSearch || undefined,
        remote: remoteOnly || undefined,
        page,
        limit: LIMIT,
      });
      setJobs(data.jobs);
      setTotal(data.total);
    } catch (err: unknown) {
      setError(extractErrorMsg(err, "Failed to load market jobs. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, remoteOnly, page]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  /**
   * Apply Now flow:
   * 1. Open external URL immediately (non-blocking).
   * 2. Fire-and-forget click record — failure is silently ignored (non-critical).
   */
  async function handleApply(job: MarketJob) {
    window.open(job.url, "_blank", "noopener,noreferrer");
    // Track click for modal popup later
    localStorage.setItem("market_job_clicked", job.slug);
    try {
      await marketJobsService.recordClick({
        job_title: job.title,
        company_name: job.company_name,
      });
    } catch {
      // Non-critical — do not surface this error to the student
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-glow-sm">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
              Market Jobs
            </h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">
              {loading ? "Loading live opportunities…" : `${total} live opportunities from the job market`}
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.08}>
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 dark:text-surface-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search jobs or companies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 placeholder:text-surface-400 dark:placeholder:text-surface-500 transition-colors"
            />
          </div>

          {/* Remote only toggle */}
          <label className="flex items-center gap-2 px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl bg-white dark:bg-surface-800 cursor-pointer text-sm text-surface-700 dark:text-surface-300 select-none hover:border-primary-400 dark:hover:border-primary-500 transition-colors">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => handleRemoteToggle(e.target.checked)}
              className="w-4 h-4 rounded accent-primary-600"
            />
            <Globe className="w-3.5 h-3.5 text-teal-500" />
            Remote only
          </label>
        </div>
      </FadeIn>

      {/* Content */}
      {loading ? (
        <LoadingSpinner className="h-64" size="lg" />
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
          <Button variant="secondary" size="sm" onClick={loadJobs} className="mt-4">
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* Job cards grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {jobs.map((job, idx) => (
              <motion.div
                key={job.slug}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: idx * 0.03 }}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-5 flex flex-col gap-3 hover:shadow-lg dark:hover:shadow-surface-900/50 transition-shadow"
              >
                {/* Title + remote badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-surface-900 dark:text-white leading-snug line-clamp-2 text-sm">
                      {job.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-surface-500 dark:text-surface-400 text-xs mt-1">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{job.company_name}</span>
                    </div>
                  </div>
                  {job.remote && (
                    <span className="flex-shrink-0 text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2.5 py-0.5 rounded-full font-medium">
                      Remote
                    </span>
                  )}
                </div>

                {/* Location + job type badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 px-2.5 py-0.5 rounded-full">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {job.location || "Not specified"}
                  </span>
                  {job.job_types.slice(0, 2).map((jt) => (
                    <span
                      key={jt}
                      className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 px-2.5 py-0.5 rounded-full font-medium capitalize"
                    >
                      {jt.replace(/-/g, " ")}
                    </span>
                  ))}
                </div>

                {/* Tags */}
                {job.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {job.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-surface-50 dark:bg-surface-700/60 text-surface-500 dark:text-surface-400 px-2 py-0.5 rounded-md border border-surface-200 dark:border-surface-600"
                      >
                        {tag}
                      </span>
                    ))}
                    {job.tags.length > 4 && (
                      <span className="text-xs text-surface-400 dark:text-surface-500 px-2 py-0.5">
                        +{job.tags.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                {/* Apply button — pushed to bottom of card */}
                <div className="mt-auto pt-1">
                  <Button
                    onClick={() => handleApply(job)}
                    variant="gradient"
                    size="sm"
                    fullWidth
                  >
                    <span className="flex items-center justify-center gap-2">
                      Apply Now
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </Button>
                </div>
              </motion.div>
            ))}

            {/* Empty state */}
            {jobs.length === 0 && (
              <div className="col-span-1 lg:col-span-2 xl:col-span-3 text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                  <Search className="w-7 h-7 text-surface-400 dark:text-surface-500" />
                </div>
                <p className="text-surface-500 dark:text-surface-400 font-medium text-sm">
                  No jobs found matching your criteria
                </p>
                <p className="text-surface-400 dark:text-surface-500 text-xs mt-1">
                  Try adjusting your search or clearing filters
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <FadeIn>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-surface-500 dark:text-surface-400 font-medium">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </FadeIn>
          )}
        </>
      )}
    </div>
  );
}
