import { describe, expect, it } from "vitest";
import type { DecisionContext, TeachingAction } from "../types";
import { decideNextAction } from "./l3";
import { makeBelief, makeContext } from "./l3.test";

/**
 * Educator sign-off guard: all 40 golden decision scenarios below are derived
 * from SPEC §8 & §25 and require education-lead review before pilot sign-off.
 */
export const GOLDEN_EDUCATOR_REVIEW_STATUS = "pending" as const;

interface GoldenScenario {
  readonly id: string;
  readonly educatorReviewStatus: "pending";
  readonly situation: string;
  readonly context: DecisionContext;
  readonly expectedAction: TeachingAction;
  readonly expectedReasonCode: string;
  readonly expectedConceptId?: DecisionContext["focusConceptId"];
  readonly expectedHintRung?: 1 | 2 | 3;
  readonly expectedDifficulty?: 1 | 2 | 3;
  readonly expectedFallback?: boolean;
  readonly expectedOfferBreak?: boolean;
  readonly expectedAskSimplify?: boolean;
}

const GOLDEN_SCENARIOS: readonly GoldenScenario[] = [
  // G01-G10 match SPEC §25 canonical scenarios
  {
    id: "G01",
    educatorReviewStatus: "pending",
    situation: "Cold start; focus concept not_assessed; nothing served",
    context: makeContext({
      belief: makeBelief("MATH-FRAC-ADDUNLIKE", "not_assessed"),
      session: {
        mode: "learn",
        incorrectOnConcept: 0,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
        currentItemServed: false,
      },
    }),
    expectedAction: "DIAGNOSE",
    expectedReasonCode: "R6_COLD_CONCEPT",
    expectedDifficulty: 1,
  },
  {
    id: "G02",
    educatorReviewStatus: "pending",
    situation: "First miss on an item; no misconception",
    context: makeContext({
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 1 },
      session: {
        mode: "learn",
        incorrectOnConcept: 1,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "GIVE_HINT",
    expectedReasonCode: "R10_FIRST_MISS",
    expectedHintRung: 1,
  },
  {
    id: "G03",
    educatorReviewStatus: "pending",
    situation: "First miss; answer matches MC-ADD-ACROSS",
    context: makeContext({
      lastAttempt: {
        outcome: "incorrect",
        misconceptionId: "MC-ADD-ACROSS",
        assistance: 0,
        tryNo: 1,
      },
      session: {
        mode: "learn",
        incorrectOnConcept: 1,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "EXPLAIN",
    expectedReasonCode: "R9_MISCONCEPTION",
  },
  {
    id: "G04",
    educatorReviewStatus: "pending",
    situation: "Second miss on the same item",
    context: makeContext({
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 2 },
      session: {
        mode: "learn",
        incorrectOnConcept: 2,
        prereqRouteTaken: false,
        hintRungShown: 1,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "WORKED_EXAMPLE",
    expectedReasonCode: "R11_SECOND_MISS",
  },
  {
    id: "G05",
    educatorReviewStatus: "pending",
    situation: "Third miss in concept; prerequisite EQUIV not_assessed",
    context: makeContext({
      prerequisiteBeliefs: [
        makeBelief("MATH-FRAC-EQUIV", "not_assessed"),
        makeBelief("MATH-FRAC-ADDLIKE", "demonstrated"),
      ],
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 1 },
      session: {
        mode: "learn",
        incorrectOnConcept: 3,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "DIAGNOSE",
    expectedReasonCode: "R7_PREREQ_ROUTE",
    expectedConceptId: "MATH-FRAC-EQUIV",
  },
  {
    id: "G06",
    educatorReviewStatus: "pending",
    situation: "Fourth miss; all prerequisites demonstrated",
    context: makeContext({
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 2 },
      session: {
        mode: "learn",
        incorrectOnConcept: 4,
        prereqRouteTaken: false,
        hintRungShown: 1,
        consecutiveIndependentCorrect: 0,
        difficulty: 2,
      },
    }),
    expectedAction: "REQUEST_REVIEW",
    expectedReasonCode: "R8_ESCALATE",
    expectedDifficulty: 1,
    expectedOfferBreak: true,
  },
  {
    id: "G07",
    educatorReviewStatus: "pending",
    situation: "Correct after a hint",
    context: makeContext({
      lastAttempt: { outcome: "correct", assistance: 1, tryNo: 2 },
    }),
    expectedAction: "INDEPENDENT_PRACTICE",
    expectedReasonCode: "R12_ASSISTED_OK",
  },
  {
    id: "G08",
    educatorReviewStatus: "pending",
    situation: "Third independent correct makes demonstrated; review due elsewhere",
    context: makeContext({
      focusConceptId: "MATH-FRAC-ADDUNLIKE",
      belief: makeBelief("MATH-FRAC-ADDUNLIKE", "demonstrated"),
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
      justBecameDemonstrated: true,
      reviewDue: true,
      dueReviewConceptId: "MATH-FRAC-PART",
    }),
    expectedAction: "RETRIEVAL_REVIEW",
    expectedReasonCode: "R13_DEMONSTRATED",
    expectedConceptId: "MATH-FRAC-PART",
  },
  {
    id: "G09",
    educatorReviewStatus: "pending",
    situation: "2/4 typed when simplest form is required",
    context: makeContext({
      lastAttempt: { outcome: "not_simplified", assistance: 0, tryNo: 1 },
    }),
    expectedAction: "ASK_CLARIFICATION",
    expectedReasonCode: "R4_NOT_SIMPLIFIED",
    expectedAskSimplify: true,
  },
  {
    id: "G10",
    educatorReviewStatus: "pending",
    situation: "Unparseable abc typed",
    context: makeContext({
      lastAttempt: { outcome: "unparseable", assistance: 0, tryNo: 1 },
    }),
    expectedAction: "ASK_CLARIFICATION",
    expectedReasonCode: "R3_UNPARSEABLE",
  },

  // G11-G20: Hint requests, explain routes, budget & clarification precedence
  {
    id: "G11",
    educatorReviewStatus: "pending",
    situation: "Student asks for hint when none shown yet",
    context: makeContext({
      request: { kind: "hint" },
      session: {
        mode: "learn",
        incorrectOnConcept: 0,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "GIVE_HINT",
    expectedReasonCode: "R1_HINT_REQUESTED",
    expectedHintRung: 1,
  },
  {
    id: "G12",
    educatorReviewStatus: "pending",
    situation: "Student asks for hint after rung 1 shown",
    context: makeContext({
      request: { kind: "hint" },
      session: {
        mode: "learn",
        incorrectOnConcept: 1,
        prereqRouteTaken: false,
        hintRungShown: 1,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "GIVE_HINT",
    expectedReasonCode: "R1_HINT_REQUESTED",
    expectedHintRung: 2,
  },
  {
    id: "G13",
    educatorReviewStatus: "pending",
    situation: "Student asks for hint after rung 2 shown",
    context: makeContext({
      request: { kind: "hint" },
      session: {
        mode: "learn",
        incorrectOnConcept: 1,
        prereqRouteTaken: false,
        hintRungShown: 2,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "GIVE_HINT",
    expectedReasonCode: "R1_HINT_REQUESTED",
    expectedHintRung: 3,
  },
  {
    id: "G14",
    educatorReviewStatus: "pending",
    situation: "Student asks for hint when all 3 rungs used up",
    context: makeContext({
      request: { kind: "hint" },
      session: {
        mode: "learn",
        incorrectOnConcept: 2,
        prereqRouteTaken: false,
        hintRungShown: 3,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "WORKED_EXAMPLE",
    expectedReasonCode: "R1_HINT_REQUESTED",
  },
  {
    id: "G15",
    educatorReviewStatus: "pending",
    situation: "Student asks for explain another way via everyday route",
    context: makeContext({
      request: { kind: "explain", route: "everyday" },
    }),
    expectedAction: "EXPLAIN",
    expectedReasonCode: "R2_EXPLAIN_REQUESTED",
  },
  {
    id: "G16",
    educatorReviewStatus: "pending",
    situation: "Student asks for explain another way via picture route",
    context: makeContext({
      request: { kind: "explain", route: "picture" },
    }),
    expectedAction: "VISUALIZE",
    expectedReasonCode: "R2_EXPLAIN_REQUESTED",
  },
  {
    id: "G17",
    educatorReviewStatus: "pending",
    situation: "Student explicitly requests a worked example",
    context: makeContext({
      request: { kind: "worked_example" },
    }),
    expectedAction: "WORKED_EXAMPLE",
    expectedReasonCode: "R2_EXPLAIN_REQUESTED",
  },
  {
    id: "G18",
    educatorReviewStatus: "pending",
    situation: "Session budget reached and current item resolved after correct answer",
    context: makeContext({
      remainingSeconds: 0,
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
      session: {
        mode: "learn",
        incorrectOnConcept: 0,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 1,
        currentItemResolved: true,
      },
    }),
    expectedAction: "ADVANCE",
    expectedReasonCode: "R5_BUDGET",
  },
  {
    id: "G19",
    educatorReviewStatus: "pending",
    situation:
      "Session budget reached but current item unresolved on first miss -> still gives hint",
    context: makeContext({
      remainingSeconds: 0,
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 1 },
      session: {
        mode: "learn",
        incorrectOnConcept: 1,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
        currentItemResolved: false,
      },
    }),
    expectedAction: "GIVE_HINT",
    expectedReasonCode: "R10_FIRST_MISS",
  },
  {
    id: "G20",
    educatorReviewStatus: "pending",
    situation: "Unparseable overrides remainingSeconds <= 0 so student can re-enter",
    context: makeContext({
      remainingSeconds: 0,
      lastAttempt: { outcome: "unparseable", assistance: 0, tryNo: 1 },
    }),
    expectedAction: "ASK_CLARIFICATION",
    expectedReasonCode: "R3_UNPARSEABLE",
  },

  // G21-G30: Prerequisite routing, escalation boundaries & misconception priority
  {
    id: "G21",
    educatorReviewStatus: "pending",
    situation:
      "Third miss on concept; prerequisite ADDLIKE is needs_support -> REVIEW_PREREQUISITE",
    context: makeContext({
      prerequisiteBeliefs: [
        makeBelief("MATH-FRAC-EQUIV", "demonstrated"),
        makeBelief("MATH-FRAC-ADDLIKE", "needs_support"),
      ],
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 1 },
      session: {
        mode: "learn",
        incorrectOnConcept: 3,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "REVIEW_PREREQUISITE",
    expectedReasonCode: "R7_PREREQ_ROUTE",
    expectedConceptId: "MATH-FRAC-ADDLIKE",
    expectedDifficulty: 1,
  },
  {
    id: "G22",
    educatorReviewStatus: "pending",
    situation:
      "Third miss on concept; prerequisite NUM-LCM is developing -> REVIEW_PREREQUISITE at difficulty 2",
    context: makeContext({
      prerequisiteBeliefs: [
        makeBelief("MATH-FRAC-EQUIV", "retained"),
        makeBelief("MATH-NUM-LCM", "developing"),
      ],
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 2 },
      session: {
        mode: "learn",
        incorrectOnConcept: 3,
        prereqRouteTaken: false,
        hintRungShown: 1,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "REVIEW_PREREQUISITE",
    expectedReasonCode: "R7_PREREQ_ROUTE",
    expectedConceptId: "MATH-NUM-LCM",
    expectedDifficulty: 2,
  },
  {
    id: "G23",
    educatorReviewStatus: "pending",
    situation:
      "Third miss with weak prereq, but prereqRouteTaken already true -> falls through to R9 misconception",
    context: makeContext({
      prerequisiteBeliefs: [makeBelief("MATH-FRAC-EQUIV", "needs_support")],
      lastAttempt: {
        outcome: "incorrect",
        misconceptionId: "MC-SUB-ACROSS",
        assistance: 0,
        tryNo: 1,
      },
      session: {
        mode: "learn",
        incorrectOnConcept: 3,
        prereqRouteTaken: true,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "EXPLAIN",
    expectedReasonCode: "R9_MISCONCEPTION",
  },
  {
    id: "G24",
    educatorReviewStatus: "pending",
    situation: "Fourth miss after prereqRouteTaken already true -> escalates to REQUEST_REVIEW",
    context: makeContext({
      prerequisiteBeliefs: [makeBelief("MATH-FRAC-EQUIV", "needs_support")],
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 2 },
      session: {
        mode: "learn",
        incorrectOnConcept: 4,
        prereqRouteTaken: true,
        hintRungShown: 2,
        consecutiveIndependentCorrect: 0,
        difficulty: 3,
      },
    }),
    expectedAction: "REQUEST_REVIEW",
    expectedReasonCode: "R8_ESCALATE",
    expectedDifficulty: 2,
    expectedOfferBreak: true,
  },
  {
    id: "G25",
    educatorReviewStatus: "pending",
    situation: "Fourth miss at difficulty 1 clamps easier difficulty to 1",
    context: makeContext({
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 1 },
      session: {
        mode: "learn",
        incorrectOnConcept: 5,
        prereqRouteTaken: true,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
        difficulty: 1,
      },
    }),
    expectedAction: "REQUEST_REVIEW",
    expectedReasonCode: "R8_ESCALATE",
    expectedDifficulty: 1,
  },
  {
    id: "G26",
    educatorReviewStatus: "pending",
    situation:
      "Third miss when all prerequisites demonstrated, try 1 no misconception -> hint rung 1",
    context: makeContext({
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 1 },
      session: {
        mode: "learn",
        incorrectOnConcept: 3,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "GIVE_HINT",
    expectedReasonCode: "R10_FIRST_MISS",
    expectedHintRung: 1,
  },
  {
    id: "G27",
    educatorReviewStatus: "pending",
    situation:
      "Second try miss with misconception still goes to WORKED_EXAMPLE (R11 checks tryNo 2, R9 is tryNo 1)",
    context: makeContext({
      lastAttempt: {
        outcome: "incorrect",
        misconceptionId: "MC-ADD-ACROSS",
        assistance: 1,
        tryNo: 2,
      },
      session: {
        mode: "learn",
        incorrectOnConcept: 2,
        prereqRouteTaken: false,
        hintRungShown: 1,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "WORKED_EXAMPLE",
    expectedReasonCode: "R11_SECOND_MISS",
  },
  {
    id: "G28",
    educatorReviewStatus: "pending",
    situation: "R7 takes priority over R9 when >= 3 incorrect and prerequisite route available",
    context: makeContext({
      prerequisiteBeliefs: [makeBelief("MATH-NUM-LCM", "not_assessed")],
      lastAttempt: {
        outcome: "incorrect",
        misconceptionId: "MC-ADD-ACROSS",
        assistance: 0,
        tryNo: 1,
      },
      session: {
        mode: "learn",
        incorrectOnConcept: 3,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "DIAGNOSE",
    expectedReasonCode: "R7_PREREQ_ROUTE",
    expectedConceptId: "MATH-NUM-LCM",
  },
  {
    id: "G29",
    educatorReviewStatus: "pending",
    situation:
      "R8 waits if a prerequisite route is STILL available on miss 4 -> routes to R7 instead",
    context: makeContext({
      prerequisiteBeliefs: [makeBelief("MATH-FRAC-ADDLIKE", "developing")],
      lastAttempt: { outcome: "incorrect", assistance: 0, tryNo: 2 },
      session: {
        mode: "learn",
        incorrectOnConcept: 4,
        prereqRouteTaken: false,
        hintRungShown: 1,
        consecutiveIndependentCorrect: 0,
      },
    }),
    expectedAction: "REVIEW_PREREQUISITE",
    expectedReasonCode: "R7_PREREQ_ROUTE",
    expectedConceptId: "MATH-FRAC-ADDLIKE",
  },
  {
    id: "G30",
    educatorReviewStatus: "pending",
    situation:
      "Not-assessed concept WITH item already served and first miss does NOT trigger R6 cold start",
    context: makeContext({
      belief: makeBelief("MATH-FRAC-PART", "not_assessed"),
      focusConceptId: "MATH-FRAC-PART",
      prerequisiteBeliefs: [],
      lastAttempt: {
        outcome: "incorrect",
        misconceptionId: "MC-PART-RATIO",
        assistance: 0,
        tryNo: 1,
      },
      session: {
        mode: "learn",
        incorrectOnConcept: 1,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
        currentItemServed: true,
      },
    }),
    expectedAction: "EXPLAIN",
    expectedReasonCode: "R9_MISCONCEPTION",
  },

  // G31-G40: Correct progressions, difficulty ramp, mastery advance, and guards/fallback
  {
    id: "G31",
    educatorReviewStatus: "pending",
    situation: "Demonstrated on independent correct with NO review due -> ADVANCE",
    context: makeContext({
      belief: makeBelief("MATH-FRAC-EQUIV", "demonstrated"),
      focusConceptId: "MATH-FRAC-EQUIV",
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
      justBecameDemonstrated: true,
      reviewDue: false,
    }),
    expectedAction: "ADVANCE",
    expectedReasonCode: "R13_DEMONSTRATED",
  },
  {
    id: "G32",
    educatorReviewStatus: "pending",
    situation: "Retained on independent correct review -> ADVANCE when no other review due",
    context: makeContext({
      belief: makeBelief("MATH-FRAC-PART", "retained"),
      focusConceptId: "MATH-FRAC-PART",
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
      justBecameDemonstrated: true,
      reviewDue: false,
    }),
    expectedAction: "ADVANCE",
    expectedReasonCode: "R13_DEMONSTRATED",
  },
  {
    id: "G33",
    educatorReviewStatus: "pending",
    situation: "Assisted correct on needs_support stays at difficulty 1 independent practice",
    context: makeContext({
      belief: makeBelief("MATH-FRAC-EQUIV", "needs_support"),
      focusConceptId: "MATH-FRAC-EQUIV",
      lastAttempt: { outcome: "correct", assistance: 2, tryNo: 2 },
    }),
    expectedAction: "INDEPENDENT_PRACTICE",
    expectedReasonCode: "R12_ASSISTED_OK",
    expectedDifficulty: 1,
  },
  {
    id: "G34",
    educatorReviewStatus: "pending",
    situation: "Assisted correct on developing serves difficulty 2 independent practice",
    context: makeContext({
      belief: makeBelief("MATH-FRAC-EQUIV", "developing"),
      focusConceptId: "MATH-FRAC-EQUIV",
      lastAttempt: { outcome: "correct", assistance: 3, tryNo: 1 },
    }),
    expectedAction: "INDEPENDENT_PRACTICE",
    expectedReasonCode: "R12_ASSISTED_OK",
    expectedDifficulty: 2,
  },
  {
    id: "G35",
    educatorReviewStatus: "pending",
    situation: "Independent correct on developing with 1 consecutive -> difficulty 2",
    context: makeContext({
      belief: makeBelief("MATH-FRAC-SIMPLIFY", "developing"),
      focusConceptId: "MATH-FRAC-SIMPLIFY",
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
      session: {
        mode: "learn",
        incorrectOnConcept: 0,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 1,
      },
    }),
    expectedAction: "INDEPENDENT_PRACTICE",
    expectedReasonCode: "R14_KEEP_GOING",
    expectedDifficulty: 2,
  },
  {
    id: "G36",
    educatorReviewStatus: "pending",
    situation: "Independent correct on developing with 2 consecutive in a row -> difficulty 3",
    context: makeContext({
      belief: makeBelief("MATH-FRAC-SIMPLIFY", "developing"),
      focusConceptId: "MATH-FRAC-SIMPLIFY",
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
      session: {
        mode: "learn",
        incorrectOnConcept: 0,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 2,
      },
    }),
    expectedAction: "INDEPENDENT_PRACTICE",
    expectedReasonCode: "R14_KEEP_GOING",
    expectedDifficulty: 3,
  },
  {
    id: "G37",
    educatorReviewStatus: "pending",
    situation: "Independent correct on needs_support stays at difficulty 1 even after 2 in a row",
    context: makeContext({
      belief: makeBelief("MATH-FRAC-DIV", "needs_support"),
      focusConceptId: "MATH-FRAC-DIV",
      lastAttempt: { outcome: "correct", assistance: 0, tryNo: 1 },
      session: {
        mode: "learn",
        incorrectOnConcept: 2,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 2,
      },
    }),
    expectedAction: "INDEPENDENT_PRACTICE",
    expectedReasonCode: "R14_KEEP_GOING",
    expectedDifficulty: 1,
  },
  {
    id: "G38",
    educatorReviewStatus: "pending",
    situation: "Developing concept at session resume with no lastAttempt falls to R0_DEFAULT",
    context: makeContext({
      belief: makeBelief("MATH-FRAC-COMPARE", "developing"),
      focusConceptId: "MATH-FRAC-COMPARE",
      lastAttempt: undefined,
    }),
    expectedAction: "INDEPENDENT_PRACTICE",
    expectedReasonCode: "R0_DEFAULT",
    expectedFallback: true,
  },
  {
    id: "G39",
    educatorReviewStatus: "pending",
    situation:
      "Guard rejects EXPLAIN if disallowed in quest/boss mode -> falls back to INDEPENDENT_PRACTICE",
    context: makeContext({
      allowedActions: ["INDEPENDENT_PRACTICE"],
      lastAttempt: {
        outcome: "incorrect",
        misconceptionId: "MC-DIV-NO-FLIP",
        assistance: 0,
        tryNo: 1,
      },
    }),
    expectedAction: "INDEPENDENT_PRACTICE",
    expectedReasonCode: "R0_DEFAULT",
    expectedFallback: true,
  },
  {
    id: "G40",
    educatorReviewStatus: "pending",
    situation: "R1 hint request beats R5 zero budget so student still gets requested hint",
    context: makeContext({
      remainingSeconds: 0,
      request: { kind: "hint" },
      session: {
        mode: "learn",
        incorrectOnConcept: 1,
        prereqRouteTaken: false,
        hintRungShown: 0,
        consecutiveIndependentCorrect: 0,
        currentItemResolved: false,
      },
    }),
    expectedAction: "GIVE_HINT",
    expectedReasonCode: "R1_HINT_REQUESTED",
    expectedHintRung: 1,
  },
];

describe("L3 40 golden decision scenarios (educator review pending)", () => {
  it("contains exactly 40 scenarios, all explicitly marked educator review pending", () => {
    expect(GOLDEN_EDUCATOR_REVIEW_STATUS).toBe("pending");
    expect(GOLDEN_SCENARIOS).toHaveLength(40);
    expect(new Set(GOLDEN_SCENARIOS.map((s) => s.id)).size).toBe(40);
    expect(GOLDEN_SCENARIOS.every((s) => s.educatorReviewStatus === "pending")).toBe(true);
  });

  it.each(GOLDEN_SCENARIOS)(
    "$id: $situation -> $expectedAction ($expectedReasonCode)",
    (scenario) => {
      const res = decideNextAction(scenario.context);
      expect(res.selectedAction).toBe(scenario.expectedAction);
      expect(res.reasonCodes).toContain(scenario.expectedReasonCode);
      if (scenario.expectedConceptId !== undefined) {
        expect(res.params.conceptId).toBe(scenario.expectedConceptId);
      }
      if (scenario.expectedHintRung !== undefined) {
        expect(res.params.hintRung).toBe(scenario.expectedHintRung);
      }
      if (scenario.expectedDifficulty !== undefined) {
        expect(res.params.difficulty).toBe(scenario.expectedDifficulty);
      }
      if (scenario.expectedFallback !== undefined) {
        expect(res.fallbackUsed).toBe(scenario.expectedFallback);
      } else {
        expect(res.fallbackUsed).toBe(false);
      }
      if (scenario.expectedOfferBreak !== undefined) {
        expect(res.params.offerBreak).toBe(scenario.expectedOfferBreak);
      }
      if (scenario.expectedAskSimplify !== undefined) {
        expect(res.params.askSimplify).toBe(scenario.expectedAskSimplify);
      }
    },
  );
});
