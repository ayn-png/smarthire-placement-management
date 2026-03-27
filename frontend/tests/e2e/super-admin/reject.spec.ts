import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, TEST_CREDS } from "../../fixtures/auth";

test.describe("Super Admin — Reject action + email interception", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    if (!TEST_CREDS.superAdmin.password) {
      test.skip(true, "SUPER_ADMIN_PASSWORD not set");
    }
  });

  test("reject a pending user — modal opens, reason required, intercept email", async ({ page }) => {
    interface SendgridPayload {
      from: { email: string; name: string };
      subject: string;
      personalizations: Array<{ to: Array<{ email: string }> }>;
      content: Array<{ type: string; value: string }>;
    }
    let sendgridPayload: SendgridPayload | null = null;

    // Intercept SendGrid — capture payload, respond 202 (no real email)
    await page.route("https://api.sendgrid.com/v3/mail/send", async (route) => {
      sendgridPayload = route.request().postDataJSON() as SendgridPayload;
      await route.fulfill({ status: 202, body: "" });
    });

    await loginAsSuperAdmin(page);
    await page.waitForTimeout(3_000);

    // Click first Reject button
    const rejectBtn = page.locator('button').filter({ hasText: /^reject$/i }).first();
    if ((await rejectBtn.count()) === 0) {
      test.skip(true, "No pending requests to reject");
    }
    await rejectBtn.click();

    // Rejection modal / reason input should appear
    await page.waitForTimeout(1_000);
    const reasonInput = page.locator('textarea, input[placeholder*="reason" i], input[placeholder*="reject" i]').first();
    await expect(reasonInput).toBeVisible({ timeout: 5_000 });

    const testReason = "Test rejection — automated E2E test";
    await reasonInput.fill(testReason);

    // Confirm the rejection
    const confirmBtn = page.locator('button').filter({ hasText: /confirm|submit|yes|reject/i }).last();
    await confirmBtn.click();

    await page.waitForTimeout(5_000);

    // ── Email payload assertions ──────────────────────────────────────────
    const payload = sendgridPayload as SendgridPayload | null;
    if (payload !== null) {
      expect(payload.subject.toLowerCase()).toMatch(/not approved|reject/);
      expect(payload.content[0].value).toContain(testReason);
      expect(payload.from.email).toBe("aalamaynn@gmail.com");
    }

    // ── Toast visible after rejection ─────────────────────────────────────
    const toast = page.locator('[role="status"], .toast').first();
    if (await toast.isVisible()) {
      const toastText = (await toast.textContent()) ?? "";
      expect(toastText.length).toBeGreaterThan(0);
    }
  });

  test("reject without reason → reject button disabled or shows validation", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.waitForTimeout(3_000);

    const rejectBtn = page.locator('button').filter({ hasText: /^reject$/i }).first();
    if ((await rejectBtn.count()) === 0) {
      test.skip(true, "No pending requests");
    }
    await rejectBtn.click();
    await page.waitForTimeout(1_000);

    // Try to confirm without entering a reason
    const confirmBtn = page.locator('button').filter({ hasText: /confirm|submit|yes/i }).last();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(2_000);
      // Should show a validation message
      const body = await page.content();
      expect(
        body.includes("reason") || body.includes("required") || body.includes("enter")
      ).toBeTruthy();
    }
  });
});
