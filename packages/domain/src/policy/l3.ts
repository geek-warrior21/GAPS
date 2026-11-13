import {
  type Belief,
  type ConceptId,
  type DecisionContext,
  type DecisionResult,
  POLICY_VERSION,
  type TeachingAction,
} from "../types";
import { targetDifficulty } from "./l2";

export function isEligibleWeakPrerequisite(b: Belief): boolean {
  return b.status === "not_assessed" || b.status === "needs_support" || b.status === "developing";
}

export function findWeakPrerequisite(prereqs: readonly Belief[]): Belief | undefined {
  return prereqs.find(isEligibleWeakPrerequisite);
}

export function isValidPrerequisiteRoute(
  ctx: DecisionContext,
  targetConceptId?: ConceptId,
): boolean {
  if (ctx.session.prereqRouteTaken) {
    return false;
  }
  if (!targetConceptId) {
    return false;
  }
  const prereq = ctx.prerequisiteBeliefs.find((b) => b.conceptId === targetConceptId);
  if (!prereq) {
    return false;
  }
  return isEligibleWeakPrerequisite(prereq);
}

export function isValidRetrievalReview(ctx: DecisionContext, targetConceptId?: ConceptId): boolean {
  if (!ctx.reviewDue || !ctx.dueReviewConceptId) {
    return false;
  }
  if (!targetConceptId || targetConceptId !== ctx.dueReviewConceptId) {
    return false;
  }
  return true;
}

function clampDifficulty(value: number): 1 | 2 | 3 {
  if (value <= 1) return 1;
  if (value >= 3) return 3;
  return 2;
}

function tryCreateFallback(
  action: TeachingAction,
  ctx: DecisionContext,
  reasonCode: string,
): DecisionResult | null {
  let conceptId = ctx.focusConceptId;
  let difficulty: 1 | 2 | 3 | undefined;
  let route: string | undefined;
  let hintRung: 1 | 2 | 3 | undefined;
  let offerBreak: boolean | undefined;

  if (action === "INDEPENDENT_PRACTICE" || action === "DIAGNOSE" || action === "GUIDED_PRACTICE") {
    difficulty = 1;
  } else if (action === "EXPLAIN") {
    route = "everyday";
  } else if (action === "VISUALIZE") {
    route = "picture";
  } else if (action === "REQUEST_REVIEW") {
    difficulty = 1;
    offerBreak = true;
  } else if (action === "GIVE_HINT") {
    hintRung = clampDifficulty(ctx.session.hintRungShown + 1) as 1 | 2 | 3;
  } else if (action === "RETRIEVAL_REVIEW") {
    if (!ctx.dueReviewConceptId || !isValidRetrievalReview(ctx, ctx.dueReviewConceptId)) {
      return null;
    }
    conceptId = ctx.dueReviewConceptId;
  } else if (action === "REVIEW_PREREQUISITE") {
    if (ctx.session.prereqRouteTaken) {
      return null;
    }
    const weakPrereq = findWeakPrerequisite(ctx.prerequisiteBeliefs);
    if (!weakPrereq) {
      return null;
    }
    conceptId = weakPrereq.conceptId;
    difficulty = targetDifficulty(weakPrereq.status, 0);
  }

  return {
    decisionId: ctx.decisionId,
    selectedAction: action,
    params: {
      conceptId,
      ...(difficulty !== undefined ? { difficulty } : {}),
      ...(route !== undefined ? { route } : {}),
      ...(hintRung !== undefined ? { hintRung } : {}),
      ...(offerBreak !== undefined ? { offerBreak } : {}),
    },
    reasonCodes: [reasonCode],
    provider: "rules",
    policyVersion: POLICY_VERSION,
    fallbackUsed: true,
    latencyMs: 0,
  };
}

function buildFallback(ctx: DecisionContext, reasonCode = "R0_DEFAULT"): DecisionResult {
  if (ctx.allowedActions.length === 0) {
    throw new RangeError("Cannot authorize execution: allowedActions is empty");
  }
  if (ctx.allowedActions.includes("INDEPENDENT_PRACTICE")) {
    const res = tryCreateFallback("INDEPENDENT_PRACTICE", ctx, reasonCode);
    if (res) return res;
  }
  for (const action of ctx.allowedActions) {
    const res = tryCreateFallback(action, ctx, reasonCode);
    if (res) return res;
  }
  throw new RangeError("Cannot authorize execution: no valid fallback action in allowedActions");
}

