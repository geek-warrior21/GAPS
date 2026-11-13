import { describe, expect, it } from "vitest";
import { buildComebackCard, formatComebackMessage } from "./comeback";
import type { CheckedAttempt } from "./types";

function attempt(
  seq: number,
  outcome: CheckedAttempt["outcome"],
  at: string,
  assistance: 0 | 1 = 0,
  isReview = false,
): CheckedAttempt {
  return {
    attemptId: `att_01J000000000000000000000${String(seq).padStart(2, "0")}`,
    studentId: "stu_01J00000000000000000000001",
    sessionId: "ses_01J00000000000000000000001",
    clientAttemptId: `11111111-1111-4111-8111-0000000000${String(seq).padStart(2, "0")}`,
    itemInstanceId: `itm_01J000000000000000000000${String(seq).padStart(2, "0")}`,
    templateId: `T${(seq % 2) + 1}`,
    conceptId: "MATH-FRAC-EQUIV",
    mode: isReview ? "review" : "learn",
    outcome,
    assistance,
    tryNo: 1,
    isReview,
    verifierVersion: "verify-1.0",
    at,
  };
}

describe("buildComebackCard", () => {
  it("returns null if not demonstrated/retained or < 24 hours after firstNeedsSupportAt", () => {
    const history = [
      attempt(1, "incorrect", "2026-11-10T10:00:00.000Z"),
      attempt(2, "incorrect", "2026-11-10T10:05:00.000Z"),
      attempt(3, "correct", "2026-11-11T09:59:00.000Z"),
      attempt(4, "correct", "2026-11-11T09:59:30.000Z"),
      attempt(5, "correct", "2026-11-11T09:59:59.000Z"),
    ];

    expect(
      buildComebackCard({
        conceptId: "MATH-FRAC-EQUIV",
        studentTitle: "Equivalent fractions",
        status: "developing",
        firstNeedsSupportAt: "2026-11-10T10:05:00.000Z",
        achievedAt: "2026-11-11T11:00:00.000Z",
        history,
      }),
    ).toBeNull();

    // 23h 54m 59s after firstNeedsSupportAt -> ineligible
    expect(
      buildComebackCard({
        conceptId: "MATH-FRAC-EQUIV",
        studentTitle: "Equivalent fractions",
        status: "demonstrated",
        firstNeedsSupportAt: "2026-11-10T10:05:00.000Z",
        achievedAt: "2026-11-11T09:59:59.000Z",
        history,
      }),
    ).toBeNull();
  });

  it("builds a factual Comeback Card >= 24h later citing demonstration evidence and consistent counts", () => {
    const history = [
      attempt(1, "correct", "2026-11-10T10:00:00.000Z"),
      attempt(2, "incorrect", "2026-11-10T10:02:00.000Z"),
      attempt(3, "incorrect", "2026-11-10T10:04:00.000Z"),
      attempt(4, "incorrect", "2026-11-10T10:06:00.000Z"),
      attempt(5, "incorrect", "2026-11-10T10:08:00.000Z"),
      attempt(6, "correct", "2026-11-11T11:00:00.000Z"),
      attempt(7, "correct", "2026-11-11T11:02:00.000Z"),
      attempt(8, "correct", "2026-11-11T11:05:00.000Z"),
    ];

    const card = buildComebackCard({
      conceptId: "MATH-FRAC-EQUIV",
      studentTitle: "Equivalent fractions",
      status: "demonstrated",
      firstNeedsSupportAt: "2026-11-10T10:04:00.000Z",
      achievedAt: "2026-11-11T11:05:00.000Z",
      history,
    });

    expect(card).not.toBeNull();
    expect(card?.pastDate).toBe("2026-11-10");
    expect(card?.pastCorrect).toBe(1);
    expect(card?.pastTotal).toBe(5);
    expect(card?.pastAttemptIds).toHaveLength(3);
    expect(card?.presentCorrect).toBe(3);
    expect(card?.presentAttemptIds).toEqual([
      history[5]!.attemptId,
      history[6]!.attemptId,
      history[7]!.attemptId,
    ]);
    expect(card?.presentAttemptIds.length).toBe(card?.presentCorrect);
    expect(card?.spansMultipleDays).toBe(false);
    expect(card?.messageKey).toBe("comeback.singleDay");
    expect(card?.message).toBe(
      "On 2026-11-10 you got 1 of 5 Equivalent fractions questions. Today you answered 3 correctly on your own. That's a comeback!",
    );
  });

  it("handles retention comebacks and date-neutral copy when evidence spans days", () => {
    const history = [
      attempt(1, "incorrect", "2026-11-01T10:00:00.000Z"),
      attempt(2, "incorrect", "2026-11-01T10:05:00.000Z"),
      attempt(3, "correct", "2026-11-02T10:00:00.000Z"),
      attempt(4, "correct", "2026-11-02T10:05:00.000Z"),
      attempt(5, "correct", "2026-11-02T10:10:00.000Z"),
      // 7 days later: review attempt passes
      attempt(6, "correct", "2026-11-09T11:00:00.000Z", 0, true),
    ];

    const retainedCard = buildComebackCard({
      conceptId: "MATH-FRAC-EQUIV",
      studentTitle: "Equivalent fractions",
      status: "retained",
      firstNeedsSupportAt: "2026-11-01T10:05:00.000Z",
      demonstratedAt: "2026-11-02T10:10:00.000Z",
      achievedAt: "2026-11-09T11:00:00.000Z",
      history,
    });

    expect(retainedCard).not.toBeNull();
    expect(retainedCard?.status).toBe("retained");
    expect(retainedCard?.retentionAttemptId).toBe(history[5]!.attemptId);
    expect(retainedCard?.messageKey).toBe("comeback.retention");
    expect(retainedCard?.message).toBe(
      "On 2026-11-01 you got 0 of 2 Equivalent fractions questions. You locked this in with a successful review. That's a comeback!",
    );

    // Custom copy formatter
    const custom = formatComebackMessage(
      retainedCard!,
      "Great work on {studentTitle}: {presentCorrect} verified!",
    );
    expect(custom).toBe("Great work on Equivalent fractions: 3 verified!");

    // Retention without explicit demonstratedAt
    const retainedDerived = buildComebackCard({
      conceptId: "MATH-FRAC-EQUIV",
      studentTitle: "Equivalent fractions",
      status: "retained",
      firstNeedsSupportAt: "2026-11-01T10:05:00.000Z",
      achievedAt: "2026-11-09T11:00:00.000Z",
      history,
    });
    expect(retainedDerived).not.toBeNull();
    expect(retainedDerived?.status).toBe("retained");

    // Less than 3 demonstration corrects in qualifying window returns null
    const notDemonstratedHistory = [
      attempt(1, "incorrect", "2026-11-01T10:00:00.000Z"),
      attempt(2, "incorrect", "2026-11-01T10:05:00.000Z"),
      attempt(3, "correct", "2026-11-02T10:00:00.000Z"),
      attempt(4, "correct", "2026-11-02T10:05:00.000Z"),
    ];
    expect(
      buildComebackCard({
        conceptId: "MATH-FRAC-EQUIV",
        studentTitle: "Equivalent fractions",
        status: "demonstrated",
        firstNeedsSupportAt: "2026-11-01T10:05:00.000Z",
        achievedAt: "2026-11-02T10:05:00.000Z",
        history: notDemonstratedHistory,
      }),
    ).toBeNull();
  });
});
