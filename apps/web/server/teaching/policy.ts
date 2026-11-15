import type {
  LessonProgressStage,
  LessonTeachingAction as TeachingAction,
  TeachingDecisionInput,
  TeachingDecisionEvidence,
  TeachingAssessedResponse,
} from "@gaps/contracts";

/**
 * Version of the lesson-level teaching rules below. It is recorded with every
 * persisted decision. The belief thresholds themselves stay in packages/domain
 * (POLICY_VERSION rules-1.0) and are not restated or altered here.
 */
export const TEACHING_POLICY_VERSION = "teaching-rules-1.1";

/** Remediation routes allowed in one round before the server requires a pause. */
export const MAX_REMEDIATION_CYCLES = 2;

/**
 * Two distinct unassisted correct answers in a row. This is a WITHIN-LESSON
 * signal only: the learner stops receiving guided practice and moves to further
 * independent checks. It never advances the objective. Objective advancement
 * requires the belief reducer's demonstrated status (SPEC §9 / §19.4).
 */
export const LESSON_READY_STREAK = 2;

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

const SUPPORT_ACTIONS: readonly TeachingAction[] = [
  "explain",
  "demonstrate",
  "explore",
  "guided_practice",
  "revisit_prerequisite",
];

export function isSupportAction(action: TeachingAction): boolean {
  return SUPPORT_ACTIONS.includes(action);
}

/**
 * Pure server-side policy engine that determines which teaching actions and
 * objectives are eligible.
 * Requirement 2: "The server decides which objectives and actions are eligible.
 * The LLM can select and configure an activity within those limits.
 * It cannot declare mastery, invent prerequisites, change grading rules, or execute generated code."
 *
 * Two thresholds are kept apart on purpose:
 *  - LESSON_READY_STREAK moves a learner on WITHIN a lesson.
 *  - `advance` (leaving the objective) is eligible only when `objectiveStatus`,
 *    computed by the canonical belief reducer over stored evidence, is
 *    demonstrated or retained. The policy never computes mastery itself.
 */
