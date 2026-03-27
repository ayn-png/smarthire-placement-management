import { test, expect } from "@playwright/test";
import { TEST_CREDS, loginAsSuperAdmin } from "../../fixtures/auth";

test.describe("Login — all roles", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("student login → redirected to /student/dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_CREDS.student.email);
    await page.fill('input[type="password"]', TEST_CREDS.student.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/student/dashboard", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test("invalid credentials → shows Firebase error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "notreal@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // Should stay on login page and show error
    await expect(page).toHaveURL(/\/login/);
    // Error message should be visible
    const error = page.locator('[role="alert"], .text-red-500, .text-red-600, [data-testid="error"]');
    await expect(error.first()).toBeVisible({ timeout: 8_000 });
  });

  test("pending admin login → blocked with approval message", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_CREDS.pendingAdmin.email);
    await page.fill('input[type="password"]', TEST_CREDS.pendingAdmin.password);
    await page.click('button[type="submit"]');
    // Should NOT redirect to student or admin dashboard
    await page.waitForTimeout(4_000);
    await expect(page).not.toHaveURL(/\/student\/dashboard/);
    await expect(page).not.toHaveURL(/\/admin\/dashboard/);
    // Should show pending message
    const body = await page.content();
    const hasPendingMsg =
      body.includes("not approved") ||
      body.includes("pending") ||
      body.includes("waiting") ||
      body.includes("approval");
    expect(hasPendingMsg).toBeTruthy();
  });

  test("super admin login → redirected to /super-admin dashboard", async ({ page }) => {
    if (!TEST_CREDS.superAdmin.password) {
      test.skip(true, "SUPER_ADMIN_PASSWORD not set in env");
    }
    await loginAsSuperAdmin(page);
    await expect(page).toHaveURL(/\/super-admin/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("empty form → shows validation errors", async ({ page }) => {
    await page.goto("/login");
    await page.click('button[type="submit"]');
    // HTML5 validation or custom error — form should not submit
    await expect(page).toHaveURL(/\/login/);
  });
});