/**
 * Validate a DecisionResult against DecisionContext invariants, allowedActions,
 * and action preconditions per SPEC §8.
 */
export function guardDecision(ctx: DecisionContext, candidate: DecisionResult): DecisionResult {
  if (ctx.allowedActions.length === 0) {
    throw new RangeError("Cannot authorize execution: allowedActions is empty");
  }

  if (ctx.reviewDue && !ctx.dueReviewConceptId) {
    throw new TypeError("dueReviewConceptId is required when reviewDue is true");
  }

  if (!ctx.allowedActions.includes(candidate.selectedAction)) {
    return buildFallback(ctx, "R0_DEFAULT");
  }

  if (
    candidate.params.difficulty !== undefined &&
    candidate.params.difficulty !== 1 &&
    candidate.params.difficulty !== 2 &&
    candidate.params.difficulty !== 3
  ) {
    return buildFallback(ctx, "R0_DEFAULT");
  }

  switch (candidate.selectedAction) {
    case "GIVE_HINT": {
      const rung = candidate.params.hintRung;
      if (rung !== 1 && rung !== 2 && rung !== 3) {
        return buildFallback(ctx, "R0_DEFAULT");
      }
      break;
    }
    case "RETRIEVAL_REVIEW": {
      if (!isValidRetrievalReview(ctx, candidate.params.conceptId)) {
        return buildFallback(ctx, "R0_DEFAULT");
      }
      break;
    }
    case "REVIEW_PREREQUISITE": {
      if (!isValidPrerequisiteRoute(ctx, candidate.params.conceptId)) {
        return buildFallback(ctx, "R0_DEFAULT");
      }
      break;
    }
    default:
      break;
  }

  return candidate;
}

/**
 * Evaluate deterministic L3 rule table (rules-1.0) per SPEC §8.
 * Pure, zero-I/O decision engine; every candidate passes guardDecision.
 */
