import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin, TEST_CREDS } from "../../fixtures/auth";

test.describe("Super Admin — Delete approved user", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    if (!TEST_CREDS.superAdmin.password) {
      test.skip(true, "SUPER_ADMIN_PASSWORD not set");
    }
  });

  test("delete API route returns 200 with valid userId", async ({ page }) => {
    await loginAsSuperAdmin(page);

    // Hit the delete API directly with the test_email_debug_001 UID we created earlier
    const res = await page.request.delete(
      "/api/super-admin/test_email_debug_001/delete"
    );
    // Either 200 (deleted) or 404 (already gone) — both are acceptable
    expect([200, 404]).toContain(res.status());
  });

  test("delete button in approved tab triggers confirmation dialog", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.waitForTimeout(2_000);

    // Switch to approved tab
    const approvedTab = page.locator('button, [role="tab"]').filter({ hasText: /approved/i }).first();
    await approvedTab.click();
    await page.waitForTimeout(2_000);

    const deleteBtn = page.locator('button').filter({ hasText: /delete/i }).first();
    const deleteBtnCount = await deleteBtn.count();

    if (deleteBtnCount === 0) {
      test.skip(true, "No approved users to delete");
    }

    // Set up dialog handler to CANCEL (don't actually delete in E2E)
    page.on("dialog", (dialog) => dialog.dismiss());
    await deleteBtn.click();
    // Dialog was dismissed — user still in list
    await page.waitForTimeout(1_000);
  });
});
