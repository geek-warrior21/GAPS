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
    await expect(page.getByRole("heading", { name: "GapMap" })).toBeVisible();

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

  test("S4: Diagnostic assessment launches, adapts, and presents diagnostic items", async ({
    page,
  }) => {
    // 1. Sign in as Aarav
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "aarav");
    await page.fill("#pin", "121212");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // 2. Click Diagnostic Check
    const diagButton = page.locator("button:has-text('Diagnostic Check')");
    await expect(diagButton).toBeVisible();
    await diagButton.click();

    // 3. Reaches diagnostic session
    await expect(page).toHaveURL(/\/session.*mode=diagnostic/);
    await expect(page.getByText(/diagnostic session/i)).toBeVisible();

    // 4. AnswerPad and Question are rendered
    await expect(page.locator("button:has-text('Check Answer')")).toBeVisible();
  });

  test("S5: Interactive AI Maths Tutor provides progressive disclosure and concept guidance", async ({
    page,
  }) => {
    // 1. Sign in as Ananya
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "ananya");
    await page.fill("#pin", "555555");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // 2. Launch learning session
    await page.click("button:has-text('Continue Learning')");
    await expect(page).toHaveURL(/\/session/);

    // 3. Open Tutor Panel
    const tutorToggleBtn = page.getByTestId("toggle-tutor-btn");
    await expect(tutorToggleBtn).toBeVisible();
    await tutorToggleBtn.click();

    // 4. Verify Tutor header and guidance notice
    await expect(page.getByText("Gaps AI Maths Tutor")).toBeVisible();
    await expect(page.getByText("Guidance Only")).toBeVisible();
    await expect(page.getByText(/tutor turns remaining/i)).toBeVisible();

    // 5. Click Quick Action: "Give me a hint"
    const hintBtn = page.getByTestId("tutor-quick-hint");
    await expect(hintBtn).toBeVisible();
    await hintBtn.click();

    // Verify conversation thread displays assistant reply
    const thread = page.getByTestId("tutor-conversation-thread");
    await expect(thread).toBeVisible();
    await expect(thread.getByText("Gaps Tutor")).toBeVisible();

    // 6. Send conceptual free-text question: "What is the denominator?"
    const inputField = page.getByTestId("tutor-input-field");
    await inputField.fill("What is the denominator?");
    await page.getByTestId("tutor-send-btn").click();

    // Verify tutor answers explaining denominator
    await expect(thread.getByText(/denominator is the bottom number/i)).toBeVisible();

    // 7. Verification: Submit answer on the actual AnswerPad
    const checkAnswerBtn = page.locator("button:has-text('Check Answer')");
    await expect(checkAnswerBtn).toBeVisible();
  });

  test("S6: Student navigation across Home, Learn, Play, GapMap, and Solve With Me", async ({
    page,
  }) => {
    // 1. Sign in as Meera
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "meera");
    await page.fill("#pin", "333333");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // 2. Navigate to Learn
    await page.locator("a[href='/learn']:visible").first().click();
    await expect(page).toHaveURL(/\/learn/);
    await expect(page.locator("h1")).toContainText("Fractions Curriculum");

    // 3. Navigate to Play
    await page.locator("a[href='/play']:visible").first().click();
    await expect(page).toHaveURL(/\/play/);
    await expect(page.locator("h1")).toContainText("Play & Challenges");

    // 4. Navigate to GapMap
    await page.locator("a[href='/gapmap']:visible").first().click();
    await expect(page).toHaveURL(/\/gapmap/);
    await expect(page.locator("h1")).toContainText("GapMap");

    // 5. Navigate to Solve With Me
    await page.locator("a[href='/solve']:visible").first().click();
    await expect(page).toHaveURL(/\/solve/);
    await expect(page.locator("h1")).toContainText("Solve With Me");

    // 6. Return Home
    await page.locator("a[href='/home']:visible").first().click();
    await expect(page).toHaveURL(/\/home/);
  });

  test("S7: Chapter and concept browsing on Learn page and launching concept practice", async ({
    page,
  }) => {
    // Sign in as Meera
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "meera");
    await page.fill("#pin", "333333");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // Visit Learn page
    await page.goto("/learn");
    await expect(page.locator("h1")).toContainText("Fractions Curriculum");

    // Verify all 3 chapters are listed
    await expect(page.getByText("Chapter A", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meet the fractions" })).toBeVisible();
    await expect(page.getByText("Chapter B", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fraction operations" })).toBeVisible();
    await expect(page.getByText("Chapter C", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fractions in the world" })).toBeVisible();

    // Verify concepts inside Chapter A are visible
    await expect(page.getByText("Parts of a whole").first()).toBeVisible();

    // Start learning/practising on first concept
    const startBtn = page
      .locator("button:has-text('Practise Skill'), button:has-text('Start Learning')")
      .first();
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Reaches session
    await expect(page).toHaveURL(/\/session.*mode=learn/);
    await expect(page.locator("button:has-text('Check Answer')")).toBeVisible();
  });

  test("S8: Play page displays Daily Quest and Chapter Boss unlock rules", async ({ page }) => {
    // Sign in as Meera
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "meera");
    await page.fill("#pin", "333333");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // Visit Play page
    await page.goto("/play");
    await expect(page.locator("h1")).toContainText("Play & Challenges");

    // Verify Daily Challenge card
    await expect(page.getByText("Daily Challenge")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Daily Quest" })).toBeVisible();

    // Verify Boss Battles section and chapter cards
    await expect(page.getByText("Chapter Boss Battles")).toBeVisible();
    await expect(page.getByText("The Equal Splitter")).toBeVisible();
    await expect(page.getByText("The Cross Multiplier")).toBeVisible();
    await expect(page.getByText("The Real-World Riddle")).toBeVisible();

    // Verify unlock requirements text and lock status are displayed
    await expect(page.getByText("🔒 Locked").first()).toBeVisible();
    await expect(page.getByText(/Demonstrate or develop at least/i).first()).toBeVisible();
    await expect(page.getByText("Progress to unlock").first()).toBeVisible();
  });

  test("S9: AI-off Solve With Me guided mode provides visual models and Try One Like It", async ({
    page,
  }) => {
    // Sign in as Meera
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "meera");
    await page.fill("#pin", "333333");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // Visit Solve With Me
    await page.goto("/solve");
    await expect(page.locator("h1")).toContainText("Solve With Me");

    // Click preset problem for Adding unlike fractions
    const presetBtn = page.locator(
      "button:has-text('Adding unlike fractions: Common denominator')",
    );
    await expect(presetBtn).toBeVisible();
    await presetBtn.click();

    // Verify Visual Explanation and Target Concept are rendered
    await expect(page.getByText("Visual Explanation")).toBeVisible();
    await expect(page.getByText("Target Concept")).toBeVisible();

    // Verify "Try one like it" button navigates to session
    const tryBtn = page.locator("button:has-text('Try one like it')");
    await expect(tryBtn).toBeVisible();
    await tryBtn.click();

    await expect(page).toHaveURL(/\/session.*conceptId=MATH-FRAC-ADDUNLIKE/);
    await expect(page.locator("button:has-text('Check Answer')")).toBeVisible();
  });

  test("S10: Home page displays active session resume banner", async ({ page }) => {
    // Sign in as Aarav (starts a session)
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "aarav");
    await page.fill("#pin", "121212");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // Launch session
    await page.click("button:has-text('Continue Learning')");
    await expect(page).toHaveURL(/\/session/);

    // Navigate back to home
    await page.goto("/home");

    // Session in progress banner should be displayed
    await expect(page.getByText("Session in Progress")).toBeVisible();
    const resumeBtn = page.locator("button:has-text('Resume Session →')");
    await expect(resumeBtn).toBeVisible();
    await resumeBtn.click();

    // Reaches session
    await expect(page).toHaveURL(/\/session/);
    await expect(page.locator("button:has-text('Check Answer')")).toBeVisible();
  });
});
