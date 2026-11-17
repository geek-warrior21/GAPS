import {
  LessonActivitySchema,
  type LessonActivity,
  type LessonActivityType,
  type LessonProgressStage,
  type LessonTeachingAction,
  type ObjectiveBeliefStatus,
  type SubjectId,
  type TeachingAssessedResponse,
  type TeachingDecisionInput,
  type TeachingDecisionOutput,
  type TeachingDecisionTraceEntry,
} from "@gaps/contracts";
import type { TeachingDecisionEngine } from "./types";
import { AuthoredTeachingDecisionEngine } from "./authored-engine";
import { TeachingPolicyEngine, TEACHING_POLICY_VERSION, isSupportAction } from "./policy";
import {
  AMBIGUOUS_FEEDBACK,
  ITEM_BANK_VERSION,
  MISCONCEPTION_FEEDBACK,
  countRemainingAssessmentItems,
  getBankItem,
  getBankItems,
  getItemReview,
  gradeBankItem,
  selectAssessmentItem,
} from "./item-bank";
import { validateActivityFactualRules } from "../lesson/planner-validator";
import { isContentServable } from "../runtime-policy";

/**
 * Step-by-step sequencing shared by persisted student sessions and the
 * developer comparison. It holds no I/O: callers supply the objective's belief
 * status (from the belief reducer) and persist the returned state themselves.
 */

export const ADAPTIVE_ENGINE_VERSION = "adaptive-lesson-1.0";

export type StepRole = "teach" | "assessment" | "diagnostic" | "pause" | "advance";

export interface StepDecisionRecord {
  rationale: string;
  assessmentTarget: string;
  eligibleActions: LessonTeachingAction[];
  inferredMisconception: string | null;
  isAmbiguous: boolean;
  objectiveStatus: ObjectiveBeliefStatus;
  lessonStage: LessonProgressStage | null;
  source: "authored" | "llm_suggested" | "fallback";
  fallbackReason: string | null;
  model: string | null;
  unverifiedExplanatoryProse: boolean;
  policyVersion: string;
  engineVersion: string;
  itemBankVersion: string;
}

export interface StepOutcome {
  submittedAnswer: string;
  /** Undefined for teaching steps, which are participation and are not graded. */
  isCorrect?: boolean;
  misconception: string | null;
  isAmbiguous: boolean;
  /** True only for an assessment answer recorded as an attempt. */
  countedAsEvidence: boolean;
  attemptId?: string;
  feedback: string;
}

export interface DeliveredStep {
  seq: number;
  action: LessonTeachingAction;
  role: StepRole;
  /** Full authored snapshot, including answers. Never sent to a student as is. */
  activity: LessonActivity;
  itemId?: string;
  /** Fixed when the step is delivered, so a refresh cannot change it. */
  assistanceLevel: 0 | 1;
  decision: StepDecisionRecord;
  deliveredAt: string;
  response?: unknown;
  outcome?: StepOutcome;
  resolvedAt?: string;
}

export interface AdaptiveLessonState {
  engineVersion: string;
  objectiveId: string;
  subject: SubjectId;
  level: number;
  steps: DeliveredStep[];
  /** Remediation routes begun in the current round. */
  remediationCycles: number;
  /** Incremented each time the learner continues after a pause. */
  round: number;
  /** Items the learner had already attempted before this lesson began. */
  priorItemIds: string[];
  stoppingPointSaved: boolean;
}

export function createAdaptiveLessonState(params: {
  objectiveId: string;
  subject: SubjectId;
  level: number;
  priorItemIds?: readonly string[];
}): AdaptiveLessonState {
  return {
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    objectiveId: params.objectiveId,
    subject: params.subject,
    level: params.level,
    steps: [],
    remediationCycles: 0,
    round: 1,
    priorItemIds: [...(params.priorItemIds ?? [])],
    stoppingPointSaved: false,
  };
}

