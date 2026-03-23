"use client";
import { useRef, useState, useEffect, useCallback, KeyboardEvent } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const BRANCH_OPTIONS = [
  { label: "CSE", value: "CSE" },
  { label: "ECE", value: "ECE" },
  { label: "ME",  value: "ME"  },
  { label: "CE",  value: "CE"  },
  { label: "EE",  value: "EE"  },
  { label: "IT",  value: "IT"  },
  { label: "Other", value: "Other" },
] as const;

export type BranchValue = (typeof BRANCH_OPTIONS)[number]["value"] | "";

interface BranchSelectProps {
  value?: BranchValue;
  onChange?: (value: BranchValue) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export default function BranchSelect({
  value = "",
  onChange,
  label,
  error,
  disabled = false,
}: BranchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch]   = useState("");
  const [focusIdx, setFocusIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLUListElement>(null);

  const filtered = BRANCH_OPTIONS.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel =
    BRANCH_OPTIONS.find((o) => o.value === value)?.label ?? "";

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ── Focus search box when dropdown opens ──────────────────────────────────
  useEffect(() => {
    if (open) {
      setFocusIdx(-1);
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  // ── Scroll highlighted item into view ─────────────────────────────────────
  useEffect(() => {
    if (focusIdx >= 0 && listRef.current) {
      const item = listRef.current.children[focusIdx] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIdx]);

  // ── Select a branch ────────────────────────────────────────────────────────
  const select = useCallback(
    (val: BranchValue) => {
      onChange?.(val);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  // ── Keyboard handler on the search input ──────────────────────────────────
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (focusIdx >= 0 && filtered[focusIdx]) {
          select(filtered[focusIdx].value);
        }
        break;
      case "Escape":
        setOpen(false);
        setSearch("");
        break;
    }
  }

  // ── Keyboard handler on the trigger button ────────────────────────────────
  function handleTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (["Enter", " ", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-surface-600 dark:text-surface-300 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2",
          "px-3.5 py-2.5 border rounded-xl text-sm transition-all duration-200 text-left",
          "bg-white dark:bg-surface-900",
          "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
          "dark:focus:ring-primary-400/20 dark:focus:border-primary-400",
          error
            ? "border-red-400 bg-red-50/50 dark:bg-red-950/20 dark:border-red-500"
            : "border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "truncate",
            selectedLabel
              ? "text-surface-900 dark:text-surface-100"
              : "text-surface-400 dark:text-surface-500"
          )}
        >
          {selectedLabel || "Select branch…"}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 flex-shrink-0 text-surface-400 dark:text-surface-500 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute z-50 mt-1.5 w-full min-w-[180px]",
              "rounded-xl border shadow-xl",
              "bg-white dark:bg-surface-800",
              "border-surface-200 dark:border-surface-700"
            )}
          >
            {/* Search box */}
            <div className="p-2 border-b border-surface-100 dark:border-surface-700">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setFocusIdx(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search branch…"
                className={cn(
                  "w-full px-3 py-1.5 text-sm rounded-lg",
                  "bg-surface-50 dark:bg-surface-900",
                  "border border-surface-200 dark:border-surface-600",
                  "text-surface-900 dark:text-surface-100",
                  "placeholder:text-surface-400 dark:placeholder:text-surface-500",
                  "focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-400/30"
                )}
              />
            </div>

            {/* Options list */}
            <ul
              ref={listRef}
              role="listbox"
              aria-label="Branch options"
              className="py-1 max-h-52 overflow-y-auto"
            >
              {filtered.length === 0 ? (
                <li className="px-4 py-2.5 text-sm text-surface-400 dark:text-surface-500 text-center">
                  No results
                </li>
              ) : (
                filtered.map((option, idx) => {
                  const isSelected = option.value === value;
                  const isFocused  = idx === focusIdx;
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setFocusIdx(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault(); // prevent blur on search input
                        select(option.value);
                      }}
                      className={cn(
                        "flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer",
                        "transition-colors duration-100",
                        isFocused
                          ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                          : isSelected
                          ? "bg-primary-50/60 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                          : "text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/60"
                      )}
                    >
                      <span className="font-medium">{option.label}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-primary-500 dark:text-primary-400 flex-shrink-0" />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation error (matches Input component style) */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5 text-xs text-red-500 dark:text-red-400"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
