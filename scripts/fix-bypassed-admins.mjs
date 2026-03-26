/**
 * fix-bypassed-admins.mjs
 *
 * Retroactively fix users who signed up as PLACEMENT_ADMIN / COLLEGE_MANAGEMENT
 * BEFORE the super-admin gatekeeper was deployed.
 *
 * These users currently:
 *   - Have PLACEMENT_ADMIN / COLLEGE_MANAGEMENT Firebase custom claims (active login)
 *   - Have NO admin_requests doc in Firestore (bypassed approval)
 *   - Have role=PLACEMENT_ADMIN in users collection (isVerifiedAdmin: undefined)
 *
 * This script:
 *   1. Finds all such users
 *   2. Resets their Firebase custom claim to STUDENT (blocks login until approved)
 *   3. Creates admin_requests doc with status "pending" so super admin can approve
 *   4. Updates users collection: role=STUDENT, isVerifiedAdmin=false
 *
 * Run: node scripts/fix-bypassed-admins.mjs
 * (from D:\Placement Management directory)
 */

import { readFileSync } from "fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const SA_PATH = "D:/Placement Management/backend/firebase-service-account.json";

if (getApps().length === 0) {
  const sa = JSON.parse(readFileSync(SA_PATH, "utf-8"));
  initializeApp({ credential: cert(sa) });
}

const auth = getAuth();
const db = getFirestore();

async function main() {
  console.log("Scanning Firebase Auth for bypassed admin users...\n");

  const allUsers = [];
  let nextPageToken;
  do {
    const result = await auth.listUsers(100, nextPageToken);
    allUsers.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  const adminRoles = ["PLACEMENT_ADMIN", "COLLEGE_MANAGEMENT"];
  const bypassed = allUsers.filter(
    (u) => u.customClaims && adminRoles.includes(u.customClaims.role)
  );

  console.log(`Found ${bypassed.length} users with direct admin claims.\n`);

  let fixed = 0;
  let skipped = 0;

  for (const user of bypassed) {
    const { uid, email, displayName } = user;
    const claimedRole = user.customClaims.role;

    // Check if admin_requests doc already exists
    const reqDoc = await db.collection("admin_requests").doc(uid).get();
    if (reqDoc.exists) {
      const status = (reqDoc.data() || {}).status;
      console.log(`SKIP ${email} — already has admin_requests doc (status: ${status})`);
      skipped++;
      continue;
    }

    console.log(`FIXING ${email} (${claimedRole})...`);

    const now = new Date();

    // 1. Reset Firebase claim to STUDENT
    await auth.setCustomUserClaims(uid, { role: "STUDENT" });
    console.log(`  ✓ Reset claim: ${claimedRole} → STUDENT`);

    // 2. Create admin_requests doc
    await db.collection("admin_requests").doc(uid).set({
      userId: uid,
      email: email || "",
      full_name: displayName || email || "",
      requestedRole: claimedRole,
      status: "pending",
      createdAt: now,
      approvedBy: null,
      approvedAt: null,
    });
    console.log(`  ✓ Created admin_requests doc (status: pending)`);

    // 3. Update users collection
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      await userRef.update({
        role: "STUDENT",
        isVerifiedAdmin: false,
        is_active: false,
        updated_at: now,
      });
      console.log(`  ✓ Updated users doc: role=STUDENT, isVerifiedAdmin=false`);
    } else {
      await userRef.set({
        email: email || "",
        full_name: displayName || email || "",
        role: "STUDENT",
        isVerifiedAdmin: false,
        is_active: false,
        created_at: now,
        updated_at: now,
      });
      console.log(`  ✓ Created users doc`);
    }

    fixed++;
  }

  console.log(`\nDone. Fixed: ${fixed}, Skipped (already had doc): ${skipped}`);
  console.log("These users will now appear as PENDING in the super admin dashboard.");
  console.log("They cannot log in until the super admin approves them.");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
