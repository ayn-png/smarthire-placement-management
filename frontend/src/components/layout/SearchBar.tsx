"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getUserRole } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  User,
  FileText,
  Briefcase,
  ClipboardList,
  Brain,
  Building2,
  BarChart3,
  PieChart,
  TrendingUp,
  Command,
  ArrowRight,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  keywords: string[];
  category: string;
}

const STUDENT_ITEMS: NavItem[] = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: ["home", "overview", "stats"], category: "Navigation" },
  { href: "/student/profile", label: "My Profile", icon: User, keywords: ["account", "info", "details", "personal"], category: "Navigation" },
  { href: "/student/resume", label: "Resume", icon: FileText, keywords: ["cv", "document", "upload", "file"], category: "Navigation" },
  { href: "/student/jobs", label: "Job Listings", icon: Briefcase, keywords: ["openings", "positions", "opportunities", "work", "career"], category: "Navigation" },
  { href: "/student/applications", label: "My Applications", icon: ClipboardList, keywords: ["applied", "status", "submissions", "track"], category: "Navigation" },
  { href: "/student/interview", label: "AI Interview Prep", icon: Brain, keywords: ["practice", "mock", "ai", "preparation", "questions"], category: "Navigation" },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: ["home", "overview", "stats"], category: "Navigation" },
  { href: "/admin/companies", label: "Companies", icon: Building2, keywords: ["organizations", "employers", "firms", "corporate"], category: "Navigation" },
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase, keywords: ["openings", "positions", "listings", "postings"], category: "Navigation" },
  { href: "/admin/applications", label: "Applications", icon: ClipboardList, keywords: ["submissions", "candidates", "applied", "review"], category: "Navigation" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, keywords: ["analytics", "data", "charts", "statistics", "export"], category: "Navigation" },
];

const MANAGEMENT_ITEMS: NavItem[] = [
  { href: "/management/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: ["home", "overview", "stats"], category: "Navigation" },
  { href: "/management/analytics", label: "Analytics", icon: PieChart, keywords: ["insights", "data", "trends", "metrics"], category: "Navigation" },
  { href: "/management/statistics", label: "Statistics", icon: TrendingUp, keywords: ["numbers", "data", "metrics", "performance"], category: "Navigation" },
  { href: "/management/reports", label: "Reports", icon: BarChart3, keywords: ["export", "pdf", "charts", "summary"], category: "Navigation" },
];

export default function SearchBar() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const role = (mounted ? getUserRole() : undefined) || "STUDENT";

  const allItems = useMemo(() => {
    switch (role) {
      case "PLACEMENT_ADMIN": return ADMIN_ITEMS;
      case "COLLEGE_MANAGEMENT": return MANAGEMENT_ITEMS;
      default: return STUDENT_ITEMS;
    }
  }, [role]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q)) ||
        item.href.toLowerCase().includes(q)
    );
  }, [query, allItems]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  // Global Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
    },
    [router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      navigate(filtered[selectedIndex].href);
    }
  }

  return (
    <div className="hidden md:block relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search pages..."
          className="w-64 pl-10 pr-16 py-2 text-sm rounded-xl bg-surface-100 dark:bg-surface-800 border border-transparent focus:border-primary-500/30 focus:bg-white dark:focus:bg-surface-900 text-surface-700 dark:text-surface-200 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 transition-all"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-surface-200/80 dark:bg-surface-700/80 text-[10px] font-medium text-surface-400 dark:text-surface-500 border border-surface-300/50 dark:border-surface-600/50">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-surface-900 rounded-2xl shadow-xl dark:shadow-surface-950/50 border border-surface-200 dark:border-surface-700/60 overflow-hidden z-50"
          >
            {/* Category label */}
            <div className="px-3 py-2 border-b border-surface-100 dark:border-surface-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
                {query ? `Results for "${query}"` : "Quick Navigation"}
              </p>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-surface-400 dark:text-surface-500">
                  <Search className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm font-medium">No results found</p>
                  <p className="text-xs mt-0.5">Try a different search term</p>
                </div>
              ) : (
                filtered.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = index === selectedIndex;
                  return (
                    <motion.button
                      key={item.href}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      initial={false}
                      animate={{
                        backgroundColor: isSelected
                          ? "var(--color-primary-50, rgba(99,102,241,0.08))"
                          : "transparent",
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group transition-colors"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected
                            ? "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400"
                            : "bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate transition-colors ${
                            isSelected
                              ? "text-primary-700 dark:text-primary-300"
                              : "text-surface-700 dark:text-surface-200"
                          }`}
                        >
                          {item.label}
                        </p>
                        <p className="text-[11px] text-surface-400 dark:text-surface-500 truncate">
                          {item.href}
                        </p>
                      </div>
                      <ArrowRight
                        className={`w-3.5 h-3.5 flex-shrink-0 transition-all ${
                          isSelected
                            ? "opacity-100 text-primary-500 translate-x-0"
                            : "opacity-0 translate-x-1"
                        }`}
                      />
                    </motion.button>
                  );
                })
              )}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-surface-100 dark:border-surface-800 flex items-center gap-3 text-[10px] text-surface-400 dark:text-surface-500">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 font-mono">↵</kbd>
                open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 font-mono">esc</kbd>
                close
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
