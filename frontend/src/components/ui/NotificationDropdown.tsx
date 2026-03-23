"use client";
/**
 * Feature 11 — In-App Notification Dropdown
 * Polls every 60 seconds for notifications; marks items as read on click.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Bell, CheckCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { notificationService } from "@/services/api";
import { AppNotification } from "@/types";
import { formatDate } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const POLL_INTERVAL_MS = 60_000;   // Fallback poll — every 60 s while SSE is live
const SSE_RETRY_DELAY_MS = 15_000; // Wait before reconnecting a broken SSE stream

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  // === TESTING MODE — getToken stubbed out (SSE uses X-Test-Role via Axios instead) ===
  // const { getToken } = useAuth();
  const getToken = async () => null as string | null;
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch notifications (available for both initial load and manual refresh) ──
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!mountedRef.current) return;
    if (!silent) setLoading(true);
    try {
      const data = await notificationService.list();
      if (mountedRef.current) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      // silently fail — notifications are best-effort
    } finally {
      if (mountedRef.current && !silent) setLoading(false);
    }
  }, []);

  // Initial load + SSE connect + fallback polling
  useEffect(() => {
    mountedRef.current = true;

    // ── SSE connection ─────────────────────────────────────────────────────
    async function connectSSE() {
      // Tear down any existing connection first
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (!mountedRef.current) return;

      try {
        const token = await getTokenRef.current();
        if (!token || !mountedRef.current) return; // Not authenticated yet — polling will handle it

        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch(`${API_URL}/api/v1/notifications/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok || !response.body || !mountedRef.current) {
          // SSE not available — fall back to polling only
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const pump = async () => {
          try {
            while (mountedRef.current) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? ""; // Keep incomplete last line

              let currentEvent = "";
              let currentData = "";

              for (const line of lines) {
                if (line.startsWith("event:")) {
                  currentEvent = line.slice(6).trim();
                } else if (line.startsWith("data:")) {
                  currentData = line.slice(5).trim();
                } else if (line === "" && currentEvent && currentData) {
                  // Dispatch the event
                  try {
                    const payload = JSON.parse(currentData);
                    if (currentEvent === "notification") {
                      // Prepend the new notification
                      setNotifications((prev) => {
                        // Deduplicate by id
                        if (prev.some((n) => n.id === payload.id)) return prev;
                        return [payload as AppNotification, ...prev];
                      });
                      if (!payload.read) {
                        setUnreadCount((c) => c + 1);
                      }
                    } else if (currentEvent === "connected") {
                      // Sync unread count from server on connect
                      if (typeof payload.unread_count === "number") {
                        setUnreadCount(payload.unread_count);
                      }
                    }
                  } catch {
                    // Ignore malformed SSE data frames
                  }
                  currentEvent = "";
                  currentData = "";
                }
              }
            }
          } catch {
            // Stream ended or errored — schedule reconnect if still mounted
          }
          // Schedule reconnect if still mounted
          if (mountedRef.current) {
            retryTimerRef.current = setTimeout(connectSSE, SSE_RETRY_DELAY_MS);
          }
        };

        pump();
      } catch {
        // Network error or token fetch failure — retry later if still mounted
        if (mountedRef.current) {
          retryTimerRef.current = setTimeout(connectSSE, SSE_RETRY_DELAY_MS);
        }
      }
    }

    fetchNotifications();
    connectSSE();

    // Fallback polling — syncs state in case SSE misses anything
    const interval = setInterval(() => fetchNotifications(true), POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchNotifications]); // Now safe to include fetchNotifications as it's memoized

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Optimistically mark one notification as read, then persist to the backend.
   * Called both by the explicit ✓ button AND by clicking the notification row.
   * The `e` parameter is optional so this can be called without a MouseEvent.
   */
  function markOneRead(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    // DB#12 — only decrement if the notification was actually unread
    const notif = notifications.find((n) => n.id === id);
    if (!notif || notif.read) return;
    // Optimistic state update — instant badge decrease
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    // Persist in background (fire-and-forget — notification is best-effort)
    notificationService.markRead(id).catch(() => {});
  }

  async function handleMarkAllRead() {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }

  /**
   * Called when the user clicks a notification row.
   * Marks as read (if unread) and closes the dropdown.
   * Navigation (if the notification has a link) is handled by the <Link> wrapper.
   */
  function handleNotificationClick(notification: AppNotification) {
    if (!notification.read) {
      markOneRead(notification.id);
    }
    setOpen(false);
  }

  function handleOpen() {
    setOpen((prev) => !prev);
    if (!open) fetchNotifications();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
      >
        <Bell className="w-5 h-5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-surface-900"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-12 w-80 sm:w-96 bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-700">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span className="font-semibold text-sm text-surface-900 dark:text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded-full font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    title="Mark all as read"
                    className="p-1.5 text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-700">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Bell className="w-8 h-8 text-surface-300 dark:text-surface-600" />
                  <p className="text-sm text-surface-400 dark:text-surface-500">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={(e) => markOneRead(n.id, e)}
                    onItemClick={() => handleNotificationClick(n)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-surface-100 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
                <p className="text-xs text-center text-surface-400 dark:text-surface-500">
                  Showing last {notifications.length} notifications
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────
function NotificationItem({
  notification: n,
  onMarkRead,
  onItemClick,
}: {
  notification: AppNotification;
  /** Called by the explicit ✓ button — stops propagation so the row click is ignored */
  onMarkRead: (e: React.MouseEvent) => void;
  /** Called when the user clicks anywhere on the row — marks as read + closes dropdown */
  onItemClick: () => void;
}) {
  const inner = (
    <div
      onClick={onItemClick}
      className={`relative flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer
        ${n.read
          ? "hover:bg-surface-50 dark:hover:bg-surface-700/50"
          : "bg-primary-50/50 dark:bg-primary-950/20 hover:bg-primary-50 dark:hover:bg-primary-950/30"
        }`}
    >
      {/* Unread indicator dot */}
      {!n.read && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
      )}
      <div className="pl-2 flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${n.read ? "text-surface-700 dark:text-surface-300" : "text-surface-900 dark:text-white"}`}>
          {n.title}
        </p>
        <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">{n.message}</p>
        <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-1">{formatDate(n.created_at)}</p>
      </div>
      {/* Explicit "mark as read" button — stopPropagation prevents double-firing onItemClick */}
      {!n.read && (
        <button
          onClick={onMarkRead}
          title="Mark as read"
          className="shrink-0 p-1 text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors"
        >
          <CheckCheck className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  // For notifications with a navigation link, wrap in <Link> so clicking
  // both navigates AND marks as read (via onItemClick on the inner div).
  if (n.link) {
    return <Link href={n.link}>{inner}</Link>;
  }
  return <div>{inner}</div>;
}
