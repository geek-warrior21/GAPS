import { type Belief, type ConceptId, type MisconceptionId, type TeachingAction } from "../types";
import { type TemplateCandidate, selectTemplate, targetDifficulty } from "./l2";
import { findWeakPrerequisite } from "./l3";
import type { Rng } from "../rng";

export interface AdaptiveSelectionInput {
  readonly focusConceptId: ConceptId;
  readonly belief: Belief;
  readonly prerequisiteBeliefs: readonly Belief[];
  readonly recentAttempts: readonly {
    readonly conceptId: ConceptId;
    readonly outcome: "correct" | "incorrect" | "unparseable" | "not_simplified";
    readonly assistance: number;
    readonly tryNo: number;
    readonly misconceptionId?: string;
  }[];
  readonly consecutiveIndependentCorrect: number;
  readonly consecutiveIncorrect: number;
  readonly activeMisconceptions: readonly MisconceptionId[];
  readonly recentTemplateIds: readonly string[];
  readonly remediationCount: number;
  readonly sessionMode: "learn" | "review" | "diagnostic" | "quick_check" | "quest" | "boss";
  readonly dueReviewConceptId?: ConceptId;
  readonly prereqRouteTaken?: boolean;
}

export interface AdaptiveDecision {
  readonly action: TeachingAction;
  readonly targetConceptId: ConceptId;
  readonly targetDifficulty: 1 | 2 | 3;
  readonly preferredTemplateId?: string;
  readonly explanationRoute?: "picture" | "everyday" | "steps";
  readonly reasonCode: string;
  readonly reason: string;
  readonly isPrereqStepBack: boolean;
  readonly sessionCompleted: boolean;
}

/**
 * Maps a misconception to the most effective pedagogical explanation route:
 * - Structural / spatial misconceptions map to "picture" (SVG visual models).
 * - Algorithmic / computational misconceptions map to "steps" (step-by-step procedure).
 * - Conceptual / meaning misconceptions map to "everyday" (real-world analogies).
 */
export function getRemediationRouteForMisconception(
  misconceptionId?: MisconceptionId | null,
): "picture" | "everyday" | "steps" {
  if (!misconceptionId) return "everyday";

  switch (misconceptionId) {
    case "MC-PART-RATIO":
    case "MC-NUMLINE-TICKS":
    case "MC-BIGGER-DENOM":
    case "MC-NUMERATOR-ONLY":
    case "MC-ADD-ACROSS":
    case "MC-ADD-DENOMS-LIKE":
      return "picture";

    case "MC-EQUIV-ADDITIVE":
    case "MC-MIXED-ADD-PARTS":
    case "MC-MIXED-WRONG-PRODUCT":
    case "MC-SUB-ACROSS":
    case "MC-MULT-SAME-DENOM":
    case "MC-DIV-FLIP-FIRST":
    case "MC-DIV-NO-FLIP":
    case "MC-DEC-DIGITS":
      return "steps";

    case "MC-FRACTION-OF-UNIT":
    default:
      return "everyday";
  }
}

/**
 * Adaptive Activity Selector.
 * Selects the optimal next learning activity based on student performance,
 * prerequisite readiness, misconception evidence, and previous template exposures.
 */
