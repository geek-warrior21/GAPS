export const DOMAIN_PHASE = 1 as const;

export {
  CONCEPT_IDS,
  MISCONCEPTION_IDS,
  POLICY_VERSION,
  TEACHING_ACTIONS,
  VERIFIER_VERSION,
  type AnswerSpec,
  type AssistanceLevel,
  type AttemptMode,
  type AttemptOutcome,
  type Belief,
  type BeliefStatus,
  type ChapterId,
  type CheckedAttempt,
  type ComparisonSymbol,
  type ConceptId,
  type ConceptNode,
  type DecisionContext,
  type DecisionResult,
  type MisconceptionId,
  type Parsed,
  type ParsedKind,
  type Rational,
  type RationalAcceptKind,
  type RationalForm,
  type Reliability,
  type RichText,
  type RichTextSegment,
  type TeachingAction,
  type VisualSpec,
} from "./types";

export { createRng, hashStringToSeed, type Rng } from "./rng";
export {
  ID_PREFIXES,
  isValidPrefixedId,
  makeId,
  makeUlid,
  type IdEntity,
  type IdPrefix,
} from "./ids";
export {
  abs,
  add,
  cmp,
  div,
  eq,
  format,
  fromDecimalString,
  gcd,
  isInteger,
  lcm,
  mul,
  neg,
  rational,
  sub,
  toMixed,
} from "./rational";
export { normalizeInput, parseAnswer, type ParseOptions } from "./parse";
export {
  MISCONCEPTION_CATALOG,
  getMisconceptionMeta,
  matchMisconception,
  type MisconceptionMap,
  type MisconceptionMeta,
  type MisconceptionValue,
} from "./misconceptions";
export { verify, type VerifyResult } from "./verify";
export {
  beliefReducer,
  computeEffectiveReliability,
  createInitialBeliefState,
  replayBeliefs,
  replayTransitions,
  toPublicBelief,
  type BeliefReducerContext,
  type BeliefState,
  type DemonstrationTransition,
  type RetentionTransition,
  type ReviewEffect,
  type TransitionHistory,
} from "./belief";
export {
  GRADE_ENTRY,
  STRAND_CONCEPTS,
  focusConcept,
  getChapterConcepts,
  getConceptNode,
  type Grade,
} from "./policy/l1";
export {
  QUICK_CHECK_DIFFICULTY,
  QUICK_CHECK_MAX_ITEMS,
  createQuickCheck,
  runQuickCheck,
  stepQuickCheck,
  type QuickCheckState,
} from "./quickcheck";
export {
  BOSS_BATTLE_DIFFICULTY,
  BOSS_BATTLE_ITEM_COUNT,
  BOSS_BATTLE_PASS_SCORE,
  LEARN_SESSION_BUDGET_SECONDS,
  canStartBossToday,
  canUnlockChapterBoss,
  composeBossBattle,
  composeDailyQuest,
  drawFreshSeed,
  evaluateBossBattle,
  planLearnSessionOpen,
  selectTemplate,
  targetDifficulty,
  type BossBattlePlan,
  type BossItemSlot,
  type DailyQuestPlan,
  type DueReviewItem,
  type LearnSessionOpenPlan,
  type QuestSlot,
  type TemplateCandidate,
} from "./policy/l2";
export {
  decideNextAction,
  findWeakPrerequisite,
  guardDecision,
  isEligibleWeakPrerequisite,
  isValidPrerequisiteRoute,
  isValidRetrievalReview,
} from "./policy/l3";
export {
  DAILY_SPARKS_CAP,
  SPARK_AMOUNTS,
  SPARK_MILESTONES,
  computeSparksAward,
  computeWeeklyRhythm,
  getNewlyUnlockedMilestones,
  istWeekDates,
  sparkIdempotencyKey,
  toIstDateString,
  type SparkAwardInput,
  type SparkAwardResult,
  type SparkKind,
  type WeeklyRhythm,
} from "./sparks";
export {
  DEFAULT_DIAGNOSTIC_MAX_ITEMS,
  createDiagnostic,
  projectDiagnosticBeliefs,
  stepDiagnostic,
  type CreateDiagnosticOptions,
  type DiagnosticItemResult,
  type DiagnosticState,
} from "./diagnostic";
export {
  detectHeuristicMisconceptions,
  detectMisconception,
  reconcileActiveMisconceptions,
  type AttemptMisconceptionEvidence,
  type MisconceptionConfidence,
  type MisconceptionDetectionResult,
} from "./misconception-tracker";
export {
  getRemediationRouteForMisconception,
  selectAdaptiveActivity,
  type AdaptiveDecision,
  type AdaptiveSelectionInput,
} from "./policy/adaptive-selector";
export { buildComebackCard, type ComebackCardData } from "./comeback";
