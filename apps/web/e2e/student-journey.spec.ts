/* eslint-disable no-console */
import { test, expect } from "@playwright/test";
import {
  getDb,
  conceptBeliefs,
  attempts,
  learningSessions,
  sparksLedger,
  events,
  inArray,
} from "@gaps/db";

async function resetStudentEvidence(studentIds: string[]) {
  try {
    const db = getDb();
    await db.delete(conceptBeliefs).where(inArray(conceptBeliefs.studentId, studentIds));
    await db.delete(attempts).where(inArray(attempts.studentId, studentIds));
    await db.delete(learningSessions).where(inArray(learningSessions.studentId, studentIds));
    await db.delete(sparksLedger).where(inArray(sparksLedger.studentId, studentIds));
    await db.delete(events).where(inArray(events.studentId, studentIds));
  } catch (err) {
    console.warn("Could not reset student evidence directly:", err);
  }
}

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

  test("S14: Mathematics adaptive loop: struggling student triggers remediation, fresh check, stopping point, and refresh recovery", async ({
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

    // Step 2: Interactive Exploration
    await expect(page.getByText("Interactive Exploration", { exact: true })).toBeVisible();
    await page.click("button:has-text('Next Step')");

    // Wait until Activity 3 Predict & Observe has loaded
    await expect(page.getByText("ACTIVITY 3 OF 5")).toBeVisible();
    await expect(page.getByText("Predict & Observe", { exact: true })).toBeVisible();

    // Student makes INCORRECT prediction (4/3 instead of 3/4)
    const incorrectChoice = page.locator("button:has-text('4/3 (four-thirds)')");
    await expect(incorrectChoice).toBeVisible();
    await incorrectChoice.click();
    await page.click("button:has-text('Test Prediction & Observe')");
    await expect(page.getByText("Observation & Why It Happens")).toBeVisible();
    await page.click("button:has-text('Continue to Next Activity')");

    // ADAPTIVE TRIGGER 1: Remediation simulation is displayed
    await expect(page.getByText("Adaptive Support")).toBeVisible();
    await expect(page.getByText("Targeted remediation active", { exact: false })).toBeVisible();
    await expect(page.getByText("Guided Investigation: Denominator as Equal Parts")).toBeVisible();

    // REFRESH RECOVERY 1: Mid-remediation simulation
    await page.reload();
    await expect(page.getByText("Adaptive Support")).toBeVisible();
    await expect(page.getByText("Guided Investigation: Denominator as Equal Parts")).toBeVisible();

    // Complete remediation simulation
    await page.click("button:has-text('Next Step')");

    // ADAPTIVE TRIGGER 2: Fresh Follow-Up Check
    await expect(page.getByText("Fresh Question: Parts of a Whole")).toBeVisible();
    await expect(
      page.getByText("A round roti is divided into 4 equal quarters", { exact: false }),
    ).toBeVisible();

    // REFRESH RECOVERY 2: Mid-follow-up check
    await page.reload();
    await expect(page.getByText("Fresh Question: Parts of a Whole")).toBeVisible();

    // Student answers fresh question INCORRECTLY (4/1 four rotis)
    const wrongFreshChoice = page.locator("button:has-text('4/1 (four rotis)')");
    await expect(wrongFreshChoice).toBeVisible();
    await wrongFreshChoice.click();
    await page.click("button:has-text('Submit Answer')");
    await expect(page.getByText("Good Try — Learning Opportunity")).toBeVisible();
    await page.click("button:has-text('Submit & Continue')");

    // ADAPTIVE TRIGGER 3: Stopping Point reached for continued difficulty
    await expect(page.getByText("Support & Reflection")).toBeVisible();
    await expect(page.getByText("Let's Pause & Review Key Ideas")).toBeVisible();
    await expect(
      page.getByText("Always count the total equal parts first", { exact: false }),
    ).toBeVisible();

    // REFRESH RECOVERY 3: Mid-stopping point
    await page.reload();
    await expect(page.getByText("Support & Reflection")).toBeVisible();
    await expect(page.getByText("Let's Pause & Review Key Ideas")).toBeVisible();

    // Acknowledge stopping point and proceed
    await page.click("button:has-text('Acknowledge & Continue')");

    // Successfully resumes mainstream at Step 4 Guided Challenge
    await expect(page.getByText("Guided Challenge", { exact: true })).toBeVisible();
    const plusParts = page.locator("button[aria-label='Increase parts']");
    await plusParts.click();
    await plusParts.click();
    const plusShaded = page.locator("button[aria-label='Increase shaded parts']");
    await plusShaded.click();
    await page.click("button:has-text('Check Solution')");
    await expect(page.getByText("Goal Achieved!")).toBeVisible();
    await page.click("button:has-text('Continue')");

    // Step 5: Final Independent Check
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

  test("S15: Science adaptive loop: circuit remediation and successful fresh check progression", async ({
    page,
  }) => {
    // 1. Sign in as Ananya
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "ananya");
    await page.fill("#pin", "555555");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // 2. Navigate to Learn -> Science
    await page.goto("/learn");
    const scienceTab = page.locator("[data-testid='tab-subject-science']");
    await expect(scienceTab).toBeVisible();
    await scienceTab.click();

    // 3. Launch Circuits Lesson
    const launchBtn = page.locator("[data-testid='start-circuits-lesson-button']");
    await expect(launchBtn).toBeVisible();
    await launchBtn.click();

    // Step 1: Intro & Step 2: Interactive Sandbox
    await expect(page.getByText("Concept Introduction", { exact: true })).toBeVisible();
    await page.click('button:has-text("Let\'s Explore")');

    await expect(page.getByText("Interactive Exploration", { exact: true })).toBeVisible();
    await page.click("button:has-text('Next Step')");

    // Step 3: Predict & Observe: Make INCORRECT prediction
    await expect(page.getByText("Predict & Observe", { exact: true })).toBeVisible();
    const wrongPredict = page.locator(
      "button:has-text('Yes, the bulb will glow because the battery is still attached.')",
    );
    await expect(wrongPredict).toBeVisible();
    await wrongPredict.click();
    await page.click("button:has-text('Test Prediction & Observe')");
    await expect(page.getByText("Observation & Why It Happens")).toBeVisible();
    await page.click("button:has-text('Continue to Next Activity')");

    // Remediation Branch: Air gap simulator
    await expect(page.getByText("Adaptive Support")).toBeVisible();
    await expect(
      page.getByText("Guided Investigation: The Air Gap in an Open Circuit"),
    ).toBeVisible();

    // Complete remediation simulation
    await page.click("button:has-text('Next Step')");

    // Fresh Check: Student answers CORRECTLY
    await expect(page.getByText("Fresh Check: Circuit Continuity")).toBeVisible();
    const correctFresh = page.locator(
      "button:has-text('Current stops flowing and the bulb stays dark')",
    );
    await expect(correctFresh).toBeVisible();
    await correctFresh.click();
    await page.click("button:has-text('Submit Answer')");
    await expect(page.getByText("Correct Response!")).toBeVisible();
    await page.click("button:has-text('Submit & Continue')");

    // Advances to Guided Challenge
    await expect(page.getByText("Guided Challenge", { exact: true })).toBeVisible();
    const guidedSwitch = page.getByTestId("toggle-circuit-switch");
    await expect(guidedSwitch).toBeVisible();
    await guidedSwitch.click();
    await page.click("button:has-text('Check Solution')");
    await expect(page.getByText("Goal Achieved!")).toBeVisible();
    await page.click("button:has-text('Continue')");

    // Final Independent Check
    await expect(page.getByText("Independent Check", { exact: true })).toBeVisible();
    const finalChoice = page.locator("button:has-text('A complete, closed conducting loop')");
    await expect(finalChoice).toBeVisible();
    await finalChoice.click();
    await page.click("button:has-text('Submit Answer')");
    await expect(page.getByText("Correct Response!")).toBeVisible();
    await page.click("button:has-text('Complete Lesson & Collect Sparks')");

    // Verify Completion Screen
    await expect(page.getByText("Lesson Concluded")).toBeVisible();
    await expect(page.getByText("+15 Sparks Added to Your Ledger")).toBeVisible();
  });

  test("S16: Stopping point 'Save & Finish for Now' preserves state and shows evidence-based next action banner on Learn", async ({
    page,
  }) => {
    // 1. Sign in as Ananya (has active status & consent)
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", "ananya");
    await page.fill("#pin", "555555");
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

    // Step 2: Interactive Exploration
    await expect(page.getByText("Interactive Exploration", { exact: true })).toBeVisible();
    await page.click("button:has-text('Next Step')");

    // Activity 3: Predict & Observe -> Student makes incorrect choice
    await expect(page.getByText("ACTIVITY 3 OF 5")).toBeVisible();
    await expect(page.getByText("Predict & Observe", { exact: true })).toBeVisible();
    const incorrectChoice = page.locator("button:has-text('4/3 (four-thirds)')");
    await expect(incorrectChoice).toBeVisible();
    await incorrectChoice.click();
    await page.click("button:has-text('Test Prediction & Observe')");
    await expect(page.getByText("Observation & Why It Happens")).toBeVisible();
    await page.click("button:has-text('Continue to Next Activity')");

    // Adaptive remediation simulation
    await expect(page.getByText("Adaptive Support")).toBeVisible();
    await page.click("button:has-text('Next Step')");

    // Follow-up check -> Incorrect answer
    await expect(page.getByText("Fresh Question: Parts of a Whole")).toBeVisible();
    const wrongFreshChoice = page.locator("button:has-text('4/1 (four rotis)')");
    await expect(wrongFreshChoice).toBeVisible();
    await wrongFreshChoice.click();
    await page.click("button:has-text('Submit Answer')");
    await expect(page.getByText("Good Try — Learning Opportunity")).toBeVisible();
    await page.click("button:has-text('Submit & Continue')");

    // Stopping Point reached
    await expect(page.getByText("Support & Reflection")).toBeVisible();
    const saveAndFinishBtn = page.locator("button:has-text('Save & Finish for Now')");
    await expect(saveAndFinishBtn).toBeVisible();
    await saveAndFinishBtn.click();

    // Verify redirected to Learn page
    await expect(page).toHaveURL(/\/learn/);

    // Verify Next Action recommendation banner on Learn
    const nextActionCard = page.locator("[data-testid='next-action-card']");
    await expect(nextActionCard).toBeVisible();
    await expect(page.getByText("Action on Return: Revisit Objective")).toBeVisible();

    // Click Next Action button to resume
    const resumeBtn = page.locator("[data-testid='next-action-button']");
    await expect(resumeBtn).toBeVisible();
    await resumeBtn.click();
    await expect(page).toHaveURL(/\/lesson\/lesson-maths-frac-part-1/);

    // Resumed back at stopping point with practice options
    await expect(page.getByText("Support & Reflection")).toBeVisible();
    await expect(page.getByText("Let's Pause & Review Key Ideas")).toBeVisible();
  });

  test("S17: Science student completes Circuit Simulator, takes Mastery Assessment across 2 templates, and demonstrates mastery (+20 Sparks)", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("Mobile");
    const username = isMobile ? "priya" : "rohan";
    const pin = isMobile ? "888888" : "777777";
    const studentId = isMobile
      ? "stu_01J00000000000000000000006"
      : "stu_01J00000000000000000000005";
    await resetStudentEvidence([studentId]);

    // 1. Login
    await page.goto("/login");
    await page.fill("#joinCode", "DEMO7A");
    await page.fill("#username", username);
    await page.fill("#pin", pin);
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/home/);

    // 2. Navigate to Learn and switch to Science
    await page.goto("/learn");
    await expect(page).toHaveURL(/\/learn/);

    const scienceTab = page.locator("[data-testid='tab-subject-science']");
    await expect(scienceTab).toBeVisible();
    await scienceTab.click();

    // 3. Launch Electric Circuits Topic 1 (lesson-sci-circuits-1)
    const launchCircuitsBtn = page.locator("[data-testid='start-circuits-lesson-button']");
    await expect(launchCircuitsBtn).toBeVisible();
    await launchCircuitsBtn.click();
    await expect(page).toHaveURL(/\/lesson\/lesson-sci-circuits-1/);

    // Activity 1: Intro -> click Let's Explore
    await expect(page.getByRole("heading", { name: "The Torch Switch Mystery" })).toBeVisible();
    await page.click('button:has-text("Let\'s Explore")');

    // Activity 2: Interactive Simulation -> click Next Step
    await expect(page.getByText("Interactive Exploration", { exact: true })).toBeVisible();
    await page.click("button:has-text('Next Step')");

    // Activity 3: Predict & Observe (Correct choice: choice_dark)
    await expect(page.getByText("Predict & Observe", { exact: true })).toBeVisible();
    const correctPrediction = page.locator("button:has-text('No, the bulb stays dark')");
    await expect(correctPrediction).toBeVisible();
    await correctPrediction.click();
    await page.click("button:has-text('Test Prediction & Observe')");
    await expect(page.getByText("Observation & Why It Happens")).toBeVisible();
    await page.click("button:has-text('Continue to Next Activity')");

    // Activity 4: Guided Practice
    await expect(page.getByText("Guided Challenge", { exact: true })).toBeVisible();
    const toggleSwitchBtn = page.locator("[data-testid='toggle-circuit-switch']");
    await expect(toggleSwitchBtn).toBeVisible();
    await toggleSwitchBtn.click();
    await page.click("button:has-text('Check Solution')");
    await page.click("button:has-text('Continue')");

    // Activity 5: Independent Check 1 (Template 1: Continuity, Item 1)
    await expect(
      page.getByRole("heading", { name: "Independent Check: Check Your Understanding" }),
    ).toBeVisible();
    const check1Choice = page.locator("button:has-text('A complete, closed conducting loop')");
    await expect(check1Choice).toBeVisible();
    await check1Choice.click();
    await page.click("button:has-text('Submit Answer')");
    await expect(page.getByText("Correct Response!")).toBeVisible();
    await page.click("button:has-text('Complete Lesson & Collect Sparks')");

    // Lesson 1 Completed screen -> Return to Curriculum
    await expect(page.getByText("Outstanding Effort!")).toBeVisible();
    await page.click("button:has-text('Return to Curriculum')");
    await expect(page).toHaveURL(/\/learn/);

    // 4. Return to Learn -> Switch to Science tab
    await page.locator("[data-testid='tab-subject-science']").click();

    // Verify Next Action banner surfaces Fresh Check / Mastery Assessment
    const nextActionCard = page.locator("[data-testid='next-action-card']");
    await expect(nextActionCard).toBeVisible();
    await expect(page.getByText("Action on Return: Fresh Check")).toBeVisible();

    // Launch Mastery Assessment via Next Action Button
    const nextActionBtn = page.locator("[data-testid='next-action-button']");
    await expect(nextActionBtn).toBeVisible();
    await nextActionBtn.click();
    await expect(page).toHaveURL(/\/lesson\/lesson-sci-circuits-mastery/);

    // Mastery Lesson: Activity 1: Intro -> click Let's Explore
    await expect(page.getByRole("heading", { name: "Circuit Mastery Check" })).toBeVisible();
    await page.click('button:has-text("Let\'s Explore")');

    // Mastery Lesson: Activity 2: Independent Check 2 (Template 1: Continuity, Item 2: Open Switch Air Gap)
    await expect(
      page.getByRole("heading", { name: "Independent Check: Open Switch Air Gap" }),
    ).toBeVisible();
    const airGapChoice = page.locator("button:has-text('The open switch creates an air gap')");
    await expect(airGapChoice).toBeVisible();
    await airGapChoice.click();
    await page.click("button:has-text('Submit Answer')");
    await expect(page.getByText("Correct Response!")).toBeVisible();
    await page.click("button:has-text('Submit & Continue')");

    // Mastery Lesson: Activity 3: Independent Check 3 (Template 2: Breaks, Item 3: Detecting Circuit Breaks)
    await expect(
      page.getByRole("heading", { name: "Independent Check: Detecting Circuit Breaks" }),
    ).toBeVisible();
    const wireBreakChoice = page.locator(
      "button:has-text('Current stops flowing completely and the bulb turns off immediately')",
    );
    await expect(wireBreakChoice).toBeVisible();
    await wireBreakChoice.click();
    await page.click("button:has-text('Submit Answer')");
    await expect(page.getByText("Correct Response!")).toBeVisible();
    await page.click("button:has-text('Complete Lesson & Collect Sparks')");

    // Mastery Lesson Completed Screen
    await expect(page.getByText("Outstanding Effort!")).toBeVisible();
    await page.click("button:has-text('Return to Curriculum')");
    await expect(page).toHaveURL(/\/learn/);

    // Switch to Science tab -> Next Action advances to Topic 2: Conductors & Insulators
    await page.locator("[data-testid='tab-subject-science']").click();
    await expect(page.getByText("🚀 Next Milestone")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Next Objective: Conductors and insulators" }),
    ).toBeVisible();
  });

  test("S18: Developer-only lesson-planning preview produces multi-stage validated plans and renders in preview player", async ({
    page,
  }) => {
    // 1. Visit dev lesson planner
    await page.goto("/dev/lesson-planner");
    await expect(
      page.getByRole("heading", { name: "Model-Planned Teaching Engine: Live Preview" }),
    ).toBeVisible();
    await expect(page.getByText("Developer Mode")).toBeVisible();

    // 2. Select Science and Struggling Profile with AIR_GAP misconception
    await page.locator("[data-testid='select-subject-science']").click();
    await page.locator("[data-testid='profile-struggling']").click();

    const misconceptionSelect = page.locator("[data-testid='select-misconception']");
    await expect(misconceptionSelect).toBeVisible();
    await misconceptionSelect.selectOption("AIR_GAP");

    // 3. Generate Lesson Plan
    const generateBtn = page.locator("[data-testid='generate-plan-button']");
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // 4. Verify Audit Panel and Multi-stage Validation Badges
    const auditPanel = page.locator("[data-testid='planner-audit-panel']");
    await expect(auditPanel).toBeVisible();
    await expect(page.locator("[data-testid='badge-generation-model']")).toBeVisible();
    await expect(page.locator("[data-testid='badge-generation-latency']")).toBeVisible();

    // Validation distinctions
    await expect(page.locator("[data-testid='val-schema-card']")).toContainText(
      "✓ Schema Valid (Zod)",
    );
    await expect(page.locator("[data-testid='val-factual-card']")).toContainText(
      "✓ Factual Integrity Valid",
    );
    await expect(page.locator("[data-testid='val-pedagogical-card']")).toContainText(
      "✓ Tailored: struggling",
    );

    // 5. Verify sandboxed preview player is rendered
    const previewPlayer = page.locator("[data-testid='preview-lesson-player']");
    await expect(previewPlayer).toBeVisible();
    await expect(page.getByText("Interactive Lesson Player Preview")).toBeVisible();

    // Click "Let's Explore" inside preview player to verify interactive operation
    await previewPlayer.locator('button:has-text("Let\'s Explore")').click();
    await expect(previewPlayer.getByText("Interactive Exploration", { exact: true })).toBeVisible();

    // 6. Test Challenge Profile Generation
    await page.locator("[data-testid='profile-challenge']").click();
    await generateBtn.click();
    await expect(page.locator("[data-testid='val-pedagogical-card']")).toContainText(
      "✓ Tailored: ready_for_challenge",
    );
    await expect(page.getByText("Interactive Lesson Player Preview")).toBeVisible();
  });
});
