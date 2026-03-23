"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "next/link";

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console
    console.error("Student route error:", error);

    // Send to error tracking service (Sentry, etc.)
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-2xl mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-surface-500 dark:text-surface-400 text-sm mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>

        {process.env.NODE_ENV === "development" && error.digest && (
          <p className="text-xs text-surface-400 dark:text-surface-500 mb-4">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="primary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          <Link href="/student/dashboard">
            <Button variant="secondary">
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
