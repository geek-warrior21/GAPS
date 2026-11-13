import { z } from "zod";

export const ConceptIdSchema = z.enum([
  "MATH-FRAC-PART",
  "MATH-FRAC-NUMLINE",
  "MATH-NUM-HCF",
  "MATH-FRAC-EQUIV",
  "MATH-FRAC-SIMPLIFY",
  "MATH-FRAC-COMPARE",
  "MATH-FRAC-MIXED",
  "MATH-NUM-LCM",
  "MATH-FRAC-ADDLIKE",
  "MATH-FRAC-ADDUNLIKE",
  "MATH-FRAC-MULT",
  "MATH-FRAC-DIV",
  "MATH-FRAC-DEC",
  "MATH-FRAC-WORD",
]);

export const MisconceptionIdSchema = z.enum([
  "MC-PART-RATIO",
  "MC-NUMLINE-TICKS",
  "MC-EQUIV-ADDITIVE",
  "MC-NUMERATOR-ONLY",
  "MC-BIGGER-DENOM",
  "MC-MIXED-ADD-PARTS",
  "MC-MIXED-WRONG-PRODUCT",
  "MC-ADD-ACROSS",
  "MC-ADD-DENOMS-LIKE",
  "MC-SUB-ACROSS",
  "MC-MULT-SAME-DENOM",
  "MC-FRACTION-OF-UNIT",
  "MC-DIV-FLIP-FIRST",
  "MC-DIV-NO-FLIP",
  "MC-DEC-DIGITS",
]);

export const TeachingActionSchema = z.enum([
  "DIAGNOSE",
  "EXPLAIN",
  "GIVE_HINT",
  "WORKED_EXAMPLE",
  "VISUALIZE",
  "REVIEW_PREREQUISITE",
  "GUIDED_PRACTICE",
  "INDEPENDENT_PRACTICE",
  "RETRIEVAL_REVIEW",
  "ADVANCE",
  "ASK_CLARIFICATION",
  "REQUEST_REVIEW",
]);

export const BeliefStatusSchema = z.enum([
  "not_assessed",
  "needs_support",
  "developing",
  "demonstrated",
  "retained",
]);

export const ReliabilitySchema = z.enum(["missing", "stale", "conflicting", "supported"]);

export const AttemptModeSchema = z.enum([
  "learn",
  "review",
  "quest",
  "boss",
  "quick_check",
  "solve_followup",
]);

export const AttemptOutcomeSchema = z.enum([
  "correct",
  "incorrect",
  "unparseable",
  "not_simplified",
]);

export const BeliefSchema = z.object({
  conceptId: ConceptIdSchema,
  status: BeliefStatusSchema,
  estimate: z.number().min(0).max(1).nullable(),
  reliability: ReliabilitySchema,
  demonstratedAt: z.iso.datetime().nullable(),
  retainedAt: z.iso.datetime().nullable(),
  firstNeedsSupportAt: z.iso.datetime().nullable(),
  activeMisconceptionIds: z.array(MisconceptionIdSchema),
  policyVersion: z.literal("rules-1.0"),
  version: z.number().int().min(0),
});

const CROCKFORD_ULID_CHARS = "[0-9A-HJKMNP-TV-Z]{26}";
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PrefixedUlidSchema = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}${CROCKFORD_ULID_CHARS}$`), `Invalid ${prefix} ID`);

export const AttemptIdSchema = PrefixedUlidSchema("att_");
export const StudentIdSchema = PrefixedUlidSchema("stu_");
export const SessionIdSchema = PrefixedUlidSchema("ses_");
export const ItemInstanceIdSchema = PrefixedUlidSchema("itm_");
export const DecisionIdSchema = PrefixedUlidSchema("dec_");
export const QuestIdSchema = PrefixedUlidSchema("qst_");
export const BossIdSchema = PrefixedUlidSchema("bos_");
export const ClientAttemptIdSchema = z
  .string()
  .regex(UUID_V4_REGEX, "Invalid clientAttemptId UUID v4");

export const CheckedAttemptSchema = z.object({
  attemptId: AttemptIdSchema,
  studentId: StudentIdSchema,
  sessionId: SessionIdSchema,
  clientAttemptId: ClientAttemptIdSchema,
  itemInstanceId: ItemInstanceIdSchema,
  templateId: z.string().min(1),
  conceptId: ConceptIdSchema,
  mode: AttemptModeSchema,
  outcome: AttemptOutcomeSchema,
  misconceptionId: MisconceptionIdSchema.optional(),
  assistance: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  tryNo: z.union([z.literal(1), z.literal(2)]),
  isReview: z.boolean(),
  verifierVersion: z.literal("verify-1.0"),
  at: z.iso.datetime(),
});

export const DecisionContextSchema = z.object({
  schemaVersion: z.literal(1),
  decisionId: DecisionIdSchema,
  studentRef: z.string().min(1),
  stateVersion: z.number().int().min(0),
  focusConceptId: ConceptIdSchema,
  belief: BeliefSchema,
  prerequisiteBeliefs: z.array(BeliefSchema),
  lastAttempt: CheckedAttemptSchema.pick({
    outcome: true,
    misconceptionId: true,
    assistance: true,
    tryNo: true,
  }).optional(),
  request: z
    .object({
      kind: z.enum(["hint", "explain", "worked_example"]),
      route: z.string().optional(),
    })
    .optional(),
  session: z.object({
    mode: AttemptModeSchema,
    incorrectOnConcept: z.number().int().min(0),
    prereqRouteTaken: z.boolean(),
    hintRungShown: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    consecutiveIndependentCorrect: z.number().int().min(0),
    currentItemServed: z.boolean().optional(),
    currentItemResolved: z.boolean().optional(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    justBecameDemonstrated: z.boolean().optional(),
  }),
  justBecameDemonstrated: z.boolean().optional(),
  dueReviewConceptId: ConceptIdSchema.optional(),
  reviewDue: z.boolean(),
  allowedActions: z.array(TeachingActionSchema),
  policyVersion: z.literal("rules-1.0"),
  remainingSeconds: z.number().int(),
  flags: z.object({ aiAllowed: z.boolean() }),
});

export const DecisionResultSchema = z.object({
  decisionId: DecisionIdSchema,
  selectedAction: TeachingActionSchema,
  params: z.object({
    itemInstanceId: ItemInstanceIdSchema.optional(),
    hintRung: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    conceptId: ConceptIdSchema.optional(),
    route: z.string().optional(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    offerBreak: z.boolean().optional(),
    askSimplify: z.boolean().optional(),
  }),
  reasonCodes: z.array(z.string().min(1)),
  provider: z.literal("rules"),
  policyVersion: z.literal("rules-1.0"),
  fallbackUsed: z.boolean(),
  latencyMs: z.number().min(0),
});
