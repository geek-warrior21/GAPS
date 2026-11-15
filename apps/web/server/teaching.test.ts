import { describe, it, expect } from "vitest";
import { TeachingPolicyEngine, evaluateErrorMisconception } from "./teaching/policy";
import { AuthoredTeachingDecisionEngine } from "./teaching/authored-engine";
import { LlmTeachingDecisionEngine } from "./teaching/llm-engine";
import { runTeachingDecisionComparison } from "./teaching/compare";
import type { TeachingDecisionInput, TeachingAssessedResponse } from "@gaps/contracts";

describe("Next-Step Teaching Decision Engine", () => {
  const baseMathsInput: TeachingDecisionInput = {
    objectiveId: "MATH-FRAC-PART",
    prerequisites: [],
    recentAssessedResponses: [],
    assistanceHistory: {},
    previouslyDeliveredActivities: [],
    availableActivityTypes: [
      "intro",
      "interactive_manipulation",
      "predict_and_observe",
      "guided_practice",
      "independent_check",
      "stopping_point",
    ],
    remediationCycleCount: 0,
    subject: "maths",
    level: 6,
  };

  const baseCircuitsInput: TeachingDecisionInput = {
    objectiveId: "SCI-ELEC-CIRCUITS",
    prerequisites: [],
    recentAssessedResponses: [],
    assistanceHistory: {},
    previouslyDeliveredActivities: [],
    availableActivityTypes: [
      "intro",
      "interactive_manipulation",
      "predict_and_observe",
      "guided_practice",
      "independent_check",
      "stopping_point",
    ],
    remediationCycleCount: 0,
    subject: "science",
    level: 6,
  };

  describe("1. Teaching Policy Engine & Server Envelope (Requirement 2)", () => {
    it("restricts eligible actions at session start (0 delivered activities)", () => {
      const policy = TeachingPolicyEngine.evaluatePolicy(baseMathsInput);
      expect(policy.eligibleActions).toEqual(["explore", "demonstrate", "explain"]);
      expect(policy.eligibleActions).not.toContain("advance");
      expect(policy.recommendedAction).toBe("explore");
    });

    it("does not allow advance without meeting authoritative independent evidence threshold", () => {
      // 1 correct attempt is not sufficient
      const singleCorrect: TeachingAssessedResponse = {
        activityId: "act_1",
        conceptId: "MATH-FRAC-PART",
        submittedAnswer: "3/4",
        isCorrect: true,
        assistanceLevel: 0,
        ambiguousError: false,
        timestamp: new Date().toISOString(),
      };

      const policy = TeachingPolicyEngine.evaluatePolicy({
        ...baseMathsInput,
        previouslyDeliveredActivities: [
          {
            id: "act_intro",
            type: "intro",
            title: "Intro",
            action: "explore",
            timestamp: new Date().toISOString(),
          },
        ],
        recentAssessedResponses: [singleCorrect],
      });

      expect(policy.eligibleActions).not.toContain("advance");
      expect(policy.eligibleActions).toContain("independent_check");
    });

    // Acceptance question B. The original test here expected `advance` after two
    // consecutive correct answers. That let the teaching policy advance an
    // objective the belief reducer (SPEC §9 / §19.4: 3 distinct items across 2
    // templates) had not marked demonstrated. The two-answer rule is kept as a
    // within-lesson signal; objective advancement now requires the reducer.
    const twoDistinctUnassistedCorrect = (): TeachingDecisionInput => {
      const resp1: TeachingAssessedResponse = {
        activityId: "act_check_1",
        conceptId: "MATH-FRAC-PART",
        submittedAnswer: "3/4",
        isCorrect: true,
        assistanceLevel: 0,
        ambiguousError: false,
        timestamp: new Date().toISOString(),
      };
      const resp2: TeachingAssessedResponse = {
        activityId: "act_check_2",
        conceptId: "MATH-FRAC-PART",
        submittedAnswer: "2/5",
        isCorrect: true,
        assistanceLevel: 0,
        ambiguousError: false,
        timestamp: new Date().toISOString(),
      };
      return {
        ...baseMathsInput,
        previouslyDeliveredActivities: [
          {
            id: "act_1",
            type: "interactive_manipulation",
            title: "Explore",
            action: "explore",
            timestamp: new Date().toISOString(),
          },
          {
            id: "act_check_1",
            type: "independent_check",
            title: "Check 1",
            action: "independent_check",
            timestamp: new Date().toISOString(),
          },
        ],
        recentAssessedResponses: [resp1, resp2],
      };
    };

    it("two distinct unassisted correct answers move the learner on within the lesson but do not advance the objective", () => {
      const policy = TeachingPolicyEngine.evaluatePolicy({
        ...twoDistinctUnassistedCorrect(),
        objectiveStatus: "developing",
      });

      expect(policy.evidence.consecutiveSuccesses).toBe(2);
      expect(policy.eligibleActions).not.toContain("advance");
      // Scaffolding ends: only a further independent check is eligible.
      expect(policy.eligibleActions).toEqual(["independent_check"]);
      expect(policy.recommendedAction).toBe("independent_check");
      expect(policy.evidence.lessonStage).toBe("ready_for_demonstration_check");
      expect(policy.evidence.objectiveStatus).toBe("developing");
    });

    it("never authorizes advance when no belief status is supplied, however long the streak", () => {
      const policy = TeachingPolicyEngine.evaluatePolicy(twoDistinctUnassistedCorrect());
      expect(policy.eligibleActions).not.toContain("advance");
      expect(policy.recommendedAction).toBe("independent_check");
    });

    it("authorizes advance only when the belief reducer reports the objective demonstrated", () => {
      for (const objectiveStatus of ["demonstrated", "retained"] as const) {
        const policy = TeachingPolicyEngine.evaluatePolicy({
          ...twoDistinctUnassistedCorrect(),
          objectiveStatus,
        });
        expect(policy.eligibleActions).toContain("advance");
        expect(policy.recommendedAction).toBe("advance");
        expect(policy.evidence.lessonStage).toBe("objective_demonstrated");
      }

      for (const objectiveStatus of ["not_assessed", "needs_support", "developing"] as const) {
        const policy = TeachingPolicyEngine.evaluatePolicy({
          ...twoDistinctUnassistedCorrect(),
          objectiveStatus,
        });
        expect(policy.eligibleActions).not.toContain("advance");
      }
    });

    it("does not advance a demonstrated objective on an incorrect or assisted latest answer path", () => {
      const input = twoDistinctUnassistedCorrect();
      const policy = TeachingPolicyEngine.evaluatePolicy({
        ...input,
        objectiveStatus: "demonstrated",
        recentAssessedResponses: [
          ...input.recentAssessedResponses,
          {
            activityId: "act_check_3",
            conceptId: "MATH-FRAC-PART",
            submittedAnswer: "5/2",
            isCorrect: false,
            assistanceLevel: 0,
            misconceptionDetected: "REVERSAL",
            ambiguousError: false,
            timestamp: new Date().toISOString(),
          },
        ],
      });
      expect(policy.eligibleActions).not.toContain("advance");
      expect(policy.recommendedAction).toBe("explore");
    });

    it("a diagnostic probe never counts toward the success streak and is asked at most once", () => {
      const probeCorrect: TeachingAssessedResponse = {
        activityId: "act_probe",
        conceptId: "MATH-FRAC-PART",
        submittedAnswer: "c_total",
        isCorrect: true,
        assistanceLevel: 0,
        ambiguousError: false,
        kind: "diagnostic",
        timestamp: new Date().toISOString(),
      };
      const afterProbe = TeachingPolicyEngine.evaluatePolicy({
        ...baseMathsInput,
        objectiveStatus: "developing",
        previouslyDeliveredActivities: [
          {
            id: "act_probe",
            type: "independent_check",
            title: "Probe",
            action: "independent_check",
            timestamp: new Date().toISOString(),
          },
        ],
        recentAssessedResponses: [probeCorrect],
      });
      expect(afterProbe.evidence.consecutiveSuccesses).toBe(0);
      expect(afterProbe.recommendedAction).toBe("independent_check");
      expect(afterProbe.evidence.rationale).toContain("not mastery evidence");

      // A second ambiguous error after a probe goes to teaching, not another probe.
      const secondAmbiguous = TeachingPolicyEngine.evaluatePolicy({
        ...baseMathsInput,
        objectiveStatus: "developing",
        previouslyDeliveredActivities: [],
        recentAssessedResponses: [
          probeCorrect,
          {
            activityId: "act_check_9",
            conceptId: "MATH-FRAC-PART",
            submittedAnswer: "c_2_7",
            isCorrect: false,
            assistanceLevel: 0,
            misconceptionDetected: null,
            ambiguousError: true,
            timestamp: new Date().toISOString(),
          },
        ],
      });
      expect(secondAmbiguous.recommendedAction).toBe("explore");
    });

    it("closes the lesson without advancing when no unused authored check remains", () => {
      const policy = TeachingPolicyEngine.evaluatePolicy({
        ...twoDistinctUnassistedCorrect(),
        objectiveStatus: "developing",
        remainingCheckItems: 0,
      });
      expect(policy.eligibleActions).toEqual(["pause"]);
      expect(policy.evidence.lessonStage).toBe("consolidating");
    });

    it("bounds remediation loops: mandates pause when remediationCycle >= 2 and student continues struggling", () => {
      const incorrectResp: TeachingAssessedResponse = {
        activityId: "act_check_remed",
        conceptId: "MATH-FRAC-PART",
        submittedAnswer: "4/3",
        isCorrect: false,
        assistanceLevel: 1,
        misconceptionDetected: "REVERSAL",
        ambiguousError: false,
        timestamp: new Date().toISOString(),
      };

      const policy = TeachingPolicyEngine.evaluatePolicy({
        ...baseMathsInput,
        previouslyDeliveredActivities: [
          {
            id: "act_1",
            type: "intro",
            title: "Intro",
            action: "explain",
            timestamp: new Date().toISOString(),
          },
        ],
        recentAssessedResponses: [incorrectResp],
        remediationCycleCount: 2, // Reached bound
      });

      expect(policy.eligibleActions).toEqual(["pause"]);
      expect(policy.recommendedAction).toBe("pause");
      expect(policy.evidence.rationale).toContain("remediation cycles");
    });
  });

  describe("2. Misconception & Ambiguity Differentiation (Requirement 3)", () => {
    it("accurately identifies clear numerator/denominator reversal", () => {
      const evalResult = evaluateErrorMisconception("MATH-FRAC-PART", "4/3");
      expect(evalResult.isAmbiguous).toBe(false);
      expect(evalResult.misconceptionId).toBe("REVERSAL");
    });

    it("accurately identifies air gap misconception in circuits", () => {
      const evalResult = evaluateErrorMisconception(
        "SCI-ELEC-CIRCUITS",
        "The open switch air gap allows current to jump",
      );
      expect(evalResult.isAmbiguous).toBe(false);
      expect(evalResult.misconceptionId).toBe("AIR_GAP");
    });

    it("does not infer a definite misconception from an arbitrary or unrecognized answer; flags ambiguity", () => {
      const evalResult = evaluateErrorMisconception("MATH-FRAC-PART", "7");
      expect(evalResult.isAmbiguous).toBe(true);
      expect(evalResult.misconceptionId).toBeNull();
      expect(evalResult.description).toContain("diagnostic probe required");
    });

    it("prescribes a diagnostic question when evidence is ambiguous", () => {
      const ambiguousResp: TeachingAssessedResponse = {
        activityId: "act_probe",
        conceptId: "MATH-FRAC-PART",
        submittedAnswer: "7",
        isCorrect: false,
        assistanceLevel: 0,
        misconceptionDetected: null,
        ambiguousError: true,
        timestamp: new Date().toISOString(),
      };

      const policy = TeachingPolicyEngine.evaluatePolicy({
        ...baseMathsInput,
        previouslyDeliveredActivities: [
          {
            id: "act_1",
            type: "intro",
            title: "Intro",
            action: "explore",
            timestamp: new Date().toISOString(),
          },
        ],
        recentAssessedResponses: [ambiguousResp],
      });

      expect(policy.eligibleActions).toEqual(["independent_check"]);
      expect(policy.recommendedAction).toBe("independent_check");
      expect(policy.evidence.isAmbiguous).toBe(true);
      expect(policy.assessmentTarget).toContain(
        "conceptual misconception or an accidental execution slip",
      );
    });
  });

  describe("3. Authored Teaching Decision Engine (Requirement 2 & 3)", () => {
    const authoredEngine = new AuthoredTeachingDecisionEngine();

    it("prescribes fraction strip manipulation for numerator/denominator reversal", async () => {
      const reversalResp: TeachingAssessedResponse = {
        activityId: "act_test_reversal",
        conceptId: "MATH-FRAC-PART",
        submittedAnswer: "4/3",
        isCorrect: false,
        assistanceLevel: 0,
        misconceptionDetected: "REVERSAL",
        ambiguousError: false,
        timestamp: new Date().toISOString(),
      };

      const decision = await authoredEngine.decideNextStep({
        ...baseMathsInput,
        previouslyDeliveredActivities: [
          {
            id: "act_intro",
            type: "intro",
            title: "Intro",
            action: "explore",
            timestamp: new Date().toISOString(),
          },
        ],
        recentAssessedResponses: [reversalResp],
      });

      expect(decision.action).toBe("explore");
      expect(decision.activity.type).toBe("interactive_manipulation");
      expect(decision.activity.config.type).toBe("interactive_manipulation");
      expect(decision.evidence.inferredMisconception).toBe("REVERSAL");
    });

    it("prescribes alternative explanation and memory anchor on continued confusion", async () => {
      const persistentResp: TeachingAssessedResponse = {
        activityId: "act_test_confused",
        conceptId: "MATH-FRAC-PART",
        submittedAnswer: "4/3",
        isCorrect: false,
        assistanceLevel: 1,
        misconceptionDetected: "REVERSAL",
        ambiguousError: false,
        timestamp: new Date().toISOString(),
      };

      const decision = await authoredEngine.decideNextStep({
        ...baseMathsInput,
        previouslyDeliveredActivities: [
          {
            id: "act_1",
            type: "intro",
            title: "Intro",
            action: "explore",
            timestamp: new Date().toISOString(),
          },
          {
            id: "act_2",
            type: "interactive_manipulation",
            title: "Manipulation",
            action: "explore",
            timestamp: new Date().toISOString(),
          },
        ],
        recentAssessedResponses: [persistentResp],
        remediationCycleCount: 1, // Already received 1 intervention
      });

      expect(decision.action).toBe("explain");
      expect(decision.activity.type).toBe("intro");
      expect(decision.activity.title).toContain("Denominator is Down");
    });

    it("prescribes diagnostic 2-choice check when answer is ambiguous", async () => {
      const ambiguousResp: TeachingAssessedResponse = {
        activityId: "act_test_ambig",
        conceptId: "MATH-FRAC-PART",
        submittedAnswer: "99",
        isCorrect: false,
        assistanceLevel: 0,
        misconceptionDetected: null,
        ambiguousError: true,
        timestamp: new Date().toISOString(),
      };

      const decision = await authoredEngine.decideNextStep({
        ...baseMathsInput,
        previouslyDeliveredActivities: [
          {
            id: "act_1",
            type: "intro",
            title: "Intro",
            action: "explore",
            timestamp: new Date().toISOString(),
          },
        ],
        recentAssessedResponses: [ambiguousResp],
      });

      expect(decision.action).toBe("independent_check");
      expect(decision.activity.type).toBe("independent_check");
      expect(decision.activity.title).toContain("Diagnostic Check");
      const checkCfg = decision.activity.config as { choices?: Array<{ id: string }> };
      expect(checkCfg.choices?.length).toBe(2);
    });

    it("prescribes later unassisted independent check following supported success", async () => {
      const supportedSuccessResp: TeachingAssessedResponse = {
        activityId: "act_guided",
        conceptId: "MATH-FRAC-PART",
        submittedAnswer: "3",
        isCorrect: true,
        assistanceLevel: 1, // Supported
        ambiguousError: false,
        timestamp: new Date().toISOString(),
      };

      const decision = await authoredEngine.decideNextStep({
        ...baseMathsInput,
        previouslyDeliveredActivities: [
          {
            id: "act_1",
            type: "guided_practice",
            title: "Guided",
            action: "guided_practice",
            timestamp: new Date().toISOString(),
          },
        ],
        recentAssessedResponses: [supportedSuccessResp],
      });

      expect(decision.action).toBe("independent_check");
      expect(decision.activity.type).toBe("independent_check");
      expect(decision.evidence.rationale).toContain("scaffolded support");
    });

    it("prescribes circuit experiment for open-circuit air gap misconception", async () => {
      const airGapResp: TeachingAssessedResponse = {
        activityId: "act_circ_check",
        conceptId: "SCI-ELEC-CIRCUITS",
        submittedAnswer: "choice_glow",
        isCorrect: false,
        assistanceLevel: 0,
        misconceptionDetected: "AIR_GAP",
        ambiguousError: false,
        timestamp: new Date().toISOString(),
      };

      const decision = await authoredEngine.decideNextStep({
        ...baseCircuitsInput,
        previouslyDeliveredActivities: [
          {
            id: "act_intro",
            type: "intro",
            title: "Intro",
            action: "explore",
            timestamp: new Date().toISOString(),
          },
        ],
        recentAssessedResponses: [airGapResp],
      });

      expect(decision.action).toBe("explore");
      expect(decision.activity.type).toBe("interactive_manipulation");
      expect(decision.activity.title).toContain("Testing the Open Switch Air Gap");
    });
  });

  describe("4. LLM Teaching Decision Engine & Fallback (Requirement 5)", () => {
    it("falls back to authored activity for the SAME objective when LLM provider is disabled without logging PII", async () => {
      const llmEngine = new LlmTeachingDecisionEngine();

      const decision = await llmEngine.decideNextStep(baseMathsInput);
      expect(decision.activity).toBeDefined();
      expect(decision.action).toBe("explore");
      expect(decision.audit?.source).toBe("fallback");
      expect(decision.audit?.fallbackReason).toBe("LLM_PROVIDER_DISABLED");
      expect(decision.audit?.unverifiedExplanatoryProse).toBe(false);
    });
  });

  describe("5. Visible Comparison: Struggling vs. Succeeding Synthetic Learners (Requirement 6)", () => {
    // The comparison now replays the same sequencer that persisted student
    // sessions use, with objective status from the real belief reducer, so the
    // trace lists every delivered step (including the checks themselves).
    for (const [subject, objectiveId, misconception] of [
      ["maths", "MATH-FRAC-PART", "REVERSAL"],
      ["science", "SCI-ELEC-CIRCUITS", "AIR_GAP"],
    ] as const) {
      it(`generates materially distinct sequences for struggling vs succeeding learners on ${objectiveId}`, async () => {
        const comparison = await runTeachingDecisionComparison(subject, objectiveId);

        expect(comparison.objectiveId).toBe(objectiveId);
        expect(comparison.subject).toBe(subject);

        const struggling = comparison.traces.struggling;
        const succeeding = comparison.traces.succeeding;
        const strugglingActions = struggling.decisions.map((d) => d.action);
        const succeedingActions = succeeding.decisions.map((d) => d.action);

        // Same objective, same opening step, different sequences afterwards.
        expect(strugglingActions[0]).toBe("explore");
        expect(succeedingActions[0]).toBe("explore");
        expect(strugglingActions[1]).toBe("independent_check");
        expect(succeedingActions[1]).toBe("independent_check");
        expect(struggling.decisions[1]?.activityId).toBe(succeeding.decisions[1]?.activityId);
        expect(strugglingActions).not.toEqual(succeedingActions);

        // Struggling: named misconception -> targeted exploration -> guided task ->
        // supported check -> ambiguous error -> diagnostic probe -> alternative
        // explanation -> supported check -> bounded pause.
        expect(strugglingActions).toEqual([
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
        expect(struggling.decisions[2]?.inferredMisconception).toBe(misconception);
        expect(struggling.decisions[5]?.isAmbiguous).toBe(true);
        expect(struggling.decisions[5]?.learnerResponse?.countedAsEvidence).toBe(false);
        // Checks taken straight after support are recorded as assisted.
        expect(struggling.decisions[1]?.assistanceLevel).toBe(0);
        expect(struggling.decisions[4]?.assistanceLevel).toBe(1);
        expect(struggling.decisions[7]?.assistanceLevel).toBe(1);
        expect(struggling.finalStatus).toBe("paused_at_stopping_point");
        expect(struggling.masteryDemonstrated).toBe(false);
        expect(strugglingActions).not.toContain("advance");

        // Succeeding: three unassisted checks on distinct items before advance.
        expect(succeedingActions).toEqual([
          "explore",
          "independent_check",
          "independent_check",
          "independent_check",
          "advance",
        ]);
        const checks = succeeding.decisions.filter((d) => d.action === "independent_check");
        expect(new Set(checks.map((d) => d.activityId)).size).toBe(3);
        expect(checks.every((d) => d.assistanceLevel === 0)).toBe(true);
        // After two correct answers the lesson moves on, but the objective has not.
        expect(succeeding.decisions[3]?.lessonStage).toBe("ready_for_demonstration_check");
        expect(succeeding.decisions[3]?.objectiveStatus).toBe("developing");
        expect(succeeding.decisions[3]?.eligibleActions).not.toContain("advance");
        // Advance appears only once the reducer reports demonstrated.
        expect(succeeding.decisions[4]?.objectiveStatus).toBe("demonstrated");
        expect(succeeding.finalStatus).toBe("mastery_demonstrated_advanced");
        expect(succeeding.masteryDemonstrated).toBe(true);
        expect(succeedingActions).not.toContain("guided_practice");
        expect(succeedingActions).not.toContain("pause");
      });
    }

    it("rejects an objective that has no authored item bank instead of improvising checks", async () => {
      await expect(runTeachingDecisionComparison("maths", "MATH-FRAC-EQUIV")).rejects.toThrow(
        "No authored item bank",
      );
    });
  });
});
