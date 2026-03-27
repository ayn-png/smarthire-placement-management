// This file configures the Sentry SDK on the SERVER side (Node.js / API routes).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV ?? "development",

  // Higher sample rate on server — API errors are critical
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.3 : 1.0,

  // Capture unhandled promise rejections in Next.js API routes
  integrations: [
    Sentry.captureConsoleIntegration({ levels: ["error"] }),
  ],

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
