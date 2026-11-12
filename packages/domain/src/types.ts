export const POLICY_VERSION = "rules-1.0" as const;
export const VERIFIER_VERSION = "verify-1.0" as const;

export const CONCEPT_IDS = [
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
] as const;

export type ConceptId = (typeof CONCEPT_IDS)[number];

export type ChapterId = "A" | "B" | "C";

export interface ConceptNode {
  readonly id: ConceptId;
  readonly studentTitle: string;
  readonly chapter: ChapterId;
  readonly topoOrder: number;
  readonly prerequisites: readonly ConceptId[];
}

export const MISCONCEPTION_IDS = [
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
] as const;

export type MisconceptionId = (typeof MISCONCEPTION_IDS)[number];

export const TEACHING_ACTIONS = [
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
] as const;

export type TeachingAction = (typeof TEACHING_ACTIONS)[number];

export type BeliefStatus =
  "not_assessed" | "needs_support" | "developing" | "demonstrated" | "retained";

export type Reliability = "missing" | "stale" | "conflicting" | "supported";

export type AttemptMode = "learn" | "review" | "quest" | "boss" | "quick_check" | "solve_followup";

export type AttemptOutcome = "correct" | "incorrect" | "unparseable" | "not_simplified";

export interface Rational {
  readonly n: bigint;
  readonly d: bigint;
}

export type RichTextSegment =
  | { readonly t: "text"; readonly v: string }
  | { readonly t: "frac"; readonly n: number | bigint; readonly d: number | bigint }
  | {
      readonly t: "mixed";
      readonly w: number | bigint;
      readonly n: number | bigint;
      readonly d: number | bigint;
    }
  | { readonly t: "blank" }
  | { readonly t: "math"; readonly v: string };

export type RichText = readonly RichTextSegment[];

export type VisualSpec =
  | {
      readonly type: "fraction_bar";
      readonly bars: readonly {
        readonly parts: number;
        readonly shaded: number;
        readonly label?: string;
        readonly highlightUnknown?: boolean;
      }[];
    }
  | {
      readonly type: "number_line";
      readonly min: number;
      readonly max: number;
      readonly divisions: number;
      readonly markers?: readonly { readonly value: Rational; readonly label?: string }[];
      readonly jumps?: readonly {
        readonly from: Rational;
        readonly to: Rational;
        readonly label?: string;
      }[];
    }
  | {
      readonly type: "area_model";
      readonly rows: number;
      readonly cols: number;
      readonly shadedRows: number;
      readonly shadedCols: number;
    };

export type RationalAcceptKind = "integer" | "fraction" | "mixed" | "decimal";
export type RationalForm = "any" | "simplest" | "mixed" | "improper";
export type ComparisonSymbol = "<" | ">" | "=";

export type AnswerSpec =
  | {
      readonly kind: "rational";
      readonly value: Rational;
      readonly form: RationalForm;
      readonly accept?: readonly RationalAcceptKind[];
    }
  | { readonly kind: "integer"; readonly value: bigint }
  | { readonly kind: "decimal"; readonly value: Rational }
  | { readonly kind: "comparison"; readonly value: ComparisonSymbol }
  | {
      readonly kind: "choice";
      readonly value: string;
      readonly options: readonly { readonly id: string; readonly label: RichText }[];
    }
  | { readonly kind: "order"; readonly value: readonly Rational[] };

export type ParsedKind =
  "integer" | "fraction" | "mixed" | "decimal" | "comparison" | "choice" | "order";

export interface Parsed {
  readonly kind: ParsedKind;
  readonly value: Rational | readonly Rational[] | string;
  readonly lowestTerms: boolean;
}

export type AssistanceLevel = 0 | 1 | 2 | 3;

export interface CheckedAttempt {
  readonly attemptId: string;
  readonly studentId: string;
  readonly sessionId: string;
  readonly clientAttemptId: string;
  readonly itemInstanceId: string;
  readonly templateId: string;
  readonly conceptId: ConceptId;
  readonly mode: AttemptMode;
  readonly outcome: AttemptOutcome;
  readonly misconceptionId?: MisconceptionId;
  readonly assistance: AssistanceLevel;
  readonly tryNo: 1 | 2;
  readonly isReview: boolean;
  readonly verifierVersion: typeof VERIFIER_VERSION;
  readonly at: string;
}

export interface Belief {
  readonly conceptId: ConceptId;
  readonly status: BeliefStatus;
  readonly estimate: number | null;
  readonly reliability: Reliability;
  readonly demonstratedAt: string | null;
  readonly retainedAt: string | null;
  readonly firstNeedsSupportAt: string | null;
  readonly activeMisconceptionIds: readonly MisconceptionId[];
  readonly policyVersion: typeof POLICY_VERSION;
  readonly version: number;
}

export interface DecisionContext {
  readonly schemaVersion: 1;
  readonly decisionId: string;
  readonly studentRef: string;
  readonly stateVersion: number;
  readonly focusConceptId: ConceptId;
  readonly belief: Belief;
  readonly prerequisiteBeliefs: readonly Belief[];
  readonly lastAttempt?: Pick<
    CheckedAttempt,
    "outcome" | "misconceptionId" | "assistance" | "tryNo"
  >;
  readonly request?: {
    readonly kind: "hint" | "explain" | "worked_example";
    readonly route?: string;
  };
  readonly session: {
    readonly mode: AttemptMode;
    readonly incorrectOnConcept: number;
    readonly prereqRouteTaken: boolean;
    readonly hintRungShown: 0 | 1 | 2 | 3;
    readonly consecutiveIndependentCorrect: number;
    readonly currentItemServed?: boolean;
    readonly currentItemResolved?: boolean;
    readonly difficulty?: 1 | 2 | 3;
  };
  readonly reviewDue: boolean;
  readonly allowedActions: readonly TeachingAction[];
  readonly policyVersion: typeof POLICY_VERSION;
  readonly remainingSeconds: number;
  readonly flags: { readonly aiAllowed: boolean };
}

export interface DecisionResult {
  readonly decisionId: string;
  readonly selectedAction: TeachingAction;
  readonly params: {
    readonly itemInstanceId?: string;
    readonly hintRung?: 1 | 2 | 3;
    readonly conceptId?: ConceptId;
    readonly route?: string;
    readonly difficulty?: 1 | 2 | 3;
    readonly offerBreak?: boolean;
    readonly askSimplify?: boolean;
  };
  readonly reasonCodes: readonly string[];
  readonly provider: "rules";
  readonly policyVersion: typeof POLICY_VERSION;
  readonly fallbackUsed: boolean;
  readonly latencyMs: number;
}