export function isAdaptiveLessonState(value: unknown): value is AdaptiveLessonState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<AdaptiveLessonState>;
  return (
    typeof v.objectiveId === "string" &&
    typeof v.engineVersion === "string" &&
    Array.isArray(v.steps) &&
    v.steps.length > 0 &&
    v.steps.every(
      (s) =>
        typeof s === "object" &&
        s !== null &&
        typeof s.seq === "number" &&
        typeof s.action === "string" &&
        LessonActivitySchema.safeParse(s.activity).success,
    )
  );
}

export function currentStep(state: AdaptiveLessonState): DeliveredStep | undefined {
  return state.steps[state.steps.length - 1];
}

export function isClosingStep(step: DeliveredStep): boolean {
  return (
    step.role === "advance" ||
    (step.role === "pause" && step.decision.lessonStage === "consolidating")
  );
}

function sessionItemIds(state: AdaptiveLessonState): string[] {
  return state.steps.flatMap((s) => (s.role === "assessment" && s.itemId ? [s.itemId] : []));
}

/**
 * Items not to repeat. Items the learner met in earlier lessons are avoided
 * while unseen ones remain; items already used in this lesson are never reused.
 */
function excludedItemIds(state: AdaptiveLessonState): string[] {
  // Items that may not be served in this environment (unreviewed in
  // production) are excluded outright, whichever engine is asking.
  const unservable = getBankItems(state.objectiveId)
    .filter((i) => !isContentServable(getItemReview(i.itemId)))
    .map((i) => i.itemId);
  const inSession = [...new Set([...sessionItemIds(state), ...unservable])];
  const withPrior = [...new Set([...inSession, ...state.priorItemIds])];
  return selectAssessmentItem(state.objectiveId, withPrior) ? withPrior : inSession;
}

/**
 * A check is assisted when support was delivered after the last assessed
 * question. Teaching that opens the lesson, before any question has been
 * asked, is not help with an item and leaves the first check independent.
 */
function nextCheckAssistanceLevel(state: AdaptiveLessonState): 0 | 1 {
  let sawAssessment = false;
  let supportSinceLastAssessment = false;
  for (let i = state.steps.length - 1; i >= 0; i--) {
    const step = state.steps[i]!;
    if (step.role === "assessment") {
      sawAssessment = true;
      break;
    }
    if (isSupportAction(step.action)) supportSinceLastAssessment = true;
  }
  return sawAssessment && supportSinceLastAssessment ? 1 : 0;
}

export function buildDecisionInput(
  state: AdaptiveLessonState,
  objectiveStatus: ObjectiveBeliefStatus,
): TeachingDecisionInput {
  const responses: TeachingAssessedResponse[] = [];
  for (const step of state.steps) {
    if (!step.outcome) continue;
    if (step.role !== "assessment" && step.role !== "diagnostic") continue;
    responses.push({
      activityId: step.activity.id,
      conceptId: state.objectiveId,
      submittedAnswer: step.outcome.submittedAnswer,
      isCorrect: step.outcome.isCorrect === true,
      assistanceLevel: step.assistanceLevel,
      misconceptionDetected: step.outcome.misconception,
      ambiguousError: step.outcome.isAmbiguous,
      kind: step.role,
      timestamp: step.resolvedAt ?? step.deliveredAt,
    });
  }

  const excluded = excludedItemIds(state);
  const assistanceHistory: Record<string, string> = {};
  for (const step of state.steps) {
    if (step.role === "assessment") {
      assistanceHistory[step.activity.id] = step.assistanceLevel === 0 ? "independent" : "assisted";
    }
  }

  return {
    objectiveId: state.objectiveId,
    prerequisites: [],
    recentAssessedResponses: responses,
    assistanceHistory,
    previouslyDeliveredActivities: state.steps.map((s) => ({
      id: s.activity.id,
      type: s.activity.type,
      title: s.activity.title,
      action: s.action,
      timestamp: s.deliveredAt,
    })),
    availableActivityTypes: [
      "intro",
      "interactive_manipulation",
      "predict_and_observe",
      "guided_practice",
      "independent_check",
      "stopping_point",
    ],
    remediationCycleCount: state.remediationCycles,
    subject: state.subject,
    level: state.level,
    objectiveStatus,
    excludedItemIds: excluded,
    remainingCheckItems: countRemainingAssessmentItems(state.objectiveId, excluded),
  };
}