export class TeachingPolicyEngine {
  public static evaluatePolicy(input: TeachingDecisionInput): PolicyEvaluationResult {
    const delivered = input.previouslyDeliveredActivities;
    const deliveredCount = delivered.length;
    const lastDelivered = delivered[deliveredCount - 1];
    const recent = input.recentAssessedResponses;
    const latestResponse: TeachingAssessedResponse | undefined = recent[recent.length - 1];
    const latestIsDiagnostic = latestResponse?.kind === "diagnostic";
    const assessed = recent.filter((r) => r.kind !== "diagnostic");
    const diagnosticAlreadyUsed = recent.some((r) => r.kind === "diagnostic");

    // Independent consecutive successes over assessed responses (probes excluded).
    const streak: TeachingAssessedResponse[] = [];
    for (let i = assessed.length - 1; i >= 0; i--) {
      const r = assessed[i]!;
      if (r.isCorrect && r.assistanceLevel === 0) {
        streak.push(r);
      } else {
        break;
      }
    }
    const consecutiveSuccesses = streak.length;
    const distinctStreakActivities = new Set(streak.map((r) => r.activityId)).size;

    const remediationCycle = input.remediationCycleCount;
    const objectiveStatus = input.objectiveStatus;
    const objectiveDemonstrated =
      objectiveStatus === "demonstrated" || objectiveStatus === "retained";
    const noCheckItemsLeft = input.remainingCheckItems === 0;

    // A response still needs acting on when nothing has been delivered after the
    // activity it answered. Responses to activities outside the delivered list
    // (direct policy calls) are treated as needing action.
    const answeredIndex = latestResponse
      ? delivered.findIndex((d) => d.id === latestResponse.activityId)
      : -1;
    const responsePending =
      latestResponse !== undefined &&
      (answeredIndex === -1 || answeredIndex === deliveredCount - 1);

    let errorEval: EvaluatedError = {
      isAmbiguous: false,
      misconceptionId: null,
      description: "No recent errors.",
    };
    if (latestResponse && !latestResponse.isCorrect) {
      if (latestResponse.misconceptionDetected) {
        errorEval = {
          isAmbiguous: false,
          misconceptionId: latestResponse.misconceptionDetected,
          description: `Authored distractor maps to misconception ${latestResponse.misconceptionDetected}.`,
        };
      } else if (latestResponse.ambiguousError) {
        errorEval = {
          isAmbiguous: true,
          misconceptionId: null,
          description: `Answer "${latestResponse.submittedAnswer}" does not match a known misconception pattern; diagnostic probe required.`,
        };
      } else {
        errorEval = evaluateErrorMisconception(input.objectiveId, latestResponse.submittedAnswer);
      }
    }

    const result = (
      eligibleActions: TeachingAction[],
      recommendedAction: TeachingAction,
      rationale: string,
      assessmentTarget: string,
      lessonStage: LessonProgressStage,
      error: { inferredMisconception: string | null; isAmbiguous: boolean } = {
        inferredMisconception: null,
        isAmbiguous: false,
      },
    ): PolicyEvaluationResult => ({
      eligibleActions,
      recommendedAction,
      evidence: {
        rationale,
        inferredMisconception: error.inferredMisconception,
        isAmbiguous: error.isAmbiguous,
        consecutiveSuccesses,
        remediationCycle,
        eligibleActions,
        ...(objectiveStatus ? { objectiveStatus } : {}),
        lessonStage,
      },
      assessmentTarget,
    });

    /** Wrap up without advancing when no unused authored check remains. */
    const consolidate = (): PolicyEvaluationResult =>
      result(
        ["pause"],
        "pause",
        `All authored checks for this objective have been used in this lesson and the objective status is ${objectiveStatus ?? "not supplied"}, not demonstrated. The lesson closes without advancing the objective; further evidence is gathered next time.`,
        "Consolidate today's work; return for further independent checks.",
        "consolidating",
      );

    const independentCheck = (
      eligible: TeachingAction[],
      rationale: string,
      target: string,
      stage: LessonProgressStage,
    ): PolicyEvaluationResult =>
      noCheckItemsLeft
        ? consolidate()
        : result(eligible, "independent_check", rationale, target, stage);

    // =========================================================================
    // A. The latest response has not been acted on yet
    // =========================================================================
    if (responsePending && latestResponse) {
      if (!latestResponse.isCorrect) {
        // A missed probe settles the ambiguity: it is a conceptual gap, not a slip.
        const error = latestIsDiagnostic
          ? { inferredMisconception: null, isAmbiguous: false }
          : {
              inferredMisconception: errorEval.misconceptionId,
              isAmbiguous: errorEval.isAmbiguous,
            };

        // RULE 1: Bounded Remediation Loop -> Mandatory Pause
        // Requirement 4: "Bound remediation loops and provide a genuine save-and-pause option."
        if (remediationCycle >= MAX_REMEDIATION_CYCLES) {
          return result(
            ["pause"],
            "pause",
            `Student has encountered continued difficulty across ${MAX_REMEDIATION_CYCLES} remediation cycles. Server policy mandates pause to offer genuine Save & Pause option and prevent frustration.`,
            "Reflect on core mental model with educator guidance before re-attempting.",
            "paused",
            error,
          );
        }

        // RULE 4A: Ambiguous Error -> Diagnostic probe (once per lesson)
        // Requirement 3: "Do not infer a definite misconception from every incorrect
        // answer. When evidence is ambiguous, use a diagnostic question."
        if (errorEval.isAmbiguous && !latestIsDiagnostic && !diagnosticAlreadyUsed) {
          return result(
            ["independent_check"],
            "independent_check",
            `Ambiguous error pattern: ${errorEval.description}. A targeted 2-choice diagnostic probe is required to isolate understanding before prescribing remediation.`,
            "Isolate whether failure is a conceptual misconception or an accidental execution slip.",
            "remediating",
            error,
          );
        }

        const cause = latestIsDiagnostic
          ? "The diagnostic probe was not answered correctly, which points to a conceptual gap rather than a slip"
          : errorEval.misconceptionId
            ? `Identified clear misconception: ${errorEval.misconceptionId}`
            : "The error stayed unclassified after a diagnostic probe was already used in this lesson";

        // RULE 4B: Continued Confusion -> Alternative Explanation or Simpler Task
        // Requirement 3: "Continued confusion -> a different explanation or simpler task."
        if (remediationCycle >= 1) {
          const eligible: TeachingAction[] = ["explain", "guided_practice"];
          if (input.prerequisites.length > 0) eligible.push("revisit_prerequisite");
          return result(
            eligible,
            "explain",
            `Persistent misconception (${errorEval.misconceptionId ?? "unclassified"}) after initial support. ${cause}. Server prescribes an alternative explanation route with everyday grounding and a simplified task.`,
            "Reframe core definition with distinct representation to dispel misconception.",
            "remediating",
            error,
          );
        }

        // RULE 4C: First difficulty -> Interactive Manipulation
        // Requirement 3: "Numerator/denominator confusion -> fraction manipulation.
        // Open-circuit misconception -> prediction and circuit experiment."
        return result(
          ["explore", "guided_practice", "demonstrate"],
          "explore",
          `${cause}. Prescribing targeted interactive manipulation to contrast incorrect assumption against physical reality.`,
          "Directly observe that simulation behavior contradicts the misconception.",
          "remediating",
          error,
        );
      }

      // ---- Latest response was correct ------------------------------------
      if (latestIsDiagnostic) {
        return independentCheck(
          ["independent_check"],
          "The diagnostic probe was answered correctly, so the earlier error looks like a slip rather than a misconception. No remediation is prescribed; a fresh unassisted check follows. The probe itself is not mastery evidence.",
          "Confirm understanding on a fresh item without support.",
          "building_evidence",
        );
      }

      // RULE 2: Objective advancement is decided by the belief reducer only.
      if (objectiveDemonstrated) {
        return result(
          ["advance", "independent_check"],
          "advance",
          `The belief reducer reports this objective as ${objectiveStatus} from stored independent evidence (${consecutiveSuccesses} consecutive unassisted correct in this lesson). Advancement to next objective is authorized.`,
          "Transition understanding to next curriculum milestone.",
          "objective_demonstrated",
        );
      }

      // RULE 5A: Supported Success -> Later Independent Assessment
      if (latestResponse.assistanceLevel > 0) {
        return independentCheck(
          ["independent_check"],
          "Student succeeded with scaffolded support / remediation. An independent assessment is now required to test unassisted mastery.",
          "Demonstrate unassisted problem solving on a fresh item instance.",
          "building_evidence",
        );
      }

      // Within-lesson two-answer rule: stop scaffolding, keep assessing.
      if (
        consecutiveSuccesses >= LESSON_READY_STREAK &&
        distinctStreakActivities >= LESSON_READY_STREAK
      ) {
        return independentCheck(
          ["independent_check"],
          `Student has ${consecutiveSuccesses} consecutive unassisted correct answers on distinct items. Within the lesson this ends guided practice and moves to a further independent check on a different question type. It does not advance the objective: the belief reducer reports ${objectiveStatus ?? "no status"}, and advancement needs its demonstrated status.`,
          "Complete the independent evidence the belief reducer requires across distinct items and templates.",
          "ready_for_demonstration_check",
        );
      }

      // RULE 5B: Independent Success -> Further Independent Check
      return independentCheck(
        ["independent_check", "guided_practice"],
        `Student achieved independent success (${consecutiveSuccesses} consecutive). Presenting next distinct independent check to build towards evidence threshold.`,
        "Verify consistency across distinct question variations.",
        "building_evidence",
      );
    }

    // =========================================================================
    // B. No response is waiting: sequence the teaching steps
    // =========================================================================

    // RULE 3: Initial Session Onboarding (0 activities delivered)
    if (deliveredCount === 0 || !lastDelivered) {
      return result(
        ["explore", "demonstrate", "explain"],
        "explore",
        "Initial session step: engage learner with interactive simulation and hands-on discovery.",
        "Introduce physical representation and verify basic tool familiarity.",
        "teaching",
      );
    }

    // The learner chose to continue after a pause: restart with a different route.
    if (lastDelivered.action === "pause") {
      return result(
        ["demonstrate", "explain"],
        "demonstrate",
        "Learner chose to continue after a pause. Restarting with a foundational walkthrough that differs from the earlier exploration and explanation.",
        "Rebuild the core idea before a supported check.",
        "remediating",
      );
    }

    const inRemediation = latestResponse !== undefined && !latestResponse.isCorrect;

    // After a targeted exploration, a guided task comes before the supported check.
    if (inRemediation && lastDelivered.action === "explore") {
      return result(
        ["guided_practice", "independent_check"],
        "guided_practice",
        "Targeted exploration completed. A structured guided task follows so the learner applies the corrected idea with support before being checked.",
        "Verify ability to achieve guided objective criteria.",
        "remediating",
      );
    }

    if (inRemediation) {
      return independentCheck(
        ["independent_check"],
        "Support for this difficulty has been delivered. A supported check on a fresh item follows; because it comes straight after support it is recorded as assisted and cannot count toward mastery.",
        "Apply the corrected idea to a fresh item with support still recent.",
        "remediating",
      );
    }

    // RULE 6: Introductory/exploratory stage completed.
    return independentCheck(
      ["independent_check", "guided_practice", "explore"],
      "Introductory/exploratory stage completed. A first independent check establishes what the learner can already do before any scaffolding is chosen.",
      "Establish a first unassisted response on the objective.",
      "building_evidence",
    );
  }
}
