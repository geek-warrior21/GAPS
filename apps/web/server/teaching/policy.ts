import type {
  LessonTeachingAction as TeachingAction,
  TeachingDecisionInput,
  TeachingDecisionEvidence,
  TeachingAssessedResponse,
} from "@gaps/contracts";

export interface EvaluatedError {
  isAmbiguous: boolean;
  misconceptionId: string | null;
  description: string;
}

/**
 * Evaluates an incorrect response to determine whether it maps cleanly to a
 * known misconception or is ambiguous.
 * Requirement 3: "Do not infer a definite misconception from every incorrect answer.
 * When evidence is ambiguous, use a diagnostic question."
 */
export function evaluateErrorMisconception(
  objectiveId: string,
  submittedAnswer: string,
): EvaluatedError {
  const norm = submittedAnswer.trim().toLowerCase().replace(/\s+/g, "");

  if (objectiveId === "MATH-FRAC-PART" || objectiveId === "MATH-FRAC-EQUIV") {
    // Numerator / denominator reversal: e.g. "4/3" for "3/4", "3/2" for "2/3"
    if (norm === "4/3" || norm === "3/2" || norm === "5/2" || norm === "6/5") {
      return {
        isAmbiguous: false,
        misconceptionId: "REVERSAL",
        description: "Student inverted numerator and denominator (wrote total over shaded).",
      };
    }

    // Whole vs Part confusion: e.g. "4/1", "1", "3/1"
    if (norm === "4/1" || norm === "3/1" || norm === "1" || norm === "1/1") {
      return {
        isAmbiguous: false,
        misconceptionId: "WHOLE_PART_CONFUSION",
        description: "Student treated parts as whole units without fractional division.",
      };
    }

    // Unshaded partition counted instead of shaded: e.g. "1/4" when 3/4 was shaded
    if (norm === "1/4" || norm === "1/3" || norm === "2/5") {
      return {
        isAmbiguous: false,
        misconceptionId: "UNSHADED_CONFUSION",
        description: "Student counted unshaded portions rather than the specified target.",
      };
    }

    // Arbitrary number or off-by-count without recognizable pattern -> AMBIGUOUS
    return {
      isAmbiguous: true,
      misconceptionId: null,
      description: `Answer "${submittedAnswer}" does not match a known misconception pattern; diagnostic probe required.`,
    };
  }

  if (objectiveId === "SCI-ELEC-CIRCUITS" || objectiveId === "SCI-ELEC-CONDUCTORS") {
    // Air gap misconception
    if (
      norm.includes("air") ||
      norm.includes("gap") ||
      norm.includes("jump") ||
      norm === "choice_glow" ||
      norm.includes("open")
    ) {
      return {
        isAmbiguous: false,
        misconceptionId: "AIR_GAP",
        description: "Student believes current can jump across open switch or air gap.",
      };
    }

    // Current consumption misconception
    if (norm.includes("consume") || norm.includes("used_up") || norm.includes("usesall")) {
      return {
        isAmbiguous: false,
        misconceptionId: "CURRENT_CONSUMPTION",
        description: "Student believes current is used up by the bulb before completing loop.",
      };
    }

    // Unrecognized choice or ambiguous input
    return {
      isAmbiguous: true,
      misconceptionId: null,
      description: `Response does not match known circuit misconceptions; diagnostic probe required.`,
    };
  }

  return {
    isAmbiguous: true,
    misconceptionId: null,
    description: "Ambiguous error pattern for objective.",
  };
}

export interface PolicyEvaluationResult {
  eligibleActions: TeachingAction[];
  recommendedAction: TeachingAction;
  evidence: TeachingDecisionEvidence;
  assessmentTarget: string;
}

/**
 * Pure server-side policy engine that determines which teaching actions and
 * objectives are eligible.
 * Requirement 2: "The server decides which objectives and actions are eligible.
 * The LLM can select and configure an activity within those limits.
 * It cannot declare mastery, invent prerequisites, change grading rules, or execute generated code."
 */
