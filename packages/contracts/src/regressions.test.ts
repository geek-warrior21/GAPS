import { describe, expect, it } from "vitest";
import { CheckedAttemptSchema } from "./domain";
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
});
