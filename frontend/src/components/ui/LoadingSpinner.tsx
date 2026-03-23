"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function LoadingSpinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: 16, md: 32, lg: 48 };
  const s = sizes[size];
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        style={{ width: s, height: s }}
      >
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="text-surface-200 dark:text-surface-700" />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-primary-500"
          />
        </svg>
      </motion.div>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <LoadingSpinner size="lg" className="mb-4" />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-surface-500 dark:text-surface-400 text-sm"
        >
          Loading...
        </motion.p>
      </motion.div>
    </div>
  );
}

/* ── Skeleton loaders ── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-6 space-y-4">
      <Skeleton className="h-4 w-2/3 rounded" />
      <Skeleton className="h-3 w-1/2 rounded" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 overflow-hidden">
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-1/4 rounded" />
            <Skeleton className="h-4 w-1/5 rounded" />
            <Skeleton className="h-4 w-1/6 rounded" />
            <Skeleton className="h-4 w-1/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
