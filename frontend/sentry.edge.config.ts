// This file configures Sentry for Next.js Edge Runtime (middleware).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
