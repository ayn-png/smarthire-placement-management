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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // data: needed for icon/web fonts embedded as data URIs
      "font-src 'self' https://fonts.gstatic.com data:",
      // Cloudinary for uploaded images/avatars/logos; localhost only in dev
      `img-src 'self' data: blob: https://res.cloudinary.com${DEV_BACKEND} https://*.onrender.com`,
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
      // res.cloudinary.com allows inline PDF resume viewing via <iframe>.
      "frame-src https://*.firebaseapp.com https://accounts.google.com https://res.cloudinary.com",
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
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