const ALLOWED_TYPES_BY_ACTION: Readonly<
  Record<LessonTeachingAction, readonly LessonActivityType[]>
> = {
  explain: ["intro"],
  demonstrate: ["intro", "predict_and_observe"],
  revisit_prerequisite: ["intro", "interactive_manipulation"],
  explore: ["interactive_manipulation", "predict_and_observe"],
  guided_practice: ["guided_practice"],
  independent_check: ["independent_check"],
  advance: ["intro"],
  pause: ["stopping_point"],
};

/** Actions whose content must be authored: assessed items and lesson boundaries. */
const AUTHORED_ONLY_ACTIONS: readonly LessonTeachingAction[] = [
  "independent_check",
  "advance",
  "pause",
];

const authoredEngine = new AuthoredTeachingDecisionEngine();

/**
 * Asks the engine for the next step and enforces the server envelope on its
 * answer. Any engine failure or rejected output is replaced by the authored
 * decision for the same objective and state, so a step is always produced.
 */
export async function decideNextStep(
  state: AdaptiveLessonState,
  objectiveStatus: ObjectiveBeliefStatus,
  engine: TeachingDecisionEngine = authoredEngine,
  now: () => Date = () => new Date(),
): Promise<DeliveredStep> {
  const input = buildDecisionInput(state, objectiveStatus);
  const policy = TeachingPolicyEngine.evaluatePolicy(input);

  const authoredFallback = async (reason: string): Promise<TeachingDecisionOutput> => {
    const authored = await authoredEngine.decideNextStep(input);
    return {
      ...authored,
      audit: { source: "fallback", fallbackReason: reason, unverifiedExplanatoryProse: false },
    };
  };

  let output: TeachingDecisionOutput;
  try {
    output = await engine.decideNextStep(input);
  } catch (err) {
    output = await authoredFallback(
      `ENGINE_EXCEPTION: ${err instanceof Error ? err.name : "unknown"}`,
    );
  }

  const rejection = validateEngineOutput(output, policy.eligibleActions);
  if (rejection) {
    output = await authoredFallback(rejection);
  } else if (engine !== authoredEngine && AUTHORED_ONLY_ACTIONS.includes(output.action)) {
    // Another engine may pick these actions but never write their content:
    // assessed questions and lesson boundaries always use authored material.
    const authored = await authoredEngine.decideNextStep(input);
    output =
      authored.action === output.action
        ? {
            ...authored,
            audit: {
              source: output.audit?.source ?? "authored",
              ...(output.audit?.model ? { model: output.audit.model } : {}),
              ...(output.audit?.fallbackReason
                ? { fallbackReason: output.audit.fallbackReason }
                : {}),
              unverifiedExplanatoryProse: false,
            },
          }
        : await authoredFallback("AUTHORED_CONTENT_REQUIRED_FOR_ACTION");
  }

  // Nested remediation branches belong to fixed lessons, not to engine steps.
  const { remediation: _ignored, ...activity } = output.activity;
  void _ignored;

  const action = output.action;
  const bankItem =
    activity.config.type === "independent_check" && activity.config.itemInstanceId
      ? getBankItem(activity.config.itemInstanceId)
      : undefined;

  if (
    action === "independent_check" &&
    (!bankItem || !isContentServable(getItemReview(bankItem.itemId)))
  ) {
    // No improvised or unreviewed question is ever served as a check.
    throw new UnservableContentError(state.objectiveId);
  }

  let role: StepRole = "teach";
  if (action === "advance") role = "advance";
  else if (action === "pause") role = "pause";
  else if (action === "independent_check") {
    role =
      bankItem?.kind === "diagnostic" || policy.evidence.isAmbiguous ? "diagnostic" : "assessment";
  }

  return {
    seq: state.steps.length + 1,
    action,
    role,
    activity,
    ...(bankItem ? { itemId: bankItem.itemId } : {}),
    assistanceLevel: role === "assessment" ? nextCheckAssistanceLevel(state) : 0,
    decision: {
      // Evidence always comes from the server policy, never from the engine.
      rationale: policy.evidence.rationale,
      assessmentTarget: output.assessmentTarget || policy.assessmentTarget,
      eligibleActions: [...policy.eligibleActions],
      inferredMisconception: policy.evidence.inferredMisconception ?? null,
      isAmbiguous: policy.evidence.isAmbiguous,
      objectiveStatus,
      lessonStage: policy.evidence.lessonStage ?? null,
      source: output.audit?.source ?? "authored",
      fallbackReason: output.audit?.fallbackReason ?? null,
      model: output.audit?.model ?? null,
      unverifiedExplanatoryProse: output.audit?.unverifiedExplanatoryProse ?? false,
      policyVersion: TEACHING_POLICY_VERSION,
      engineVersion: ADAPTIVE_ENGINE_VERSION,
      itemBankVersion: ITEM_BANK_VERSION,
    },
    deliveredAt: now().toISOString(),
  };
}

