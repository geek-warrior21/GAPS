import { describe, expect, it } from "vitest";
import { BeliefSchema, DecisionContextSchema, DecisionResultSchema } from "./domain";
import { ItemViewSchema, StepSchema } from "./step";

describe("contracts: domain & step schemas", () => {
  it("validates DecisionContext and DecisionResult matching domain types", () => {
    const belief = BeliefSchema.parse({
      conceptId: "MATH-FRAC-EQUIV",
      status: "developing",
      estimate: 0.6,
      reliability: "supported",
      demonstratedAt: null,
      retainedAt: null,
      firstNeedsSupportAt: null,
      activeMisconceptionIds: ["MC-EQUIV-ADDITIVE"],
      policyVersion: "rules-1.0",
      version: 2,
    });

    const ctx = DecisionContextSchema.parse({
      schemaVersion: 1,
      decisionId: "dec_01J00000000000000000000001",
      studentRef: "stu_01J00000000000000000000001",
      stateVersion: 2,
      focusConceptId: "MATH-FRAC-EQUIV",
      belief,
      prerequisiteBeliefs: [],
      session: {
        mode: "learn",
        incorrectOnConcept: 1,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
      },
      reviewDue: false,
      allowedActions: ["GIVE_HINT", "INDEPENDENT_PRACTICE"],
      policyVersion: "rules-1.0",
      remainingSeconds: 800,
      flags: { aiAllowed: false },
    });

    const res = DecisionResultSchema.parse({
      decisionId: ctx.decisionId,
      selectedAction: "GIVE_HINT",
      params: { conceptId: "MATH-FRAC-EQUIV", hintRung: 1 },
      reasonCodes: ["R10_FIRST_MISS"],
      provider: "rules",
      policyVersion: "rules-1.0",
      fallbackUsed: false,
      latencyMs: 0,
    });

    expect(res.selectedAction).toBe("GIVE_HINT");
  });

  it("rejects answers, misconceptions, and template seeds inside ItemView (invariant I9)", () => {
    const safeItem = {
      id: "itm_01J00000000000000000000001",
      conceptId: "MATH-FRAC-EQUIV" as const,
      prompt: [
        { t: "text" as const, v: "Fill in the box: " },
        { t: "frac" as const, n: 2, d: 3 },
      ],
      input: { kind: "number" as const },
    };

    expect(ItemViewSchema.safeParse(safeItem).success).toBe(true);
    expect(ItemViewSchema.safeParse({ ...safeItem, answer: 4 }).success).toBe(false);
    expect(ItemViewSchema.safeParse({ ...safeItem, seed: 42 }).success).toBe(false);
    expect(ItemViewSchema.safeParse({ ...safeItem, misconceptions: {} }).success).toBe(false);

    const step = StepSchema.parse({
      kind: "item",
      stepSeq: 1,
      context: "learn",
      item: safeItem,
      help: ["hint", "explain"],
    });
    expect(step.kind).toBe("item");
  });
});
