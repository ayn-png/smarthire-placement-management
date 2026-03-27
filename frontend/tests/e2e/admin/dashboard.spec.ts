import { test, expect } from "@playwright/test";
import { loginAsAdmin, TEST_CREDS } from "../../fixtures/auth";

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    if (!TEST_CREDS.admin.password) {
      test.skip(true, "TEST_ADMIN_EMAIL/PASSWORD not set");
    }
  });

  test("admin dashboard loads after approved admin login", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    // Should see the dashboard content
    await page.waitForTimeout(3_000);
    await expect(page.locator("main, [data-testid='dashboard']").first()).toBeVisible();
  });

  test("admin students page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/students");
    await expect(page).toHaveURL(/\/admin\/students/);
    const resp = await page.waitForResponse("**/api/v1/students**");
    expect(resp.status()).toBe(200);
  });

  test("admin jobs page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/jobs");
    await expect(page).toHaveURL(/\/admin\/jobs/);
    await page.waitForTimeout(2_000);
    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
  });

  test("analytics API returns system status", async ({ page }) => {
    await loginAsAdmin(page);
    // Call system status directly via page.request (shares cookies)
    const resp = await page.request.get(
      `${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8000"}/api/v1/analytics/system-status`
    );
    expect(resp.status()).toBe(200);
    const data = await resp.json() as { smtp?: unknown; openai?: unknown; mistral?: unknown };
    expect(data).toHaveProperty("smtp");
    expect(data).toHaveProperty("openai");
    expect(data).toHaveProperty("mistral");
  });
});
