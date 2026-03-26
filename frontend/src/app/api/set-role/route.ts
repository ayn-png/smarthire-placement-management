import { NextRequest, NextResponse } from "next/server";

const VALID_ROLES = ["STUDENT", "PLACEMENT_ADMIN", "COLLEGE_MANAGEMENT"];
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

// Lazy-initialize Firebase Admin SDK
let adminAuth: import("firebase-admin/auth").Auth | null = null;

async function getAdminAuth() {
  if (adminAuth) return adminAuth;

  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");

  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountJson && serviceAccountJson.trim()) {
      // Option 1: JSON string in env var (preferred for production/CI)
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } else if (serviceAccountPath && serviceAccountPath.trim()) {
      // Option 2: path to JSON file (for local dev)
      const fs = await import("fs");
      const raw = fs.readFileSync(serviceAccountPath, "utf-8");
      const serviceAccount = JSON.parse(raw);
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      throw new Error(
        "Firebase Admin SDK not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in .env.local"
      );
    }
  }

  adminAuth = getAuth();
  return adminAuth;
}

export async function POST(request: NextRequest) {
  // Extract Firebase ID token from Authorization header
  const authHeader = request.headers.get("Authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the token with Firebase Admin
  let decodedToken: import("firebase-admin/auth").DecodedIdToken;
  try {
    const fbAuth = await getAdminAuth();
    decodedToken = await fbAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = decodedToken.uid;
  const email = decodedToken.email ?? "";
  const displayName = decodedToken.name ?? email;

  let role: string;
  try {
    const body = await request.json();
    role = body.role;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // 1. Set Firebase custom claim so the role is in the ID token
  try {
    const fbAuth = await getAdminAuth();
    // For admin roles, set claim to STUDENT until approved by super admin
    const claimRole = (role === "PLACEMENT_ADMIN" || role === "COLLEGE_MANAGEMENT") ? "STUDENT" : role;
    await fbAuth.setCustomUserClaims(uid, { role: claimRole });
  } catch (err) {
    console.error("[set-role] Failed to set custom claim:", err);
    return NextResponse.json({ error: "Failed to set role" }, { status: 500 });
  }

  // 2. Sync user record to Firestore via backend.
  //
  // NON-FATAL: if this call fails (INTERNAL_API_SECRET mismatch, backend cold
  // start, transient network error) we log the problem but still return success
  // to the client.  The Firebase custom claim (step 1) IS already set, so the
  // client can call /auth/self-sync with the freshly-refreshed token to create
  // the Firestore doc without needing X-Internal-Secret.
  //
  // We retry once after a short delay before giving up, to survive cold starts.
  const syncPayload = JSON.stringify({ firebase_uid: uid, email, full_name: displayName, role });
  const syncHeaders = {
    "Content-Type": "application/json",
    "X-Internal-Secret": INTERNAL_SECRET,
    Authorization: `Bearer ${idToken}`,
  };

  let syncOk = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const syncRes = await fetch(`${BACKEND_URL}/api/v1/auth/firebase-sync`, {
        method: "POST",
        headers: syncHeaders,
        body: syncPayload,
      });
      if (syncRes.ok) { syncOk = true; break; }
      const body = await syncRes.text().catch(() => "");
      console.warn(`[set-role] firebase-sync attempt ${attempt} returned ${syncRes.status}: ${body}`);
    } catch (networkErr) {
      console.warn(`[set-role] firebase-sync attempt ${attempt} network error:`, networkErr);
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1200));
  }

  if (!syncOk) {
    // Both attempts failed.  Custom claim is set — the client will call
    // /auth/self-sync with the fresh token to finish creating the Firestore doc.
    console.error("[set-role] firebase-sync failed after 2 attempts; client will self-sync.");
  }

  return NextResponse.json({ success: true, role, selfSyncNeeded: !syncOk });
}
