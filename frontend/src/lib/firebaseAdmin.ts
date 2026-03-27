/**
 * Firebase Admin SDK singleton for Next.js API routes.
 * Import getAdminApp(), getAdminAuth(), getAdminDb() from here.
 *
 * Requires one of:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  – full JSON string (production / Render)
 *   FIREBASE_SERVICE_ACCOUNT_PATH  – path to JSON file (local dev)
 */

let _initialized = false;

async function ensureInitialized() {
  if (_initialized) return;

  const { getApps, initializeApp, cert } = await import("firebase-admin/app");

  if (getApps().length > 0) {
    _initialized = true;
    return;
  }

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

  _initialized = true;
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
