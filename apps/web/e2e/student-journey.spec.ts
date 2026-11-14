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

  test("S11: Science dynamic lesson with interactive circuit simulator, prediction, and Sparks", async ({
    page,
  }) => {
    // 1. Sign in as Meera
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "meera");
    await page.fill("#pin", "333333");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // 2. Navigate to Learn and switch to Science
    await page.goto("/learn");
    await expect(page).toHaveURL(/\/learn/);

    const scienceTab = page.locator("[data-testid='tab-subject-science']");
    await expect(scienceTab).toBeVisible();
    await scienceTab.click();

    // 3. Launch Science Lesson: Electric Current & Simple Circuits
    const launchBtn = page.locator("[data-testid='start-circuits-lesson-button']");
    await expect(launchBtn).toBeVisible();
    await launchBtn.click();
    await expect(page).toHaveURL(/\/lesson\/lesson-sci-circuits-1/);

    // Step 1: Intro activity
    await expect(page.getByText("Concept Introduction", { exact: true })).toBeVisible();
    await page.click('button:has-text("Let\'s Explore")');

    // Step 2: Interactive Circuit Manipulation
    await expect(page.getByText("Interactive Exploration", { exact: true })).toBeVisible();
    // Toggle the switch
    const switchToggle = page.getByTestId("toggle-circuit-switch");
    await expect(switchToggle).toBeVisible();
    await switchToggle.click();
    // Proceed
    await page.click("button:has-text('Next Step')");

    // Step 3: Predict & Observe
    await expect(page.getByText("Predict & Observe", { exact: true })).toBeVisible();
    const predictChoice = page.locator("button:has-text('The bulb stays dark')");
    await expect(predictChoice).toBeVisible();
    await predictChoice.click();
    await page.click("button:has-text('Test Prediction & Observe')");

    // Verify observation revealed
    await expect(page.getByText("Observation & Why It Happens")).toBeVisible();
    await page.click("button:has-text('Continue to Next Activity')");

    // Step 4: Guided Practice
    await expect(page.getByText("Guided Challenge", { exact: true })).toBeVisible();
    // Flip switch to closed
    const guidedSwitch = page.getByTestId("toggle-circuit-switch");
    await expect(guidedSwitch).toBeVisible();
    await guidedSwitch.click();
    await page.click("button:has-text('Check Solution')");
    await expect(page.getByText("Goal Achieved!")).toBeVisible();
    await page.click("button:has-text('Continue')");

    // Step 5: Independent Check
    await expect(page.getByText("Independent Check", { exact: true })).toBeVisible();
    const independentChoice = page.locator("button:has-text('A complete, closed conducting loop')");
    await expect(independentChoice).toBeVisible();
    await independentChoice.click();
    await page.click("button:has-text('Submit Answer')");
    await expect(page.getByText("Correct Response!")).toBeVisible();
    await page.click("button:has-text('Complete Lesson & Collect Sparks')");

    // Verify Completion Screen
    await expect(page.getByText("Lesson Concluded")).toBeVisible();
    await expect(page.getByText("Outstanding Effort!")).toBeVisible();
    await expect(page.getByText("+15 Sparks Added to Your Ledger")).toBeVisible();
  });

  test("S12: Mathematics dynamic lesson with fraction strip manipulation, reload resume, and verification", async ({
    page,
  }) => {
    // 1. Sign in as Aarav
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "aarav");
    await page.fill("#pin", "121212");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // 2. Navigate to Learn and launch Fractions lesson
    await page.goto("/learn");
    await expect(page).toHaveURL(/\/learn/);

    const launchMathsBtn = page.locator("[data-testid='start-maths-lesson-button']");
    await expect(launchMathsBtn).toBeVisible();
    await launchMathsBtn.click();
    await expect(page).toHaveURL(/\/lesson\/lesson-maths-frac-part-1/);

    // Step 1: Intro
    await expect(page.getByText("Concept Introduction", { exact: true })).toBeVisible();
    await page.click('button:has-text("Let\'s Explore")');

    // Step 2: Interactive Manipulation
    await expect(page.getByText("Interactive Exploration", { exact: true })).toBeVisible();
    await page.click("button:has-text('Next Step')");

    // Wait until Activity 3 has loaded
    await expect(page.getByText("ACTIVITY 3 OF 5")).toBeVisible();
    await expect(page.getByText("Predict & Observe", { exact: true })).toBeVisible();

    // Step 3: Test Reload & Resume Progress
    await page.reload();
    await expect(page.getByText("ACTIVITY 3 OF 5")).toBeVisible();
    await expect(page.getByText("Predict & Observe", { exact: true })).toBeVisible();

    // Make prediction
    const choice34 = page.locator("button:has-text('3/4 (three-fourths)')");
    await expect(choice34).toBeVisible();
    await choice34.click();
    await page.click("button:has-text('Test Prediction & Observe')");
    await expect(page.getByText("Observation & Why It Happens")).toBeVisible();
    await page.click("button:has-text('Continue to Next Activity')");

    // Step 4: Guided Challenge (model 2/5: initialParts=3, initialShaded=1)
    await expect(page.getByText("Guided Challenge", { exact: true })).toBeVisible();
    // Increase parts twice to 5
    const plusParts = page.locator("button[aria-label='Increase parts']");
    await plusParts.click();
    await plusParts.click();
    // Increase shaded once to 2
    const plusShaded = page.locator("button[aria-label='Increase shaded parts']");
    await plusShaded.click();

    // Check solution
    await page.click("button:has-text('Check Solution')");
    await expect(page.getByText("Goal Achieved!")).toBeVisible();
    await page.click("button:has-text('Continue')");

    // Step 5: Independent Check (Kabir eats 5 squares of 6 -> 5/6)
    await expect(page.getByText("Independent Check", { exact: true })).toBeVisible();
    const choice56 = page.locator("button:has-text('5/6')");
    await expect(choice56).toBeVisible();
    await choice56.click();
    await page.click("button:has-text('Submit Answer')");
    await expect(page.getByText("Correct Response!")).toBeVisible();
    await page.click("button:has-text('Complete Lesson & Collect Sparks')");

    // Verify Completion Screen
    await expect(page.getByText("Lesson Concluded")).toBeVisible();
    await expect(page.getByText("+15 Sparks Added to Your Ledger")).toBeVisible();
  });

  test("S13: Purely configured topic (Conductors & Insulators) runs through shared activity renderer", async ({
    page,
  }) => {
    // 1. Sign in as Meera
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "meera");
    await page.fill("#pin", "333333");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // 2. Navigate to Learn -> Science
    await page.goto("/learn");
    await expect(page).toHaveURL(/\/learn/);

    const scienceTab = page.locator("[data-testid='tab-subject-science']");
    await expect(scienceTab).toBeVisible();
    await scienceTab.click();

    // 3. Launch Conductors Lesson
    const conductorsBtn = page.locator("[data-testid='start-conductors-lesson-button']");
    await expect(conductorsBtn).toBeVisible();
    await conductorsBtn.click();
    await expect(page).toHaveURL(/\/lesson\/lesson-sci-conductors-1/);

    // Step 1: Intro
    await expect(page.getByText("The Metal Core and the Plastic Skin")).toBeVisible();
    await page.click('button:has-text("Let\'s Explore")');

    // Step 2: Predict testing copper key
    await expect(page.getByText("Predict & Observe", { exact: true })).toBeVisible();
    const copperChoice = page.locator(
      "button:has-text('Yes, copper is a metal conductor and will complete the loop')",
    );
    await expect(copperChoice).toBeVisible();
    await copperChoice.click();
    await page.click("button:has-text('Test Prediction & Observe')");
    await expect(page.getByText("Observation & Why It Happens")).toBeVisible();
    await page.click("button:has-text('Continue to Next Activity')");

    // Step 3: Independent Check (Which object is an insulator -> rubber eraser)
    await expect(page.getByText("Independent Check", { exact: true })).toBeVisible();
    const eraserChoice = page.locator("button:has-text('A rubber eraser')");
    await expect(eraserChoice).toBeVisible();
    await eraserChoice.click();
    await page.click("button:has-text('Submit Answer')");
    await expect(page.getByText("Correct Response!")).toBeVisible();
    await page.click("button:has-text('Complete Lesson & Collect Sparks')");

    // Verify Completion Screen
    await expect(page.getByText("Lesson Concluded")).toBeVisible();
    await expect(page.getByText("+15 Sparks Added to Your Ledger")).toBeVisible();
  });
});
