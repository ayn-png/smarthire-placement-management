"use client";
/**
 * PWAInstallPrompt — shows a bottom banner prompting users to install SmartHire.
 *
 * Android Chrome: intercepts the native `beforeinstallprompt` event and shows a
 * custom banner with an Install button.
 *
 * iOS Safari: detects iOS + not-yet-in-standalone and shows a "how to install"
 * bottom sheet (Safari doesn't fire beforeinstallprompt).
 *
 * Dismissed state is persisted in localStorage so the prompt never reappears
 * after the user explicitly closes it.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type Mode = "android" | "ios" | null;

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isInStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

const STORAGE_KEY = "pwa-prompt-dismissed";

export default function PWAInstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed or user already dismissed — do nothing
    if (isInStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    if (isIOS()) {
      // Show iOS instructions after a short delay so it doesn't pop instantly
      const t = setTimeout(() => {
        setMode("ios");
        setVisible(true);
      }, 3000);
      return () => clearTimeout(t);
    }

    // Android / Chrome Desktop: wait for the browser's deferred prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setMode("android");
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && mode === "android" && (
        <motion.div
          key="android-prompt"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
          className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-96 z-50"
        >
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-2xl p-4 flex items-center gap-3">
            {/* App icon */}
            <img
              src="/favicon-192x192.png"
              alt="SmartHire"
              className="w-12 h-12 rounded-xl flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-surface-900 dark:text-white text-sm leading-tight">
                Add SmartHire to Home Screen
              </p>
              <p className="text-surface-500 dark:text-surface-400 text-xs mt-0.5">
                Install for a faster, app-like experience
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Install
              </button>
              <button
                onClick={dismiss}
                className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {visible && mode === "ios" && (
        <motion.div
          key="ios-prompt"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
          className="fixed bottom-20 left-3 right-3 z-50"
        >
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-2xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <img
                  src="/favicon-192x192.png"
                  alt="SmartHire"
                  className="w-10 h-10 rounded-xl flex-shrink-0"
                />
                <div>
                  <p className="font-semibold text-surface-900 dark:text-white text-sm">
                    Install SmartHire
                  </p>
                  <p className="text-surface-500 dark:text-surface-400 text-xs">
                    Add to your Home Screen
                  </p>
                </div>
              </div>
              <button
                onClick={dismiss}
                className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-2 text-sm text-surface-700 dark:text-surface-300">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                <span>
                  Tap the{" "}
                  <span className="inline-flex items-center gap-1 font-medium text-primary-600 dark:text-primary-400">
                    {/* Safari share icon */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                      <polyline points="16 6 12 2 8 6"/>
                      <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                    Share
                  </span>{" "}
                  button in Safari
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                <span>Scroll down and tap <strong className="font-semibold">Add to Home Screen</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                <span>Tap <strong className="font-semibold">Add</strong> to install</span>
              </li>
            </ol>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
