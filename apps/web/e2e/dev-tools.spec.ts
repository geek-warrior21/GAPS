/* eslint-disable no-console */
import { test, expect, type Page } from "@playwright/test";

/**
 * Developer tools, exercised where they are allowed to exist: a development
 * server (never the production build) started with DEV_TOOLS_ENABLED=true, and
 * only for a signed-in staff admin. The production build's refusal is covered
 * by S24 in student-journey.spec.ts.
 */

const DEV_APIS: Array<[string, unknown]> = [
  [
    "/api/v1/dev/lesson-planner/generate",
    {
      subject: "maths",
      level: 6,
      topicId: "maths-frac-part",
      objectiveId: "MATH-FRAC-PART",
      learnerProfile: { profileType: "struggling", namedMisconception: "REVERSAL" },
    },
  ],
  ["/api/v1/dev/teaching-engine/step", { objectiveId: "MATH-FRAC-PART", subject: "maths" }],
  ["/api/v1/dev/teaching-engine/compare", { subject: "maths", objectiveId: "MATH-FRAC-PART" }],
  ["/api/v1/dev/open-topic", { topic: "photosynthesis", level: 7 }],
  ["/api/v1/dev/open-topic/open-ses_none/autoplay", { profile: "succeeding" }],
];
const DEV_PAGES = ["/dev/lesson-planner", "/dev/open-topic"];

const signInAsStaffAdmin = async (page: Page) => {
  const res = await page.request.post("/api/v1/auth/staff-login", {
    data: { email: "admin@demo.gaps", password: "AdminDemo2026!" },
  });
  expect(res.status()).toBe(200);
};

/**
 * A development server compiles and hydrates the page on first use. Controls
 * clicked before hydration do nothing, so wait for the page to settle.
 */
const openPlanner = async (page: Page) => {
  const res = await page.goto("/dev/lesson-planner");
  expect(res?.status()).toBe(200);
};

const signInAsStudent = async (page: Page) => {
  const res = await page.request.post("/api/v1/auth/student-login", {
    data: { joinCode: "DEMO7A", username: "meera", pin: "333333" },
  });
  expect(res.status()).toBe(200);
};

const expectToolOutputWithheld = (body: string) => {
  expect(body).not.toContain("correctAnswer");
  expect(body).not.toContain("eligibleActions");
  expect(body).not.toContain("activities");
};

