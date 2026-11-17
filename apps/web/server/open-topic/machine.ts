import type {
  LessonActivity,
  LessonContentStatus,
  LessonProgressStage,
  LessonTeachingAction,
  SubjectId,
  TeachingAssessedResponse,
  TeachingDecisionInput,
} from "@gaps/contracts";
import { LessonActivitySchema } from "@gaps/contracts";
import { TeachingPolicyEngine, isSupportAction } from "../teaching/policy";
import { numericAnswersEqual, parseNumericAnswer } from "./arithmetic";
import { type AcceptedStep, type AnswerVerification, GENERATABLE_ACTIONS } from "./validation";

/**
 * Pure state machine for an open-topic lesson. It has no I/O and no model
 * access: the caller supplies generated steps that already passed validation.
 *
 * Everything here is provisional practice. An open-topic lesson has no concept
 * in the curriculum graph, records no attempts and never reaches the belief
 * reducer, so it cannot establish mastery whatever the model says.
 */

export const OPEN_TOPIC_VERSION = "open-topic-1.0";
export const OPEN_TOPIC_POLICY_VERSION = "open-topic-rules-1.0";

/** Unassisted correct answers in a row that close a practice round. */
export const PRACTICE_ROUND_STREAK = 3;
/** Hard cap on steps (and so on model calls) in one lesson. */
export const MAX_OPEN_TOPIC_STEPS = 14;

export type OpenStepRole = "teach" | "assessment" | "diagnostic" | "pause" | "closing";

export interface OpenStepDecision {
  /** The model's stated reason. Unverified prose, kept for the developer trace. */
  rationale: string;
  eligibleActions: LessonTeachingAction[];
  lessonStage: LessonProgressStage | null;
  /** Suspected by the model for each choice. Not verified misconception evidence. */
  suspectedMisconceptions: Record<string, string>;
  idealInteraction: string | null;
  usedSourceIds: string[];
  origin: "generated" | "server";
  policyVersion: string;
}

export interface OpenStepOutcome {
  submittedAnswer: string;
  isCorrect?: boolean;
  /** The model's suspicion for the chosen distractor, if it gave one. */
  suspectedMisconception: string | null;
  /** Always false: open-topic responses are practice, never belief evidence. */
  countedAsEvidence: false;
  feedback: string;
}

export interface OpenStep {
  seq: number;
  action: LessonTeachingAction;
  role: OpenStepRole;
  activity: LessonActivity;
  assistanceLevel: 0 | 1;
  verification?: AnswerVerification;
  decision: OpenStepDecision;
  deliveredAt: string;
  response?: unknown;
  outcome?: OpenStepOutcome;
  resolvedAt?: string;
}

export interface OpenTopicState {
  version: string;
  /** The learner's request, with contact details removed. */
  topicText: string;
  level: number;
  title: string;
  subject: SubjectId;
  learningGoal: string;
  slug: string;
  /** Proposed by the model. Not verified curriculum relationships. */
  modelProposed: { prerequisites: string[]; misconceptions: string[] };
  contentStatus: LessonContentStatus;
  generator: { provider: string; model: string };
  steps: OpenStep[];
  /** Accepted opening steps not yet delivered. */
  queue: AcceptedStep[];
  remediationCycles: number;
  round: number;
  stoppingPointSaved: boolean;
  /** The last response is saved but the next step could not be prepared. */
  awaitingNextStep: boolean;
}

export function isOpenTopicState(value: unknown): value is OpenTopicState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<OpenTopicState>;
  return (
    typeof v.version === "string" &&
    typeof v.topicText === "string" &&
    typeof v.title === "string" &&
    Array.isArray(v.steps) &&
    Array.isArray(v.queue) &&
    v.steps.every(
      (s) =>
        typeof s === "object" && s !== null && LessonActivitySchema.safeParse(s.activity).success,
    )
  );
}

export function currentOpenStep(state: OpenTopicState): OpenStep | undefined {
  return state.steps[state.steps.length - 1];
}

export function isOpenClosingStep(step: OpenStep): boolean {
  return step.role === "closing";
}

function practiceStreak(state: OpenTopicState): number {
  let streak = 0;
  for (let i = state.steps.length - 1; i >= 0; i--) {
    const step = state.steps[i]!;
    if (step.role !== "assessment" || !step.outcome) continue;
    if (step.outcome.isCorrect && step.assistanceLevel === 0) streak += 1;
    else break;
  }
  return streak;
}

function nextCheckAssistanceLevel(state: OpenTopicState): 0 | 1 {
  let sawAssessment = false;
  let support = false;
  for (let i = state.steps.length - 1; i >= 0; i--) {
    const step = state.steps[i]!;
    if (step.role === "assessment") {
      sawAssessment = true;
      break;
    }
    if (isSupportAction(step.action)) support = true;
  }
  return sawAssessment && support ? 1 : 0;
}

