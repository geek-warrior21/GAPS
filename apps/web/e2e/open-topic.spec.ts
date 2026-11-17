/* eslint-disable no-console */
import { test, expect, type Page } from "@playwright/test";
import {
  getDb,
  users,
  cohorts,
  consentRecords,
  learningSessions,
  events,
  attempts,
  conceptBeliefs,
  hashPin,
  eq,
} from "@gaps/db";

/**
 * The student-facing any-topic entry. It is OFF by default (open topics are in
 * developer preview); this server switches it on with OPEN_TOPIC_STUDENT_ENTRY
 * so the entry form, the player and the per-student consent controls can be
 * exercised. Runs on the development server with the MOCK
 * provider. This checks the entry form, the player, persistence and the
 * consent controls. It does not show that a real model can teach: the mock's
 * text says so itself. Live generation is reported separately in the handoff.
 */

const ORG_ID = "org_01J00000000000000000000001";
const TEACHER_ID = "usr_01J00000000000000000000001";
const COHORT_ID = "coh_e2e_open_topic";
const JOIN_CODE = "AIDEV7";
const STUDENT_ID = "stu_e2e_open_topic";
const USERNAME = "aidev";
const PIN = "246810";

async function ensureAiEnabledLearner() {
  const db = getDb();
  await db
    .insert(cohorts)
    .values({
      id: COHORT_ID,
      orgId: ORG_ID,
      name: "Open topic browser test",
      grade: 7,
      joinCode: JOIN_CODE,
      aiEnabled: true,
    })
    .onConflictDoNothing();
  await db
    .insert(users)
    .values({
      id: STUDENT_ID,
      role: "student",
      orgId: ORG_ID,
      cohortId: COHORT_ID,
      displayName: "Open Topic Tester",
      username: USERNAME,
      pinHash: hashPin(PIN),
      status: "active",
      avatar: { color: "teal", icon: "spark" },
      settings: {},
    })
    .onConflictDoNothing();
  for (const scope of ["core_learning", "ai_free_text"]) {
    await db
      .insert(consentRecords)
      .values({
        id: `con_e2e_open_${scope}`,
        studentId: STUDENT_ID,
        scope,
        method: "school_paper",
        evidenceRef: "E2E-FIXTURE",
        recordedBy: TEACHER_ID,
        grantedAt: new Date(),
      })
      .onConflictDoNothing();
  }
  await db.delete(events).where(eq(events.studentId, STUDENT_ID));
  await db.delete(learningSessions).where(eq(learningSessions.studentId, STUDENT_ID));
}

const signIn = async (page: Page, joinCode: string, username: string, pin: string) => {
  const res = await page.request.post("/api/v1/auth/student-login", {
    data: { joinCode, username, pin },
  });
  expect(res.status()).toBe(200);
};

const openLearn = async (page: Page) => {
  await page.goto("/learn");
  await expect(page.locator("[data-testid='open-topic-card']")).toBeVisible({ timeout: 60000 });
};

/**
 * The development server compiles and hydrates a page on first use, and input
 * typed before hydration is lost. The start button only enables once React has
 * seen the typed topic, so retry until it does.
 */
const startTopic = async (page: Page, topic: string, level: string) => {
  const input = page.locator("[data-testid='open-topic-input']");
  const start = page.locator("[data-testid='open-topic-start']");
  await expect(async () => {
    await input.fill("");
    await input.fill(topic);
    await expect(start).toBeEnabled({ timeout: 1500 });
  }).toPass({ timeout: 90000 });
  await page.locator("[data-testid='open-topic-level']").selectOption(level);
  await start.click();
};

const stepLabel = (page: Page) => page.locator("[data-testid='adaptive-step-label']");

const answerCheck = async (page: Page, choiceText: string, verdict: "correct" | "not yet") => {
  await page.locator(`button:has-text("${choiceText}")`).click();
  await page.click("button:has-text('Submit Answer')");
  await expect(
    page.getByText(verdict === "correct" ? "Correct Response!" : "Good Try — Learning Opportunity"),
  ).toBeVisible();
  // Marked as practice feedback, not a verified result.
  await expect(page.locator("[data-testid='feedback-note']")).toBeVisible();
  await page.click("[data-testid='check-continue-button']");
};

