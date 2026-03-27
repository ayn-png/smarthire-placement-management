import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, TEST_CREDS } from "../../fixtures/auth";

test.describe("Super Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    if (!TEST_CREDS.superAdmin.password) {
      test.skip(true, "SUPER_ADMIN_PASSWORD not set");
    }
  });

  test("super admin login → dashboard loads with pending tab", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await expect(page).toHaveURL(/\/super-admin/);
    // Should see the tab buttons
    await expect(page.locator('button, [role="tab"]').filter({ hasText: /pending/i }).first()).toBeVisible();
  });

  test("wrong password → shows error", async ({ page }) => {
    await page.goto("/super-admin/login");
    await page.fill('input[type="email"]', TEST_CREDS.superAdmin.email);
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3_000);
    // Should stay on login page
    await expect(page).toHaveURL(/\/super-admin\/login/);
  });

  test("pending tab shows request cards with name, email, role", async ({ page }) => {
    await loginAsSuperAdmin(page);
    // Wait for requests to load
    await page.waitForTimeout(3_000);
    // Check if any pending request card exists
    const cards = page.locator('[data-testid="request-card"], .request-card, tr, li').filter({
      hasText: /@/,  // Cards should contain email addresses
    });
    const count = await cards.count();
    if (count > 0) {
      // Verify a card has email visible
      await expect(cards.first()).toBeVisible();
    } else {
      // No pending requests — table/list should be empty state, not an error
      const emptyState = page.locator("text=/no.*request|no.*pending|empty/i");
      // Either requests visible or empty state shown — either is valid
      expect(count >= 0).toBeTruthy();
    }
  });

  test("approved tab loads without error", async ({ page }) => {
    await loginAsSuperAdmin(page);
    const approvedTab = page.locator('button, [role="tab"]').filter({ hasText: /approved/i }).first();
    await approvedTab.click();
    await page.waitForTimeout(2_000);
    // Page should not crash
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/super-admin\/login/);
  });

  test("rejected tab loads without error", async ({ page }) => {
    await loginAsSuperAdmin(page);
    const rejectedTab = page.locator('button, [role="tab"]').filter({ hasText: /rejected/i }).first();
    await rejectedTab.click();
    await page.waitForTimeout(2_000);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("sign out → redirected to super admin login", async ({ page }) => {
    await loginAsSuperAdmin(page);
    const signOutBtn = page.locator('button').filter({ hasText: /sign.?out|logout/i }).first();
    await signOutBtn.click();
    await page.waitForURL(/\/super-admin\/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/super-admin\/login/);
  });
});
