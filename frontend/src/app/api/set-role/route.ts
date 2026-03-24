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
    await fbAuth.setCustomUserClaims(uid, { role });
  } catch (err) {
    console.error("[set-role] Failed to set custom claim:", err);
    return NextResponse.json({ error: "Failed to set role" }, { status: 500 });
  }

  // 2. Sync user record to Firestore via backend — FATAL if it fails.
  // Without this the Firestore users/{uid} doc is never created, and every
  // subsequent authenticated API call returns 401 "Could not validate credentials".
  let syncRes: Response;
  try {
    syncRes = await fetch(`${BACKEND_URL}/api/v1/auth/firebase-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        firebase_uid: uid,
        email,
        full_name: displayName,
        role,
      }),
    });
  } catch (networkErr) {
    console.error("[set-role] Network error syncing user to backend:", networkErr);
    return NextResponse.json(
      { error: "Failed to create your account record. Please try again." },
      { status: 500 }
    );
  }

  if (!syncRes.ok) {
    const body = await syncRes.text().catch(() => "");
    console.error(`[set-role] firebase-sync returned ${syncRes.status}: ${body}`);
    return NextResponse.json(
      { error: "Failed to create your account record. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, role });
}