export function selectAdaptiveActivity<T extends TemplateCandidate>(
  input: AdaptiveSelectionInput,
  candidateTemplates: readonly T[],
  rng: Rng,
): AdaptiveDecision {
  const {
    focusConceptId,
    belief,
    prerequisiteBeliefs,
    recentAttempts,
    consecutiveIndependentCorrect,
    consecutiveIncorrect,
    activeMisconceptions,
    recentTemplateIds,
    remediationCount,
    sessionMode,
    dueReviewConceptId,
    prereqRouteTaken = false,
  } = input;

  const lastAttempt = recentAttempts[recentAttempts.length - 1];

  // 1. Due Review Check (Spacing & Retrieval Practice)
  if (dueReviewConceptId && sessionMode === "review") {
    const diff = targetDifficulty("demonstrated", 0);
    const chosenTemplate = selectTemplate(candidateTemplates, recentTemplateIds, diff, rng);

    return {
      action: "RETRIEVAL_REVIEW",
      targetConceptId: dueReviewConceptId,
      targetDifficulty: diff,
      preferredTemplateId: chosenTemplate?.id,
      reasonCode: "RETRIEVAL_DUE",
      reason: `Reviewing retention for ${dueReviewConceptId} to reinforce memory.`,
      isPrereqStepBack: false,
      sessionCompleted: false,
    };
  }

  // 2. Evaluate Last Attempt Outcomes

  // Case A: Last attempt unparseable or not simplified -> Clarify format
  if (lastAttempt?.outcome === "unparseable") {
    return {
      action: "ASK_CLARIFICATION",
      targetConceptId: focusConceptId,
      targetDifficulty: 1,
      reasonCode: "CLARIFY_INPUT",
      reason: "Clarifying input format for the student.",
      isPrereqStepBack: false,
      sessionCompleted: false,
    };
  }

  if (lastAttempt?.outcome === "not_simplified") {
    return {
      action: "ASK_CLARIFICATION",
      targetConceptId: focusConceptId,
      targetDifficulty: 1,
      reasonCode: "CLARIFY_SIMPLIFY",
      reason: "Fraction is equivalent but needs lowest terms.",
      isPrereqStepBack: false,
      sessionCompleted: false,
    };
  }

  // Case B: Struggling on Concept (>= 2 incorrect) & Weak Prerequisite Identified
  // -> Adaptive step back to the missing foundational prerequisite
  const weakPrereq = !prereqRouteTaken ? findWeakPrerequisite(prerequisiteBeliefs) : undefined;

  if (consecutiveIncorrect >= 2 && weakPrereq !== undefined) {
    const prereqDiff = targetDifficulty(weakPrereq.status, 0);
    const chosenTemplate = selectTemplate(candidateTemplates, recentTemplateIds, prereqDiff, rng);

    return {
      action: "REVIEW_PREREQUISITE",
      targetConceptId: weakPrereq.conceptId,
      targetDifficulty: prereqDiff,
      preferredTemplateId: chosenTemplate?.id,
      reasonCode: "STEP_BACK_TO_PREREQUISITE",
      reason: `Stepping back to foundational prerequisite ${weakPrereq.conceptId} to close knowledge gap.`,
      isPrereqStepBack: true,
      sessionCompleted: false,
    };
  }

  // Case C: Recurring Misconception or Repeated Error on current concept
  // -> Targeted Remediation (Explanation with Visual Model or Worked Example)
  if (consecutiveIncorrect >= 2) {
    const detectedMisconception =
      (lastAttempt?.misconceptionId as MisconceptionId | undefined) ?? activeMisconceptions[0];
    const route = getRemediationRouteForMisconception(detectedMisconception);

    // If already remediated once, show worked example; otherwise explain with visual model
    if (remediationCount >= 1) {
      return {
        action: "WORKED_EXAMPLE",
        targetConceptId: focusConceptId,
        targetDifficulty: 1,
        reasonCode: "WORKED_EXAMPLE_REMEDIATION",
        reason: "Showing worked example step-by-step after repeated difficulty.",
        isPrereqStepBack: false,
        sessionCompleted: false,
      };
    }

    return {
      action: "EXPLAIN",
      targetConceptId: focusConceptId,
      targetDifficulty: 1,
      explanationRoute: route,
      reasonCode: "TARGETED_EXPLANATION",
      reason: `Delivering targeted explanation via '${route}' route to address misconception.`,
      isPrereqStepBack: false,
      sessionCompleted: false,
    };
  }

  // Case D: Single first-try miss on an item
  // -> Provide gentle hint ladder rung 1 without dropping difficulty
  if (lastAttempt?.outcome === "incorrect" && lastAttempt.tryNo === 1) {
    return {
      action: "GIVE_HINT",
      targetConceptId: focusConceptId,
      targetDifficulty: targetDifficulty(belief.status, consecutiveIndependentCorrect),
      reasonCode: "GENTLE_HINT",
      reason: "Offering first-rung hint to support self-correction.",
      isPrereqStepBack: false,
      sessionCompleted: false,
    };
  }

  // Case E: Concept Mastery Achieved (status is demonstrated or retained)
  if (belief.status === "demonstrated" || belief.status === "retained") {
    // If consecutive correct >= 3 and already demonstrated, mark objective complete!
    if (consecutiveIndependentCorrect >= 3) {
      return {
        action: "ADVANCE",
        targetConceptId: focusConceptId,
        targetDifficulty: 3,
        reasonCode: "CONCEPT_DEMONSTRATED",
        reason: "Mastery demonstrated over multiple independent items. Advancing focus.",
        isPrereqStepBack: false,
        sessionCompleted: true,
      };
    }
  }

  // Case F: Normal Adaptive Practice (Calibrated Difficulty)
  const desiredDifficulty = targetDifficulty(belief.status, consecutiveIndependentCorrect);
  const chosenTemplate = selectTemplate(
    candidateTemplates,
    recentTemplateIds,
    desiredDifficulty,
    rng,
  );

  return {
    action: "INDEPENDENT_PRACTICE",
    targetConceptId: focusConceptId,
    targetDifficulty: desiredDifficulty,
    preferredTemplateId: chosenTemplate?.id,
    reasonCode: "INDEPENDENT_PRACTICE",
    reason: `Serving calibrated practice at difficulty ${desiredDifficulty} avoiding recent templates.`,
    isPrereqStepBack: false,
    sessionCompleted: false,
  };
}
