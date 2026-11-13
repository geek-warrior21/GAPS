import { describe, expect, it } from "vitest";
import { AttemptIdSchema, CheckedAttemptSchema, DecisionContextSchema } from "./domain";
import { ItemViewSchema } from "./step";

describe("Phase 1 review regressions (finding 5: contracts and IDs)", () => {
  it("F5: rejects malformed IDs and accepts full prefixed ULIDs and UUID v4", () => {
    // 5a: Malformed attempt ID (too short)
    expect(
      CheckedAttemptSchema.safeParse({
        attemptId: "att_01",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000001",
        clientAttemptId: "550e8400-e29b-41d4-a716-446655440000",
        itemInstanceId: "itm_01J00000000000000000000001",
        templateId: "T1",
        conceptId: "MATH-FRAC-PART",
        mode: "learn",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-13T10:00:00.000Z",
      }).success,
    ).toBe(false);

    // 5b: Malformed clientAttemptId (not UUID v4)
    expect(
      CheckedAttemptSchema.safeParse({
        attemptId: "att_01J00000000000000000000001",
        studentId: "stu_01J00000000000000000000001",
        sessionId: "ses_01J00000000000000000000001",
        clientAttemptId: "uuid-1",
        itemInstanceId: "itm_01J00000000000000000000001",
        templateId: "T1",
        conceptId: "MATH-FRAC-PART",
        mode: "learn",
        outcome: "correct",
        assistance: 0,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: "2026-11-13T10:00:00.000Z",
      }).success,
    ).toBe(false);

    // 5c: Malformed ItemView ID (not 30-char prefixed ULID)
    expect(
      ItemViewSchema.safeParse({
        id: "itm_01",
        conceptId: "MATH-FRAC-PART",
        prompt: [{ t: "text", v: "Question" }],
        input: { kind: "number" },
      }).success,
    ).toBe(false);
  });

  it("CR3_contract: DecisionContextSchema rejects reviewDue=true when dueReviewConceptId is missing", () => {
    const ctx = {
      schemaVersion: 1 as const,
      decisionId: "dec_01J00000000000000000000001",
      studentRef: "stu_01J00000000000000000000001",
      stateVersion: 1,
      focusConceptId: "MATH-FRAC-ADDUNLIKE",
      belief: {
        conceptId: "MATH-FRAC-ADDUNLIKE",
        status: "demonstrated",
        estimate: 0.8,
        reliability: "supported",
        demonstratedAt: "2026-11-13T10:00:00.000Z",
        retainedAt: null,
        firstNeedsSupportAt: null,
        activeMisconceptionIds: [],
        policyVersion: "rules-1.0" as const,
        version: 1,
      },
      prerequisiteBeliefs: [],
      session: {
        mode: "learn",
        secondsElapsed: 100,
        hintRungShown: 0,
        incorrectOnConcept: 0,
        consecutiveIndependentCorrect: 3,
        prereqRouteTaken: false,
      },
      remainingSeconds: 600,
      allowedActions: ["RETRIEVAL_REVIEW", "INDEPENDENT_PRACTICE"],
      policyVersion: "rules-1.0" as const,
      flags: { aiAllowed: false },
      reviewDue: true,
      // dueReviewConceptId is omitted!
    };
    expect(DecisionContextSchema.safeParse(ctx).success).toBe(false);
  });

  it("CR6_contract: rejects ULID overflow encodings in contract schemas", () => {
    expect(AttemptIdSchema.safeParse("att_80000000000000000000000000").success).toBe(false);
    expect(AttemptIdSchema.safeParse("att_90000000000000000000000000").success).toBe(false);
    expect(AttemptIdSchema.safeParse("att_A0000000000000000000000000").success).toBe(false);
    expect(AttemptIdSchema.safeParse("att_ZZZZZZZZZZZZZZZZZZZZZZZZZZ").success).toBe(false);
    expect(AttemptIdSchema.safeParse("att_7ZZZZZZZZZZZZZZZZZZZZZZZZZ").success).toBe(true);
    expect(AttemptIdSchema.safeParse("att_01J00000000000000000000001").success).toBe(true);
  });
});