function validateEngineOutput(
  output: TeachingDecisionOutput,
  eligibleActions: readonly LessonTeachingAction[],
): string | null {
  if (!eligibleActions.includes(output.action)) {
    return `ACTION_OUTSIDE_ENVELOPE: ${String(output.action)}`;
  }
  const parsed = LessonActivitySchema.safeParse(output.activity);
  if (!parsed.success) return "ACTIVITY_SCHEMA_INVALID";
  if (parsed.data.type !== parsed.data.config.type) return "ACTIVITY_TYPE_MISMATCH";
  if (!ALLOWED_TYPES_BY_ACTION[output.action].includes(parsed.data.type)) {
    return `ACTIVITY_TYPE_NOT_ALLOWED_FOR_ACTION: ${output.action}/${parsed.data.type}`;
  }
  if (validateActivityFactualRules(parsed.data).length > 0) return "ACTIVITY_FACTUAL_RULES_FAILED";
  return null;
}

/** Applies a decided step: a support step taken to remedy an error begins a cycle. */
export function appendStep(state: AdaptiveLessonState, step: DeliveredStep): AdaptiveLessonState {
  const previous = currentStep(state);
  const answersAnError =
    previous?.outcome?.isCorrect === false &&
    (previous.role === "assessment" || previous.role === "diagnostic");
  return {
    ...state,
    steps: [...state.steps, step],
    remediationCycles:
      answersAnError && isSupportAction(step.action)
        ? state.remediationCycles + 1
        : state.remediationCycles,
  };
}

export class UnservableContentError extends Error {
  constructor(objectiveId: string) {
    super(`No servable authored check is available for ${objectiveId}.`);
    this.name = "UnservableContentError";
  }
}

export class StepResponseError extends Error {
  readonly code = "INVALID_RESPONSE";
}

function extractChoice(response: unknown): string {
  if (typeof response === "string") return response;
  if (typeof response === "object" && response !== null) {
    const r = response as { answer?: unknown; choiceId?: unknown };
    if (typeof r.answer === "string") return r.answer;
    if (typeof r.choiceId === "string") return r.choiceId;
  }
  return "";
}

/**
 * Grades a response to the current step. Pure: recording the attempt and
 * updating beliefs is the caller's job, through the belief reducer.
 */