export function buildOpenPolicyInput(state: OpenTopicState): TeachingDecisionInput {
  const responses: TeachingAssessedResponse[] = [];
  for (const step of state.steps) {
    if (!step.outcome || (step.role !== "assessment" && step.role !== "diagnostic")) continue;
    responses.push({
      activityId: step.activity.id,
      conceptId: `open:${state.slug}`,
      submittedAnswer: step.outcome.submittedAnswer,
      isCorrect: step.outcome.isCorrect === true,
      assistanceLevel: step.assistanceLevel,
      // No verified misconception mapping exists for generated questions, so an
      // error is never treated as a definite misconception.
      misconceptionDetected: null,
      ambiguousError: step.outcome.isCorrect !== true,
      kind: step.role,
      timestamp: step.resolvedAt ?? step.deliveredAt,
    });
  }
  return {
    objectiveId: `open:${state.slug}`,
    prerequisites: [],
    recentAssessedResponses: responses,
    assistanceHistory: {},
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
    // Deliberately absent: with no belief status the shared policy can never
    // make "advance" eligible for an open topic.
  };
}

export type OpenPolicyDecision =
  | { kind: "pause"; stage: LessonProgressStage; rationale: string }
  | { kind: "close"; rationale: string }
  | {
      kind: "generate";
      eligibleActions: LessonTeachingAction[];
      recommendedAction: LessonTeachingAction;
      /** True when the next question is a probe to tell a slip from a gap. */
      isDiagnostic: boolean;
      stage: LessonProgressStage | null;
      policyRationale: string;
    };

/** The shared teaching policy, bounded for a practice-only generated lesson. */
export function evaluateOpenPolicy(state: OpenTopicState): OpenPolicyDecision {
  if (practiceStreak(state) >= PRACTICE_ROUND_STREAK) {
    return {
      kind: "close",
      rationale: `${PRACTICE_ROUND_STREAK} unassisted practice answers in a row were correct. The practice round closes. This is provisional practice feedback and is not recorded as mastery.`,
    };
  }
  if (state.steps.length >= MAX_OPEN_TOPIC_STEPS) {
    return { kind: "close", rationale: `Step limit of ${MAX_OPEN_TOPIC_STEPS} reached.` };
  }

  const policy = TeachingPolicyEngine.evaluatePolicy(buildOpenPolicyInput(state));
  if (policy.recommendedAction === "pause") {
    return {
      kind: "pause",
      stage: policy.evidence.lessonStage ?? "paused",
      rationale: policy.evidence.rationale,
    };
  }

  const generatable: readonly LessonTeachingAction[] = GENERATABLE_ACTIONS;
  const eligibleActions = policy.eligibleActions.filter((a) => generatable.includes(a));
  if (eligibleActions.length === 0) {
    return { kind: "close", rationale: "No generatable action is eligible." };
  }
  return {
    kind: "generate",
    eligibleActions,
    recommendedAction: eligibleActions.includes(policy.recommendedAction)
      ? policy.recommendedAction
      : eligibleActions[0]!,
    isDiagnostic:
      policy.evidence.isAmbiguous === true && policy.recommendedAction === "independent_check",
    stage: policy.evidence.lessonStage ?? null,
    policyRationale: policy.evidence.rationale,
  };
}

function withId(activity: LessonActivity, seq: number): LessonActivity {
  return { ...activity, id: `act_o${seq}_${activity.type}` };
}

/** Appends a validated generated step, fixing its role and assistance level now. */
export function appendGeneratedStep(
  state: OpenTopicState,
  accepted: AcceptedStep,
  decision: Extract<OpenPolicyDecision, { kind: "generate" }>,
  now: Date = new Date(),
): OpenTopicState {
  const seq = state.steps.length + 1;
  const isCheck = accepted.action === "independent_check";
  const role: OpenStepRole = isCheck
    ? decision.isDiagnostic
      ? "diagnostic"
      : "assessment"
    : "teach";
  const previous = currentOpenStep(state);
  const answersAnError =
    previous?.outcome?.isCorrect === false &&
    (previous.role === "assessment" || previous.role === "diagnostic");

  const step: OpenStep = {
    seq,
    action: accepted.action,
    role,
    activity: withId(accepted.activity, seq),
    assistanceLevel: role === "assessment" ? nextCheckAssistanceLevel(state) : 0,
    ...(accepted.verification ? { verification: accepted.verification } : {}),
    decision: {
      rationale: accepted.rationale,
      eligibleActions: [...decision.eligibleActions],
      lessonStage: decision.stage,
      suspectedMisconceptions: { ...accepted.suspectedMisconceptions },
      idealInteraction: accepted.idealInteraction,
      usedSourceIds: [...accepted.usedSourceIds],
      origin: "generated",
      policyVersion: OPEN_TOPIC_POLICY_VERSION,
    },
    deliveredAt: now.toISOString(),
  };
  return {
    ...state,
    steps: [...state.steps, step],
    awaitingNextStep: false,
    remediationCycles:
      answersAnError && isSupportAction(accepted.action)
        ? state.remediationCycles + 1
        : state.remediationCycles,
  };
}

