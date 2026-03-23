import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ApplicationStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount?: number): string {
  if (!amount) return "Not disclosed";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/**
 * Format a salary range for job listings.
 * Salary values are stored in LPA (e.g. 5 = ₹5 LPA).
 *
 * Fix: the job card was rendering a DollarSign ($) icon alongside
 * formatCurrency() which already outputs ₹ — producing "$ ₹5 LPA".
 * This function returns a single clean string with only the ₹ symbol.
 */
export function formatSalaryRange(min?: number, max?: number): string {
  if (!min && !max) return "";
  const fmt = (n: number): string =>
    `₹${Number.isInteger(n) ? n : n.toFixed(1)} LPA`;
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  return fmt(min!);
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Application status badge classes.
 * Fix: added dark: variants — previously only light-mode classes were present,
 * making badges illegible in dark mode.
 */
export function getStatusColor(status: ApplicationStatus): string {
  const colors: Record<ApplicationStatus, string> = {
    PENDING:
      "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
    UNDER_REVIEW:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    SHORTLISTED:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
    INTERVIEW_SCHEDULED:
      "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300",
    SELECTED:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    REJECTED:
      "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    WITHDRAWN:
      "bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300",
  };
  return (
    colors[status] ||
    "bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300"
  );
}

/** Resolve an upload URL to an absolute URL pointing at the backend.
 *  Blob/data/http URLs are returned as-is; relative /uploads/ paths get
 *  the backend origin prepended so they are not fetched from the Next.js
 *  dev server (port 3000) by accident. */
export function getFileUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("http")) return url;
  const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/v1\/?$/, "");
  return `${apiOrigin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Job type badge classes.
 * Fix: added dark: variants for dark mode readability.
 */
export function getJobTypeBadge(type: string): string {
  const colors: Record<string, string> = {
    FULL_TIME:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    PART_TIME:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    INTERNSHIP:
      "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
    CONTRACT:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
  };
  return (
    colors[type] ||
    "bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300"
  );
}
