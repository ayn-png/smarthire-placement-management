/**
 * SmartHire Service Worker — PWA offline support
 *
 * Strategy:
 * - Static assets (JS, CSS, fonts, images): Cache-first with network fallback
 * - API calls: Network-first with a 3-second timeout fallback to cache
 * - Navigation requests (HTML): Network-first, fallback to /offline.html
 *
 * Cache versioning: bump CACHE_VERSION to force cache refresh on deploy.
 */

const CACHE_VERSION = "smarthire-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/favicon.svg",
  "/favicon-192x192.png",
  "/manifest.json",
];

// ── Install: pre-cache critical assets ──────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("[SW] Pre-cache failed for some assets:", err);
      });
    })
  );
  // Take control immediately without waiting for tabs to close
  self.skipWaiting();
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Claim all open clients immediately
  self.clients.claim();
});

// ── Fetch: route requests ────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and data: requests
  if (
    request.method !== "GET" ||
    url.protocol === "chrome-extension:" ||
    url.protocol === "data:"
  ) {
    return;
  }

  // SSE stream — never cache, always pass through
  if (url.pathname.includes("/notifications/stream")) {
    return;
  }

  // API requests: network-first with 3s timeout, fall back to cache.
  // IMPORTANT: only intercept SAME-ORIGIN requests (Next.js /api/* routes like
  // /api/set-role). Cross-origin backend requests (smarthire-*.onrender.com)
  // must NOT be intercepted — the SW's 3-second abort would kill them during
  // Render cold-starts and cause silent failures on every dashboard load.
  const isSameOrigin = url.origin === self.location.origin;
  if (isSameOrigin && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 3000));
    return;
  }

  // Static assets: cache-first (same-origin only).
  // Cross-origin CDN assets (Cloudinary images, Google Fonts, etc.) are skipped —
  // the browser loads them natively and the CDN handles caching. Intercepting
  // cross-origin fetches in the SW causes CSP connect-src violations and 503s.
  if (
    isSameOrigin && (
      request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "font" ||
      request.destination === "image"
    )
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation (HTML pages): network-first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match("/") || new Response("Offline", { status: 503 });
      })
    );
    return;
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Network error", { status: 503 });
  }
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    clearTimeout(timeoutId);
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ detail: "You appear to be offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
