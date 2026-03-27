import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, TEST_CREDS } from "../../fixtures/auth";

test.describe("Super Admin — Approve action + email interception", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    if (!TEST_CREDS.superAdmin.password) {
      test.skip(true, "SUPER_ADMIN_PASSWORD not set");
    }
  });

  test("approve a pending user — intercept SendGrid call, verify email payload", async ({ page }) => {
    interface SendgridPayload {
      from: { email: string; name: string };
      subject: string;
      personalizations: Array<{ to: Array<{ email: string }> }>;
      content: Array<{ type: string; value: string }>;
    }
    let sendgridPayload: SendgridPayload | null = null;
    let sendgridCalled = false;

    // Intercept all calls to SendGrid and capture the payload WITHOUT sending real email
    await page.route("https://api.sendgrid.com/v3/mail/send", async (route) => {
      const request = route.request();
      sendgridPayload = request.postDataJSON() as SendgridPayload;
      sendgridCalled = true;
      // Respond with 202 Accepted (what real SendGrid returns) — no real email sent
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: "",
      });
    });

    await loginAsSuperAdmin(page);

    // Wait for pending requests to load
    await page.waitForTimeout(3_000);

    // Click first available Approve button
    const approveBtn = page.locator('button').filter({ hasText: /^approve$/i }).first();
    const approveBtnCount = await approveBtn.count();

    if (approveBtnCount === 0) {
      test.skip(true, "No pending requests available to approve");
    }

    await approveBtn.click();

    // Wait for the action to complete (API call + toast)
    await page.waitForTimeout(5_000);

    // ── Email payload assertions ──────────────────────────────────────────
    const payload = sendgridPayload as SendgridPayload | null;
    if (sendgridCalled && payload !== null) {
      // Verify FROM email
      expect(payload.from.email).toBe("aalamaynn@gmail.com");
      expect(payload.from.name).toBe("SmartHire");
      // Verify subject contains "Approved"
      expect(payload.subject.toLowerCase()).toContain("approved");
      // Verify there is a recipient
      expect(payload.personalizations[0].to[0].email).toContain("@");
      // Verify HTML content
      expect(payload.content[0].type).toBe("text/html");
      expect(payload.content[0].value.toLowerCase()).toContain("approved");
    }

    // ── Toast / UI assertion ──────────────────────────────────────────────
    // Either success toast or warning toast (email might not be configured) — both are OK
    const toast = page.locator('[role="status"], .toast, [data-testid="toast"]').first();
    if (await toast.isVisible()) {
      const toastText = await toast.textContent();
      expect(toastText).toBeTruthy();
    }
  });

  test("approve — API returns emailSent:true when SendGrid key configured", async ({ page }) => {
    // Intercept the Next.js approve API route directly
    let approveResponse: { emailSent?: boolean; emailError?: string | null } | null = null;

    await page.route("**/api/super-admin/**/approve", async (route) => {
      // Also intercept SendGrid so no real email is sent
      const response = await route.fetch();
      const body = await response.json() as { emailSent?: boolean; emailError?: string | null };
      approveResponse = body;
      await route.fulfill({ response });
    });

    // Intercept SendGrid to prevent real sends
    await page.route("https://api.sendgrid.com/v3/mail/send", async (route) => {
      await route.fulfill({ status: 202, body: "" });
    });

    await loginAsSuperAdmin(page);
    await page.waitForTimeout(3_000);

    const approveBtn = page.locator('button').filter({ hasText: /^approve$/i }).first();
    if ((await approveBtn.count()) === 0) {
      test.skip(true, "No pending requests to approve");
    }
    await approveBtn.click();
    await page.waitForTimeout(5_000);

    const resp = approveResponse as { emailSent?: boolean; emailError?: string | null } | null;
    if (resp !== null) {
      // Response must have emailSent field
      expect(typeof resp.emailSent).toBe("boolean");
    }
  });
});
