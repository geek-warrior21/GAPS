import { describe, expect, it } from "vitest";
import { createStudentRepo, getDb, getItemInstance, attempts } from "@gaps/db";
import { eq, and } from "drizzle-orm";
import {
  advanceLearningSessionStep,
  processSessionAttempt,
  startLearningSession,
} from "./session/engine";
import { handleTutorTurn } from "./tutor/service";

describe("Server-Side Assistance Level Enforcement & Invariant §3", () => {
  const db = getDb();
  const ananyaId = "stu_01J00000000000000000000004";

  it("Tutor hint -> correct answer is authoritatively marked assisted and cannot promote mastery", async () => {
    const studentRepo = createStudentRepo(ananyaId, db);
    const { session, initialStep } = await startLearningSession(
      ananyaId,
      { mode: "learn", budgetS: 900 },
      db,
    );

    const itemStep = initialStep as { item: { id: string; conceptId: string } };
    const itemId = itemStep.item.id;
    const itemInstance = await getItemInstance(db, itemId);
    expect(itemInstance).toBeDefined();

    // 1. Request a hint from the tutor
    await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Give me a hint please",
        intent: "hint",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    // Verify session counters recorded assistance server-side
    const refreshedSession = await studentRepo.getSession(session.id);
    const counters = (refreshedSession?.counters as Record<string, unknown>) ?? {};
    const itemAssistance = (counters.itemAssistance as Record<string, number>) ?? {};
    expect(itemAssistance[itemId]).toBeGreaterThanOrEqual(1);

    // 2. Submit correct answer, but client attempts to spoof assistanceLevel: 0
    // Get actual correct answer value
    const answerObj = itemInstance?.answer as { kind: string; value: { n: number; d: number } };
    const rawAnswer = `${answerObj.value.n}/${answerObj.value.d}`;

    const clientAttemptId = crypto.randomUUID();
    const result = await processSessionAttempt(
      ananyaId,
      session.id,
      {
        clientAttemptId,
        itemInstanceId: itemId,
        rawAnswer,
        assistanceLevel: 0, // Client tries to spoof 0!
        tryNo: 1,
        latencyMs: 1200,
      },
      db,
    );

    expect(result.outcome).toBe("correct");

    // 3. Verify attempt recorded in DB has assistanceLevel >= 1
    const recordedAttempts = await db
      .select()
      .from(attempts)
      .where(
        and(eq(attempts.sessionId, session.id), eq(attempts.clientAttemptId, clientAttemptId)),
      );

    expect(recordedAttempts[0]?.assistanceLevel).toBeGreaterThanOrEqual(1);

    // 4. Invariant §3: Assisted attempt cannot promote mastery to demonstrated
    const belief = await studentRepo.getConceptBelief(itemStep.item.conceptId);
    expect(belief?.status).not.toBe("demonstrated");
  });

  it("Refresh after help preserves assisted status", async () => {
    const studentRepo = createStudentRepo(ananyaId, db);
    const { session, initialStep } = await startLearningSession(
      ananyaId,
      { mode: "learn", budgetS: 900 },
      db,
    );

    const itemStep = initialStep as { item: { id: string } };
    const itemId = itemStep.item.id;
    const itemInstance = await getItemInstance(db, itemId);

    // Student asks for visual help
    await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Show me a visual model",
        intent: "visual",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    // Simulate page refresh: reload session from database
    const sessionAfterReload = await studentRepo.getSession(session.id);
    const counters = (sessionAfterReload?.counters as Record<string, unknown>) ?? {};
    const itemAssistance = (counters.itemAssistance as Record<string, number>) ?? {};
    expect(itemAssistance[itemId]).toBeGreaterThanOrEqual(2);

    // Now submit answer on the reloaded page with client assistanceLevel: 0
    const answerObj = itemInstance?.answer as { kind: string; value: { n: number; d: number } };
    const rawAnswer = `${answerObj.value.n}/${answerObj.value.d}`;

    const clientAttemptId = crypto.randomUUID();
    await processSessionAttempt(
      ananyaId,
      session.id,
      {
        clientAttemptId,
        itemInstanceId: itemId,
        rawAnswer,
        assistanceLevel: 0,
        tryNo: 1,
        latencyMs: 1500,
      },
      db,
    );

    const recorded = await db
      .select()
      .from(attempts)
      .where(
        and(eq(attempts.sessionId, session.id), eq(attempts.clientAttemptId, clientAttemptId)),
      );

    expect(recorded[0]?.assistanceLevel).toBeGreaterThanOrEqual(2);
  });

  it("A fresh item without help counts as independent", async () => {
    const { session, initialStep } = await startLearningSession(
      ananyaId,
      { mode: "learn", budgetS: 900 },
      db,
    );

    // Turn 1: On item 1, request help
    const item1 = (initialStep as { item: { id: string } }).item;
    await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Hint please",
        intent: "hint",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    // Advance to a fresh item 2
    const advanceRes = await advanceLearningSessionStep(ananyaId, session.id, db);
    expect(advanceRes.step.kind).toBe("item");
    const freshItemStep = advanceRes.step as { item: { id: string } };
    const freshItemId = freshItemStep.item.id;
    expect(freshItemId).not.toBe(item1.id);

    const itemInstance = await getItemInstance(db, freshItemId);
    const answerObj = itemInstance?.answer as { kind: string; value: { n: number; d: number } };
    const rawAnswer = `${answerObj.value.n}/${answerObj.value.d}`;

    // Submit answer on fresh item WITHOUT asking for help
    const clientAttemptId = crypto.randomUUID();
    await processSessionAttempt(
      ananyaId,
      session.id,
      {
        clientAttemptId,
        itemInstanceId: freshItemId,
        rawAnswer,
        assistanceLevel: 0,
        tryNo: 1,
        latencyMs: 1000,
      },
      db,
    );

    const recorded = await db
      .select()
      .from(attempts)
      .where(
        and(eq(attempts.sessionId, session.id), eq(attempts.clientAttemptId, clientAttemptId)),
      );

    // Must be strictly 0 (independent)
    expect(recorded[0]?.assistanceLevel).toBe(0);
  });
});
