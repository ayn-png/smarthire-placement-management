"use client";
/**
 * ServiceWorkerRegistrar — registers the PWA service worker on mount.
 * Only runs in production to avoid cache interference during development.
 * Placed inside <ThemeProvider> so it mounts after hydration.
 */
import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.info("[SW] Registered successfully:", registration.scope);
        // Check for updates immediately and then on each page focus
        registration.update();
        const handleFocus = () => registration.update();
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
      })
      .catch((err) => {
        // Non-fatal — app works without SW
        console.warn("[SW] Registration failed:", err);
      });
  }, []);

  return null; // No UI — purely side-effect
}