export class TeachingPolicyEngine {
  public static evaluatePolicy(input: TeachingDecisionInput): PolicyEvaluationResult {
    const deliveredCount = input.previouslyDeliveredActivities.length;
    const recent = input.recentAssessedResponses;
    const latestResponse: TeachingAssessedResponse | undefined = recent[recent.length - 1];

    // Compute independent consecutive successes
    let consecutiveSuccesses = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      const r = recent[i]!;
      if (r.isCorrect && r.assistanceLevel === 0) {
        consecutiveSuccesses++;
      } else {
        break;
      }
    }

    // Distinct items and templates among correct independent checks
    const correctIndependent = recent.filter((r) => r.isCorrect && r.assistanceLevel === 0);
    const distinctActivities = new Set(correctIndependent.map((r) => r.activityId));

    // Remediation cycle count
    const remediationCycle = input.remediationCycleCount;

    // Check for misconception or ambiguity if latest response was incorrect
    let errorEval: EvaluatedError = {
      isAmbiguous: false,
      misconceptionId: null,
      description: "No recent errors.",
    };
    if (latestResponse && !latestResponse.isCorrect) {
      errorEval = evaluateErrorMisconception(input.objectiveId, latestResponse.submittedAnswer);
    }

    const eligibleActions: TeachingAction[] = [];
    let recommendedAction: TeachingAction = "explore";
    let rationale = "";
    let assessmentTarget = "";

    // =========================================================================
    // RULE 1: Bounded Remediation Loop -> Mandatory Pause
    // Requirement 4: "Bound remediation loops and provide a genuine save-and-pause option."
    // =========================================================================
    if (remediationCycle >= 2 && latestResponse && !latestResponse.isCorrect) {
      eligibleActions.push("pause");
      recommendedAction = "pause";
      rationale =
        "Student has encountered continued difficulty across 2 remediation cycles. Server policy mandates pause to offer genuine Save & Pause option and prevent frustration.";
      assessmentTarget =
        "Reflect on core mental model with educator guidance before re-attempting.";

      return {
        eligibleActions,
        recommendedAction,
        evidence: {
          rationale,
          inferredMisconception: errorEval.misconceptionId,
          isAmbiguous: errorEval.isAmbiguous,
          consecutiveSuccesses,
          remediationCycle,
          eligibleActions,
        },
        assessmentTarget,
      };
    }

    // =========================================================================
    // RULE 2: Authoritative Mastery Threshold -> Advance Eligible
    // Requirement 2: "It cannot declare mastery... server decides which objectives and actions are eligible."
    // =========================================================================
    const hasSufficientEvidence = consecutiveSuccesses >= 2 && distinctActivities.size >= 2;

    if (hasSufficientEvidence && latestResponse?.isCorrect) {
      eligibleActions.push("advance");
      eligibleActions.push("independent_check"); // Optional challenge check
      recommendedAction = "advance";
      rationale = `Student has achieved sufficient independent evidence (${consecutiveSuccesses} consecutive correct across ${distinctActivities.size} items without assistance). Advancement to next objective is authorized.`;
      assessmentTarget = "Transition understanding to next curriculum milestone.";

      return {
        eligibleActions,
        recommendedAction,
        evidence: {
          rationale,
          inferredMisconception: null,
          isAmbiguous: false,
          consecutiveSuccesses,
          remediationCycle,
          eligibleActions,
        },
        assessmentTarget,
      };
    }

    // =========================================================================
    // RULE 3: Initial Session Onboarding (0 activities delivered)
    // =========================================================================
    if (deliveredCount === 0) {
      eligibleActions.push("explore", "demonstrate", "explain");
      recommendedAction = "explore";
      rationale =
        "Initial session step: engage learner with interactive simulation and hands-on discovery.";
      assessmentTarget = "Introduce physical representation and verify basic tool familiarity.";

      return {
        eligibleActions,
        recommendedAction,
        evidence: {
          rationale,
          inferredMisconception: null,
          isAmbiguous: false,
          consecutiveSuccesses: 0,
          remediationCycle: 0,
          eligibleActions,
        },
        assessmentTarget,
      };
    }

