"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** AI Interview Prep has been removed. Redirect to dashboard. */
export default function InterviewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/student/dashboard");
  }, [router]);
  return null;
}
