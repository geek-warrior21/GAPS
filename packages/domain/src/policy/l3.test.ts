import { describe, expect, it } from "vitest";
import { POLICY_VERSION, TEACHING_ACTIONS, type Belief, type DecisionContext } from "../types";
import { decideNextAction, guardDecision } from "./l3";

export function makeBelief(
  conceptId: Belief["conceptId"],
  status: Belief["status"] = "developing",
): Belief {
  return {
    conceptId,
    status,
    estimate: status === "not_assessed" ? null : 0.6,
    reliability: status === "not_assessed" ? "missing" : "supported",
    demonstratedAt:
      status === "demonstrated" || status === "retained" ? "2026-11-10T10:00:00.000Z" : null,
    retainedAt: status === "retained" ? "2026-11-18T10:00:00.000Z" : null,
    firstNeedsSupportAt: status === "needs_support" ? "2026-11-09T10:00:00.000Z" : null,
    activeMisconceptionIds: [],
    policyVersion: POLICY_VERSION,
    version: status === "not_assessed" ? 0 : 2,
  };
}

export function makeContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    schemaVersion: 1,
    decisionId: "dec_01J00000000000000000000001",
    studentRef: "stu_01J00000000000000000000001",
    stateVersion: 5,
    focusConceptId: "MATH-FRAC-ADDUNLIKE",
    belief: makeBelief("MATH-FRAC-ADDUNLIKE", "developing"),
    prerequisiteBeliefs: [
      makeBelief("MATH-FRAC-EQUIV", "demonstrated"),
      makeBelief("MATH-FRAC-ADDLIKE", "demonstrated"),
      makeBelief("MATH-NUM-LCM", "demonstrated"),
    ],
    session: {
      mode: "learn",
      incorrectOnConcept: 0,
      prereqRouteTaken: false,
      hintRungShown: 0,
      consecutiveIndependentCorrect: 0,
      currentItemServed: true,
    },
    reviewDue: false,
    allowedActions: TEACHING_ACTIONS,
    policyVersion: POLICY_VERSION,
    remainingSeconds: 600,
    flags: { aiAllowed: false },
    ...overrides,
  };
}

describe("L3 guard and fallback", () => {
  it("falls back to R0_DEFAULT when selected action is disallowed by allowedActions", () => {
    const ctx = makeContext({
      allowedActions: ["INDEPENDENT_PRACTICE"],
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 1 },
    });
    const res = decideNextAction(ctx);
    expect(res.selectedAction).toBe("INDEPENDENT_PRACTICE");
    expect(res.fallbackUsed).toBe(true);
    expect(res.reasonCodes).toEqual(["R0_DEFAULT"]);
  });

  it("rejects RETRIEVAL_REVIEW in guardDecision when reviewDue is false", () => {
    const ctx = makeContext({ reviewDue: false });
    const invalid = guardDecision(ctx, {
      decisionId: ctx.decisionId,
      selectedAction: "RETRIEVAL_REVIEW",
      params: { conceptId: ctx.focusConceptId },
      reasonCodes: ["R13_DEMONSTRATED"],
      provider: "rules",
      policyVersion: POLICY_VERSION,
      fallbackUsed: false,
      latencyMs: 0,
    });
    expect(invalid.selectedAction).toBe("INDEPENDENT_PRACTICE");
    expect(invalid.fallbackUsed).toBe(true);
    expect(invalid.reasonCodes).toEqual(["R0_DEFAULT"]);
  });

  it("handles guardDecision invalid parameters and fallback action selection", () => {
    const ctx = makeContext({
      allowedActions: ["EXPLAIN", "VISUALIZE", "REQUEST_REVIEW"],
    });

    // Invalid difficulty falls back to allowed action (EXPLAIN)
    const badDiff = guardDecision(ctx, {
      decisionId: ctx.decisionId,
      selectedAction: "EXPLAIN",
      params: { difficulty: 5 as unknown as 1 },
      reasonCodes: ["TEST"],
      provider: "rules",
      policyVersion: POLICY_VERSION,
      fallbackUsed: false,
      latencyMs: 0,
    });
    expect(badDiff.selectedAction).toBe("EXPLAIN");
    expect(badDiff.params.route).toBe("everyday");
    expect(badDiff.fallbackUsed).toBe(true);

    // Invalid hintRung in GIVE_HINT
    const ctxHint = makeContext({ allowedActions: ["GIVE_HINT"] });
    const badHint = guardDecision(ctxHint, {
      decisionId: ctxHint.decisionId,
      selectedAction: "GIVE_HINT",
      params: { hintRung: 9 as unknown as 1 },
      reasonCodes: ["TEST"],
      provider: "rules",
      policyVersion: POLICY_VERSION,
      fallbackUsed: false,
      latencyMs: 0,
    });
    expect(badHint.selectedAction).toBe("GIVE_HINT");
    expect(badHint.params.hintRung).toBe(1);

    // RETRIEVAL_REVIEW with mismatched target concept
    const ctxRet = makeContext({
      reviewDue: true,
      dueReviewConceptId: "MATH-FRAC-PART",
      allowedActions: ["INDEPENDENT_PRACTICE"],
    });
    const badRet = guardDecision(ctxRet, {
      decisionId: ctxRet.decisionId,
      selectedAction: "RETRIEVAL_REVIEW",
      params: { conceptId: "MATH-NUM-LCM" },
      reasonCodes: ["TEST"],
      provider: "rules",
      policyVersion: POLICY_VERSION,
      fallbackUsed: false,
      latencyMs: 0,
    });
    expect(badRet.selectedAction).toBe("INDEPENDENT_PRACTICE");

    // REVIEW_PREREQUISITE with non-prerequisite concept
    const badPrereq = guardDecision(ctxRet, {
      decisionId: ctxRet.decisionId,
      selectedAction: "REVIEW_PREREQUISITE",
      params: { conceptId: "MATH-FRAC-WORD" },
      reasonCodes: ["TEST"],
      provider: "rules",
      policyVersion: POLICY_VERSION,
      fallbackUsed: false,
      latencyMs: 0,
    });
    expect(badPrereq.selectedAction).toBe("INDEPENDENT_PRACTICE");

    // Rule 1 when hintRungShown >= 3 returns WORKED_EXAMPLE
    const ctxMaxHint = makeContext({
      session: {
        mode: "learn",
        incorrectOnConcept: 0,
        prereqRouteTaken: false,
        hintRungShown: 3,
        consecutiveIndependentCorrect: 0,
        currentItemServed: true,
      },
      request: { kind: "hint" },
    });
    const maxHintRes = decideNextAction(ctxMaxHint);
    expect(maxHintRes.selectedAction).toBe("WORKED_EXAMPLE");
  });
});