test.describe("Open-topic lessons (development server, mock provider)", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => console.log("[BROWSER ERROR]:", err.message));
    await ensureAiEnabledLearner();
  });

  test("O1: A learner types a topic, gets a labelled generated preview, and the lesson changes direction after a missed answer", async ({
    page,
  }) => {
    const payloads: string[] = [];
    page.on("response", async (res) => {
      if (!/\/api\/v1\/(lessons|open-lessons)/.test(res.url())) return;
      try {
        payloads.push(await res.text());
      } catch {
        // Body unavailable after navigation.
      }
    });

    await signIn(page, JOIN_CODE, USERNAME, PIN);
    await openLearn(page);
    await startTopic(page, "photosynthesis", "7");

    // A session exists for a topic that has no file, enum entry or page of its own.
    await expect(page).toHaveURL(/\/lesson\/open-ses_/);
    const banner = page.locator("[data-testid='generated-preview-banner']");
    await expect(banner).toContainText("Generated preview");
    await expect(banner).toContainText("not yet checked by a teacher");
    await expect(page.locator("[data-testid='generated-preview-sources']")).toContainText(
      "No approved source was available",
    );

    // Step 1: explanation card
    await expect(stepLabel(page)).toHaveText("STEP 1");
    await page.click('button:has-text("Let\'s Explore")');

    // Step 2: prediction without a simulation (none exists for this topic)
    await expect(stepLabel(page)).toHaveText("STEP 2");
    await page.locator("button:has-text('The expected outcome')").click();
    await page.click("button:has-text('Test Prediction & Observe')");
    await expect(page.getByText("Observation & Why It Happens")).toBeVisible();
    await expect(page.getByText("Verify hands-on in the simulator")).toHaveCount(0);
    await page.click("button:has-text('Continue to Next Activity')");

    // Step 3: first question, missed
    await expect(stepLabel(page)).toHaveText("STEP 3");
    await answerCheck(page, "Other option 3", "not yet");

    // Step 4: the lesson changes direction: a diagnostic probe, not the next question
    await expect(stepLabel(page)).toHaveText("STEP 4");
    await expect(page.getByRole("heading", { name: "Mock probe 4" })).toBeVisible();

    // Reload: same stored step, banner still shown
    await page.reload();
    await expect(stepLabel(page)).toHaveText("STEP 4");
    await expect(page.getByRole("heading", { name: "Mock probe 4" })).toBeVisible();
    await expect(banner).toBeVisible();

    // Probe answered correctly, then three unassisted practice answers
    await answerCheck(page, "Key option 4", "correct");
    for (const n of [5, 6, 7]) {
      await expect(stepLabel(page)).toHaveText(`STEP ${n}`);
      await answerCheck(page, `Key option ${n}`, "correct");
    }

    // Closing step written by the server, then a practice-only completion screen
    await expect(page.getByRole("heading", { name: "Practice Round Complete" })).toBeVisible();
    await page.click("[data-testid='finish-for-today-button']");
    const done = page.locator("[data-testid='practice-complete']");
    await expect(done).toContainText("practice only");
    await expect(page.getByText("Sparks")).toHaveCount(0);
    await expect(page.getByText("Mastery Demonstrated")).toHaveCount(0);

    // No answer key reached the browser, and nothing became evidence.
    expect(payloads.length).toBeGreaterThan(5);
    for (const body of payloads) {
      expect(body).not.toMatch(/"correctAnswer":"[^"]+"/);
      expect(body).not.toContain("openTopicState");
    }
    const db = getDb();
    expect(await db.select().from(attempts).where(eq(attempts.studentId, STUDENT_ID))).toHaveLength(
      0,
    );
    expect(
      await db.select().from(conceptBeliefs).where(eq(conceptBeliefs.studentId, STUDENT_ID)),
    ).toHaveLength(0);
  });

  test("O2: An ambiguous request gets one short clarification, then the lesson starts", async ({
    page,
  }) => {
    await signIn(page, JOIN_CODE, USERNAME, PIN);
    await openLearn(page);
    await startTopic(page, "cells", "8");

    const clarify = page.locator("[data-testid='open-topic-clarify']");
    await expect(clarify).toContainText("Which kind of cells do you mean?");
    await expect(page).toHaveURL(/\/learn/);
    await clarify.locator("button:has-text('Cells in living things')").click();

    await expect(page).toHaveURL(/\/lesson\/open-ses_/);
    await expect(page.locator("[data-testid='generated-preview-banner']")).toBeVisible();
    await expect(stepLabel(page)).toHaveText("STEP 1");
  });

  test("O3: A learner without AI consent gets a plain refusal for a new topic, and no session", async ({
    page,
  }) => {
    // Meera is in the demo class, where AI is off and no AI consent is recorded.
    await signIn(page, "DEMO7A", "meera", "333333");
    await openLearn(page);
    await startTopic(page, "states of matter", "6");

    await expect(page.locator("[data-testid='open-topic-message']")).toContainText("AI features");
    await expect(page).toHaveURL(/\/learn/);
    await expect(page.locator("[data-testid='generated-preview-banner']")).toHaveCount(0);
  });
});
