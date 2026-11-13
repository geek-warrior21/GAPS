import { describe, expect, it } from "vitest";
import { buildComebackCard } from "./comeback";
import { evaluateBossBattle } from "./policy/l2";
import { decideNextAction, guardDecision } from "./policy/l3";
import { makeBelief, makeContext } from "./policy/l3.test";
import type { CheckedAttempt } from "./types";

describe("Phase 1 review regressions (findings 1-4)", () => {
  it("F1: never returns action outside allowedActions and rejects empty allowedActions", () => {
    // 1a: Fallback must never return an action outside allowedActions
    const ctxDisallowedFallback = makeContext({
      allowedActions: ["ADVANCE"],
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 1 },
    });
    const res = decideNextAction(ctxDisallowedFallback);
    expect(ctxDisallowedFallback.allowedActions).toContain(res.selectedAction);

    // 1b: Empty allowedActions must not authorize execution
    const ctxEmpty = makeContext({
      allowedActions: [],
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
    });
    expect(() => decideNextAction(ctxEmpty)).toThrow();
    expect(() =>
      guardDecision(ctxEmpty, {
        decisionId: ctxEmpty.decisionId,
        selectedAction: "ADVANCE",
        params: {},
        reasonCodes: ["TEST"],
        provider: "rules",
        policyVersion: "rules-1.0",
        fallbackUsed: false,
        latencyMs: 0,
      }),
    ).toThrow();
  });

  it("F2: requires explicit justBecameDemonstrated for R13 and routes retrieval to dueReviewConceptId", () => {
    // 2a: Concept demonstrated earlier, but not just demonstrated -> R14 (INDEPENDENT_PRACTICE)
    const ctxAlreadyDemonstrated = makeContext({
      belief: makeBelief("MATH-FRAC-ADDUNLIKE", "demonstrated"),
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
      justBecameDemonstrated: false,
      reviewDue: false,
    });
    const resAlready = decideNextAction(ctxAlreadyDemonstrated);
    expect(resAlready.selectedAction).toBe("INDEPENDENT_PRACTICE");
    expect(resAlready.reasonCodes).toContain("R14_KEEP_GOING");

    // 2b: Just demonstrated with review due on another concept -> routes to dueReviewConceptId
    const ctxDueOther = makeContext({
      focusConceptId: "MATH-FRAC-ADDUNLIKE",
      belief: makeBelief("MATH-FRAC-ADDUNLIKE", "demonstrated"),
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
      justBecameDemonstrated: true,
      reviewDue: true,
      dueReviewConceptId: "MATH-FRAC-PART",
    });
    const resDueOther = decideNextAction(ctxDueOther);
    expect(resDueOther.selectedAction).toBe("RETRIEVAL_REVIEW");
    expect(resDueOther.params.conceptId).toBe("MATH-FRAC-PART");
    expect(resDueOther.params.conceptId).not.toBe(ctxDueOther.focusConceptId);
  });

  it("F3: cites demonstration evidence accurately on C,I,C,C across multi-day learning and retention", () => {
    const history: CheckedAttempt[] = [
      // Day 1: support entered
      {
        attemptId: "att_01J00000000000000000000001",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000001",
        clientAttemptId: "11111111-1111-4111-8111-000000000001",
        itemInstanceId: "itm_01J00000000000000000000001",
        templateId: "T1",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "incorrect",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-01T10:00:00.000Z",
      },
      {
        attemptId: "att_01J00000000000000000000002",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000001",
        clientAttemptId: "11111111-1111-4111-8111-000000000002",
        itemInstanceId: "itm_01J00000000000000000000002",
        templateId: "T2",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "incorrect",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-01T10:05:00.000Z",
      },
      // Day 2: C
      {
        attemptId: "att_01J00000000000000000000003",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000002",
        clientAttemptId: "11111111-1111-4111-8111-000000000003",
        itemInstanceId: "itm_01J00000000000000000000003",
        templateId: "T1",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-02T10:00:00.000Z",
      },
      // Day 3: I, C, C -> qualifying L4 is [C, I, C, C], okL4 has 3 correct attempts
      {
        attemptId: "att_01J00000000000000000000004",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000003",
        clientAttemptId: "11111111-1111-4111-8111-000000000004",
        itemInstanceId: "itm_01J00000000000000000000004",
        templateId: "T2",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "incorrect",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-03T10:00:00.000Z",
      },
      {
        attemptId: "att_01J00000000000000000000005",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000003",
        clientAttemptId: "11111111-1111-4111-8111-000000000005",
        itemInstanceId: "itm_01J00000000000000000000005",
        templateId: "T1",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-03T10:05:00.000Z",
      },
      {
        attemptId: "att_01J00000000000000000000006",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000003",
        clientAttemptId: "11111111-1111-4111-8111-000000000006",
        itemInstanceId: "itm_01J00000000000000000000006",
        templateId: "T2",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-03T10:10:00.000Z",
      },
    ];

    const card = buildComebackCard({
      conceptId: "MATH-FRAC-EQUIV",
      studentTitle: "Equivalent fractions",
      status: "demonstrated",
      firstNeedsSupportAt: "2026-11-01T10:05:00.000Z",
      achievedAt: "2026-11-03T10:10:00.000Z",
      history,
    });

    expect(card).not.toBeNull();
    // Must cite the 3 qualifying correct attempts from okL4, not just streak
    expect(card?.presentAttemptIds).toEqual([
      "att_01J00000000000000000000003",
      "att_01J00000000000000000000005",
      "att_01J00000000000000000000006",
    ]);
    expect(card?.presentCorrect).toBe(3);
    expect(card?.presentAttemptIds.length).toBe(card?.presentCorrect);
    // Spans multi-day learning (Day 2 and Day 3)
    expect(card?.spansMultipleDays).toBe(true);
    expect(card?.messageKey).toBe("comeback.multiDay");
  });

  it("F4: boss victory requires 8 resolved items and rejects invalid result lengths", () => {
    // 6 correct out of 6 items (incomplete battle) must NOT be declared victorious
    const sixItems = Array(6).fill("correct");
    const incompleteRes = evaluateBossBattle(sixItems);
    expect(incompleteRes.total).toBe(6);
    expect(incompleteRes.defeated).toBe(false);

    // Over-long battle (> 8 items) must be rejected
    const nineItems = Array(9).fill("correct");
    expect(() => evaluateBossBattle(nineItems)).toThrow();
  });
});
