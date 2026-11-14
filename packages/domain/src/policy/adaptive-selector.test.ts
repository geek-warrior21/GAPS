import { describe, expect, it } from "vitest";
import { getRemediationRouteForMisconception, selectAdaptiveActivity } from "./adaptive-selector";
import { createRng } from "../rng";
import type { Belief, ConceptId } from "../types";

const mockTemplates = [
  { id: "tpl_part_1", difficulty: 1 as const, reviewed: true },
  { id: "tpl_part_2", difficulty: 2 as const, reviewed: true },
  { id: "tpl_part_3", difficulty: 3 as const, reviewed: true },
  { id: "tpl_part_4", difficulty: 2 as const, reviewed: true },
];

import { POLICY_VERSION } from "../types";

function makeBelief(conceptId: ConceptId, status: Belief["status"]): Belief {
  return {
    conceptId,
    status,
    estimate: 0.5,
    reliability: "supported",
    demonstratedAt: status === "demonstrated" ? new Date().toISOString() : null,
    retainedAt: status === "retained" ? new Date().toISOString() : null,
    firstNeedsSupportAt: status === "needs_support" ? new Date().toISOString() : null,
    activeMisconceptionIds: [],
    policyVersion: POLICY_VERSION,
    version: 1,
  };
}

describe("Workstream C & D: Adaptive Question Selection & Targeted Remediation", () => {
  const rng = createRng(42);

  it("selects difficulty 1 and independent practice for struggling concept", () => {
    const decision = selectAdaptiveActivity(
      {
        focusConceptId: "MATH-FRAC-PART",
        belief: makeBelief("MATH-FRAC-PART", "needs_support"),
        prerequisiteBeliefs: [],
        recentAttempts: [],
        consecutiveIndependentCorrect: 0,
        consecutiveIncorrect: 0,
        activeMisconceptions: [],
        recentTemplateIds: [],
        remediationCount: 0,
        sessionMode: "learn",
      },
      mockTemplates,
      rng,
    );

    expect(decision.action).toBe("INDEPENDENT_PRACTICE");
    expect(decision.targetDifficulty).toBe(1);
    expect(decision.preferredTemplateId).toBe("tpl_part_1");
  });

  it("increases challenge to difficulty 3 after consecutive correct answers", () => {
    const decision = selectAdaptiveActivity(
      {
        focusConceptId: "MATH-FRAC-PART",
        belief: makeBelief("MATH-FRAC-PART", "developing"),
        prerequisiteBeliefs: [],
        recentAttempts: [
          { conceptId: "MATH-FRAC-PART", outcome: "correct", assistance: 0, tryNo: 1 },
        ],
        consecutiveIndependentCorrect: 2,
        consecutiveIncorrect: 0,
        activeMisconceptions: [],
        recentTemplateIds: ["tpl_part_1"],
        remediationCount: 0,
        sessionMode: "learn",
      },
      mockTemplates,
      rng,
    );

    expect(decision.action).toBe("INDEPENDENT_PRACTICE");
    expect(decision.targetDifficulty).toBe(3);
    expect(decision.preferredTemplateId).toBe("tpl_part_3");
  });

  it("avoids templates used in the last 3 items to prevent infinite repetition", () => {
    const decision = selectAdaptiveActivity(
      {
        focusConceptId: "MATH-FRAC-PART",
        belief: makeBelief("MATH-FRAC-PART", "developing"),
        prerequisiteBeliefs: [],
        recentAttempts: [],
        consecutiveIndependentCorrect: 0,
        consecutiveIncorrect: 0,
        activeMisconceptions: [],
        recentTemplateIds: ["tpl_part_2"], // recently used
        remediationCount: 0,
        sessionMode: "learn",
      },
      mockTemplates,
      rng,
    );

    expect(decision.targetDifficulty).toBe(2);
    // Should choose tpl_part_4 instead of tpl_part_2
    expect(decision.preferredTemplateId).toBe("tpl_part_4");
  });

  it("steps back to an unassessed or weak prerequisite when struggling", () => {
    const weakPrereq = makeBelief("MATH-FRAC-PART", "needs_support");
    const decision = selectAdaptiveActivity(
      {
        focusConceptId: "MATH-FRAC-EQUIV",
        belief: makeBelief("MATH-FRAC-EQUIV", "needs_support"),
        prerequisiteBeliefs: [weakPrereq],
        recentAttempts: [
          { conceptId: "MATH-FRAC-EQUIV", outcome: "incorrect", assistance: 0, tryNo: 2 },
          { conceptId: "MATH-FRAC-EQUIV", outcome: "incorrect", assistance: 0, tryNo: 2 },
        ],
        consecutiveIndependentCorrect: 0,
        consecutiveIncorrect: 2,
        activeMisconceptions: [],
        recentTemplateIds: [],
        remediationCount: 0,
        sessionMode: "learn",
        prereqRouteTaken: false,
      },
      mockTemplates,
      rng,
    );

    expect(decision.action).toBe("REVIEW_PREREQUISITE");
    expect(decision.targetConceptId).toBe("MATH-FRAC-PART");
    expect(decision.isPrereqStepBack).toBe(true);
  });

  it("selects targeted remediation route tailored to the active misconception", () => {
    // Spatial / visual misconception -> "picture" route
    expect(getRemediationRouteForMisconception("MC-PART-RATIO")).toBe("picture");
    expect(getRemediationRouteForMisconception("MC-NUMLINE-TICKS")).toBe("picture");
    expect(getRemediationRouteForMisconception("MC-ADD-ACROSS")).toBe("picture");

    // Procedural misconception -> "steps" route
    expect(getRemediationRouteForMisconception("MC-EQUIV-ADDITIVE")).toBe("steps");
    expect(getRemediationRouteForMisconception("MC-DIV-FLIP-FIRST")).toBe("steps");

    // Test selection of EXPLAIN action with route
    const decision = selectAdaptiveActivity(
      {
        focusConceptId: "MATH-FRAC-PART",
        belief: makeBelief("MATH-FRAC-PART", "needs_support"),
        prerequisiteBeliefs: [], // no prereqs to step back to
        recentAttempts: [
          {
            conceptId: "MATH-FRAC-PART",
            outcome: "incorrect",
            assistance: 0,
            tryNo: 2,
            misconceptionId: "MC-PART-RATIO",
          },
          {
            conceptId: "MATH-FRAC-PART",
            outcome: "incorrect",
            assistance: 0,
            tryNo: 2,
            misconceptionId: "MC-PART-RATIO",
          },
        ],
        consecutiveIndependentCorrect: 0,
        consecutiveIncorrect: 2,
        activeMisconceptions: ["MC-PART-RATIO"],
        recentTemplateIds: [],
        remediationCount: 0,
        sessionMode: "learn",
      },
      mockTemplates,
      rng,
    );

    expect(decision.action).toBe("EXPLAIN");
    expect(decision.explanationRoute).toBe("picture");
  });

  it("serves worked example if explanation was already given and student still struggles", () => {
    const decision = selectAdaptiveActivity(
      {
        focusConceptId: "MATH-FRAC-PART",
        belief: makeBelief("MATH-FRAC-PART", "needs_support"),
        prerequisiteBeliefs: [],
        recentAttempts: [
          { conceptId: "MATH-FRAC-PART", outcome: "incorrect", assistance: 0, tryNo: 2 },
          { conceptId: "MATH-FRAC-PART", outcome: "incorrect", assistance: 0, tryNo: 2 },
        ],
        consecutiveIndependentCorrect: 0,
        consecutiveIncorrect: 2,
        activeMisconceptions: [],
        recentTemplateIds: [],
        remediationCount: 1, // already remediated once
        sessionMode: "learn",
      },
      mockTemplates,
      rng,
    );

    expect(decision.action).toBe("WORKED_EXAMPLE");
  });

  it("completes session and advances when concept is demonstrated and confirmed", () => {
    const decision = selectAdaptiveActivity(
      {
        focusConceptId: "MATH-FRAC-PART",
        belief: makeBelief("MATH-FRAC-PART", "demonstrated"),
        prerequisiteBeliefs: [],
        recentAttempts: [
          { conceptId: "MATH-FRAC-PART", outcome: "correct", assistance: 0, tryNo: 1 },
        ],
        consecutiveIndependentCorrect: 3,
        consecutiveIncorrect: 0,
        activeMisconceptions: [],
        recentTemplateIds: [],
        remediationCount: 0,
        sessionMode: "learn",
      },
      mockTemplates,
      rng,
    );

    expect(decision.action).toBe("ADVANCE");
    expect(decision.sessionCompleted).toBe(true);
  });
});
