import { describe, expect, it } from "vitest";
import { renderComebackMessage } from "./comeback";
import type { ComebackCardData } from "@gaps/domain";

describe("renderComebackMessage", () => {
  it("renders structured card data using en.json templates", () => {
    const singleDayCard: ComebackCardData = {
      conceptId: "MATH-FRAC-EQUIV",
      studentTitle: "Equivalent fractions",
      status: "demonstrated",
      pastDate: "2026-11-10",
      pastCorrect: 1,
      pastTotal: 5,
      pastAttemptIds: ["att_01J00000000000000000000001"],
      presentCorrect: 3,
      presentTotal: 4,
      presentAttemptIds: [
        "att_01J00000000000000000000002",
        "att_01J00000000000000000000003",
        "att_01J00000000000000000000004",
      ],
      achievedAt: "2026-11-11T11:05:00.000Z",
      demonstratedAt: "2026-11-11T11:05:00.000Z",
      retainedAt: null,
      spansMultipleDays: false,
      messageKey: "comeback.singleDay",
      copyParams: {
        pastDate: "2026-11-10",
        pastCorrect: 1,
        pastTotal: 5,
        studentTitle: "Equivalent fractions",
        presentCorrect: 3,
        presentTotal: 4,
      },
    };

    expect(renderComebackMessage(singleDayCard)).toBe(
      "On 2026-11-10 you got 1 of 5 Equivalent fractions questions. Today you answered 3 correctly on your own. That's a comeback!",
    );

    const retentionCard: ComebackCardData = {
      ...singleDayCard,
      status: "retained",
      messageKey: "comeback.retention",
      retainedAt: "2026-11-18T10:00:00.000Z",
      retentionAttemptId: "att_01J00000000000000000000005",
    };

    expect(renderComebackMessage(retentionCard)).toBe(
      "On 2026-11-10 you got 1 of 5 Equivalent fractions questions. You locked this in with a successful review. That's a comeback!",
    );
  });
});
