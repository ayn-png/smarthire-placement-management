"use client";
import {
  useRef, useState, useEffect, useCallback, KeyboardEvent,
} from "react";
import { X, Search, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Suggestion catalogue ──────────────────────────────────────────────────────
export const REQUIREMENT_CATEGORIES = [
  {
    id: "technical",
    label: "Programming & Technical Skills",
    items: [
      "Data Structures & Algorithms",
      "Object-Oriented Programming",
      "REST API Development",
      "Database Design",
      "Git & Version Control",
      "Debugging & Problem Solving",
      "Cloud Basics (AWS/Azure/GCP)",
      "Docker & CI/CD",
      "Testing (Unit/Integration)",
      "System Design Basics",
      "API Integration",
      "Frontend Framework Knowledge",
      "Backend Development Knowledge",
    ],
  },
  {
    id: "soft",
    label: "Communication & Soft Skills",
    items: [
      "Verbal Communication",
      "Written Communication",
      "Team Collaboration",
      "Presentation Skills",
      "Leadership Skills",
      "Time Management",
      "Critical Thinking",
      "Adaptability",
      "Conflict Resolution",
    ],
  },
  {
    id: "general",
    label: "General Requirements",
    items: [
      "Strong analytical ability",
      "Quick learner",
      "Attention to detail",
      "Ability to work under pressure",
      "Willingness to relocate",
      "Internship/Project experience",
      "Portfolio/GitHub required",
      "Open to learning new technologies",
    ],
  },
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary-200 dark:bg-primary-700/60 text-primary-900 dark:text-primary-100 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface RequirementsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function RequirementsInput({
  value,
  onChange,
  label = "Requirements *",
  placeholder = "Search or type a requirement…",
}: RequirementsInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [focusIdx, setFocusIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);

  // ── Flat filtered list for keyboard nav ─────────────────────────────────────
  const flatFiltered: { item: string; categoryId: string }[] = [];
  REQUIREMENT_CATEGORIES.forEach((cat) => {
    cat.items.forEach((item) => {
      if (item.toLowerCase().includes(query.toLowerCase())) {
        flatFiltered.push({ item, categoryId: cat.id });
      }
    });
  });

  const canAddCustom =
    query.trim().length > 0 &&
    !value.includes(query.trim()) &&
    !REQUIREMENT_CATEGORIES.some((c) => c.items.includes(query.trim() as never));

  // ── Close on outside click ───────────────────────────────────────────────────
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // ── Auto-focus search when open ──────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setFocusIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // ── Scroll focused item into view ────────────────────────────────────────────
  useEffect(() => {
    if (focusIdx >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.querySelector<HTMLElement>(
        `[data-flat-idx="${focusIdx}"]`
      );
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIdx]);

  // ── Toggle selection ─────────────────────────────────────────────────────────
  const toggle = useCallback(
    (item: string) => {
      onChange(
        value.includes(item) ? value.filter((v) => v !== item) : [...value, item]
      );
    },
    [value, onChange]
  );

  // ── Add custom entry ─────────────────────────────────────────────────────────
  const addCustom = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setQuery("");
    setFocusIdx(-1);
    inputRef.current?.focus();
  }, [query, value, onChange]);

  // ── Keyboard handler on search input ─────────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const maxIdx = flatFiltered.length - 1 + (canAddCustom ? 1 : 0);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, maxIdx));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (focusIdx >= 0 && focusIdx < flatFiltered.length) {
          toggle(flatFiltered[focusIdx].item);
        } else if (focusIdx === flatFiltered.length && canAddCustom) {
          addCustom();
        } else if (canAddCustom) {
          addCustom();
        }
        break;
      case "Escape":
        setOpen(false);
        break;
      case "Backspace":
        if (!query && value.length > 0) {
          onChange(value.slice(0, -1));
        }
        break;
    }
  }

  // ── Whether a category has any visible items under current query ─────────────
  function catHasResults(cat: (typeof REQUIREMENT_CATEGORIES)[number]) {
    return cat.items.some((item) =>
      item.toLowerCase().includes(query.toLowerCase())
    );
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          {label}
        </label>
      )}

      {/* Tag input trigger */}
      <div
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 30); }}
        className={cn(
          "min-h-[44px] w-full flex flex-wrap items-center gap-1.5 px-3 py-2",
          "border rounded-xl text-sm transition-all duration-200 cursor-text",
          "bg-white dark:bg-surface-800",
          "border-surface-300 dark:border-surface-600",
          "hover:border-surface-400 dark:hover:border-surface-500",
          open && "ring-2 ring-primary-500/20 border-primary-500 dark:ring-primary-400/20 dark:border-primary-400"
        )}
      >
        {/* Selected chips */}
        {value.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 rounded-lg text-xs font-medium max-w-[240px]"
          >
            <span className="truncate">{chip}</span>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); toggle(chip); }}
              className="flex-shrink-0 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Hidden search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setFocusIdx(-1); setOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? placeholder : ""}
          className={cn(
            "flex-1 min-w-[160px] bg-transparent outline-none text-sm",
            "text-surface-900 dark:text-surface-100",
            "placeholder:text-surface-400 dark:placeholder:text-surface-500"
          )}
        />

        <ChevronDown
          className={cn(
            "w-4 h-4 flex-shrink-0 text-surface-400 dark:text-surface-500 ml-auto transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </div>

      {/* Count badge */}
      {value.length > 0 && (
        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
          {value.length} requirement{value.length !== 1 ? "s" : ""} selected
        </p>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute z-50 mt-1.5 w-full",
              "rounded-xl border shadow-xl",
              "bg-white dark:bg-surface-800",
              "border-surface-200 dark:border-surface-700",
              "max-h-72 flex flex-col"
            )}
          >
            {/* Search bar */}
            <div className="p-2 border-b border-surface-100 dark:border-surface-700 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-surface-400 dark:text-surface-500 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setFocusIdx(-1); }}
                onKeyDown={handleKeyDown}
                placeholder="Search requirements…"
                className={cn(
                  "flex-1 text-sm bg-transparent outline-none",
                  "text-surface-900 dark:text-surface-100",
                  "placeholder:text-surface-400 dark:placeholder:text-surface-500"
                )}
              />
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1">
              {/* Custom add row */}
              {canAddCustom && (
                <button
                  type="button"
                  data-flat-idx={flatFiltered.length}
                  onMouseDown={(e) => { e.preventDefault(); addCustom(); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left",
                    "transition-colors duration-100",
                    focusIdx === flatFiltered.length
                      ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                      : "text-primary-600 dark:text-primary-400 hover:bg-surface-50 dark:hover:bg-surface-700/60"
                  )}
                >
                  <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                  Add &ldquo;<span className="font-medium">{query.trim()}</span>&rdquo;
                </button>
              )}

              {/* No results */}
              {flatFiltered.length === 0 && !canAddCustom && (
                <p className="px-4 py-4 text-sm text-surface-400 dark:text-surface-500 text-center">
                  No results found
                </p>
              )}

              {/* Categories */}
              {REQUIREMENT_CATEGORIES.map((cat) => {
                if (!catHasResults(cat)) return null;
                const isCollapsed = collapsed[cat.id];
                const visibleItems = query.trim()
                  ? cat.items.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
                  : cat.items;

                return (
                  <div key={cat.id}>
                    {/* Category header */}
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCollapsed((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }));
                      }}
                      className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider hover:bg-surface-50 dark:hover:bg-surface-700/40 transition-colors"
                    >
                      <span>{cat.label}</span>
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Items */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          {visibleItems.map((item) => {
                            const globalIdx = flatFiltered.findIndex((f) => f.item === item);
                            const isSelected = value.includes(item);
                            const isFocused  = globalIdx === focusIdx;
                            return (
                              <button
                                type="button"
                                key={item}
                                data-flat-idx={globalIdx}
                                onMouseEnter={() => setFocusIdx(globalIdx)}
                                onMouseDown={(e) => { e.preventDefault(); toggle(item); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-6 py-2 text-sm text-left",
                                  "transition-colors duration-100",
                                  isFocused
                                    ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                                    : isSelected
                                    ? "bg-primary-50/50 dark:bg-primary-900/15 text-primary-600 dark:text-primary-400"
                                    : "text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/60"
                                )}
                              >
                                {/* Checkbox */}
                                <span
                                  className={cn(
                                    "flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                                    isSelected
                                      ? "bg-primary-500 dark:bg-primary-500 border-primary-500 dark:border-primary-500"
                                      : "border-surface-300 dark:border-surface-600"
                                  )}
                                >
                                  {isSelected && (
                                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </span>
                                <span>{highlight(item, query)}</span>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
