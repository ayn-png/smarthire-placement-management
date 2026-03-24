"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { motion } from "framer-motion";
import { GraduationCap, ShieldCheck, BarChart3 } from "lucide-react";

const VALID_ROLES = ["STUDENT", "PLACEMENT_ADMIN", "COLLEGE_MANAGEMENT"] as const;
type Role = (typeof VALID_ROLES)[number];

const DASHBOARD_MAP: Record<Role, string> = {
  STUDENT: "/student/dashboard",
  PLACEMENT_ADMIN: "/admin/dashboard",
  COLLEGE_MANAGEMENT: "/management/dashboard",
};

const ROLES: { value: Role; label: string; description: string; icon: React.ElementType }[] = [
  {
    value: "STUDENT",
    label: "Student",
    description: "Browse jobs, apply, and practice AI interviews",
    icon: GraduationCap,
  },
  {
    value: "PLACEMENT_ADMIN",
    label: "Placement Admin",
    description: "Manage students, companies, jobs and applications",
    icon: ShieldCheck,
  },
  {
    value: "COLLEGE_MANAGEMENT",
    label: "College Management",
    description: "View analytics, statistics and placement reports",
    icon: BarChart3,
  },
];

export default function RoleSelectPage() {
  const router = useRouter();
  const { user, isLoaded } = useAuth();
  const [loading, setLoading] = useState<Role | null>(null);
  const [error, setError] = useState("");

  async function handleSelect(role: Role) {
    if (!isLoaded || !user) return;
    setError("");
    setLoading(role);
    try {
      // Get fresh Firebase ID token to send to our API route
      const idToken = await user.getIdToken();

      const res = await fetch("/api/set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to set role");
      }

      const data = await res.json().catch(() => ({}));

      // Force-refresh the ID token so the new custom claim (role) is in the token
      await auth.currentUser?.getIdToken(true);

      // Self-sync: create the Firestore users/{uid} doc from the client using the
      // freshly-refreshed token (which now carries the role claim).
      // This is the fallback when the server-side firebase-sync failed
      // (e.g. INTERNAL_API_SECRET mismatch on Render, backend cold start).
      // Safe to call even when firebase-sync succeeded — the endpoint is idempotent.
      try {
        const freshToken = await auth.currentUser?.getIdToken();
        if (freshToken) {
          const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
          await fetch(`${apiUrl}/api/v1/auth/self-sync`, {
            method: "POST",
            headers: { Authorization: `Bearer ${freshToken}` },
          });
        }
      } catch {
        // Non-fatal — if self-sync fails the dashboard will retry
        if ((data as { selfSyncNeeded?: boolean }).selfSyncNeeded) {
          console.warn("[role-select] self-sync failed; user may see 401 on first dashboard load");
        }
      }

      // Set role cookie for middleware
      document.cookie = `__role=${role}; path=/; SameSite=Lax`;

      router.push(DASHBOARD_MAP[role]);
    } catch (err: unknown) {
      setError((err as Error).message || "Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/10">
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-white"
        >
          Choose your role
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-white/50 text-sm mt-1.5"
        >
          Select how you&apos;ll use SmartHire
        </motion.p>
      </div>

      {error && (
        <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {ROLES.map(({ value, label, description, icon: Icon }, i) => (
          <motion.button
            key={value}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            onClick={() => handleSelect(value)}
            disabled={loading !== null}
            className="flex items-center gap-4 w-full text-left p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 group-hover:shadow-glow-sm transition-shadow">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium">
                {loading === value ? "Setting up..." : label}
              </p>
              <p className="text-white/40 text-xs mt-0.5 truncate">{description}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
