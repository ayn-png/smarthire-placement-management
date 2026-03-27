import type { Page } from "@playwright/test";

// ─── Test credentials from env ────────────────────────────────────────────────
export const TEST_CREDS = {
  student: {
    email: process.env.TEST_STUDENT_EMAIL ?? "test-student@smarthire-e2e.com",
    password: process.env.TEST_STUDENT_PASSWORD ?? "TestPass123!",
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL ?? "test-admin@smarthire-e2e.com",
    password: process.env.TEST_ADMIN_PASSWORD ?? "TestPass123!",
  },
  pendingAdmin: {
    email: process.env.TEST_PENDING_ADMIN_EMAIL ?? "test-pending@smarthire-e2e.com",
    password: process.env.TEST_PENDING_ADMIN_PASSWORD ?? "TestPass123!",
  },
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL ?? "REDACTED_EMAIL",
    password: process.env.SUPER_ADMIN_PASSWORD ?? "",
  },
};

// ─── Login helpers ────────────────────────────────────────────────────────────

/** Log in as a regular student user */
export async function loginAsStudent(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_CREDS.student.email);
  await page.fill('input[type="password"]', TEST_CREDS.student.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/student/dashboard", { timeout: 15_000 });
}

/** Log in as an approved placement admin user */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_CREDS.admin.email);
  await page.fill('input[type="password"]', TEST_CREDS.admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });
}

/** Log in to the super admin panel */
export async function loginAsSuperAdmin(page: Page): Promise<void> {
  await page.goto("/super-admin/login");
  await page.fill('input[type="email"]', TEST_CREDS.superAdmin.email);
  await page.fill('input[type="password"]', TEST_CREDS.superAdmin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/super-admin", { timeout: 15_000 });
}

/** Clear all auth cookies so next test starts fresh */
export async function logout(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
}
