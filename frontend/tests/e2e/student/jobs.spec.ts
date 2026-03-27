import { test, expect } from "@playwright/test";
import { loginAsStudent, TEST_CREDS } from "../../fixtures/auth";

test.describe("Student Jobs", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    if (!TEST_CREDS.student.password) {
      test.skip(true, "TEST_STUDENT_PASSWORD not set");
    }
  });

  test("jobs list page loads after student login", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/student/jobs");
    await expect(page).toHaveURL(/\/student\/jobs/);
    // Should not be a blank page
    await page.waitForTimeout(3_000);
    const body = await page.content();
    expect(body.length).toBeGreaterThan(500);
  });

  test("jobs page does not throw 404 or 500", async ({ page }) => {
    await loginAsStudent(page);
    const resp = await page.goto("/student/jobs");
    expect(resp?.status()).not.toBe(404);
    expect(resp?.status()).not.toBe(500);
  });

  test("applications page loads", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/student/applications");
    await expect(page).toHaveURL(/\/student\/applications/);
    await page.waitForTimeout(3_000);
    await expect(page.locator("main, [data-testid='applications']").first()).toBeVisible();
  });
});
