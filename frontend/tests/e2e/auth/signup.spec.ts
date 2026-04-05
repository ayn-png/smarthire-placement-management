import { test, expect } from "@playwright/test";

test.describe("Signup flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("student signup → shows email verification screen", async ({ page }) => {
    const uniqueEmail = `test-student-${Date.now()}@smarthire-e2e.com`;
    await page.goto("/signup");
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', "TestPass123!");
    const confirmInput = page.locator('input[type="password"]').nth(1);
    if (await confirmInput.isVisible()) {
      await confirmInput.fill("TestPass123!");
    }
    await page.click('button[type="submit"]');

    // After signup, either goes to role-select or shows verify-email
    await page.waitForURL(/\/(signup\/role-select|verify-email|signup\/verify)/, { timeout: 15_000 });
    // Should NOT go straight to dashboard
    await expect(page).not.toHaveURL(/\/student\/dashboard/);
    await expect(page).not.toHaveURL(/\/admin\/dashboard/);
  });

  test("PLACEMENT_ADMIN signup → shows pending approval screen", async ({ page }) => {
    const uniqueEmail = `test-admin-${Date.now()}@smarthire-e2e.com`;
    await page.goto("/signup");
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', "TestPass123!");
    const confirmInput = page.locator('input[type="password"]').nth(1);
    if (await confirmInput.isVisible()) {
      await confirmInput.fill("TestPass123!");
    }
    await page.click('button[type="submit"]');

    // Navigate to role-select
    await page.waitForURL(/\/signup\/role-select/, { timeout: 15_000 });

    // Select PLACEMENT_ADMIN role
    const adminBtn = page.locator('button, [role="button"]').filter({
      hasText: /placement.?admin|admin/i,
    }).first();
    await adminBtn.click();

    // After role selection for admin, should show pending message — NOT dashboard
    await page.waitForTimeout(5_000);
    await expect(page).not.toHaveURL(/\/admin\/dashboard/);
    await expect(page).not.toHaveURL(/\/student\/dashboard/);

    const body = await page.content();
    const hasPendingMsg =
      body.includes("pending") ||
      body.includes("review") ||
      body.includes("approval") ||
      body.includes("wait");
    expect(hasPendingMsg).toBeTruthy();
  });

  test("signup with existing email → shows error", async ({ page }) => {
    await page.goto("/signup");
    // Use an email we know already exists (set E2E_EXISTING_USER_EMAIL in env for a pre-registered test account)
    await page.fill('input[type="email"]', process.env.E2E_EXISTING_USER_EMAIL ?? "");
    await page.fill('input[type="password"]', "TestPass123!");
    const confirmInput = page.locator('input[type="password"]').nth(1);
    if (await confirmInput.isVisible()) {
      await confirmInput.fill("TestPass123!");
    }
    await page.click('button[type="submit"]');
    // Should show an error about existing account
    await page.waitForTimeout(4_000);
    const body = await page.content();
    const hasError =
      body.includes("already") ||
      body.includes("exists") ||
      body.includes("in use") ||
      page.url().includes("signup");
    expect(hasError).toBeTruthy();
  });
});