export function gradeStepResponse(step: DeliveredStep, response: unknown): StepOutcome {
  const config = step.activity.config;

  if (config.type === "independent_check") {
    const submitted = extractChoice(response).trim();
    const choiceIds = (config.choices ?? []).map((c) => c.id);
    if (!submitted || (choiceIds.length > 0 && !choiceIds.includes(submitted))) {
      // Not evidence either way (SPEC §8 rule 3): the same item stays active.
      throw new StepResponseError("Choose one of the answers shown for this question.");
    }

    const item = step.itemId ? getBankItem(step.itemId) : undefined;
    const graded = item
      ? gradeBankItem(item, submitted)
      : {
          isCorrect: submitted.toLowerCase() === config.correctAnswer.trim().toLowerCase(),
          misconception: null,
          isAmbiguous: submitted.toLowerCase() !== config.correctAnswer.trim().toLowerCase(),
        };

    let feedback: string;
    if (graded.isCorrect) {
      feedback = config.explanation;
    } else if (step.role === "diagnostic") {
      feedback = "Not yet. Let's build this idea step by step.";
    } else {
      feedback =
        (graded.misconception && MISCONCEPTION_FEEDBACK[graded.misconception]) ||
        AMBIGUOUS_FEEDBACK;
    }

    return {
      submittedAnswer: submitted,
      isCorrect: graded.isCorrect,
      misconception: graded.misconception,
      isAmbiguous: graded.isAmbiguous,
      countedAsEvidence: step.role === "assessment",
      feedback,
    };
  }

  const teachingFeedback: Record<string, string> = {
    intro: "Let's keep going.",
    interactive_manipulation: "Exploration saved.",
    predict_and_observe: "Prediction saved.",
    guided_practice: "Guided task complete.",
    stopping_point: "Thank you for reflecting.",
  };

  return {
    submittedAnswer:
      typeof response === "object" && response !== null && "value" in response
        ? String((response as { value: unknown }).value).slice(0, 32)
        : extractChoice(response).slice(0, 32),
    misconception: null,
    isAmbiguous: false,
    countedAsEvidence: false,
    feedback: teachingFeedback[config.type] ?? "Saved.",
  };
}

export function resolveCurrentStep(
  state: AdaptiveLessonState,
  response: unknown,
  outcome: StepOutcome,
  now: () => Date = () => new Date(),
): AdaptiveLessonState {
  const steps = [...state.steps];
  const last = steps[steps.length - 1];
  if (!last) return state;
  steps[steps.length - 1] = { ...last, response, outcome, resolvedAt: now().toISOString() };
  return { ...state, steps };
}

/** The learner continues after a pause: a new round with a fresh cycle budget. */
export function beginNewRound(state: AdaptiveLessonState): AdaptiveLessonState {
  return { ...state, remediationCycles: 0, round: state.round + 1, stoppingPointSaved: false };
}

export function toTraceEntry(step: DeliveredStep): TeachingDecisionTraceEntry {
  return {
    stepIndex: step.seq,
    action: step.action,
    activityId: step.activity.id,
    activityTitle: step.activity.title,
    activityType: step.activity.type,
    activity: step.activity,
    rationale: step.decision.rationale,
    assessmentTarget: step.decision.assessmentTarget,
    inferredMisconception: step.decision.inferredMisconception,
    isAmbiguous: step.decision.isAmbiguous,
    eligibleActions: step.decision.eligibleActions,
    source: step.decision.source,
    timestamp: step.deliveredAt,
    objectiveStatus: step.decision.objectiveStatus,
    ...(step.decision.lessonStage ? { lessonStage: step.decision.lessonStage } : {}),
    ...(step.role === "assessment" ? { assistanceLevel: step.assistanceLevel } : {}),
    ...(step.outcome
      ? {
          learnerResponse: {
            submittedAnswer: step.outcome.submittedAnswer,
            ...(step.outcome.isCorrect === undefined ? {} : { isCorrect: step.outcome.isCorrect }),
            countedAsEvidence: step.outcome.countedAsEvidence,
          },
        }
      : {}),
  };
}
