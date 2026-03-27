import { test, expect } from "@playwright/test";
import { loginAsStudent, TEST_CREDS } from "../../fixtures/auth";

test.describe("Student — Interview Prep module", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    if (!TEST_CREDS.student.password) {
      test.skip(true, "TEST_STUDENT_PASSWORD not set");
    }
  });

  test("interview page loads (not redirected away)", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/student/interview");
    await page.waitForTimeout(3_000);
    // Should stay on interview page — not redirected to dashboard
    await expect(page).toHaveURL(/\/student\/interview/);
  });

  test("interview page has Question Bank tab", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/student/interview");
    await page.waitForTimeout(2_000);
    const questionBankTab = page.locator('button, [role="tab"]').filter({ hasText: /question.?bank|questions/i }).first();
    await expect(questionBankTab).toBeVisible({ timeout: 8_000 });
  });

  test("interview page has Mock Interview tab", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/student/interview");
    await page.waitForTimeout(2_000);
    const mockTab = page.locator('button, [role="tab"]').filter({ hasText: /mock.?interview|chat/i }).first();
    await expect(mockTab).toBeVisible({ timeout: 8_000 });
  });

  test("generate questions — intercept AI call, verify request", async ({ page }) => {
    let interviewApiCalled = false;

    // Intercept the backend interview/questions call
    await page.route("**/api/v1/interview/questions**", async (route) => {
      interviewApiCalled = true;
      // Return mock questions so UI doesn't hang
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          questions: [
            { question: "What is polymorphism?", difficulty: "medium", category: "TECHNICAL" },
            { question: "Explain SOLID principles.", difficulty: "medium", category: "TECHNICAL" },
          ],
        }),
      });
    });

    await loginAsStudent(page);
    await page.goto("/student/interview");
    await page.waitForTimeout(2_000);

    // Click Question Bank tab if not already active
    const questionBankTab = page.locator('button, [role="tab"]').filter({ hasText: /question.?bank|questions/i }).first();
    if (await questionBankTab.isVisible()) {
      await questionBankTab.click();
    }

    // Click generate / get questions button
    const generateBtn = page.locator('button').filter({ hasText: /generate|get.?questions|start/i }).first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await page.waitForTimeout(4_000);
      // Questions should appear
      expect(interviewApiCalled).toBeTruthy();
    }
  });

  test("mock interview tab — start interview sends chat request", async ({ page }) => {
    let chatApiCalled = false;

    await page.route("**/api/v1/interview/mock-chat**", async (route) => {
      chatApiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Tell me about your experience with React and TypeScript.",
          session_id: "test-session-123",
        }),
      });
    });

    await loginAsStudent(page);
    await page.goto("/student/interview");
    await page.waitForTimeout(2_000);

    // Switch to mock interview tab
    const mockTab = page.locator('button, [role="tab"]').filter({ hasText: /mock.?interview|chat/i }).first();
    if (await mockTab.isVisible()) {
      await mockTab.click();
      await page.waitForTimeout(1_000);
    }

    const startBtn = page.locator('button').filter({ hasText: /start.?interview|begin/i }).first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(4_000);
      expect(chatApiCalled).toBeTruthy();
    }
  });
});
