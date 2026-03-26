"use client";
/**
 * Feature 3 — Admin Student Directory
 * Uses GET /students/ (existing endpoint) with search, branch filter + pagination.
 */
import { useEffect, useState, useCallback } from "react";
import { Users, Search, GraduationCap, Mail, Phone, Star, Eye, Download } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import { studentService } from "@/services/api";
import { StudentProfile } from "@/types";
import { FadeIn } from "@/components/ui/Animations";
import { getFileUrl } from "@/lib/utils";

const BRANCHES = ["CSE", "ECE", "ME", "CE", "EE", "IT", "Other"];
const PAGE_LIMIT = 20;

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [minCgpa, setMinCgpa] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await studentService.listStudents({
        branch: filterBranch || undefined,
        min_cgpa: minCgpa ? parseFloat(minCgpa) : undefined,
        page,
        limit: PAGE_LIMIT,
      });
      // Client-side name/email search (backend endpoint doesn't support text search)
      const raw: StudentProfile[] = data.profiles || [];
      if (search.trim()) {
        const q = search.toLowerCase();
        const filtered = raw.filter(
          (s) =>
            (s.full_name ?? "").toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q) ||
            s.roll_number.toLowerCase().includes(q)
        );
        setStudents(filtered);
        setTotal(filtered.length);
      } else {
        setStudents(raw);
        setTotal(data.total || raw.length);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (err as { message?: string })?.message
        || "Failed to load students";
      setError(msg);
      console.error("[AdminStudents] load error:", err);
      setStudents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterBranch, minCgpa, page, search]);

  useEffect(() => {
    setPage(1);
  }, [filterBranch, minCgpa, search]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const blob = await studentService.exportCsv({
        branch: filterBranch || undefined,
        min_cgpa: minCgpa ? parseFloat(minCgpa) : undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "students_export.csv";
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

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Student Directory</h1>
              <p className="text-surface-500 dark:text-surface-400 text-sm">{total} students registered</p>
            </div>
          </div>
          <Button onClick={handleExportCSV} variant="secondary" disabled={exporting}>
            <Download className="w-4 h-4" />{exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, email or roll no…"
                className="pl-9 pr-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 w-60 transition-colors"
              />
            </div>
            <button type="submit" className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors">
              Search
            </button>
            {search && (
              <button type="button" onClick={() => { setSearch(""); setSearchInput(""); }}
                className="px-4 py-2.5 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400 text-sm font-medium rounded-xl transition-colors">
                Clear
              </button>
            )}
          </form>

          {/* Branch filter */}
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            className="px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
            <option value="">All Branches</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>

          {/* Min CGPA */}
          <input
            type="number" step="0.1" min="0" max="10"
            value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)}
            placeholder="Min CGPA"
            className="w-32 px-4 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
          />
        </div>
      </FadeIn>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
          <p className="font-medium">Failed to load students</p>
          <p className="mt-1 text-red-600 dark:text-red-500">{error}</p>
          <p className="mt-2 text-xs text-red-500 dark:text-red-600">
            Tip: Check that NEXT_PUBLIC_API_URL is set to your backend URL in production.
          </p>
        </div>
      )}

      {loading ? (
        <LoadingSpinner className="h-64" size="lg" />
      ) : students.length === 0 ? (
        <FadeIn delay={0.15}>
          <div className="text-center py-20 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700">
            <Users className="w-10 h-10 mx-auto mb-3 text-surface-300 dark:text-surface-600" />
            <p className="text-surface-500 dark:text-surface-400 text-sm font-medium">No students found</p>
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={0.15}>
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-sm overflow-hidden">
            <div>
              {students.map((s) => (
                <div key={s.id}>
                  <motion.div
                    whileHover={{ x: 2 }}
                    className="flex items-center gap-4 px-6 py-4 border-b border-surface-100 dark:border-surface-700 last:border-0 hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 ring-2 ring-primary-100 dark:ring-primary-900/30">
                      {(s as StudentProfile & { avatar_url?: string }).avatar_url ? (
                        <img
                          src={getFileUrl((s as StudentProfile & { avatar_url?: string }).avatar_url)}
                          alt={s.full_name ?? "Student"}
                          className="w-11 h-11 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-sm">{s.full_name?.charAt(0)?.toUpperCase() ?? "?"}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-surface-900 dark:text-white truncate">{s.full_name ?? "Unknown"}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 font-medium">{s.roll_number}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium">{s.branch}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-surface-500 dark:text-surface-400">
                          <Mail className="w-3 h-3" /> {s.email}
                        </span>
                        {s.phone && (
                          <span className="flex items-center gap-1 text-xs text-surface-500 dark:text-surface-400">
                            <Phone className="w-3 h-3" /> {s.phone}
                          </span>
                        )}
                        {s.skills?.length > 0 && (
                          <span className="text-xs text-surface-400 dark:text-surface-500 truncate max-w-xs">
                            {s.skills.slice(0, 4).join(", ")}{s.skills.length > 4 ? "…" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-sm font-bold text-surface-800 dark:text-surface-200">{s.cgpa?.toFixed(2) ?? "N/A"}</span>
                      </div>
                      <p className="text-xs text-surface-400 dark:text-surface-500">Sem {s.semester}</p>
                      {s.resume_url && (
                        <a href={s.resume_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                          <GraduationCap className="w-3 h-3" /> Resume
                        </a>
                      )}
                      <Link
                        href={`/admin/students/${s.id}`}
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                      >
                        <Eye className="w-3 h-3" /> View Profile
                      </Link>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>

            {/* Pagination — only shown for server-side results (no client-side search active) */}
            {!search && (
              <div className="px-6 py-3 border-t border-surface-100 dark:border-surface-700">
                <Pagination page={page} total={total} limit={PAGE_LIMIT} onPageChange={setPage} syncUrl />
              </div>
            )}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
