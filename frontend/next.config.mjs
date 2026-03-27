// @ts-check
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// In production, localhost:8000 must NOT appear in CSP — it is meaningless
// in a cloud deployment and pollutes the security policy.
const DEV_BACKEND = IS_PRODUCTION ? "" : " http://localhost:8000";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Firebase SDK needs unsafe-inline/unsafe-eval; blob: for service worker
      // Google Sign-In loads scripts from apis.google.com and www.gstatic.com
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://apis.google.com https://www.gstatic.com",
      // Google Sign-In injects styles; fonts.googleapis.com for web fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
      // data: needed for icon/web fonts embedded as data URIs
      "font-src 'self' https://fonts.gstatic.com data:",
      // Cloudinary for uploaded images/avatars/logos; Google profile photos; localhost only in dev
      `img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://www.gstatic.com${DEV_BACKEND} https://*.onrender.com`,
      // Firebase Auth: identitytoolkit + securetoken (token refresh)
      // Firebase Firestore: firestore.googleapis.com
      // Firebase Auth domain: *.firebaseapp.com (used for OAuth redirect flows)
      // LangSmith tracing; local backend only in dev
      `connect-src 'self'${DEV_BACKEND} ` +
        "https://identitytoolkit.googleapis.com " +
        "https://securetoken.googleapis.com " +
        "https://firestore.googleapis.com " +
        "https://*.firebaseapp.com " +
        "https://*.googleapis.com " +
        "https://api.smith.langchain.com " +
        "https://*.onrender.com",
      // Firebase Auth uses an iframe for redirect-based OAuth flows.
      // accounts.google.com + apis.google.com needed for Google Sign-In popup.
      // res.cloudinary.com allows inline PDF resume viewing via <iframe>.
      "frame-src https://*.firebaseapp.com https://accounts.google.com https://apis.google.com https://res.cloudinary.com",
      // Service worker needs blob: and 'self'
      "worker-src blob: 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  // HSTS only in production to avoid browser lock-in during dev
  ...(IS_PRODUCTION
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig = {
  images: {
    remotePatterns: [
      // localhost only needed in development (Render filesystem is remote)
      ...(IS_PRODUCTION ? [] : [{ protocol: "http", hostname: "localhost" }]),
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.onrender.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    // IMPORTANT: Use `fallback` so Next.js checks its own API routes first
    // (e.g. /api/super-admin/[userId]/approve|reject|delete).
    // Default array (`afterFiles`) intercepts dynamic routes before Next.js
    // resolves them, causing 404s on FastAPI for routes it doesn't own.
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/api/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
        },
      ],
    };
  },
};

// Wrap with Sentry only when DSN is configured — zero overhead otherwise
const hasSentry = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

export default hasSentry
  ? withSentryConfig(nextConfig, {
      // Sentry organisation + project (set these after creating your project)
      org: process.env.SENTRY_ORG ?? "",
      project: process.env.SENTRY_PROJECT ?? "smarthire-frontend",

      // Auth token for source map uploads (set SENTRY_AUTH_TOKEN in Render)
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Suppresses Sentry CLI output during builds
      silent: !process.env.CI,

      // Upload source maps in production for readable stack traces
      sourcemaps: { disable: !IS_PRODUCTION },

      // Automatically instrument Next.js data fetchers + API routes
      autoInstrumentServerFunctions: true,
      autoInstrumentMiddleware: true,
      autoInstrumentAppDirectory: true,

      // Reduce bundle size — tree-shake unused Sentry integrations
      disableLogger: true,
      widenClientFileUpload: true,
    })
  : nextConfig;
