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

  const isAdminRole = role === "PLACEMENT_ADMIN" || role === "COLLEGE_MANAGEMENT";

  // 1. Set Firebase custom claim.
  //    Admin roles get STUDENT claim until super admin approves them.
  try {
    const fbAuth = await getAdminAuth();
    const claimRole = isAdminRole ? "STUDENT" : role;
    await fbAuth.setCustomUserClaims(uid, { role: claimRole });
  } catch (err) {
    console.error("[set-role] Failed to set custom claim:", err);
    return NextResponse.json({ error: "Failed to set role" }, { status: 500 });
  }

  // 2. For admin roles: ALWAYS write admin_requests + users docs directly via
  //    Firestore Admin SDK — guaranteed creation regardless of backend state.
  //    This runs BEFORE firebase-sync so the doc always exists.
  if (isAdminRole) {
    try {
      const { getFirestore } = await import("firebase-admin/firestore");
      const db = getFirestore();
      const now = new Date();

      // Check if already approved — don't overwrite approved users
      const existing = await db.collection("admin_requests").doc(uid).get();
      const existingStatus = existing.exists ? (existing.data() || {}).status : null;

      if (existingStatus !== "approved" && existingStatus !== "deleted") {
        await db.collection("admin_requests").doc(uid).set({
          userId: uid,
          email,
          full_name: displayName,
          requestedRole: role,
          status: "pending",
          createdAt: now,
          approvedBy: null,
          approvedAt: null,
        }, { merge: true });
        await db.collection("users").doc(uid).set({
          email,
          full_name: displayName,
          role: "STUDENT",
          isVerifiedAdmin: false,
          is_active: false,
          created_at: now,
          updated_at: now,
        }, { merge: true });
        console.log("[set-role] admin_requests + users docs written for", email);
      } else {
        console.log("[set-role] Skipped write — user already has status:", existingStatus);
      }
    } catch (fsErr) {
      // Log but don't fail — custom claim is already set, backend sync below may recover
      console.error("[set-role] Firestore write failed:", fsErr);
    }
  }

  // 3. Also call backend firebase-sync (non-fatal — handles email notifications
  //    and any other server-side side effects; doc already written above).
  let syncOk = false;
  const syncPayload = JSON.stringify({ firebase_uid: uid, email, full_name: displayName, role });
  const syncHeaders = {
    "Content-Type": "application/json",
    "X-Internal-Secret": INTERNAL_SECRET,
    Authorization: `Bearer ${idToken}`,
  };
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
    console.warn("[set-role] firebase-sync failed — Firestore docs already written directly.");
  }

  return NextResponse.json({ success: true, role, selfSyncNeeded: !syncOk });
}