test.describe("Developer tools (development server, explicitly enabled)", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => console.log("[BROWSER ERROR]:", err.message));
  });

  test("D1: Unauthenticated callers cannot open the planner or call any developer API", async ({
    page,
  }) => {
    for (const devPage of DEV_PAGES) {
      const pageRes = await page.goto(devPage);
      expect(pageRes?.status(), devPage).toBe(404);
      await expect(page.getByText("Model-Planned Teaching Engine")).toHaveCount(0);
      await expect(page.locator("[data-testid='preview-topic-input']")).toHaveCount(0);
    }

    for (const [url, data] of DEV_APIS) {
      const res = await page.request.post(url, { data });
      expect(res.status(), url).toBe(401);
      expectToolOutputWithheld(await res.text());
    }
  });

  test("D2: A signed-in student cannot open the planner or retrieve plans, answer keys or engine controls", async ({
    page,
  }) => {
    await signInAsStudent(page);

    for (const devPage of DEV_PAGES) {
      const pageRes = await page.goto(devPage);
      expect(pageRes?.status(), devPage).toBe(404);
      await expect(page.getByText("Model-Planned Teaching Engine")).toHaveCount(0);
      await expect(page.locator("[data-testid='run-comparison-button']")).toHaveCount(0);
      await expect(page.locator("[data-testid='preview-topic-input']")).toHaveCount(0);
    }

    for (const [url, data] of DEV_APIS) {
      const res = await page.request.post(url, { data });
      expect(res.status(), url).toBe(403);
      const body = await res.text();
      expect(JSON.parse(body).error.code).toBe("FORBIDDEN");
      expectToolOutputWithheld(body);
    }
  });

  test("S18: Developer-only lesson-planning preview produces multi-stage validated plans and renders in preview player", async ({
    page,
  }) => {
    // 1. Sign in as staff admin and visit the dev lesson planner
    await signInAsStaffAdmin(page);
    await openPlanner(page);
    await expect(
      page.getByRole("heading", { name: "Model-Planned Teaching Engine: Live Preview" }),
    ).toBeVisible();
    await expect(page.getByText("Developer Mode")).toBeVisible();

    // 2. Select Science and Struggling Profile with AIR_GAP misconception
    // Clicks made before the development server has hydrated the page are lost,
    // so retry until the science misconceptions appear.
    const misconceptionSelect = page.locator("[data-testid='select-misconception']");
    await expect(async () => {
      await page.locator("[data-testid='select-subject-science']").click();
      await page.locator("[data-testid='profile-struggling']").click();
      await expect(misconceptionSelect.locator("option[value='AIR_GAP']")).toHaveCount(1, {
        timeout: 1500,
      });
    }).toPass({ timeout: 90000 });
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
    await previewPlayer.locator('button:has-text("Let\'s Explore")').click({ force: true });
    await expect(previewPlayer.getByText("Interactive Exploration", { exact: true })).toBeVisible();

    // 6. Test Challenge Profile Generation
    await page.locator("[data-testid='profile-challenge']").click({ force: true });
    await generateBtn.click({ force: true });
    await expect(page.locator("[data-testid='val-pedagogical-card']")).toContainText(
      "✓ Tailored: ready_for_challenge",
    );
    await expect(page.getByText("Interactive Lesson Player Preview")).toBeVisible();
  });

  test("S19: Developer teaching-engine comparison demonstrates distinct adaptive sequences for struggling vs succeeding learners with server policy envelopes", async ({
    page,
  }) => {
    // 1. Sign in as staff admin and visit the dev lesson planner
    await signInAsStaffAdmin(page);
    await openPlanner(page);
    await expect(
      page.getByRole("heading", { name: "Model-Planned Teaching Engine: Live Preview" }),
    ).toBeVisible();

    // 2. Switch to Next-Step Teaching Decision Comparison tab
    const traceTab = page.locator("[data-testid='tab-view-teaching-trace']");
    await expect(traceTab).toBeVisible();
    // Retry until the development server has hydrated the page and the tab responds.
    await expect(async () => {
      await traceTab.click();
      await expect(page.getByRole("heading", { name: "Teaching Decision Comparison" })).toBeVisible(
        {
          timeout: 1500,
        },
      );
    }).toPass({ timeout: 90000 });

    // 3. Verify comparison controls
    await expect(page.getByRole("heading", { name: "Teaching Decision Comparison" })).toBeVisible();
    const runBtn = page.locator("[data-testid='run-comparison-button']");
    await expect(runBtn).toBeVisible();

    // 4. Run comparison for default Maths (MATH-FRAC-PART)
    await runBtn.click();

    // 5. Verify side-by-side results container rendered
    const resultsContainer = page.locator("[data-testid='comparison-results-container']");
    await expect(resultsContainer).toBeVisible();

    // The comparison replays the same sequencer as persisted student sessions,
    // so every delivered step is listed, including the checks themselves.
    const step = (learner: "struggling" | "succeeding", n: number) =>
      page.locator(`[data-testid='trace-${learner}-step-${n}']`);

    // Verify Learner A (Struggling) Column
    await expect(page.getByText("Learner A: Struggling")).toBeVisible();
    await expect(page.getByText("Scaffolded Adaptive Interventions")).toBeVisible();
    await expect(step("struggling", 1)).toContainText("Action: explore");
    // Step 2: first unassisted check, answered with the reversal distractor
    await expect(step("struggling", 2)).toContainText("Action: independent_check");
    await expect(step("struggling", 2)).toContainText("Check recorded as: independent");
    // Step 3: targeted fraction manipulation triggered by the REVERSAL misconception
    await expect(step("struggling", 3)).toContainText("Action: explore");
    await expect(step("struggling", 3)).toContainText("Misconception Detected: REVERSAL");
    await expect(step("struggling", 4)).toContainText("Action: guided_practice");
    // Step 5: supported check straight after remediation is recorded as assisted
    await expect(step("struggling", 5)).toContainText("Action: independent_check");
    await expect(step("struggling", 5)).toContainText("assisted (cannot count toward mastery)");
    // Step 6: ambiguous error -> diagnostic probe, which is not evidence
    await expect(step("struggling", 6)).toContainText("Action: independent_check");
    await expect(step("struggling", 6)).toContainText(
      "Ambiguous Error → Diagnostic Probe Activated",
    );
    await expect(step("struggling", 6)).toContainText("not evidence");
    // Step 7: alternative explanation after continued difficulty
    await expect(step("struggling", 7)).toContainText("Action: explain");
    await expect(step("struggling", 8)).toContainText("Action: independent_check");
    // Final step 9: pause (bounded remediation loop)
    await expect(step("struggling", 9)).toContainText("Action: pause");
    await expect(step("struggling", 10)).toHaveCount(0);
    await expect(page.getByText("Status: paused_at_stopping_point")).toBeVisible();

    // Verify Learner B (Succeeding) Column
    await expect(page.getByText("Learner B: Succeeding Independently")).toBeVisible();
    await expect(page.getByText("Independent Mastery & Progression")).toBeVisible();
    await expect(step("succeeding", 1)).toContainText("Action: explore");
    await expect(step("succeeding", 2)).toContainText("Action: independent_check");
    await expect(step("succeeding", 3)).toContainText("Action: independent_check");
    // Step 4: two correct answers move the lesson on, but the objective is not
    // advanced. The belief reducer still reports "developing" and the server
    // envelope does not offer advance.
    await expect(step("succeeding", 4)).toContainText("Action: independent_check");
    await expect(step("succeeding", 4)).toContainText(
      "Objective status (belief reducer): developing",
    );
    await expect(step("succeeding", 4)).toContainText("ready_for_demonstration_check");
    await expect(step("succeeding", 4)).not.toContainText("Action: advance");
    // Step 5: advance, authorized only once the belief reducer reports demonstrated
    await expect(step("succeeding", 5)).toContainText("Action: advance");
    await expect(step("succeeding", 5)).toContainText(
      "Objective status (belief reducer): demonstrated",
    );
    await expect(page.getByText("Status: mastery_demonstrated_advanced")).toBeVisible();

    // 6. Test Step Preview interactivity
    const previewBtn = page.locator("[data-testid='preview-activity-struggling-3']");
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    // Verify preview lesson player mounts with the selected step activity
    const previewPlayer = page.locator("[data-testid='preview-lesson-player']");
    await expect(previewPlayer).toBeVisible();
    await expect(page.getByText("Close Step Preview")).toBeVisible();

    // 7. Test Science Objective (SCI-ELEC-CIRCUITS)
    await page.locator("[data-testid='trace-subject-science']").click();
    await runBtn.click();

    // Verify science trace shows circuit exploration, AIR_GAP remediation, and advance
    await expect(step("struggling", 3)).toContainText("Misconception Detected: AIR_GAP");
    await expect(step("struggling", 3)).toContainText("Testing the Open Switch Air Gap");
    await expect(step("struggling", 9)).toContainText("Action: pause");
    await expect(step("succeeding", 4)).not.toContainText("Action: advance");
    await expect(step("succeeding", 5)).toContainText("Action: advance");
  });

  test("P1: A staff admin runs an open-topic lesson as a synthetic learner: stored, refresh-safe, and it changes direction after a missed answer", async ({
    page,
  }) => {
    await signInAsStaffAdmin(page);
    const res = await page.goto("/dev/open-topic");
    expect(res?.status()).toBe(200);

    // This server uses the mock provider, and the page says so in plain words.
    await expect(page.locator("[data-testid='provider-readiness']")).toContainText(
      "MOCK provider in use",
    );

    // Typing before the development server has hydrated the page is lost: retry.
    const input = page.locator("[data-testid='preview-topic-input']");
    const start = page.locator("[data-testid='preview-start']");
    await expect(async () => {
      await input.fill("");
      await input.fill("photosynthesis");
      await expect(start).toBeEnabled({ timeout: 1500 });
    }).toPass({ timeout: 90000 });
    await page.locator("[data-testid='preview-level']").selectOption("7");
    await start.click();

    // The accepted lesson is stored and addressed by its id in the URL.
    await expect(page).toHaveURL(/\/dev\/open-topic\?lesson=open-ses_/);
    const lessonLabel = await page.locator("[data-testid='preview-lesson-id']").innerText();
    const player = page.locator("[data-testid='preview-player']");
    await expect(player.locator("[data-testid='adaptive-step-label']")).toHaveText("STEP 1");
    await expect(player.locator("[data-testid='generated-preview-banner']")).toContainText(
      "Generated preview",
    );
    await expect(page.locator("[data-testid='trace-content-basis']")).toContainText(
      "model_knowledge",
    );
    await expect(page.locator("[data-testid='open-trace-step-1']")).toContainText("generated");

    // Refresh: the same stored lesson and step come back.
    await page.reload();
    await expect(page.locator("[data-testid='preview-lesson-id']")).toHaveText(lessonLabel);
    await expect(player.locator("[data-testid='adaptive-step-label']")).toHaveText("STEP 1");

    // Play the first step by hand in the real player; the trace follows.
    await expect(async () => {
      await player.locator('button:has-text("Let\'s Explore")').click({ timeout: 1500 });
      await expect(player.locator("[data-testid='adaptive-step-label']")).toHaveText("STEP 2", {
        timeout: 3000,
      });
    }).toPass({ timeout: 90000 });
    await expect(page.locator("[data-testid='open-trace-step-2']")).toBeVisible();

    // A struggling synthetic learner: the miss at step 3 turns step 4 into a
    // diagnostic probe instead of the next question.
    await page.locator("[data-testid='autoplay-struggling']").click();
    await expect(page.locator("[data-testid='preview-notice']")).toContainText("completed", {
      timeout: 60000,
    });
    await expect(page.locator("[data-testid='open-trace-step-3']")).toContainText("not yet");
    await expect(page.locator("[data-testid='open-trace-step-3']")).toContainText("model_key");
    await expect(page.locator("[data-testid='open-trace-step-4']")).toContainText("diagnostic");
    await expect(page.locator("[data-testid='preview-trace']")).toContainText(
      "practice feedback, not evidence",
    );
    await expect(player.locator("[data-testid='practice-complete']")).toBeVisible();
  });
});