    // =========================================================================
    // RULE 4: Latest Response Was Incorrect
    // =========================================================================
    if (latestResponse && !latestResponse.isCorrect) {
      // 4A: Ambiguous Error -> Diagnostic Independent Check
      // Requirement 3: "Do not infer a definite misconception from every incorrect answer. When evidence is ambiguous, use a diagnostic question."
      if (errorEval.isAmbiguous) {
        eligibleActions.push("independent_check");
        recommendedAction = "independent_check";
        rationale = `Ambiguous error pattern: ${errorEval.description}. A targeted 2-choice diagnostic probe is required to isolate understanding before prescribing remediation.`;
        assessmentTarget =
          "Isolate whether failure is a conceptual misconception or an accidental execution slip.";
      }
      // 4B: Continued Confusion (remediationCycle >= 1) -> Alternative Explanation or Simpler Task
      // Requirement 3: "Continued confusion -> a different explanation or simpler task."
      else if (remediationCycle >= 1) {
        eligibleActions.push("explain", "guided_practice");
        if (input.prerequisites.length > 0) {
          eligibleActions.push("revisit_prerequisite");
        }
        recommendedAction = "explain";
        rationale = `Persistent misconception (${errorEval.misconceptionId}) after initial support. Server prescribes an alternative explanation route with everyday grounding and a simplified task.`;
        assessmentTarget =
          "Reframe core definition with distinct representation to dispel misconception.";
      }
      // 4C: Clear Misconception (remediationCycle === 0) -> Interactive Manipulation
      // Requirement 3: "Numerator/denominator confusion -> fraction manipulation. Open-circuit misconception -> prediction and circuit experiment."
      else {
        eligibleActions.push("explore", "guided_practice", "demonstrate");
        recommendedAction = "explore";
        rationale = `Identified clear misconception: ${errorEval.misconceptionId}. Prescribing targeted interactive manipulation to contrast incorrect assumption against physical reality.`;
        assessmentTarget =
          "Directly observe that simulation behavior contradicts the misconception.";
      }

      return {
        eligibleActions,
        recommendedAction,
        evidence: {
          rationale,
          inferredMisconception: errorEval.misconceptionId,
          isAmbiguous: errorEval.isAmbiguous,
          consecutiveSuccesses,
          remediationCycle,
          eligibleActions,
        },
        assessmentTarget,
      };
    }

    // =========================================================================
    // RULE 5: Latest Response Was Correct
    // =========================================================================
    if (latestResponse?.isCorrect) {
      // 5A: Supported Success -> Later Independent Assessment
      // Requirement 3: "Supported success -> later independent assessment."
      if (latestResponse.assistanceLevel > 0) {
        eligibleActions.push("independent_check");
        recommendedAction = "independent_check";
        rationale =
          "Student succeeded with scaffolded support / remediation. An independent assessment is now required to test unassisted mastery.";
        assessmentTarget = "Demonstrate unassisted problem solving on a fresh item instance.";
      }
      // 5B: Independent Success -> Further Independent Check or Challenge
      else {
        eligibleActions.push("independent_check", "guided_practice");
        recommendedAction = "independent_check";
        rationale = `Student achieved independent success (${consecutiveSuccesses} consecutive). Presenting next distinct independent check to build towards evidence threshold.`;
        assessmentTarget = "Verify consistency across distinct question variations.";
      }

      return {
        eligibleActions,
        recommendedAction,
        evidence: {
          rationale,
          inferredMisconception: null,
          isAmbiguous: false,
          consecutiveSuccesses,
          remediationCycle,
          eligibleActions,
        },
        assessmentTarget,
      };
    }

    // =========================================================================
    // RULE 6: Default Next Action (e.g. following exploration or intro)
    // =========================================================================
    eligibleActions.push("guided_practice", "independent_check", "explore");
    recommendedAction = "guided_practice";
    rationale =
      "Introductory/exploratory stage completed. Transition to structured guided practice.";
    assessmentTarget = "Verify ability to achieve guided objective criteria.";

    return {
      eligibleActions,
      recommendedAction,
      evidence: {
        rationale,
        inferredMisconception: null,
        isAmbiguous: false,
        consecutiveSuccesses,
        remediationCycle,
        eligibleActions,
      },
      assessmentTarget,
    };
  }
}
