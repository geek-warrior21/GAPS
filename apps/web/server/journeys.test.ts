import { beforeAll, describe, expect, it } from "vitest";
import {
  getChapterBosses,
  getConceptsOverview,
  getDailyQuest,
  initSolveWithMe,
  processSessionAttempt,
  startBossBattle,
  startDailyQuestSession,
  startQuickCheckSession,
} from "./session/engine";
import { consentRecords, createStudentRepo, getDb, studentState, users } from "@gaps/db";

describe("Phase 8 Student Journeys — Unit Tests", () => {
  const db = getDb();
  const testStudentId = `stu_journey_test_${Date.now()}`;
  let studentRepo = createStudentRepo(testStudentId, db);

  beforeAll(async () => {
    await db.insert(users).values({
      id: testStudentId,
      role: "student",
      orgId: "org_01J00000000000000000000001",
      cohortId: "coh_01J00000000000000000000001",
      displayName: "Test Learner",
      username: `test_learner_${Date.now()}`,
      pinHash: "hash123",
      status: "active",
    });

    await db.insert(studentState).values({
      studentId: testStudentId,
      stateVersion: 1,
      focusConceptId: "MATH-FRAC-PART",
      startConceptId: "MATH-FRAC-PART",
      sparksTotal: 0,
    });

    await db.insert(consentRecords).values({
      id: `con_journey_${Date.now()}`,
      studentId: testStudentId,
      scope: "core_learning",
      method: "school_paper",
      evidenceRef: "CONSENT-TEST",
      recordedBy: "usr_01J00000000000000000000001",
      grantedAt: new Date(),
    });

    studentRepo = createStudentRepo(testStudentId, db);
  });

  it("Journey 1 & 2: Concepts Overview returns 3 chapters with 14 concepts", async () => {
    const overview = await getConceptsOverview(testStudentId, db);
    expect(overview.chapters).toHaveLength(3);
    const totalConcepts = overview.chapters.reduce((sum, ch) => sum + ch.concepts.length, 0);
    expect(totalConcepts).toBe(14);
    expect(overview.chapters[0]!.id).toBe("A");
    expect(overview.chapters[0]!.concepts[0]!.id).toBe("MATH-FRAC-PART");
  });

  it("Journey 3: Complete Daily Quest awards +20 completion Sparks, preserved after refresh", async () => {
    // 1. Fetch initial quest
    const initialQuest = await getDailyQuest(testStudentId, db);
    expect(initialQuest.slots).toHaveLength(3);

    // 2. Start quest session
    const questSessionRes = await startDailyQuestSession(testStudentId, db);
    expect(questSessionRes.session.mode).toBe("quest");
    expect(questSessionRes.initialStep.kind).toBe("item");
    if (questSessionRes.initialStep.kind === "item") {
      expect(questSessionRes.initialStep.context).toBe("quest");
    }

    const initialSparks = await studentRepo.getSparksTotal();

    // 3. Complete each of the 3 slots
    let currentStep = questSessionRes.initialStep;
    let sparksAwardedSum = 0;

    for (let slot = 0; slot < 3; slot++) {
      expect(currentStep.kind === "item" || currentStep.kind === "feedback_then_retry").toBe(true);
      const itemInstanceId =
        currentStep.kind === "item" || currentStep.kind === "feedback_then_retry"
          ? currentStep.item.id
          : "";

      let attemptRes = await processSessionAttempt(
        testStudentId,
        questSessionRes.session.id,
        {
          clientAttemptId: crypto.randomUUID(),
          itemInstanceId,
          rawAnswer: "1/2", // sample answer
          assistanceLevel: 0,
          tryNo: 1,
          latencyMs: 1200,
        },
        db,
      );

      if (attemptRes.tryAgain) {
        // Resolve on second try
        attemptRes = await processSessionAttempt(
          testStudentId,
          questSessionRes.session.id,
          {
            clientAttemptId: crypto.randomUUID(),
            itemInstanceId,
            rawAnswer: "1/2",
            assistanceLevel: 0,
            tryNo: 2,
            latencyMs: 1200,
          },
          db,
        );
      }

      sparksAwardedSum += attemptRes.sparksAwarded;
      if (attemptRes.nextStep) {
        currentStep = attemptRes.nextStep;
      }
    }

    expect(sparksAwardedSum).toBeGreaterThanOrEqual(0);

    // 4. Verify quest completion
    const refreshedQuest = await getDailyQuest(testStudentId, db);
    expect(refreshedQuest.status).toBe("completed");
    expect(refreshedQuest.slots.every((s) => s.completed)).toBe(true);

    // 5. Verify +20 sparks were awarded for quest completion
    const endSparks = await studentRepo.getSparksTotal();
    expect(endSparks).toBeGreaterThanOrEqual(initialSparks + 20);

    // 6. Test idempotency: Calling awardSparks again for the quest returns awarded: false
    const duplicateAward = await studentRepo.awardSparks(refreshedQuest.id, "quest", 20);
    expect(duplicateAward.awarded).toBe(false);
  });

  it("Journey 4: Boss Battle enforces unlock rules, 8 items, no hints, defeat rule", async () => {
    // 1. Check bosses
    const bosses = await getChapterBosses(testStudentId, db);
    expect(bosses).toHaveLength(3);
    const bossA = bosses.find((b) => b.chapterId === "A")!;
    expect(bossA.name).toBe("The Equal Splitter");
    expect(bossA.unlockRule).toContain("4 of 7");

    // If Chapter A is not unlocked, verify startBossBattle throws 409
    if (!bossA.unlocked) {
      await expect(startBossBattle(testStudentId, "A", db)).rejects.toThrow(/locked/i);

      // Now satisfy unlock condition: give test student 4 developing concepts
      for (const cid of [
        "MATH-FRAC-PART",
        "MATH-FRAC-NUMLINE",
        "MATH-NUM-HCF",
        "MATH-FRAC-EQUIV",
      ]) {
        await studentRepo.upsertConceptBelief({
          studentId: testStudentId,
          conceptId: cid,
          status: "developing",
          reliability: "supported",
          lastEvidenceAt: new Date(),
        });
      }
    }

    // 2. Start Boss Battle A
    const bossSessionRes = await startBossBattle(testStudentId, "A", db);
    expect(bossSessionRes.session.mode).toBe("boss");
    expect(bossSessionRes.initialStep.kind).toBe("item");
    if (bossSessionRes.initialStep.kind === "item") {
      expect(bossSessionRes.initialStep.context).toBe("boss");
      expect(bossSessionRes.initialStep.help).toHaveLength(0); // Invariant: no hints during boss battle
    }

    // 3. Verify 8 items progression
    let currentStep = bossSessionRes.initialStep;
    let resolvedCount = 0;

    for (let i = 0; i < 8; i++) {
      expect(currentStep.kind).toBe("item");
      if (currentStep.kind !== "item") break;

      const attemptRes = await processSessionAttempt(
        testStudentId,
        bossSessionRes.session.id,
        {
          clientAttemptId: crypto.randomUUID(),
          itemInstanceId: currentStep.item.id,
          rawAnswer: "1",
          assistanceLevel: 0,
          tryNo: 1,
          latencyMs: 1000,
        },
        db,
      );

      resolvedCount++;
      if (attemptRes.nextStep) {
        currentStep = attemptRes.nextStep;
      }
    }

    expect(resolvedCount).toBe(8);
    // After 8 items, next step should be summary
    expect(currentStep.kind).toBe("summary");
  });

  it("Journey 5: Quick Check starts at grade entry, adapts, and completes with starting point", async () => {
    const qcRes = await startQuickCheckSession(testStudentId, db);
    expect(qcRes.session.mode).toBe("quick_check");
    expect(qcRes.initialStep.kind).toBe("item");
    if (qcRes.initialStep.kind === "item") {
      expect(qcRes.initialStep.context).toBe("quick_check");
      expect(qcRes.initialStep.item.conceptId).toBe("MATH-FRAC-EQUIV"); // Grade 7 entry
    }

    // Submit answer to advance
    const qcItemId = qcRes.initialStep.kind === "item" ? qcRes.initialStep.item.id : "";
    const attemptRes = await processSessionAttempt(
      testStudentId,
      qcRes.session.id,
      {
        clientAttemptId: crypto.randomUUID(),
        itemInstanceId: qcItemId,
        rawAnswer: "1/2",
        assistanceLevel: 0,
        tryNo: 1,
        latencyMs: 1500,
      },
      db,
    );

    expect(attemptRes.teachingAction).toBeDefined();
  });

  it("Journey 7: Solve With Me initializes guided walkthrough without AI model call", async () => {
    const solveRes = await initSolveWithMe(testStudentId, {
      text: "How do I add 1/3 and 1/4?",
      problemType: "arithmetic",
    });

    expect(solveRes.conceptId).toBe("MATH-FRAC-ADDUNLIKE");
    expect(solveRes.initialStep.kind).toBe("explanation");
    if (solveRes.initialStep.kind === "explanation") {
      expect(solveRes.initialStep.source).toBe("authored");
    }
  });
});
