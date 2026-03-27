/**
 * Firebase Admin SDK singleton for Next.js API routes.
 * Import getAdminAuth(), getAdminDb() from here.
 *
 * Requires one of:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  – full JSON string (production / Render)
 *   FIREBASE_SERVICE_ACCOUNT_PATH  – path to JSON file (local dev)
 *
 * Uses a promise-based lock so concurrent callers (e.g. Promise.all) never
 * call initializeApp() twice, avoiding the "duplicate-app" error.
 */

// Single promise shared by all concurrent callers during initialization
let _initPromise: Promise<void> | null = null;

async function _doInit(): Promise<void> {
  const { getApps, initializeApp, cert } = await import("firebase-admin/app");

  // Another module (e.g. set-role/route.ts) may have already initialized
  if (getApps().length > 0) return;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (json && json.trim()) {
    initializeApp({ credential: cert(JSON.parse(json)) });
  } else if (path && path.trim()) {
    const fs = await import("fs");
    const raw = fs.readFileSync(path, "utf-8");
    initializeApp({ credential: cert(JSON.parse(raw)) });
  } else {
    throw new Error(
      "Firebase Admin SDK not configured. " +
      "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH."
    );
  }
}

async function ensureInitialized() {
  if (!_initPromise) {
    _initPromise = _doInit();
  }
  await _initPromise;
}

export async function getAdminAuth() {
  await ensureInitialized();
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth();
}

export async function getAdminDb() {
  await ensureInitialized();
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore();
}
