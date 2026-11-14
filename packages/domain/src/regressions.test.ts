import { describe, expect, it } from "vitest";
import { buildComebackCard } from "./comeback";
import { isValidPrefixedId } from "./ids";
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

  it("CR1: validates fallback action preconditions and fails closed when no valid fallback exists", () => {
    // Only RETRIEVAL_REVIEW in allowedActions, but reviewDue is false -> no valid fallback
    const ctxNoValidFallback = makeContext({
      allowedActions: ["RETRIEVAL_REVIEW"],
      reviewDue: false,
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 1 },
    });
    expect(() => decideNextAction(ctxNoValidFallback)).toThrowError(/Cannot authorize execution/);

    // Only REVIEW_PREREQUISITE in allowedActions, but no weak prerequisite -> fails closed
    const ctxNoPrereqFallback = makeContext({
      allowedActions: ["REVIEW_PREREQUISITE"],
      prerequisiteBeliefs: [],
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 1 },
    });
    expect(() => decideNextAction(ctxNoPrereqFallback)).toThrowError(/Cannot authorize execution/);
  });

  it("CR2: boss battle does not complete or defeat with 6 correct plus unparseable and not_simplified", () => {
    const mixedOutcomes = [
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
      "unparseable",
      "not_simplified",
    ] as const;
    const res = evaluateBossBattle(mixedOutcomes);
    expect(res.completed).toBe(false);
    expect(res.defeated).toBe(false);
    expect(() => evaluateBossBattle(mixedOutcomes, { requireComplete: true })).toThrow();
  });

  it("CR3: requires dueReviewConceptId when reviewDue=true and never silently substitutes focus concept", () => {
    const ctxMissingDueReviewConcept = makeContext({
      focusConceptId: "MATH-FRAC-ADDUNLIKE",
      belief: makeBelief("MATH-FRAC-ADDUNLIKE", "demonstrated"),
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
      justBecameDemonstrated: true,
      reviewDue: true,
      dueReviewConceptId: undefined,
    });
    expect(() => decideNextAction(ctxMissingDueReviewConcept)).toThrowError(
      /dueReviewConceptId is required when reviewDue is true/,
    );
  });

  it("CR4: preserves original demonstration citations on retention cards with intervening practice and warm-ups", () => {
    const history: CheckedAttempt[] = [
      // Day 1: needs support
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
      // Day 2-3: C, I, C, C on T1/T2 -> qualifying demonstration citations
      {
        attemptId: "att_01J00000000000000000000002",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000002",
        clientAttemptId: "11111111-1111-4111-8111-000000000002",
        itemInstanceId: "itm_01J00000000000000000000002",
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
      {
        attemptId: "att_01J00000000000000000000003",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000003",
        clientAttemptId: "11111111-1111-4111-8111-000000000003",
        itemInstanceId: "itm_01J00000000000000000000003",
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
        attemptId: "att_01J00000000000000000000004",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000003",
        clientAttemptId: "11111111-1111-4111-8111-000000000004",
        itemInstanceId: "itm_01J00000000000000000000004",
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
        attemptId: "att_01J00000000000000000000005",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000003",
        clientAttemptId: "11111111-1111-4111-8111-000000000005",
        itemInstanceId: "itm_01J00000000000000000000005",
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
      // Day 4: Intervening independent practice attempts
      {
        attemptId: "att_01J00000000000000000000006",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000004",
        clientAttemptId: "11111111-1111-4111-8111-000000000006",
        itemInstanceId: "itm_01J00000000000000000000006",
        templateId: "T1",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-04T10:00:00.000Z",
      },
      {
        attemptId: "att_01J00000000000000000000007",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000004",
        clientAttemptId: "11111111-1111-4111-8111-000000000007",
        itemInstanceId: "itm_01J00000000000000000000007",
        templateId: "T2",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-04T10:05:00.000Z",
      },
      // Day 5: Warm-up review attempt
      {
        attemptId: "att_01J00000000000000000000008",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000005",
        clientAttemptId: "11111111-1111-4111-8111-000000000008",
        itemInstanceId: "itm_01J00000000000000000000008",
        templateId: "T1",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "review",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: true,
        verifierVersion: "verify-1.0",
        at: "2026-11-05T10:00:00.000Z",
      },
      // Day 10: Retention review attempt (7+ days after demonstration)
      {
        attemptId: "att_01J00000000000000000000009",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000006",
        clientAttemptId: "11111111-1111-4111-8111-000000000009",
        itemInstanceId: "itm_01J00000000000000000000009",
        templateId: "T2",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "review",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: true,
        verifierVersion: "verify-1.0",
        at: "2026-11-10T10:00:00.000Z",
      },
    ];

    const card = buildComebackCard({
      conceptId: "MATH-FRAC-EQUIV",
      studentTitle: "Equivalent fractions",
      status: "retained",
      firstNeedsSupportAt: "2026-11-01T10:00:00.000Z",
      achievedAt: "2026-11-10T10:00:00.000Z",
      history,
    });

    expect(card).not.toBeNull();
    // Must cite the original demonstration attempts from Day 2-3, NOT intervening att_6, att_7, att_8
    expect(card?.presentAttemptIds).toEqual([
      "att_01J00000000000000000000002",
      "att_01J00000000000000000000004",
      "att_01J00000000000000000000005",
    ]);
    expect(card?.retentionAttemptId).toBe("att_01J00000000000000000000009");
  });

  it("CR5: ComebackCardData in domain is pure structured data without hardcoded string templates", () => {
    const history: CheckedAttempt[] = [
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
        sessionId: "ses_01J00000000000000000000002",
        clientAttemptId: "11111111-1111-4111-8111-000000000002",
        itemInstanceId: "itm_01J00000000000000000000002",
        templateId: "T1",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-03T10:00:00.000Z",
      },
      {
        attemptId: "att_01J00000000000000000000003",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000002",
        clientAttemptId: "11111111-1111-4111-8111-000000000003",
        itemInstanceId: "itm_01J00000000000000000000003",
        templateId: "T2",
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
        attemptId: "att_01J00000000000000000000004",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000002",
        clientAttemptId: "11111111-1111-4111-8111-000000000004",
        itemInstanceId: "itm_01J00000000000000000000004",
        templateId: "T1",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-03T10:10:00.000Z",
      },
      {
        attemptId: "att_01J00000000000000000000005",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000002",
        clientAttemptId: "11111111-1111-4111-8111-000000000005",
        itemInstanceId: "itm_01J00000000000000000000005",
        templateId: "T2",
        conceptId: "MATH-FRAC-EQUIV",
        mode: "learn",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-03T10:15:00.000Z",
      },
    ];

    const card = buildComebackCard({
      conceptId: "MATH-FRAC-EQUIV",
      studentTitle: "Equivalent fractions",
      status: "demonstrated",
      firstNeedsSupportAt: "2026-11-01T10:00:00.000Z",
      achievedAt: "2026-11-03T10:15:00.000Z",
      history,
    });
    expect(card).not.toBeNull();
    // card must not have hardcoded message property
    expect("message" in (card ?? {})).toBe(false);
  });

  it("CR6: rejects ULID overflow encodings (first Crockford character > 7)", () => {
    expect(isValidPrefixedId("att_80000000000000000000000000", "attempt")).toBe(false);
    expect(isValidPrefixedId("att_90000000000000000000000000", "attempt")).toBe(false);
    expect(isValidPrefixedId("att_A0000000000000000000000000", "attempt")).toBe(false);
    expect(isValidPrefixedId("att_ZZZZZZZZZZZZZZZZZZZZZZZZZZ", "attempt")).toBe(false);
    expect(isValidPrefixedId("att_7ZZZZZZZZZZZZZZZZZZZZZZZZZ", "attempt")).toBe(true);
    expect(isValidPrefixedId("att_01J00000000000000000000001", "attempt")).toBe(true);
  });

  describe("Review 3: Shared guard predicates and authoritative belief transitions", () => {
    it("Issue 1a: guardDecision with reviewDue=true and no dueReviewConceptId fails closed even with candidate conceptId", () => {
      const ctxMissingDueReview = makeContext({
        reviewDue: true,
        dueReviewConceptId: undefined,
        allowedActions: ["RETRIEVAL_REVIEW", "INDEPENDENT_PRACTICE"],
      });

      const candidate = {
        decisionId: ctxMissingDueReview.decisionId,
        selectedAction: "RETRIEVAL_REVIEW" as const,
        params: { conceptId: "MATH-NUM-LCM" as const },
        reasonCodes: ["TEST"],
        provider: "rules" as const,
        policyVersion: "rules-1.0" as const,
        fallbackUsed: false,
        latencyMs: 0,
      };

      expect(() => guardDecision(ctxMissingDueReview, candidate)).toThrowError(
        /dueReviewConceptId is required when reviewDue is true/,
      );
    });

    it("Issue 1b: guardDecision rejects REVIEW_PREREQUISITE if prereqRouteTaken is true or target is not an eligible weak prerequisite", () => {
      // Target is demonstrated -> not an eligible weak prerequisite
      const ctxDemonstratedPrereq = makeContext({
        allowedActions: ["REVIEW_PREREQUISITE", "INDEPENDENT_PRACTICE"],
        prerequisiteBeliefs: [makeBelief("MATH-FRAC-EQUIV", "demonstrated")],
        session: {
          mode: "learn",
          incorrectOnConcept: 3,
          prereqRouteTaken: false,
          hintRungShown: 0,
          consecutiveIndependentCorrect: 0,
        },
      });

      const cand1 = {
        decisionId: ctxDemonstratedPrereq.decisionId,
        selectedAction: "REVIEW_PREREQUISITE" as const,
        params: { conceptId: "MATH-FRAC-EQUIV" as const },
        reasonCodes: ["TEST"],
        provider: "rules" as const,
        policyVersion: "rules-1.0" as const,
        fallbackUsed: false,
        latencyMs: 0,
      };

      const res1 = guardDecision(ctxDemonstratedPrereq, cand1);
      expect(res1.selectedAction).toBe("INDEPENDENT_PRACTICE");

      // prereqRouteTaken is true -> cannot take prerequisite route
      const ctxPrereqRouteTaken = makeContext({
        allowedActions: ["REVIEW_PREREQUISITE", "INDEPENDENT_PRACTICE"],
        prerequisiteBeliefs: [makeBelief("MATH-FRAC-EQUIV", "needs_support")],
        session: {
          mode: "learn",
          incorrectOnConcept: 3,
          prereqRouteTaken: true,
          hintRungShown: 0,
          consecutiveIndependentCorrect: 0,
        },
      });

      const cand2 = {
        decisionId: ctxPrereqRouteTaken.decisionId,
        selectedAction: "REVIEW_PREREQUISITE" as const,
        params: { conceptId: "MATH-FRAC-EQUIV" as const },
        reasonCodes: ["TEST"],
        provider: "rules" as const,
        policyVersion: "rules-1.0" as const,
        fallbackUsed: false,
        latencyMs: 0,
      };

      const res2 = guardDecision(ctxPrereqRouteTaken, cand2);
      expect(res2.selectedAction).toBe("INDEPENDENT_PRACTICE");

      // When only REVIEW_PREREQUISITE is allowed, failing the predicate fails closed
      const ctxOnlyPrereqFailsClosed = makeContext({
        allowedActions: ["REVIEW_PREREQUISITE"],
        prerequisiteBeliefs: [makeBelief("MATH-FRAC-EQUIV", "needs_support")],
        session: {
          mode: "learn",
          incorrectOnConcept: 3,
          prereqRouteTaken: true,
          hintRungShown: 0,
          consecutiveIndependentCorrect: 0,
        },
      });

      expect(() => guardDecision(ctxOnlyPrereqFailsClosed, cand2)).toThrowError(
        /Cannot authorize execution/,
      );
    });

    it("Issue 2a: sequence I, I, C(T1), C(T1), C(T1), I(T1), C(T2), C(T2) cites attempts 5, 7, 8 (not 4, 5, 7)", () => {
      const history: CheckedAttempt[] = [
        // 1: I (T1)
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
        // 2: I (T1) -> triggers needs_support at 2026-11-01T10:05:00.000Z
        {
          attemptId: "att_01J00000000000000000000002",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000001",
          clientAttemptId: "11111111-1111-4111-8111-000000000002",
          itemInstanceId: "itm_01J00000000000000000000002",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-01T10:05:00.000Z",
        },
        // 3: C (T1)
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
          at: "2026-11-02T10:10:00.000Z",
        },
        // 4: C (T1)
        {
          attemptId: "att_01J00000000000000000000004",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000004",
          itemInstanceId: "itm_01J00000000000000000000004",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:12:00.000Z",
        },
        // 5: C (T1) -> 3 correct, but only 1 template (needs 2) -> remains developing
        {
          attemptId: "att_01J00000000000000000000005",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
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
          at: "2026-11-02T10:14:00.000Z",
        },
        // 6: I (T1) -> l2 becomes [C, I]
        {
          attemptId: "att_01J00000000000000000000006",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000006",
          itemInstanceId: "itm_01J00000000000000000000006",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:16:00.000Z",
        },
        // 7: C (T2) -> l2 becomes [I, C] (not every correct) -> remains developing
        {
          attemptId: "att_01J00000000000000000000007",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000007",
          itemInstanceId: "itm_01J00000000000000000000007",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:18:00.000Z",
        },
        // 8: C (T2) -> demonstration achieved! l4 is [att5, att6, att7, att8], okL4 is [att5, att7, att8]
        {
          attemptId: "att_01J00000000000000000000008",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000008",
          itemInstanceId: "itm_01J00000000000000000000008",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:20:00.000Z",
        },
      ];

      const card = buildComebackCard({
        conceptId: "MATH-FRAC-EQUIV",
        studentTitle: "Equivalent fractions",
        status: "demonstrated",
        firstNeedsSupportAt: "2026-11-01T10:05:00.000Z",
        achievedAt: "2026-11-02T10:20:00.000Z",
        history,
      });

      expect(card).not.toBeNull();
      expect(card?.presentAttemptIds).toEqual([
        "att_01J00000000000000000000005",
        "att_01J00000000000000000000007",
        "att_01J00000000000000000000008",
      ]);
      expect(card?.presentCorrect).toBe(3);
      expect(card?.presentTotal).toBe(4);
    });

    it("Issue 2b: retention card preserves original demonstration citations even after intervening practice", () => {
      const history: CheckedAttempt[] = [
        // 1-2: Needs support on Nov 1
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
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-01T10:05:00.000Z",
        },
        // 3-5: Demonstrated on Nov 2 (T1, T2, T2)
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
          at: "2026-11-02T10:10:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000004",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000004",
          itemInstanceId: "itm_01J00000000000000000000004",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:12:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000005",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000005",
          itemInstanceId: "itm_01J00000000000000000000005",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:14:00.000Z",
        },
        // 6-7: Intervening practice on Nov 5
        {
          attemptId: "att_01J00000000000000000000006",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000003",
          clientAttemptId: "11111111-1111-4111-8111-000000000006",
          itemInstanceId: "itm_01J00000000000000000000006",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-05T10:10:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000007",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000003",
          clientAttemptId: "11111111-1111-4111-8111-000000000007",
          itemInstanceId: "itm_01J00000000000000000000007",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-05T10:15:00.000Z",
        },
        // 8: Retention review on Nov 10 (8 days after demonstration)
        {
          attemptId: "att_01J00000000000000000000008",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000004",
          clientAttemptId: "11111111-1111-4111-8111-000000000008",
          itemInstanceId: "itm_01J00000000000000000000008",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: true,
          verifierVersion: "verify-1.0",
          at: "2026-11-10T10:00:00.000Z",
        },
      ];

      const card = buildComebackCard({
        conceptId: "MATH-FRAC-EQUIV",
        studentTitle: "Equivalent fractions",
        status: "retained",
        firstNeedsSupportAt: "2026-11-01T10:05:00.000Z",
        achievedAt: "2026-11-10T10:00:00.000Z",
        history,
      });

      expect(card).not.toBeNull();
      // Must cite the original demonstration attempts, NOT intervening attempts 6 & 7
      expect(card?.presentAttemptIds).toEqual([
        "att_01J00000000000000000000003",
        "att_01J00000000000000000000004",
        "att_01J00000000000000000000005",
      ]);
      expect(card?.retentionAttemptId).toBe("att_01J00000000000000000000008");
      expect(card?.status).toBe("retained");
    });

    it("Issue 2c: demotion followed by re-demonstration cites the new re-demonstration attempts", () => {
      const history: CheckedAttempt[] = [
        // 1-2: Needs support on Nov 1
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
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-01T10:05:00.000Z",
        },
        // 3-5: First demonstration on Nov 2 (T1, T2, T2)
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
          at: "2026-11-02T10:10:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000004",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000004",
          itemInstanceId: "itm_01J00000000000000000000004",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:12:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000005",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000005",
          itemInstanceId: "itm_01J00000000000000000000005",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:14:00.000Z",
        },
        // 6-7: Consecutive misses on Nov 4 -> demoted to needs_support!
        {
          attemptId: "att_01J00000000000000000000006",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000003",
          clientAttemptId: "11111111-1111-4111-8111-000000000006",
          itemInstanceId: "itm_01J00000000000000000000006",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-04T10:00:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000007",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000003",
          clientAttemptId: "11111111-1111-4111-8111-000000000007",
          itemInstanceId: "itm_01J00000000000000000000007",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-04T10:05:00.000Z",
        },
        // 8-10: Fresh practice and re-demonstration on Nov 5 (T1, T2, T2)
        {
          attemptId: "att_01J00000000000000000000008",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000004",
          clientAttemptId: "11111111-1111-4111-8111-000000000008",
          itemInstanceId: "itm_01J00000000000000000000008",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-05T10:10:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000009",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000004",
          clientAttemptId: "11111111-1111-4111-8111-000000000009",
          itemInstanceId: "itm_01J00000000000000000000009",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-05T10:12:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000010",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000010",
          clientAttemptId: "11111111-1111-4111-8111-000000000010",
          itemInstanceId: "itm_01J00000000000000000000010",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-05T10:14:00.000Z",
        },
      ];

      const card = buildComebackCard({
        conceptId: "MATH-FRAC-EQUIV",
        studentTitle: "Equivalent fractions",
        status: "demonstrated",
        firstNeedsSupportAt: "2026-11-01T10:05:00.000Z",
        achievedAt: "2026-11-05T10:14:00.000Z",
        history,
      });

      expect(card).not.toBeNull();
      // Must cite the re-demonstration attempts (8, 9, 10), NOT old pre-demotion attempts (3, 4, 5)
      expect(card?.presentAttemptIds).toEqual([
        "att_01J00000000000000000000008",
        "att_01J00000000000000000000009",
        "att_01J00000000000000000000010",
      ]);
    });
  });

  describe("Review 3: Shared guard predicates and authoritative belief transitions", () => {
    it("Issue 1a: guardDecision with reviewDue=true and no dueReviewConceptId fails closed even with candidate conceptId", () => {
      const ctxMissingDueReview = makeContext({
        reviewDue: true,
        dueReviewConceptId: undefined,
        allowedActions: ["RETRIEVAL_REVIEW", "INDEPENDENT_PRACTICE"],
      });

      const candidate = {
        decisionId: ctxMissingDueReview.decisionId,
        selectedAction: "RETRIEVAL_REVIEW" as const,
        params: { conceptId: "MATH-NUM-LCM" as const },
        reasonCodes: ["TEST"],
        provider: "rules" as const,
        policyVersion: "rules-1.0" as const,
        fallbackUsed: false,
        latencyMs: 0,
      };

      expect(() => guardDecision(ctxMissingDueReview, candidate)).toThrowError(
        /dueReviewConceptId is required when reviewDue is true/,
      );
    });

    it("Issue 1b: guardDecision rejects REVIEW_PREREQUISITE if prereqRouteTaken is true or target is not an eligible weak prerequisite", () => {
      // Target is demonstrated -> not an eligible weak prerequisite
      const ctxDemonstratedPrereq = makeContext({
        allowedActions: ["REVIEW_PREREQUISITE", "INDEPENDENT_PRACTICE"],
        prerequisiteBeliefs: [makeBelief("MATH-FRAC-EQUIV", "demonstrated")],
        session: {
          mode: "learn",
          incorrectOnConcept: 3,
          prereqRouteTaken: false,
          hintRungShown: 0,
          consecutiveIndependentCorrect: 0,
        },
      });

      const cand1 = {
        decisionId: ctxDemonstratedPrereq.decisionId,
        selectedAction: "REVIEW_PREREQUISITE" as const,
        params: { conceptId: "MATH-FRAC-EQUIV" as const },
        reasonCodes: ["TEST"],
        provider: "rules" as const,
        policyVersion: "rules-1.0" as const,
        fallbackUsed: false,
        latencyMs: 0,
      };

      const res1 = guardDecision(ctxDemonstratedPrereq, cand1);
      expect(res1.selectedAction).toBe("INDEPENDENT_PRACTICE");

      // prereqRouteTaken is true -> cannot take prerequisite route
      const ctxPrereqRouteTaken = makeContext({
        allowedActions: ["REVIEW_PREREQUISITE", "INDEPENDENT_PRACTICE"],
        prerequisiteBeliefs: [makeBelief("MATH-FRAC-EQUIV", "needs_support")],
        session: {
          mode: "learn",
          incorrectOnConcept: 3,
          prereqRouteTaken: true,
          hintRungShown: 0,
          consecutiveIndependentCorrect: 0,
        },
      });

      const cand2 = {
        decisionId: ctxPrereqRouteTaken.decisionId,
        selectedAction: "REVIEW_PREREQUISITE" as const,
        params: { conceptId: "MATH-FRAC-EQUIV" as const },
        reasonCodes: ["TEST"],
        provider: "rules" as const,
        policyVersion: "rules-1.0" as const,
        fallbackUsed: false,
        latencyMs: 0,
      };

      const res2 = guardDecision(ctxPrereqRouteTaken, cand2);
      expect(res2.selectedAction).toBe("INDEPENDENT_PRACTICE");

      // When only REVIEW_PREREQUISITE is allowed, failing the predicate fails closed
      const ctxOnlyPrereqFailsClosed = makeContext({
        allowedActions: ["REVIEW_PREREQUISITE"],
        prerequisiteBeliefs: [makeBelief("MATH-FRAC-EQUIV", "needs_support")],
        session: {
          mode: "learn",
          incorrectOnConcept: 3,
          prereqRouteTaken: true,
          hintRungShown: 0,
          consecutiveIndependentCorrect: 0,
        },
      });

      expect(() => guardDecision(ctxOnlyPrereqFailsClosed, cand2)).toThrowError(
        /Cannot authorize execution/,
      );
    });

    it("Issue 2a: sequence I, I, C(T1), C(T1), C(T1), I(T1), C(T2), C(T2) cites attempts 5, 7, 8 (not 4, 5, 7)", () => {
      const history: CheckedAttempt[] = [
        // 1: I (T1)
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
        // 2: I (T1) -> triggers needs_support at 2026-11-01T10:05:00.000Z
        {
          attemptId: "att_01J00000000000000000000002",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000001",
          clientAttemptId: "11111111-1111-4111-8111-000000000002",
          itemInstanceId: "itm_01J00000000000000000000002",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-01T10:05:00.000Z",
        },
        // 3: C (T1)
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
          at: "2026-11-02T10:10:00.000Z",
        },
        // 4: C (T1)
        {
          attemptId: "att_01J00000000000000000000004",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000004",
          itemInstanceId: "itm_01J00000000000000000000004",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:12:00.000Z",
        },
        // 5: C (T1) -> 3 correct, but only 1 template (needs 2) -> remains developing
        {
          attemptId: "att_01J00000000000000000000005",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
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
          at: "2026-11-02T10:14:00.000Z",
        },
        // 6: I (T1) -> l2 becomes [C, I]
        {
          attemptId: "att_01J00000000000000000000006",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000006",
          itemInstanceId: "itm_01J00000000000000000000006",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:16:00.000Z",
        },
        // 7: C (T2) -> l2 becomes [I, C] (not every correct) -> remains developing
        {
          attemptId: "att_01J00000000000000000000007",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000007",
          itemInstanceId: "itm_01J00000000000000000000007",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:18:00.000Z",
        },
        // 8: C (T2) -> demonstration achieved! l4 is [att5, att6, att7, att8], okL4 is [att5, att7, att8]
        {
          attemptId: "att_01J00000000000000000000008",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000008",
          itemInstanceId: "itm_01J00000000000000000000008",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:20:00.000Z",
        },
      ];

      const card = buildComebackCard({
        conceptId: "MATH-FRAC-EQUIV",
        studentTitle: "Equivalent fractions",
        status: "demonstrated",
        firstNeedsSupportAt: "2026-11-01T10:05:00.000Z",
        achievedAt: "2026-11-02T10:20:00.000Z",
        history,
      });

      expect(card).not.toBeNull();
      expect(card?.presentAttemptIds).toEqual([
        "att_01J00000000000000000000005",
        "att_01J00000000000000000000007",
        "att_01J00000000000000000000008",
      ]);
      expect(card?.presentCorrect).toBe(3);
      expect(card?.presentTotal).toBe(4);
    });

    it("Issue 2b: retention card preserves original demonstration citations even after intervening practice", () => {
      const history: CheckedAttempt[] = [
        // 1-2: Needs support on Nov 1
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
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-01T10:05:00.000Z",
        },
        // 3-5: Demonstrated on Nov 2 (T1, T2, T2)
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
          at: "2026-11-02T10:10:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000004",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000004",
          itemInstanceId: "itm_01J00000000000000000000004",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:12:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000005",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000005",
          itemInstanceId: "itm_01J00000000000000000000005",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:14:00.000Z",
        },
        // 6-7: Intervening practice on Nov 5
        {
          attemptId: "att_01J00000000000000000000006",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000003",
          clientAttemptId: "11111111-1111-4111-8111-000000000006",
          itemInstanceId: "itm_01J00000000000000000000006",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-05T10:10:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000007",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000003",
          clientAttemptId: "11111111-1111-4111-8111-000000000007",
          itemInstanceId: "itm_01J00000000000000000000007",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-05T10:15:00.000Z",
        },
        // 8: Retention review on Nov 10 (8 days after demonstration)
        {
          attemptId: "att_01J00000000000000000000008",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000004",
          clientAttemptId: "11111111-1111-4111-8111-000000000008",
          itemInstanceId: "itm_01J00000000000000000000008",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: true,
          verifierVersion: "verify-1.0",
          at: "2026-11-10T10:00:00.000Z",
        },
      ];

      const card = buildComebackCard({
        conceptId: "MATH-FRAC-EQUIV",
        studentTitle: "Equivalent fractions",
        status: "retained",
        firstNeedsSupportAt: "2026-11-01T10:05:00.000Z",
        achievedAt: "2026-11-10T10:00:00.000Z",
        history,
      });

      expect(card).not.toBeNull();
      // Must cite the original demonstration attempts, NOT intervening attempts 6 & 7
      expect(card?.presentAttemptIds).toEqual([
        "att_01J00000000000000000000003",
        "att_01J00000000000000000000004",
        "att_01J00000000000000000000005",
      ]);
      expect(card?.retentionAttemptId).toBe("att_01J00000000000000000000008");
      expect(card?.status).toBe("retained");
    });

    it("Issue 2c: demotion followed by re-demonstration cites the new re-demonstration attempts", () => {
      const history: CheckedAttempt[] = [
        // 1-2: Needs support on Nov 1
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
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-01T10:05:00.000Z",
        },
        // 3-5: First demonstration on Nov 2 (T1, T2, T2)
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
          at: "2026-11-02T10:10:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000004",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000004",
          itemInstanceId: "itm_01J00000000000000000000004",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:12:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000005",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000002",
          clientAttemptId: "11111111-1111-4111-8111-000000000005",
          itemInstanceId: "itm_01J00000000000000000000005",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-02T10:14:00.000Z",
        },
        // 6-7: Consecutive misses on Nov 4 -> demoted to needs_support!
        {
          attemptId: "att_01J00000000000000000000006",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000003",
          clientAttemptId: "11111111-1111-4111-8111-000000000006",
          itemInstanceId: "itm_01J00000000000000000000006",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-04T10:00:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000007",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000003",
          clientAttemptId: "11111111-1111-4111-8111-000000000007",
          itemInstanceId: "itm_01J00000000000000000000007",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "incorrect",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-04T10:05:00.000Z",
        },
        // 8-10: Fresh practice and re-demonstration on Nov 5 (T1, T2, T2)
        {
          attemptId: "att_01J00000000000000000000008",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000004",
          clientAttemptId: "11111111-1111-4111-8111-000000000008",
          itemInstanceId: "itm_01J00000000000000000000008",
          templateId: "T1",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-05T10:10:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000009",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000004",
          clientAttemptId: "11111111-1111-4111-8111-000000000009",
          itemInstanceId: "itm_01J00000000000000000000009",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-05T10:12:00.000Z",
        },
        {
          attemptId: "att_01J00000000000000000000010",
          studentId: "stu_01J00000000000000000000001",
          sessionId: "ses_01J00000000000000000000010",
          clientAttemptId: "11111111-1111-4111-8111-000000000010",
          itemInstanceId: "itm_01J00000000000000000000010",
          templateId: "T2",
          conceptId: "MATH-FRAC-EQUIV",
          mode: "learn",
          outcome: "correct",
          assistance: 0,
          tryNo: 1,
          isReview: false,
          verifierVersion: "verify-1.0",
          at: "2026-11-05T10:14:00.000Z",
        },
      ];

      const card = buildComebackCard({
        conceptId: "MATH-FRAC-EQUIV",
        studentTitle: "Equivalent fractions",
        status: "demonstrated",
        firstNeedsSupportAt: "2026-11-01T10:05:00.000Z",
        achievedAt: "2026-11-05T10:14:00.000Z",
        history,
      });

      expect(card).not.toBeNull();
      // Must cite the re-demonstration attempts (8, 9, 10), NOT old pre-demotion attempts (3, 4, 5)
      expect(card?.presentAttemptIds).toEqual([
        "att_01J00000000000000000000008",
        "att_01J00000000000000000000009",
        "att_01J00000000000000000000010",
      ]);
    });
  });
});
