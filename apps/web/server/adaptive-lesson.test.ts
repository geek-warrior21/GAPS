import { describe, expect, it } from "vitest";
import {
  getDb,
  users,
  hashPin,
  attempts,
  itemInstances,
  conceptBeliefs,
  events,
  learningSessions,
  sparksLedger,
  createStudentRepo,
  and,
  asc,
  eq,
} from "@gaps/db";
import type {
  LessonActivity,
  LessonRespondResponse,
  TeachingDecisionInput,
  TeachingDecisionOutput,
} from "@gaps/contracts";
import { MATHS_FRAC_PART_LESSON, SCI_CIRCUITS_LESSON } from "@gaps/content";
import {
  getRecommendedNextAction,
  startOrResumeLessonSession,
  submitLessonActivityResponse,
} from "./lesson/service";
import { getAdaptiveLesson } from "./teaching/adaptive-lessons";
import { respondToAdaptiveLesson, startOrResumeAdaptiveLesson } from "./teaching/adaptive-session";
import { AuthoredTeachingDecisionEngine } from "./teaching/authored-engine";
import { LlmTeachingDecisionEngine } from "./teaching/llm-engine";
import { getBankItem, getBankItems } from "./teaching/item-bank";
import type { TeachingDecisionEngine } from "./teaching/types";

const FRACTIONS = "lesson-maths-frac-part-adaptive";
const CIRCUITS = "lesson-sci-circuits-adaptive";

type Answerer = (activity: LessonActivity, checkNumber: number) => string;

