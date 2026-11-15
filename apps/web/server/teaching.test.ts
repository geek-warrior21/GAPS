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

    it("authorizes advance when student demonstrates sufficient independent evidence (consecutive successes across distinct items)", () => {
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

      const policy = TeachingPolicyEngine.evaluatePolicy({
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
      });

      expect(policy.eligibleActions).toContain("advance");
      expect(policy.recommendedAction).toBe("advance");
      expect(policy.evidence.consecutiveSuccesses).toBe(2);
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
    it("generates materially distinct sequences for struggling vs succeeding learners on Fractions", async () => {
      const comparison = await runTeachingDecisionComparison("maths", "MATH-FRAC-PART");

      expect(comparison.objectiveId).toBe("MATH-FRAC-PART");
      expect(comparison.subject).toBe("maths");

      const strugglingTrace = comparison.traces.struggling;
      const succeedingTrace = comparison.traces.succeeding;

      // Both start with explore
      expect(strugglingTrace.decisions[0]?.action).toBe("explore");
      expect(succeedingTrace.decisions[0]?.action).toBe("explore");

      // Struggling sequence undergoes targeted interventions and terminates at pause
      const strugglingActions = strugglingTrace.decisions.map((d) => d.action);
      expect(strugglingActions).toContain("explore");
      expect(strugglingActions).toContain("independent_check"); // Diagnostic probe
      expect(strugglingActions).toContain("explain"); // Denominator down rule
      expect(strugglingActions).toContain("pause"); // Mandatory bounded pause
      expect(strugglingTrace.finalStatus).toBe("paused_at_stopping_point");
      expect(strugglingTrace.masteryDemonstrated).toBe(false);

      // Succeeding sequence achieves consecutive independent checks and advances
      const succeedingActions = succeedingTrace.decisions.map((d) => d.action);
      expect(succeedingActions).toContain("explore");
      expect(succeedingActions).toContain("independent_check");
      expect(succeedingActions).toContain("advance");
      expect(succeedingTrace.finalStatus).toBe("mastery_demonstrated_advanced");
      expect(succeedingTrace.masteryDemonstrated).toBe(true);
    });

    it("generates materially distinct sequences for struggling vs succeeding learners on Circuits", async () => {
      const comparison = await runTeachingDecisionComparison("science", "SCI-ELEC-CIRCUITS");

      expect(comparison.objectiveId).toBe("SCI-ELEC-CIRCUITS");
      expect(comparison.subject).toBe("science");

      const strugglingTrace = comparison.traces.struggling;
      const succeedingTrace = comparison.traces.succeeding;

      expect(strugglingTrace.decisions[1]?.inferredMisconception).toBe("AIR_GAP");
      expect(strugglingTrace.decisions.some((d) => d.action === "pause")).toBe(true);

      expect(succeedingTrace.decisions[succeedingTrace.decisions.length - 1]?.action).toBe(
        "advance",
      );
      expect(succeedingTrace.masteryDemonstrated).toBe(true);
    });
  });
});
