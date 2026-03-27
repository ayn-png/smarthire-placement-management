import { test, expect } from "@playwright/test";
import { loginAsStudent, TEST_CREDS } from "../../fixtures/auth";

test.describe("Student Profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    if (!TEST_CREDS.student.password) {
      test.skip(true, "TEST_STUDENT_PASSWORD not set");
    }
  });

  test("profile page loads after student login", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/student/profile");
    await expect(page).toHaveURL(/\/student\/profile/);
    // Page must have a form or profile section
    await expect(page.locator("form, [data-testid='profile-form'], input, textarea").first()).toBeVisible({ timeout: 10_000 });
  });

  test("profile page does not 404", async ({ page }) => {
    await loginAsStudent(page);
    const response = await page.goto("/student/profile");
    expect(response?.status()).not.toBe(404);
    expect(response?.status()).not.toBe(500);
  });
});
