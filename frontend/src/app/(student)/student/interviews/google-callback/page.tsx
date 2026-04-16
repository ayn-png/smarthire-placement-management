"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { calendarService } from "@/services/api";
import { extractErrorMsg } from "@/lib/utils";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage("Google authorization was cancelled or denied.");
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received from Google.");
      return;
    }

    calendarService.googleCallback(code)
      .then(() => {
        setStatus("success");
        setMessage("Google Calendar connected successfully!");
        setTimeout(() => router.push("/student/interviews"), 2000);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(extractErrorMsg(err, "Failed to connect Google Calendar."));
      });
  }, [searchParams, router]);

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl p-8 shadow-xl max-w-sm w-full text-center">
      {status === "loading" && (
        <>
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary-500 animate-spin" />
          <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Connecting...</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400">Completing Google Calendar authorization</p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
          <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Connected!</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400">{message}</p>
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-3">Redirecting to interviews...</p>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Connection Failed</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">{message}</p>
          <button
            onClick={() => router.push("/student/interviews")}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Back to Interviews
          </button>
        </>
      )}
    </div>
  );
}

export default function GoogleCalendarCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 p-4">
      <Suspense fallback={
        <div className="bg-white dark:bg-surface-800 rounded-2xl p-8 shadow-xl max-w-sm w-full text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary-500 animate-spin" />
          <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Loading...</h2>
        </div>
      }>
        <GoogleCallbackContent />
      </Suspense>
    </div>
  );
}
