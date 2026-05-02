"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn, getFileUrl } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authService, studentService, adminProfileService, managementProfileService } from "@/services/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, User, FileText, ClipboardList,
  Building2, BarChart3, LogOut, GraduationCap,
  PieChart, TrendingUp, ChevronLeft, ChevronRight, X, Users,
  Globe, CalendarDays, Calendar, Brain,
  Settings2, BellRing, AlertCircle, Trophy
} from "lucide-react";

const STUDENT_NAV = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/profile", label: "My Profile", icon: User },
  { href: "/student/resume", label: "Resume Insights", icon: FileText },
  { href: "/student/placement-drives", label: "Drives", icon: CalendarDays },
  { href: "/student/applications", label: "My Applications", icon: ClipboardList },
  { href: "/student/interviews", label: "Interviews", icon: Calendar },
  { href: "/student/interview", label: "Interview Prep", icon: Brain },
  { href: "/student/market-jobs", label: "Market Jobs", icon: Globe },
  { href: "/student/complaints", label: "Complaints", icon: AlertCircle },
];

const ADMIN_NAV = [
  { href: "/admin/dashboard",        label: "Dashboard",           icon: LayoutDashboard },
  { href: "/admin/students",         label: "Students",            icon: Users },
  { href: "/admin/companies",        label: "Companies",           icon: Building2 },
  { href: "/admin/placement-drives", label: "Placement Drives",    icon: CalendarDays },
  { href: "/admin/market-jobs",      label: "Market Jobs",         icon: Globe },
  { href: "/admin/reports",          label: "Reports",             icon: BarChart3 },
  { href: "/admin/settings",         label: "Settings",            icon: Settings2 },
];

const MANAGEMENT_NAV = [
  { href: "/management/dashboard",      label: "Dashboard",      icon: LayoutDashboard },
  { href: "/management/profile",        label: "My Profile",     icon: User },
  { href: "/management/announcements",  label: "Announcements",  icon: BellRing },
  { href: "/management/complaints",     label: "Complaints",     icon: AlertCircle },
  { href: "/management/leaderboard",    label: "Leaderboard",    icon: Trophy },
  { href: "/management/analytics",      label: "Analytics",      icon: PieChart },
  { href: "/management/market-jobs-analytics", label: "Market Analytics", icon: BarChart3 },
  { href: "/management/statistics",     label: "Statistics",     icon: TrendingUp },
  { href: "/management/reports",        label: "Reports",        icon: BarChart3 },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

/** Read __role cookie synchronously — available before Firebase async callback fires. */
function getCookieRole(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie.match(/(?:^|;\s*)__role=([^;]+)/)?.[1];
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role: authRole } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use cookie as an immediate synchronous fallback so the correct nav renders
  // on the very first paint without waiting for the Firebase auth callback.
  const cookieRole = typeof document !== "undefined" ? getCookieRole() : undefined;
  const role = mounted ? (authRole || cookieRole || "STUDENT") : "STUDENT";

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;
    const fallbackName = user?.displayName || user?.email?.split("@")[0] || "User";
    setDisplayName(fallbackName);
    setAvatarUrl(null);

    async function loadIdentity() {
      try {
        const me = await authService.getMe();
        if (!cancelled && me?.full_name) {
          setDisplayName(me.full_name);
        }
      } catch {
        // Keep the auth fallback if the backend user document is unavailable.
      }

      try {
        if (role === "STUDENT") {
          const profile = await studentService.getMyProfile();
          if (cancelled) return;
          if (profile.full_name) setDisplayName(profile.full_name);
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
          return;
        }

        if (role === "PLACEMENT_ADMIN") {
          const response = await adminProfileService.get();
          const profile = response.data;
          if (cancelled) return;
          if (profile?.full_name) setDisplayName(profile.full_name);
          if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
          return;
        }

        if (role === "COLLEGE_MANAGEMENT") {
          const response = await managementProfileService.get();
          const profile = response.data;
          if (cancelled) return;
          if (profile?.full_name) setDisplayName(profile.full_name);
          if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
        }
      } catch {
        // Missing role-specific profile data should not break the sidebar.
      }
    }

    loadIdentity();
    return () => {
      cancelled = true;
    };
  }, [mounted, role, user?.displayName, user?.email]);

  const name = mounted ? displayName : "User";

  const navItems =
    role === "STUDENT" ? STUDENT_NAV :
    role === "PLACEMENT_ADMIN" ? ADMIN_NAV :
    MANAGEMENT_NAV;

  const roleLabel = ({
    STUDENT: "Student",
    PLACEMENT_ADMIN: "Placement Admin",
    COLLEGE_MANAGEMENT: "College Management",
  } as Record<string, string>)[role] ?? "";

  async function handleLogout() {
    await signOut(auth);
    // Clear session cookies
    document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "__role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center border-b border-surface-200/10 dark:border-surface-700/50",
        collapsed ? "justify-center p-4" : "gap-3 p-5"
      )}>
        <motion.div
          whileHover={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.5 }}
          className="w-9 h-9 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/20"
        >
          <GraduationCap className="w-5 h-5 text-white" />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <h1 className="text-white font-bold text-sm whitespace-nowrap">SmartHire</h1>
              <p className="text-white/50 text-xs whitespace-nowrap">{roleLabel}</p>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto md:hidden p-1 text-white/60 hover:text-white rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200",
                collapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                active
                  ? "bg-white/15 text-white shadow-sm backdrop-blur-sm"
                  : "text-white/60 hover:bg-white/8 hover:text-white"
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-white/15 rounded-xl"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <Icon className={cn("w-[18px] h-[18px] flex-shrink-0 relative z-10", active && "text-white")} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative z-10 whitespace-nowrap overflow-hidden"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              {collapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1 bg-surface-900 dark:bg-surface-700 text-white text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                  {label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden md:flex justify-center p-2 border-t border-white/10">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </motion.button>
      </div>

      {/* User footer */}
      <div className={cn(
        "border-t border-white/10",
        collapsed ? "p-3" : "p-4"
      )}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 mb-3")}>
          <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white/20">
            {avatarUrl ? (
              <img
                src={getFileUrl(avatarUrl)}
                alt={name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-white text-xs font-bold">{name?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="min-w-0 overflow-hidden"
              >
                <p className="text-white text-xs font-medium truncate">{name}</p>
                <p className="text-white/40 text-xs truncate">{roleLabel}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          whileHover={{ x: 2 }}
          onClick={handleLogout}
          className={cn(
            "flex items-center text-white/50 hover:text-white text-xs transition-colors",
            collapsed ? "justify-center w-full py-2" : "gap-2 py-1.5 w-full"
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </motion.button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="hidden md:flex flex-col min-h-screen bg-gradient-to-b from-primary-700 via-primary-800 to-primary-900 dark:from-surface-950 dark:via-surface-950 dark:to-primary-950 shadow-xl overflow-hidden flex-shrink-0"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-[260px] bg-gradient-to-b from-primary-700 via-primary-800 to-primary-900 dark:from-surface-950 dark:via-surface-950 dark:to-primary-950 z-50 shadow-2xl overflow-hidden flex flex-col"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