/** Pause and closing steps are written by the server and are the same for every topic. */
export function appendServerStep(
  state: OpenTopicState,
  kind: "pause" | "closing",
  rationale: string,
  now: Date = new Date(),
): OpenTopicState {
  const seq = state.steps.length + 1;
  const activity: LessonActivity =
    kind === "pause"
      ? {
          id: `act_o${seq}_stopping_point`,
          type: "stopping_point",
          title: "Let's pause here",
          instructions: "Take a short break. Your progress is saved.",
          config: {
            type: "stopping_point",
            headline: "Let's Pause for Now",
            body: `Some ideas in "${state.title}" are still settling, and that is fine. A short break often helps. You can come back and carry on from here.`,
            recommendation:
              "Save and finish for now, or continue with a fresh explanation when you are ready.",
          },
        }
      : {
          id: `act_o${seq}_stopping_point`,
          type: "stopping_point",
          title: "Practice round complete",
          instructions: "You have finished this practice round.",
          config: {
            type: "stopping_point",
            headline: "Practice Round Complete",
            body: `You practised "${state.title}". This lesson was a generated preview, so it is practice only: it does not change your GapMap or count as mastery.`,
            recommendation: "Come back to this topic any time for another practice round.",
          },
        };
  const step: OpenStep = {
    seq,
    action: "pause",
    role: kind,
    activity,
    assistanceLevel: 0,
    decision: {
      rationale,
      eligibleActions: ["pause"],
      lessonStage: kind === "pause" ? "paused" : "consolidating",
      suspectedMisconceptions: {},
      idealInteraction: null,
      usedSourceIds: [],
      origin: "server",
      policyVersion: OPEN_TOPIC_POLICY_VERSION,
    },
    deliveredAt: now.toISOString(),
  };
  return { ...state, steps: [...state.steps, step], awaitingNextStep: false };
}

export class OpenResponseError extends Error {}

function extractAnswer(response: unknown): string {
  if (typeof response === "string") return response;
  if (typeof response === "object" && response !== null) {
    const r = response as { answer?: unknown; choiceId?: unknown; value?: unknown };
    if (typeof r.answer === "string") return r.answer;
    if (typeof r.choiceId === "string") return r.choiceId;
    if (typeof r.value === "string") return r.value;
  }
  return "";
}

/**
 * Grades a response on the server. Choice answers are compared with the key;
 * numeric answers are compared as exact rationals. The feedback is provisional:
 * the key is the model's own unless `verification` says the server recomputed it.
 */
export function gradeOpenStep(step: OpenStep, response: unknown): OpenStepOutcome {
  const config = step.activity.config;
  if (config.type !== "independent_check") {
    return {
      // Teaching steps store a short structural value only, never free text.
      submittedAnswer: extractAnswer(response)
        .replace(/[^\w/.\- ]/g, "")
        .slice(0, 32),
      suspectedMisconception: null,
      countedAsEvidence: false,
      feedback: "Saved.",
    };
  }

  const submitted = extractAnswer(response).trim();
  let isCorrect: boolean;
  if (config.questionType === "choice") {
    const ids = (config.choices ?? []).map((c) => c.id);
    if (!ids.includes(submitted)) {
      throw new OpenResponseError("Choose one of the answers shown for this question.");
    }
    isCorrect = submitted === config.correctAnswer;
  } else {
    if (!parseNumericAnswer(submitted)) {
      throw new OpenResponseError("Type your answer as a number, like -3, 2.5 or 3/4.");
    }
    isCorrect = numericAnswersEqual(submitted, config.correctAnswer);
  }

  return {
    submittedAnswer: submitted.slice(0, 32),
    isCorrect,
    suspectedMisconception: isCorrect
      ? null
      : (step.decision.suspectedMisconceptions[submitted] ?? null),
    countedAsEvidence: false,
    feedback: isCorrect
      ? config.explanation
      : "Not yet. Let's look at this idea again from another angle.",
  };
}

export function resolveOpenStep(
  state: OpenTopicState,
  response: unknown,
  outcome: OpenStepOutcome,
  now: Date = new Date(),
): OpenTopicState {
  const steps = [...state.steps];
  const last = steps[steps.length - 1];
  if (!last) return state;
  steps[steps.length - 1] = { ...last, response, outcome, resolvedAt: now.toISOString() };
  const continuedAfterPause = last.role === "pause";
  return {
    ...state,
    steps,
    ...(continuedAfterPause
      ? { remediationCycles: 0, round: state.round + 1, stoppingPointSaved: false }
      : {}),
  };
}

/**
 * The opening queue is used only while the lesson is going to plan: the queued
 * action must still be eligible and the last answer must not have been missed.
 * Otherwise the queue is dropped and the next step is chosen from the response.
 */
export function takeQueuedStep(
  state: OpenTopicState,
  decision: Extract<OpenPolicyDecision, { kind: "generate" }>,
): { state: OpenTopicState; accepted: AcceptedStep } | null {
  const next = state.queue[0];
  const last = currentOpenStep(state);
  const lastMissed = last?.outcome?.isCorrect === false;
  if (
    !next ||
    lastMissed ||
    decision.isDiagnostic ||
    !decision.eligibleActions.includes(next.action)
  ) {
    return null;
  }
  return { state: { ...state, queue: state.queue.slice(1) }, accepted: next };
}