describe("Engine-driven lesson sessions (persisted student journeys)", () => {
  const db = getDb();
  const orgId = "org_01J00000000000000000000001";
  const cohortId = "coh_01J00000000000000000000001";
  let counter = 0;

  const createStudent = async (label: string): Promise<string> => {
    counter += 1;
    const id = `stu_adp_${label}_${Date.now()}_${counter}`;
    await db
      .insert(users)
      .values({
        id,
        role: "student",
        orgId,
        cohortId,
        displayName: `Adaptive Test ${label}`,
        username: `adp_${label}_${Date.now()}_${counter}`,
        pinHash: hashPin("999999"),
        status: "active",
        avatar: { color: "teal", icon: "spark" },
        settings: {},
      })
      .onConflictDoNothing();
    return id;
  };

  /** Item behind a student-facing check, looked up by its authored item id. */
  const itemOf = (activity: LessonActivity) => {
    if (activity.config.type !== "independent_check") throw new Error("not a check");
    const item = getBankItem(activity.config.itemInstanceId ?? "");
    if (!item) throw new Error(`no bank item for ${activity.id}`);
    return item;
  };

  const correct: Answerer = (activity) => itemOf(activity).correctChoiceId;
  const withMisconception =
    (tag: string): Answerer =>
    (activity) => {
      const item = itemOf(activity);
      const choice = item.choices.find((c) => c.misconception === tag);
      if (!choice) throw new Error(`${item.itemId} has no ${tag} distractor`);
      return choice.id;
    };
  const ambiguous: Answerer = (activity) => {
    const item = itemOf(activity);
    const choice = item.choices.find((c) => c.id !== item.correctChoiceId && !c.misconception);
    if (!choice) throw new Error(`${item.itemId} has no unclassified distractor`);
    return choice.id;
  };
  const anyWrong: Answerer = (activity) => {
    const item = itemOf(activity);
    return item.choices.find((c) => c.id !== item.correctChoiceId)!.id;
  };

  const responseFor = (activity: LessonActivity, answer?: string): unknown => {
    const config = activity.config;
    if (config.type === "independent_check") return { answer };
    if (config.type === "guided_practice") return { value: config.targetCriteria.expectedValue };
    if (config.type === "interactive_manipulation") return { explored: true };
    return { acknowledged: true };
  };

  const storedAttempts = (studentId: string, conceptId: string) =>
    db
      .select({
        id: attempts.id,
        outcome: attempts.outcome,
        assistanceLevel: attempts.assistanceLevel,
        itemInstanceId: attempts.itemInstanceId,
        templateId: itemInstances.templateId,
        clientAttemptId: attempts.clientAttemptId,
        misconceptionId: attempts.misconceptionId,
        mode: attempts.mode,
      })
      .from(attempts)
      .innerJoin(itemInstances, eq(attempts.itemInstanceId, itemInstances.id))
      .where(and(eq(attempts.studentId, studentId), eq(attempts.conceptId, conceptId)))
      .orderBy(asc(attempts.createdAt), asc(attempts.id));

  const beliefStatus = async (studentId: string, conceptId: string) =>
    (await createStudentRepo(studentId, db).getConceptBelief(conceptId))?.status ?? "not_assessed";

  const tracesFor = (studentId: string, sessionId: string) =>
    createStudentRepo(studentId, db).listDecisionTraces(sessionId);

  /** Answers the active activity and returns the response. */
  const answer = async (
    studentId: string,
    lessonId: string,
    activity: LessonActivity,
    choice?: string,
  ): Promise<LessonRespondResponse> =>
    submitLessonActivityResponse(
      studentId,
      lessonId,
      activity.id,
      responseFor(activity, choice),
      db,
    );

  const expectNoAnswerLeak = (payload: unknown) => {
    const json = JSON.stringify(payload);
    // Every check sent to a student is blanked and marked server-graded.
    expect(json).not.toMatch(/"correctAnswer":"[^"]+"/);
    expect(json).not.toMatch(/"explanation":"[^"]+"/);
    expect(json).not.toContain("misconception");
    expect(json).not.toContain("rationale");
    expect(json).not.toContain("adaptiveState");
  };

  for (const [lessonId, conceptId, nextObjective] of [
    [FRACTIONS, "MATH-FRAC-PART", "MATH-FRAC-EQUIV"],
    [CIRCUITS, "SCI-ELEC-CIRCUITS", "SCI-ELEC-CONDUCTORS"],
  ] as const) {
    it(`${conceptId}: an independently succeeding learner advances only when the belief reducer reports demonstrated`, async () => {
      const studentId = await createStudent("ok");

      const start = await startOrResumeLessonSession(studentId, lessonId, db);
      expectNoAnswerLeak(start);
      expect(start.adaptive).toMatchObject({ objectiveId: conceptId, stepNumber: 1 });
      expect(start.activeActivity?.type).toBe("interactive_manipulation");
      expect(start.session.mode).toBe("lesson");

      // Step 1: opening exploration (participation only).
      const r1 = await answer(studentId, lessonId, start.activeActivity!);
      expectNoAnswerLeak(r1);
      expect(r1.activeActivity?.type).toBe("independent_check");
      expect(await storedAttempts(studentId, conceptId)).toHaveLength(0);
      expect(await beliefStatus(studentId, conceptId)).toBe("not_assessed");

      // Step 2: first unassisted check.
      const check1 = r1.activeActivity!;
      const r2 = await answer(studentId, lessonId, check1, correct(check1, 1));
      expect(r2.isCorrect).toBe(true);
      expect(r2.feedback).toBe(itemOf(check1).explanation);
      expect(r2.activeActivity?.type).toBe("independent_check");

      // Step 3: second unassisted check on a distinct item. The teaching policy's
      // two-answer rule is now satisfied, but the objective must NOT advance.
      const check2 = r2.activeActivity!;
      expect(itemOf(check2).itemId).not.toBe(itemOf(check1).itemId);
      const r3 = await answer(studentId, lessonId, check2, correct(check2, 2));
      expect(r3.isCorrect).toBe(true);
      expect(r3.isCompleted).toBe(false);
      expect(r3.sparksAwarded).toBe(0);
      expect(r3.adaptive?.isClosingStep).toBe(false);
      expect(r3.activeActivity?.type).toBe("independent_check");
      expect(await beliefStatus(studentId, conceptId)).toBe("developing");

      // Step 4: third distinct item, spanning the second template -> demonstrated.
      const check3 = r3.activeActivity!;
      const r4 = await answer(studentId, lessonId, check3, correct(check3, 3));
      expect(r4.isCorrect).toBe(true);
      expect(await beliefStatus(studentId, conceptId)).toBe("demonstrated");
      expect(r4.sparksAwarded).toBe(20); // mastery Sparks, awarded once by the evidence path
      expect(r4.adaptive?.isClosingStep).toBe(true);
      expect(r4.activeActivity?.title).toContain("Milestone Achieved");
      expect(r4.isCompleted).toBe(false);

      // Step 5: acknowledge the milestone -> lesson completes.
      const r5 = await answer(studentId, lessonId, r4.activeActivity!);
      expect(r5.isCompleted).toBe(true);
      expect(r5.sparksAwarded).toBe(15);

      const rows = await storedAttempts(studentId, conceptId);
      expect(rows).toHaveLength(3);
      expect(rows.every((a) => a.outcome === "correct" && a.assistanceLevel === 0)).toBe(true);
      expect(rows.every((a) => a.mode === "lesson")).toBe(true);
      expect(new Set(rows.map((a) => a.itemInstanceId)).size).toBe(3);
      expect(new Set(rows.map((a) => a.templateId)).size).toBe(2);

      // Developer trace: one stored decision per delivered step, with its evidence.
      const traces = await tracesFor(studentId, start.session.id);
      const results = traces.map((t) => t.result as Record<string, unknown>);
      expect(results.map((r) => r.action)).toEqual([
        "explore",
        "independent_check",
        "independent_check",
        "independent_check",
        "advance",
      ]);
      expect(results[3]?.lessonStage).toBe("ready_for_demonstration_check");
      expect(results[3]?.objectiveStatus).toBe("developing");
      expect(results[3]?.eligibleActions).toEqual(["independent_check"]);
      expect(results[4]?.objectiveStatus).toBe("demonstrated");
      expect(traces.every((t) => t.provider === "authored" && !t.fallbackUsed)).toBe(true);
      expect(traces.every((t) => t.policyVersion === "teaching-rules-1.1")).toBe(true);
      expect(JSON.stringify(traces)).not.toContain("Adaptive Test");

      const next = await getRecommendedNextAction(
        studentId,
        conceptId.startsWith("MATH") ? "maths" : "science",
        db,
      );
      expect(next.actionType).toBe("continue_next_objective");
      expect(next.objectiveId).toBe(nextObjective);
    });
  }

  it("MATH-FRAC-PART: a struggling learner gets a different sequence, and supported success does not establish mastery", async () => {
    const studentId = await createStudent("recover");
    const conceptId = "MATH-FRAC-PART";

    const start = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    const r1 = await answer(studentId, FRACTIONS, start.activeActivity!);

    // First check: numerator/denominator reversal.
    const check1 = r1.activeActivity!;
    const r2 = await answer(studentId, FRACTIONS, check1, withMisconception("REVERSAL")(check1, 1));
    expect(r2.isCorrect).toBe(false);
    expect(r2.feedback).toMatch(/^Not yet\./);
    expect(r2.feedback).not.toContain("2/5"); // the answer is not revealed
    expect(r2.feedback?.toLowerCase()).not.toMatch(/wrong|failed|incorrect/);
    // Targeted fraction manipulation, not another question.
    expect(r2.activeActivity?.type).toBe("interactive_manipulation");
    expect(r2.activeActivity?.title).toContain("Denominator Controls the Slices");

    const r3 = await answer(studentId, FRACTIONS, r2.activeActivity!);
    expect(r3.activeActivity?.type).toBe("guided_practice");
    const r4 = await answer(studentId, FRACTIONS, r3.activeActivity!);
    expect(r4.activeActivity?.type).toBe("independent_check");

    // Supported check straight after remediation: correct, but assisted.
    const supported = r4.activeActivity!;
    const r5 = await answer(studentId, FRACTIONS, supported, correct(supported, 2));
    expect(r5.isCorrect).toBe(true);
    let rows = await storedAttempts(studentId, conceptId);
    expect(rows.map((a) => [a.outcome, a.assistanceLevel])).toEqual([
      ["incorrect", 0],
      ["correct", 1],
    ]);
    expect(r5.adaptive?.isClosingStep).toBe(false);

    // Two further unassisted correct answers: with the assisted one that is three
    // correct in a row, yet only two are independent -> still not demonstrated.
    const fresh1 = r5.activeActivity!;
    const r6 = await answer(studentId, FRACTIONS, fresh1, correct(fresh1, 3));
    const fresh2 = r6.activeActivity!;
    const r7 = await answer(studentId, FRACTIONS, fresh2, correct(fresh2, 4));
    expect(await beliefStatus(studentId, conceptId)).toBe("developing");
    expect(r7.adaptive?.isClosingStep).toBe(false);
    expect(r7.activeActivity?.type).toBe("independent_check");

    // A third independent correct answer meets the reducer's rule.
    const fresh3 = r7.activeActivity!;
    const r8 = await answer(studentId, FRACTIONS, fresh3, correct(fresh3, 5));
    expect(await beliefStatus(studentId, conceptId)).toBe("demonstrated");
    expect(r8.adaptive?.isClosingStep).toBe(true);

    rows = await storedAttempts(studentId, conceptId);
    expect(rows.map((a) => a.assistanceLevel)).toEqual([0, 1, 0, 0, 0]);
    expect(new Set(rows.map((a) => a.itemInstanceId)).size).toBe(5);

    const traces = await tracesFor(studentId, start.session.id);
    const actions = traces.map((t) => (t.result as { action: string }).action);
    expect(actions).toEqual([
      "explore",
      "independent_check",
      "explore",
      "guided_practice",
      "independent_check",
      "independent_check",
      "independent_check",
      "independent_check",
      "advance",
    ]);
    expect((traces[2]!.result as { inferredMisconception: string }).inferredMisconception).toBe(
      "REVERSAL",
    );
  });

  it("SCI-ELEC-CIRCUITS: a struggling learner gets experiment, diagnostic probe, alternative explanation, then a bounded pause with save-and-resume", async () => {
    const studentId = await createStudent("pause");
    const conceptId = "SCI-ELEC-CIRCUITS";

    const start = await startOrResumeLessonSession(studentId, CIRCUITS, db);
    const r1 = await answer(studentId, CIRCUITS, start.activeActivity!);

    // Open-circuit misconception -> circuit experiment.
    const check1 = r1.activeActivity!;
    const r2 = await answer(studentId, CIRCUITS, check1, withMisconception("AIR_GAP")(check1, 1));
    expect(r2.isCorrect).toBe(false);
    expect(r2.activeActivity?.title).toContain("Testing the Open Switch Air Gap");
    const r3 = await answer(studentId, CIRCUITS, r2.activeActivity!);
    expect(r3.activeActivity?.type).toBe("guided_practice");
    const r4 = await answer(studentId, CIRCUITS, r3.activeActivity!);

    // Supported check answered with an unclassified distractor -> diagnostic probe,
    // not an assumed misconception.
    const supported = r4.activeActivity!;
    const r5 = await answer(studentId, CIRCUITS, supported, ambiguous(supported, 2));
    expect(r5.isCorrect).toBe(false);
    const probe = r5.activeActivity!;
    expect(probe.title).toContain("Diagnostic Check");
    expect(itemOf(probe).kind).toBe("diagnostic");
    expect(await storedAttempts(studentId, conceptId)).toHaveLength(2);

    // The probe is not evidence: no attempt, no belief change.
    const beliefBeforeProbe = await beliefStatus(studentId, conceptId);
    const r6 = await answer(studentId, CIRCUITS, probe, anyWrong(probe, 0));
    expect(r6.isCorrect).toBe(false);
    expect(await storedAttempts(studentId, conceptId)).toHaveLength(2);
    expect(await beliefStatus(studentId, conceptId)).toBe(beliefBeforeProbe);

    // Continued difficulty -> a different explanation.
    expect(r6.activeActivity?.type).toBe("intro");
    expect(r6.activeActivity?.title).toContain("Why Electric Loops Cannot Have Gaps");
    const r7 = await answer(studentId, CIRCUITS, r6.activeActivity!);
    const supported2 = r7.activeActivity!;
    expect(supported2.type).toBe("independent_check");

    // Third miss -> the server requires a pause.
    const r8 = await answer(studentId, CIRCUITS, supported2, anyWrong(supported2, 3));
    const pause = r8.activeActivity!;
    expect(pause.type).toBe("stopping_point");
    expect(r8.adaptive).toMatchObject({ isPaused: true, isClosingStep: false });
    expect(JSON.stringify(pause).toLowerCase()).not.toMatch(/wrong|failed/);

    const rows = await storedAttempts(studentId, conceptId);
    expect(rows.map((a) => [a.outcome, a.assistanceLevel])).toEqual([
      ["incorrect", 0],
      ["incorrect", 1],
      ["incorrect", 1],
    ]);
    expect(["developing", "needs_support"]).toContain(await beliefStatus(studentId, conceptId));

    // Save and pause: the session stays open and nothing is completed.
    const saved = await submitLessonActivityResponse(
      studentId,
      CIRCUITS,
      pause.id,
      { acknowledged: true, saveAndExit: true },
      db,
    );
    expect(saved.isSavedAndExited).toBe(true);
    expect(saved.isCompleted).toBe(false);
    expect(saved.sparksAwarded).toBe(0);

    const next = await getRecommendedNextAction(studentId, "science", db);
    expect(next.actionType).toBe("revisit_unresolved");
    expect(next.reasonCode).toBe("SAVED_AT_STOPPING_POINT");
    expect(next.lessonId).toBe(CIRCUITS);

    // Returning later resumes at the same stopping point.
    const resumed = await startOrResumeLessonSession(studentId, CIRCUITS, db);
    expect(resumed.session.id).toBe(start.session.id);
    expect(resumed.activeActivity?.id).toBe(pause.id);
    expect(resumed.adaptive?.isPaused).toBe(true);

    // Continuing starts a new round with a walkthrough, then a supported check.
    const r9 = await answer(studentId, CIRCUITS, pause);
    expect(r9.activeActivity?.type).toBe("intro");
    expect(r9.activeActivity?.title).toContain("Concept Walkthrough");
    const r10 = await answer(studentId, CIRCUITS, r9.activeActivity!);
    const afterPause = r10.activeActivity!;
    expect(afterPause.type).toBe("independent_check");
    await answer(studentId, CIRCUITS, afterPause, correct(afterPause, 4));
    const last = (await storedAttempts(studentId, conceptId)).at(-1)!;
    expect([last.outcome, last.assistanceLevel]).toEqual(["correct", 1]);
    expect(["developing", "needs_support"]).toContain(await beliefStatus(studentId, conceptId));

    const traces = await tracesFor(studentId, start.session.id);
    const results = traces.map((t) => t.result as Record<string, unknown>);
    expect(results.slice(0, 9).map((r) => r.action)).toEqual([
      "explore",
      "independent_check",
      "explore",
      "guided_practice",
      "independent_check",
      "independent_check",
      "explain",
      "independent_check",
      "pause",
    ]);
    expect(results[5]).toMatchObject({ role: "diagnostic", isAmbiguous: true });
    expect(results[8]?.eligibleActions).toEqual(["pause"]);
  });

  it("a slip is not treated as a misconception: a correct probe leads to a fresh unassisted check", async () => {
    const studentId = await createStudent("slip");
    const start = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    const r1 = await answer(studentId, FRACTIONS, start.activeActivity!);
    const check1 = r1.activeActivity!;
    const r2 = await answer(studentId, FRACTIONS, check1, ambiguous(check1, 1));
    const probe = r2.activeActivity!;
    expect(itemOf(probe).kind).toBe("diagnostic");

    const r3 = await answer(studentId, FRACTIONS, probe, correct(probe, 0));
    expect(r3.isCorrect).toBe(true);
    const fresh = r3.activeActivity!;
    expect(fresh.type).toBe("independent_check");
    expect(itemOf(fresh).kind).toBe("assessment");
    await answer(studentId, FRACTIONS, fresh, correct(fresh, 2));

    const rows = await storedAttempts(studentId, "MATH-FRAC-PART");
    // No remediation was given, so the fresh check counts as independent.
    expect(rows.map((a) => [a.outcome, a.assistanceLevel])).toEqual([
      ["incorrect", 0],
      ["correct", 0],
    ]);
  });

  it("refresh and retry reuse the stored step; responses are idempotent; assistance provenance survives a reload", async () => {
    const studentId = await createStudent("refresh");
    const conceptId = "MATH-FRAC-PART";

    const start = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    const again = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    expect(again.session.id).toBe(start.session.id);
    expect(again.activeActivity).toEqual(start.activeActivity);
    expect(await tracesFor(studentId, start.session.id)).toHaveLength(1);

    const r1 = await answer(studentId, FRACTIONS, start.activeActivity!);
    const check1 = r1.activeActivity!;

    // Reload on a check: the same question, not a regenerated one.
    const reloaded = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    expect(reloaded.activeActivity).toEqual(check1);
    expect(reloaded.completedActivities).toEqual([start.activeActivity!.id]);
    expect(await tracesFor(studentId, start.session.id)).toHaveLength(2);

    // A retried submission returns the stored result and records nothing new.
    const wrong = withMisconception("REVERSAL")(check1, 1);
    const first = await answer(studentId, FRACTIONS, check1, wrong);
    const retry = await answer(studentId, FRACTIONS, check1, wrong);
    // Even a retry carrying a different answer cannot change the stored result.
    const tampered = await answer(studentId, FRACTIONS, check1, correct(check1, 1));
    for (const replay of [retry, tampered]) {
      expect(replay.isCorrect).toBe(false);
      expect(replay.feedback).toBe(first.feedback);
      expect(replay.activeActivity).toEqual(first.activeActivity);
      expect(replay.sparksAwarded).toBe(0);
    }
    expect(await storedAttempts(studentId, conceptId)).toHaveLength(1);
    expect(await tracesFor(studentId, start.session.id)).toHaveLength(3);

    // Work through remediation, then reload before the supported check.
    const r3 = await answer(studentId, FRACTIONS, first.activeActivity!);
    const r4 = await answer(studentId, FRACTIONS, r3.activeActivity!);
    const supported = r4.activeActivity!;
    const beforeAnswer = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    expect(beforeAnswer.activeActivity).toEqual(supported);
    expect(beforeAnswer.assistanceStatus?.[supported.id]).toBe("assisted");
    expect(beforeAnswer.assistanceStatus?.[check1.id]).toBe("independent");

    // Two simultaneous submissions of the same step count once.
    const [a, b] = await Promise.all([
      answer(studentId, FRACTIONS, supported, correct(supported, 2)),
      answer(studentId, FRACTIONS, supported, correct(supported, 2)),
    ]);
    expect(a.isCorrect).toBe(true);
    expect(b.isCorrect).toBe(true);
    expect(b.activeActivity).toEqual(a.activeActivity);
    const rows = await storedAttempts(studentId, conceptId);
    expect(rows.map((r) => [r.outcome, r.assistanceLevel])).toEqual([
      ["incorrect", 0],
      ["correct", 1],
    ]);
    expect(new Set(rows.map((r) => r.clientAttemptId)).size).toBe(2);

    const after = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    expect(after.adaptive?.stepNumber).toBe(6);

    // An activity that was never delivered is rejected.
    await expect(
      submitLessonActivityResponse(studentId, FRACTIONS, "act_never_delivered", {}, db),
    ).rejects.toMatchObject({ statusCode: 409, code: "ACTIVITY_MISMATCH" });
  });

  it("an unreadable answer is not evidence and keeps the same question active", async () => {
    const studentId = await createStudent("invalid");
    const start = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    const r1 = await answer(studentId, FRACTIONS, start.activeActivity!);
    const check1 = r1.activeActivity!;

    for (const bad of [{ answer: "not_a_choice" }, { answer: "" }, {}, "2/5"]) {
      await expect(
        submitLessonActivityResponse(studentId, FRACTIONS, check1.id, bad, db),
      ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_RESPONSE" });
    }
    expect(await storedAttempts(studentId, "MATH-FRAC-PART")).toHaveLength(0);
    const reloaded = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    expect(reloaded.activeActivity).toEqual(check1);
  });

  it("sessions are scoped to their student", async () => {
    const owner = await createStudent("owner");
    const other = await createStudent("other");
    const start = await startOrResumeLessonSession(owner, FRACTIONS, db);

    await expect(
      submitLessonActivityResponse(other, FRACTIONS, start.activeActivity!.id, {}, db),
    ).rejects.toMatchObject({ statusCode: 404, code: "SESSION_NOT_FOUND" });
    expect(await tracesFor(other, start.session.id)).toHaveLength(0);

    const otherStart = await startOrResumeLessonSession(other, FRACTIONS, db);
    expect(otherStart.session.id).not.toBe(start.session.id);
    const ownerAgain = await startOrResumeLessonSession(owner, FRACTIONS, db);
    expect(ownerAgain.adaptive?.stepNumber).toBe(1);
  });

  it("a returning learner is given items they have not met before", async () => {
    const studentId = await createStudent("return");
    const play = async () => {
      const start = await startOrResumeLessonSession(studentId, CIRCUITS, db);
      let res = await answer(studentId, CIRCUITS, start.activeActivity!);
      const seen: string[] = [];
      while (res.activeActivity?.type === "independent_check") {
        const check = res.activeActivity;
        seen.push(itemOf(check).itemId);
        res = await answer(studentId, CIRCUITS, check, correct(check, 0));
      }
      if (!res.isCompleted) await answer(studentId, CIRCUITS, res.activeActivity!);
      return { seen, sessionId: start.session.id };
    };

    const first = await play();
    const second = await play();
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(first.seen).toHaveLength(3);
    expect(second.seen.length).toBeGreaterThan(0);
    expect(second.seen.some((id) => first.seen.includes(id))).toBe(false);
  });

  describe("authored fallback and the server envelope", () => {
    const def = getAdaptiveLesson(FRACTIONS)!;

    const playWith = async (engine: TeachingDecisionEngine, label: string) => {
      const studentId = await createStudent(label);
      const start = await startOrResumeAdaptiveLesson(studentId, def, db, { engine });
      const respond = (activity: LessonActivity, choice?: string) =>
        respondToAdaptiveLesson(studentId, def, activity.id, responseFor(activity, choice), db, {
          engine,
        });
      return { studentId, start, respond };
    };

    const expectAuthoredJourney = async (
      game: Awaited<ReturnType<typeof playWith>>,
      expectedReason: RegExp,
    ) => {
      const { studentId, start, respond } = game;
      expect(start.activeActivity?.title).toBe("Interactive Exploration: Fraction Strip Lab");
      let res = await respond(start.activeActivity!);
      let checks = 0;
      while (res.activeActivity?.type === "independent_check") {
        const check = res.activeActivity;
        // Assessed questions are always authored bank items.
        expect(itemOf(check).objectiveId).toBe("MATH-FRAC-PART");
        res = await respond(check, correct(check, 0));
        checks += 1;
      }
      expect(checks).toBe(3);
      expect(res.adaptive?.isClosingStep).toBe(true);
      expect(await beliefStatus(studentId, "MATH-FRAC-PART")).toBe("demonstrated");

      const traces = await tracesFor(studentId, start.session.id);
      expect(traces.length).toBe(5);
      for (const trace of traces) {
        expect(trace.fallbackUsed).toBe(true);
        expect(trace.provider).toBe("fallback");
        const result = trace.result as {
          fallbackReason: string;
          unverifiedExplanatoryProse: boolean;
        };
        expect(result.fallbackReason).toMatch(expectedReason);
        expect(result.unverifiedExplanatoryProse).toBe(false);
      }
    };

    it("a failing engine never blocks the lesson: every step falls back to authored content for the same objective", async () => {
      const failing: TeachingDecisionEngine = {
        decideNextStep: async () => {
          throw new Error("provider timeout");
        },
      };
      await expectAuthoredJourney(await playWith(failing, "fail"), /^ENGINE_EXCEPTION/);
    });

    it("the model engine with the provider disabled runs the whole journey on authored content", async () => {
      await expectAuthoredJourney(
        await playWith(new LlmTeachingDecisionEngine(), "llmoff"),
        /^LLM_PROVIDER_DISABLED$/,
      );
    });

    it("an engine cannot leave the server envelope, declare mastery, or write assessed questions", async () => {
      const authored = new AuthoredTeachingDecisionEngine();
      const seenInputs: TeachingDecisionInput[] = [];
      const rogue: TeachingDecisionEngine = {
        decideNextStep: async (input): Promise<TeachingDecisionOutput> => {
          seenInputs.push(input);
          const base = await authored.decideNextStep(input);
          if (input.previouslyDeliveredActivities.length === 0) {
            // Tries to declare mastery before any evidence exists.
            return {
              ...base,
              action: "advance",
              activity: {
                id: "act_rogue_advance",
                type: "intro",
                title: "Mastery!",
                instructions: "",
                config: { type: "intro", headline: "Mastered", body: "You have mastered this." },
              },
              audit: { source: "llm_suggested", model: "rogue", unverifiedExplanatoryProse: true },
            };
          }
          // Tries to supply its own, trivially answerable assessed question.
          return {
            ...base,
            action: "independent_check",
            activity: {
              id: "act_rogue_check",
              type: "independent_check",
              title: "Easy question",
              instructions: "",
              config: {
                type: "independent_check",
                conceptId: "MATH-FRAC-PART",
                templateId: "tpl_rogue",
                itemInstanceId: "itm_rogue_1",
                prompt: "Is 1 equal to 1?",
                questionType: "choice",
                choices: [{ id: "yes", text: "Yes" }],
                correctAnswer: "yes",
                explanation: "Yes.",
              },
            },
            audit: { source: "llm_suggested", model: "rogue", unverifiedExplanatoryProse: true },
          };
        },
      };

      const { studentId, start, respond } = await playWith(rogue, "rogue");
      // The out-of-envelope "advance" is replaced by the authored opening step.
      expect(start.activeActivity?.type).toBe("interactive_manipulation");
      expect(start.adaptive?.isClosingStep).toBe(false);

      let res = await respond(start.activeActivity!);
      let checks = 0;
      while (res.activeActivity?.type === "independent_check") {
        const check = res.activeActivity;
        expect(check.id).not.toBe("act_rogue_check");
        expect(itemOf(check).templateId).toMatch(/^tpl_adp_frac_part_/);
        res = await respond(check, correct(check, 0));
        checks += 1;
      }
      // The reducer's threshold is unchanged by the engine: three checks, not one.
      expect(checks).toBe(3);

      const rows = await storedAttempts(studentId, "MATH-FRAC-PART");
      expect(rows.some((a) => a.itemInstanceId === "itm_rogue_1")).toBe(false);
      const traces = await tracesFor(studentId, start.session.id);
      const first = traces[0]!.result as { fallbackReason: string; action: string };
      expect(first.action).toBe("explore");
      expect(first.fallbackReason).toMatch(/^ACTION_OUTSIDE_ENVELOPE/);
      // The engine was told the reducer's status and never saw a student identifier.
      expect(seenInputs.every((i) => i.objectiveStatus !== undefined)).toBe(true);
      expect(JSON.stringify(seenInputs)).not.toContain(studentId);
    });
  });

  it("unreadable stored lesson state falls back to a fresh authored session instead of failing", async () => {
    const studentId = await createStudent("corrupt");
    const start = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    await db
      .update(learningSessions)
      .set({
        counters: { lessonId: FRACTIONS, adaptive: true, adaptiveState: { steps: "broken" } },
      })
      .where(eq(learningSessions.id, start.session.id));

    const recovered = await startOrResumeLessonSession(studentId, FRACTIONS, db);
    expect(recovered.session.id).not.toBe(start.session.id);
    expect(recovered.activeActivity?.type).toBe("interactive_manipulation");
    const [old] = await db
      .select()
      .from(learningSessions)
      .where(eq(learningSessions.id, start.session.id));
    expect(old?.status).toBe("abandoned");
  });

  it("the item bank gives each objective distinct assessed questions across two templates", () => {
    for (const objectiveId of ["MATH-FRAC-PART", "SCI-ELEC-CIRCUITS"]) {
      const items = getBankItems(objectiveId);
      const assessed = items.filter((i) => i.kind === "assessment");
      expect(assessed.length).toBeGreaterThanOrEqual(8);
      expect(new Set(assessed.map((i) => i.templateId)).size).toBe(2);
      expect(new Set(items.map((i) => i.itemId)).size).toBe(items.length);
      expect(new Set(items.map((i) => i.prompt)).size).toBe(items.length);
      expect(new Set(items.map((i) => `${i.templateId}:${i.seed}`)).size).toBe(items.length);
      // Any three consecutive assessed items span both templates.
      for (let i = 0; i + 2 < assessed.length; i++) {
        expect(new Set(assessed.slice(i, i + 3).map((x) => x.templateId)).size).toBe(2);
      }
      for (const item of items) {
        const ids = item.choices.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(item.correctChoiceId);
        expect(
          item.choices.find((c) => c.id === item.correctChoiceId)?.misconception,
        ).toBeUndefined();
      }
      expect(items.filter((i) => i.kind === "diagnostic")).toHaveLength(1);
    }
  });

  it("fixed authored lessons no longer send check answers to the student, and are still graded on the server", async () => {
    const studentId = await createStudent("fixed");
    for (const lesson of [MATHS_FRAC_PART_LESSON, SCI_CIRCUITS_LESSON]) {
      const start = await startOrResumeLessonSession(studentId, lesson.lessonId, db);
      const json = JSON.stringify(start);
      expect(json).not.toMatch(/"correctAnswer":"[^"]+"/);
      expect(start.lesson.activities).toHaveLength(lesson.activities.length);
      const checks = start.lesson.activities.filter((a) => a.type === "independent_check");
      expect(checks.length).toBeGreaterThan(0);
      for (const check of checks) {
        expect(check.config).toMatchObject({ serverGraded: true, correctAnswer: "" });
      }
    }

    // Grading still uses the authored answer held on the server.
    const lessonId = MATHS_FRAC_PART_LESSON.lessonId;
    const steps: Array<[string, unknown]> = [
      ["act_1_intro", { read: true }],
      ["act_2_manipulation", { parts: 4 }],
      ["act_3_predict", { choiceId: "choice_3_4" }],
      ["act_4_guided", { value: "2/5" }],
    ];
    for (const [activityId, response] of steps) {
      await submitLessonActivityResponse(studentId, lessonId, activityId, response, db);
    }
    const graded = await submitLessonActivityResponse(
      studentId,
      lessonId,
      "act_5_check",
      { answer: "choice_a" },
      db,
    );
    expect(graded.isCorrect).toBe(true);
    expect(graded.feedback).toBeTruthy();
    expect(graded.isCompleted).toBe(true);
  });

  it("lesson participation alone never creates evidence, Sparks or mastery", async () => {
    const studentId = await createStudent("participation");
    const start = await startOrResumeLessonSession(studentId, CIRCUITS, db);
    await answer(studentId, CIRCUITS, start.activeActivity!);

    expect(await storedAttempts(studentId, "SCI-ELEC-CIRCUITS")).toHaveLength(0);
    expect(
      await db.select().from(conceptBeliefs).where(eq(conceptBeliefs.studentId, studentId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(sparksLedger).where(eq(sparksLedger.studentId, studentId)),
    ).toHaveLength(0);
    const stepEvents = await db
      .select()
      .from(events)
      .where(and(eq(events.studentId, studentId), eq(events.type, "lesson_adaptive_step")));
    expect(stepEvents).toHaveLength(1);
    expect(stepEvents[0]?.payload).toMatchObject({ countedAsEvidence: false, role: "teach" });
  });
});