export function decideNextAction(ctx: DecisionContext): DecisionResult {
  if (ctx.allowedActions.length === 0) {
    throw new RangeError("Cannot authorize execution: allowedActions is empty");
  }
  if (ctx.reviewDue && !ctx.dueReviewConceptId) {
    throw new TypeError("dueReviewConceptId is required when reviewDue is true");
  }

  const { decisionId, focusConceptId, belief, prerequisiteBeliefs, lastAttempt, request, session } =
    ctx;

  const make = (
    selectedAction: DecisionResult["selectedAction"],
    reasonCode: string,
    params: DecisionResult["params"] = {},
  ): DecisionResult =>
    guardDecision(ctx, {
      decisionId,
      selectedAction,
      params,
      reasonCodes: [reasonCode],
      provider: "rules",
      policyVersion: POLICY_VERSION,
      fallbackUsed: false,
      latencyMs: 0,
    });

  // Rule 1: Student asked for a hint
  if (request?.kind === "hint") {
    if (session.hintRungShown >= 3) {
      return make("WORKED_EXAMPLE", "R1_HINT_REQUESTED", { conceptId: focusConceptId });
    }
    const nextRung = clampDifficulty(session.hintRungShown + 1) as 1 | 2 | 3;
    return make("GIVE_HINT", "R1_HINT_REQUESTED", {
      conceptId: focusConceptId,
      hintRung: nextRung,
    });
  }

  // Rule 2: Student asked to "explain another way" (or worked example)
  if (request?.kind === "worked_example") {
    return make("WORKED_EXAMPLE", "R2_EXPLAIN_REQUESTED", {
      conceptId: focusConceptId,
      route: request.route ?? "worked_example",
    });
  }
  if (request?.kind === "explain") {
    const route = request.route ?? "everyday";
    const action = route === "picture" ? "VISUALIZE" : "EXPLAIN";
    return make(action, "R2_EXPLAIN_REQUESTED", {
      conceptId: focusConceptId,
      route,
    });
  }

  // Rule 3: Answer unparseable
  if (lastAttempt?.outcome === "unparseable") {
    return make("ASK_CLARIFICATION", "R3_UNPARSEABLE", { conceptId: focusConceptId });
  }

  // Rule 4: Correct value, not in the required form
  if (lastAttempt?.outcome === "not_simplified") {
    return make("ASK_CLARIFICATION", "R4_NOT_SIMPLIFIED", {
      conceptId: focusConceptId,
      askSimplify: true,
    });
  }

  // Rule 5: Session budget reached and current item is resolved
  const itemResolved =
    session.currentItemResolved ?? (lastAttempt === undefined || lastAttempt.outcome === "correct");
  if (ctx.remainingSeconds <= 0 && itemResolved) {
    return make("ADVANCE", "R5_BUDGET", { conceptId: focusConceptId });
  }

  // Rule 6: Focus concept not_assessed and nothing served yet
  if (
    belief.status === "not_assessed" &&
    session.currentItemServed !== true &&
    lastAttempt === undefined
  ) {
    return make("DIAGNOSE", "R6_COLD_CONCEPT", {
      conceptId: focusConceptId,
      difficulty: 1,
    });
  }

  // Rules 7-11 apply on incorrect attempts
  if (lastAttempt?.outcome === "incorrect") {
    const weakPrereq = !session.prereqRouteTaken
      ? findWeakPrerequisite(prerequisiteBeliefs)
      : undefined;

    // Rule 7: >= 3 incorrect on this concept this session and prerequisite route available
    if (session.incorrectOnConcept >= 3 && weakPrereq !== undefined) {
      if (weakPrereq.status === "not_assessed") {
        return make("DIAGNOSE", "R7_PREREQ_ROUTE", {
          conceptId: weakPrereq.conceptId,
          difficulty: 1,
        });
      }
      return make("REVIEW_PREREQUISITE", "R7_PREREQ_ROUTE", {
        conceptId: weakPrereq.conceptId,
        difficulty: targetDifficulty(weakPrereq.status, 0),
      });
    }

    // Rule 8: >= 4 incorrect on this concept this session and no prerequisite route
    if (session.incorrectOnConcept >= 4 && weakPrereq === undefined) {
      const easierDiff = clampDifficulty((session.difficulty ?? 2) - 1);
      return make("REQUEST_REVIEW", "R8_ESCALATE", {
        conceptId: focusConceptId,
        difficulty: easierDiff,
        offerBreak: true,
      });
    }

    // Rule 9: First try on item + misconception detected
    if (lastAttempt.tryNo === 1 && lastAttempt.misconceptionId !== undefined) {
      return make("EXPLAIN", "R9_MISCONCEPTION", {
        conceptId: focusConceptId,
        route: "misconception",
      });
    }

    // Rule 10: First try on item (no misconception)
    if (lastAttempt.tryNo === 1) {
      return make("GIVE_HINT", "R10_FIRST_MISS", {
        conceptId: focusConceptId,
        hintRung: 1,
      });
    }

    // Rule 11: Second try on item -> WORKED_EXAMPLE (followed by GUIDED_PRACTICE)
    if (lastAttempt.tryNo === 2) {
      return make("WORKED_EXAMPLE", "R11_SECOND_MISS", {
        conceptId: focusConceptId,
      });
    }
  }

  // Rules 12-14 apply on correct attempts
  if (lastAttempt?.outcome === "correct") {
    // Rule 12: Correct with assistance
    if (lastAttempt.assistance > 0) {
      return make("INDEPENDENT_PRACTICE", "R12_ASSISTED_OK", {
        conceptId: focusConceptId,
        difficulty: targetDifficulty(belief.status, 0),
      });
    }

    // Rule 13: Correct independently and concept just became demonstrated
    const justDemonstrated =
      ctx.justBecameDemonstrated === true || ctx.session.justBecameDemonstrated === true;
    if (justDemonstrated) {
      if (ctx.reviewDue) {
        if (!ctx.dueReviewConceptId) {
          throw new TypeError("dueReviewConceptId is required when reviewDue is true");
        }
        return make("RETRIEVAL_REVIEW", "R13_DEMONSTRATED", {
          conceptId: ctx.dueReviewConceptId,
        });
      }
      return make("ADVANCE", "R13_DEMONSTRATED", {
        conceptId: focusConceptId,
      });
    }

    // Rule 14: Correct independently, not yet demonstrated
    return make("INDEPENDENT_PRACTICE", "R14_KEEP_GOING", {
      conceptId: focusConceptId,
      difficulty: targetDifficulty(belief.status, session.consecutiveIndependentCorrect),
    });
  }

  return buildFallback(ctx, "R0_DEFAULT");
}
