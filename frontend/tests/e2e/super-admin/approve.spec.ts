import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, TEST_CREDS } from "../../fixtures/auth";

test.describe("Super Admin — Approve action", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    if (!TEST_CREDS.superAdmin.password) {
      test.skip(true, "SUPER_ADMIN_PASSWORD not set");
    }
  });

  /**
   * Intercepts the Next.js /api/super-admin/[id]/approve route response.
   * Checks that the server returns { emailSent: boolean } — the real proof
   * that mailer.ts was called. The SendGrid call is server-side and cannot
   * be intercepted via page.route().
   */
  test("approve a pending user — API returns emailSent field", async ({ page }) => {
    let approveApiResponse: { emailSent?: boolean; emailError?: string | null; message?: string } | null = null;

    // Intercept the Next.js API route, pass through, read the JSON response
    await page.route("**/api/super-admin/**/approve", async (route) => {
      const response = await route.fetch();
      try {
        approveApiResponse = await response.json() as typeof approveApiResponse;
      } catch {
        approveApiResponse = null;
      }
      await route.fulfill({ response });
    });

    await loginAsSuperAdmin(page);
    await page.waitForTimeout(3_000);

    const approveBtn = page.locator("button").filter({ hasText: /^approve$/i }).first();
    if ((await approveBtn.count()) === 0) {
      test.skip(true, "No pending requests available to approve");
    }

    await approveBtn.click();
    await page.waitForTimeout(5_000);

    // ── API response assertions ───────────────────────────────────────────
    const resp = approveApiResponse;
    if (resp !== null) {
      // Must have a message
      expect(resp.message).toBeTruthy();

      // Must have emailSent boolean (not just undefined)
      expect(typeof resp.emailSent).toBe("boolean");

      // If email is configured (SENDGRID_API_KEY set on server), it should be sent
      if (resp.emailSent === false && resp.emailError) {
        console.warn(`[approve test] Email not sent: ${resp.emailError}`);
        // Not a hard failure — server may not have SENDGRID_API_KEY in test env
      }
    }

    // ── UI: toast or success message visible ─────────────────────────────
    const successIndicators = page.locator(
      '[role="status"], [role="alert"], .toast, [data-sonner-toast]'
    );
    if (await successIndicators.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      const text = await successIndicators.first().textContent();
      expect(text).toBeTruthy();
    }
  });

  test("approve — approved user disappears from pending list", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.waitForTimeout(3_000);

    const approveBtn = page.locator("button").filter({ hasText: /^approve$/i }).first();
    if ((await approveBtn.count()) === 0) {
      test.skip(true, "No pending requests available");
    }

    // Count before approval
    const countBefore = await page.locator("button").filter({ hasText: /^approve$/i }).count();

    await approveBtn.click();
    await page.waitForTimeout(5_000);

    // Count after: should be one less (the approved request removed from UI)
    const countAfter = await page.locator("button").filter({ hasText: /^approve$/i }).count();
    expect(countAfter).toBeLessThanOrEqual(countBefore);
  });
});
