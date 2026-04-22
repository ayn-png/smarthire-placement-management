"use client";
import { useRef, useState, useEffect, useCallback, KeyboardEvent } from "react";
import { X, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const BRANCH_OPTIONS = [
  { label: "All Branches", value: "All Branches" },
  { label: "CSE",   value: "CSE"   },
  { label: "ECE",   value: "ECE"   },
  { label: "ME",    value: "ME"    },
  { label: "CE",    value: "CE"    },
  { label: "EE",    value: "EE"    },
  { label: "IT",    value: "IT"    },
  { label: "AI",    value: "AI"    },
  { label: "Other", value: "Other" },
] as const;

const ALL = "All Branches";

interface AllowedBranchesSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
}

export default function AllowedBranchesSelect({
  value,
  onChange,
  label = "Allowed Branches",
}: AllowedBranchesSelectProps) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const [focusIdx, setFocusIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLUListElement>(null);

  const allSelected = value.includes(ALL);

  const filtered = BRANCH_OPTIONS.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  // ── Outside click ────────────────────────────────────────────────────────────
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // ── Focus search on open ─────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setFocusIdx(-1);
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  // ── Scroll focused item into view ────────────────────────────────────────────
  useEffect(() => {
    if (focusIdx >= 0 && listRef.current) {
      const el = listRef.current.children[focusIdx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIdx]);

  // ── Toggle ───────────────────────────────────────────────────────────────────
  const toggle = useCallback(
    (val: string) => {
      if (val === ALL) {
        // Selecting "All Branches" clears everything else
        onChange(value.includes(ALL) ? [] : [ALL]);
        return;
      }
      if (allSelected) {
        // Deselecting individual branch when "All" was selected → switch to all except this
        const specific = BRANCH_OPTIONS.filter((o) => o.value !== ALL && o.value !== val).map((o) => o.value);
        onChange(specific);
        return;
      }
      const next = value.includes(val)
        ? value.filter((v) => v !== val)
        : [...value, val];
      onChange(next);
    },
    [value, onChange, allSelected]
  );

  // ── Remove chip ──────────────────────────────────────────────────────────────
  const removeChip = useCallback(
    (val: string) => {
      onChange(value.filter((v) => v !== val));
    },
    [value, onChange]
  );

  // ── Keyboard on search ───────────────────────────────────────────────────────
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
        if (focusIdx >= 0 && filtered[focusIdx]) toggle(filtered[focusIdx].value);
        break;
      case "Escape":
        setOpen(false);
        setSearch("");
        break;
    }
  }

  // ── Keyboard on trigger ──────────────────────────────────────────────────────
  function handleTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (["Enter", " ", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  }

  const displayChips = value.map((v) => BRANCH_OPTIONS.find((o) => o.value === v)?.label ?? v);

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "min-h-[44px] w-full flex flex-wrap items-center gap-1.5 px-3 py-2 text-left",
          "border rounded-xl text-sm transition-all duration-200",
          "bg-white dark:bg-surface-800",
          "border-surface-300 dark:border-surface-600",
          "hover:border-surface-400 dark:hover:border-surface-500",
          "focus:outline-none",
          open && "ring-2 ring-primary-500/20 border-primary-500 dark:ring-primary-400/20 dark:border-primary-400"
        )}
      >
        {/* Chips */}
        {displayChips.length > 0 ? (
          <>
            {displayChips.map((chip, i) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 rounded-lg text-xs font-medium"
              >
                {chip}
                <span
                  role="button"
                  tabIndex={-1}
                  onMouseDown={(e) => { e.preventDefault(); removeChip(value[i]); }}
                  className="hover:text-primary-600 dark:hover:text-primary-300 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </span>
              </span>
            ))}
            <span className="text-surface-400 dark:text-surface-500 text-xs ml-1">
              {value.length} selected
            </span>
          </>
        ) : (
          <span className="text-surface-400 dark:text-surface-500 text-sm">
            Select branches… (empty = all allowed)
          </span>
        )}

        <ChevronDown
          className={cn(
            "w-4 h-4 flex-shrink-0 text-surface-400 dark:text-surface-500 ml-auto transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute z-50 mt-1.5 w-full min-w-[200px]",
              "rounded-xl border shadow-xl",
              "bg-white dark:bg-surface-800",
              "border-surface-200 dark:border-surface-700"
            )}
          >
            {/* Search */}
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

            {/* "All Branches" banner note */}
            {allSelected && (
              <p className="px-4 pt-2 pb-0 text-xs text-amber-600 dark:text-amber-400 font-medium">
                "All Branches" selected — individual selections disabled
              </p>
            )}

            {/* List */}
            <ul ref={listRef} role="listbox" aria-multiselectable="true" className="py-1 max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-surface-400 dark:text-surface-500 text-center">No results</li>
              ) : (
                filtered.map((option, idx) => {
                  const isSelected = value.includes(option.value);
                  const isFocused  = idx === focusIdx;
                  const isDisabled = allSelected && option.value !== ALL;
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={isDisabled}
                      onMouseEnter={() => !isDisabled && setFocusIdx(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!isDisabled) toggle(option.value);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer",
                        "transition-colors duration-100",
                        isDisabled
                          ? "opacity-40 cursor-not-allowed"
                          : isFocused
                          ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                          : isSelected
                          ? "bg-primary-50/60 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                          : "text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/60",
                        option.value === ALL && "font-semibold border-b border-surface-100 dark:border-surface-700"
                      )}
                    >
                      {/* Checkbox */}
                      <span
                        className={cn(
                          "flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-primary-500 border-primary-500"
                            : "border-surface-300 dark:border-surface-600"
                        )}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      <span>{option.label}</span>
                    </li>
                  );
                })
              )}
            </ul>

            {/* Footer */}
            {value.length > 0 && (
              <div className="px-4 py-2.5 border-t border-surface-100 dark:border-surface-700 flex items-center justify-between">
                <span className="text-xs text-surface-500 dark:text-surface-400">
                  {value.length} selected
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange([]); }}
                  className="text-xs text-red-500 dark:text-red-400 hover:underline transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
