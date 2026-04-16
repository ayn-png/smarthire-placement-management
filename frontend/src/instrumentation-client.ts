import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment tag — "production" on Render, "development" locally
  environment: process.env.NODE_ENV ?? "development",

  // Sample 20% of requests for performance monitoring (saves quota)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Capture 100% of sessions that produce an error
  replaysOnErrorSampleRate: 1.0,

  // Sample 5% of all sessions for replay (background monitoring)
  replaysSessionSampleRate: 0.05,

  integrations: [
    // Session Replay — records screen captures on error
    Sentry.replayIntegration({
      maskAllText: true,      // GDPR: mask all text in replays
      blockAllMedia: false,
    }),
    // Capture console.error as Sentry breadcrumbs
    Sentry.breadcrumbsIntegration({ console: true }),
  ],

  // Ignore common noise errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    /^Network request failed/,
    /^Failed to fetch/,
    /^Load failed/,
  ],

  // Don't send errors in development (set NEXT_PUBLIC_SENTRY_DSN to enable locally)
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
