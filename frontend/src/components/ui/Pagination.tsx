"use client";
/**
 * Pagination.tsx — Feature 2
 * Reusable page-number pagination with prev/next and URL query-param sync.
 * Usage:
 *   <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  /** If true, syncs ?page= in the URL without a full navigation (default: false) */
  syncUrl?: boolean;
  className?: string;
}

export default function Pagination({
  page,
  total,
  limit,
  onPageChange,
  syncUrl = false,
  className = "",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  function goTo(p: number) {
    const next = Math.min(Math.max(1, p), totalPages);
    if (next === page) return;
    if (syncUrl && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("page", String(next));
      window.history.pushState({}, "", url.toString());
    }
    onPageChange(next);
  }

  /** Build the page number range to display (max 7 slots). */
  function pageNumbers(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  }

  const btnBase =
    "inline-flex items-center justify-center h-9 min-w-[36px] px-2.5 rounded-lg text-sm font-medium transition-colors select-none";
  const activeCls =
    "bg-primary-600 text-white shadow-sm cursor-default";
  const inactiveCls =
    "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer";
  const disabledCls =
    "text-surface-300 dark:text-surface-600 cursor-not-allowed";

  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      {/* Result count */}
      <p className="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap">
        {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of{" "}
        <span className="font-medium text-surface-700 dark:text-surface-300">{total}</span>
      </p>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        {/* Prev */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => goTo(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className={`${btnBase} ${page === 1 ? disabledCls : inactiveCls}`}
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>

        {pageNumbers().map((p, idx) =>
          p === "…" ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-surface-400 dark:text-surface-500 text-sm select-none">
              …
            </span>
          ) : (
            <motion.button
              key={p}
              whileTap={{ scale: 0.93 }}
              onClick={() => goTo(p as number)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              className={`${btnBase} ${p === page ? activeCls : inactiveCls}`}
            >
              {p}
            </motion.button>
          )
        )}

        {/* Next */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => goTo(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
          className={`${btnBase} ${page === totalPages ? disabledCls : inactiveCls}`}
        >
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
}
