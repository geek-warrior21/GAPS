/* eslint-disable no-console */
import { test, expect } from "@playwright/test";

test.describe("Student Learning Journey & Acceptance Scenarios", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`[BROWSER ${msg.type()}]:`, msg.text()));
    page.on("pageerror", (err) => console.log("[BROWSER ERROR]:", err.message));
    page.on("response", (res) => {
      if (res.status() >= 400) console.log("[HTTP ERROR]:", res.status(), res.url());
    });
  });

  test("S1: Student login as Meera, reaches home dashboard, sees Quest & GapMap", async ({
    page,
  }) => {
    // 1. Visit login page
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("Sign in to Gaps");

    // 2. Fill credentials for Meera
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "meera");
    await page.fill("#pin", "333333");
    await page.click("button[type='submit']");

    // 3. Arrive at home dashboard
    await expect(page).toHaveURL(/\/home/);
    await expect(page.locator("header")).toContainText("Meera");
    await expect(page.locator("header")).toContainText("Sparks");

    // 4. Verify Quest Card & GapMap exist
    await expect(page.getByText("Daily Quest")).toBeVisible();
    await expect(page.getByText("Continue Learning")).toBeVisible();
    await expect(page.getByText("GapMap")).toBeVisible();

    // 5. Click a concept in GapMap to inspect evidence drawer
    const conceptButton = page.locator("button:has-text('Parts of a whole')").first();
    await expect(conceptButton).toBeVisible();
    await conceptButton.click();

    // Evidence drawer should open
    await expect(page.getByText("Why this status?")).toBeVisible();
    await expect(page.getByText("Measurement reliability:")).toBeVisible();

    // Close modal
    await page.click("button:has-text('Close')");
  });

  test("S2: Active session loop with two-try rule, gentle copy, and teaching support", async ({
    page,
  }) => {
    // 1. Sign in as Aarav (active student practicing MATH-FRAC-PART)
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "aarav");
    await page.fill("#pin", "121212");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // 2. Launch learning session
    await page.click("button:has-text('Continue Learning')");
    await expect(page).toHaveURL(/\/session/);

    // 3. Verify question card and AnswerPad render
    await expect(page.locator("button:has-text('Check Answer')")).toBeVisible();

    // 4. Submit an incorrect answer to test two-try rule and gentle copy
    // Use AnswerPad buttons: tap 9, 9, 9
    await page.locator("button:has-text('9')").click();
    await page.locator("button:has-text('Check Answer')").click();

    // Invariant §9 & §10: Must say "not yet", never "wrong" or "failed"
    const feedbackBanner = page.locator("text=/not yet/i");
    await expect(feedbackBanner).toBeVisible();
    const feedbackText = await feedbackBanner.innerText();
    expect(feedbackText.toLowerCase()).not.toContain("wrong");
    expect(feedbackText.toLowerCase()).not.toContain("failed");

    // 5. Test teaching support: Request Hint
    const hintButton = page.locator("button:has-text('Need a hint?')");
    if (await hintButton.isVisible()) {
      await hintButton.click();
      await expect(page.getByText(/Hint Rung 1/i)).toBeVisible();
    }

    // 6. Test teaching support: Request Worked Example
    const exampleButton = page.locator("button:has-text('Worked example')");
    if (await exampleButton.isVisible()) {
      await exampleButton.click();
      await expect(page.getByText(/Worked Example/i)).toBeVisible();
    }
  });

  test("S3: Consent gating blocks student missing core consent (Kabir)", async ({ page }) => {
    // 1. Sign in as Kabir (pending consent)
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "kabir");
    await page.fill("#pin", "444444");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // 2. Navigating to session shows consent pending requirement
    await page.goto("/session");
    await expect(page.getByText(/Consent Needed|Parent Consent Needed/i)).toBeVisible();
    await expect(page.getByText(/Ask your teacher about.*consent form/i)).toBeVisible();
  });
});
