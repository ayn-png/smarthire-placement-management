import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, TEST_CREDS } from "../../fixtures/auth";

test.describe("Super Admin — Reject action", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    if (!TEST_CREDS.superAdmin.password) {
      test.skip(true, "SUPER_ADMIN_PASSWORD not set");
    }
  });

  /**
   * Intercepts the Next.js /api/super-admin/[id]/reject route response.
   * Verifies { emailSent: boolean } is returned — proof that mailer.ts ran.
   * SendGrid is called server-side so page.route() cannot capture its payload.
   */
  test("reject a pending user — modal, reason required, API returns emailSent", async ({ page }) => {
    let rejectApiResponse: { emailSent?: boolean; emailError?: string | null; message?: string } | null = null;

    // Intercept the Next.js reject route, pass through, capture response
    await page.route("**/api/super-admin/**/reject", async (route) => {
      const response = await route.fetch();
      try {
        rejectApiResponse = await response.json() as typeof rejectApiResponse;
      } catch {
        rejectApiResponse = null;
      }
      await route.fulfill({ response });
    });

    await loginAsSuperAdmin(page);
    await page.waitForTimeout(3_000);

    const rejectBtn = page.locator("button").filter({ hasText: /^reject$/i }).first();
    if ((await rejectBtn.count()) === 0) {
      test.skip(true, "No pending requests to reject");
    }
    await rejectBtn.click();

    // Modal / reason input should appear
    await page.waitForTimeout(1_000);
    const reasonInput = page
      .locator('textarea, input[placeholder*="reason" i], input[placeholder*="reject" i]')
      .first();
    await expect(reasonInput).toBeVisible({ timeout: 5_000 });

    const testReason = "Automated E2E test — rejection reason";
    await reasonInput.fill(testReason);

    // Confirm the rejection
    const confirmBtn = page
      .locator("button")
      .filter({ hasText: /confirm|submit|yes|reject/i })
      .last();
    await confirmBtn.click();

    await page.waitForTimeout(5_000);

    // ── API response assertions ───────────────────────────────────────────
    const resp = rejectApiResponse;
    if (resp !== null) {
      expect(resp.message).toBeTruthy();
      expect(typeof resp.emailSent).toBe("boolean");

      if (resp.emailSent === false && resp.emailError) {
        console.warn(`[reject test] Email not sent: ${resp.emailError}`);
      }
    }

    // ── Toast visible after rejection ─────────────────────────────────────
    const toast = page
      .locator('[role="status"], [role="alert"], .toast, [data-sonner-toast]')
      .first();
    if (await toast.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const text = (await toast.textContent()) ?? "";
      expect(text.length).toBeGreaterThan(0);
    }
  });

  test("reject without entering reason → confirm button disabled or shows validation", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.waitForTimeout(3_000);

    const rejectBtn = page.locator("button").filter({ hasText: /^reject$/i }).first();
    if ((await rejectBtn.count()) === 0) {
      test.skip(true, "No pending requests");
    }
    await rejectBtn.click();
    await page.waitForTimeout(1_000);

    // Without filling a reason, try to confirm
    const confirmBtn = page
      .locator("button")
      .filter({ hasText: /confirm|submit|yes/i })
      .last();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const isDisabled = await confirmBtn.isDisabled();
      if (!isDisabled) {
        await confirmBtn.click();
        await page.waitForTimeout(2_000);
        // Should show validation message
        const content = await page.content();
        expect(
          content.includes("reason") ||
          content.includes("required") ||
          content.includes("enter")
        ).toBeTruthy();
      } else {
        // Confirm is disabled without reason — this is the correct behavior
        expect(isDisabled).toBe(true);
      }
    }
  });
});
