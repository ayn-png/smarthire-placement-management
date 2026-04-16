"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import Sidebar from "./Sidebar";
import SearchBar from "./SearchBar";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NotificationDropdown from "@/components/ui/NotificationDropdown"; // Feature 11
import MarketJobApplyModal from "@/components/shared/MarketJobApplyModal";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  LayoutDashboard,
  Briefcase,
  ClipboardList,
  User,
  Brain,
} from "lucide-react";

/* Bottom nav items for mobile (per role) */
const MOBILE_NAV: Record<string, { href: string; icon: React.ElementType; label: string }[]> = {
  STUDENT: [
    { href: "/student/dashboard", icon: LayoutDashboard, label: "Home" },
    { href: "/student/jobs", icon: Briefcase, label: "Jobs" },
    { href: "/student/applications", icon: ClipboardList, label: "Apps" },
    { href: "/student/interview", icon: Brain, label: "AI Prep" },
    { href: "/student/profile", icon: User, label: "Profile" },
  ],
  PLACEMENT_ADMIN: [
    { href: "/admin/dashboard", icon: LayoutDashboard, label: "Home" },
    { href: "/admin/companies", icon: Briefcase, label: "Companies" },
    { href: "/admin/jobs", icon: Briefcase, label: "Jobs" },
    { href: "/admin/applications", icon: ClipboardList, label: "Apps" },
  ],
  COLLEGE_MANAGEMENT: [
    { href: "/management/dashboard", icon: LayoutDashboard, label: "Home" },
    { href: "/management/analytics", icon: Briefcase, label: "Analytics" },
    { href: "/management/statistics", icon: ClipboardList, label: "Stats" },
    { href: "/management/reports", icon: ClipboardList, label: "Reports" },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { role: authRole } = useAuth();

  // --- NEW: Market Job tracking ---
  const [clickedJobId, setClickedJobId] = useState<string | null>(null);

  // Check for return on focus, visibility change, or mount
  useEffect(() => {
    // Only track for students
    if (role !== "STUDENT") return;

    const checkTracking = () => {
      if (typeof window === "undefined") return;
      const stored = localStorage.getItem("market_job_clicked");
      // If we have a stored job but haven't triggered the modal yet
      if (stored && !clickedJobId) {
        setClickedJobId(stored);
      }
    };

    checkTracking();
    window.addEventListener("focus", checkTracking);
    // Visibilitychange is more robust for "coming back" from other tabs
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkTracking();
    });

    return () => {
      window.removeEventListener("focus", checkTracking);
      document.removeEventListener("visibilitychange", checkTracking);
    };
  }, [clickedJobId, role]);

  // Read cookie synchronously so the correct mobile nav renders on first paint
  // without waiting for the Firebase auth callback to complete.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cookieRole = typeof document !== "undefined"
    ? document.cookie.match(/(?:^|;\s*)__role=([^;]+)/)?.[1]
    : undefined;
  const role = mounted ? (authRole || cookieRole || "STUDENT") : "STUDENT";
  const mobileItems = MOBILE_NAV[role] || MOBILE_NAV.STUDENT;

  /* Scroll to top on route change */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navbar */}
        <header className="sticky top-0 z-30 bg-[var(--color-glass)] backdrop-blur-xl border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between h-16 px-4 md:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <SearchBar />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {/* Feature 11 — Live notification bell with dropdown */}
              <NotificationDropdown />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="max-w-7xl mx-auto p-4 md:p-8 pb-24 md:pb-8"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="mobile-bottom-nav md:hidden">
        {mobileItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors ${
                active
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-surface-400 dark:text-surface-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <motion.div
                  layoutId="mobile-active"
                  className="absolute bottom-0 w-8 h-0.5 bg-primary-500 rounded-full"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Market Job Tracking Modal */}
      <AnimatePresence>
        {clickedJobId && (
          <MarketJobApplyModal 
            jobId={clickedJobId} 
            onClose={() => setClickedJobId(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

