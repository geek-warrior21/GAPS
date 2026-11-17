import { type DbClient, createStudentRepo, users } from "@gaps/db";
import type { LessonRespondResponse, OpenLessonRequest, OpenLessonResponse } from "@gaps/contracts";
import { getLlmProvider, readAiEnv } from "@gaps/ai";
import { createModelCaller } from "../ai/gateway";
import { OpenTopicEngine } from "./engine";
import { type OpenStep, type OpenTopicState, currentOpenStep, isOpenTopicState } from "./machine";
import {
  OPEN_LESSON_PREFIX,
  type OpenTopicDeps,
  createOpenLesson,
  respondToOpenLesson,
  startOrResumeOpenLesson,
} from "./session";
import { type SyntheticProfile, syntheticAnswer } from "./simulate";

/**
 * Open-topic lessons in the protected developer preview.
 *
 * A staff admin runs lessons as a SYNTHETIC learner: a placeholder account that
 * belongs to no child and has no class, consent record or personal data. The
 * lessons use the same persisted session lifecycle as student lessons, so
 * stored activities, refresh and retry behave identically.
 *
 * Because no real student is involved, the per-student consent checks do not
 * apply here; they continue to guard every student-facing path. A provider must
 * still be configured, and callers must pass the developer-tools gate first.
 */

export const SYNTHETIC_LEARNER_ID = "stu_synthetic_preview_learner";

export async function ensureSyntheticLearner(db: DbClient, orgId: string | null): Promise<string> {
  await db
    .insert(users)
    .values({
      id: SYNTHETIC_LEARNER_ID,
      role: "student",
      orgId,
      cohortId: null,
      displayName: "Synthetic learner",
      username: null,
      pinHash: null,
      // Cannot sign in: there is no credential and the account is locked.
      status: "locked",
      avatar: { color: "grey", icon: "robot" },
      settings: { synthetic: true },
    })
    .onConflictDoNothing();
  return SYNTHETIC_LEARNER_ID;
}

export interface ProviderReadiness {
  ready: boolean;
  provider: string;
  model: string;
  /** What is missing, in terms an operator can act on. */
  missing: string[];
  /** True when the provider is a stand-in that proves wiring only. */
  isMock: boolean;
}

export function getProviderReadiness(
  env: Record<string, string | undefined> = process.env,
): ProviderReadiness {
  const cfg = readAiEnv(env);
  const missing: string[] = [];
  if (cfg.provider === "disabled") missing.push("LLM_PROVIDER=openai (it is currently disabled)");
  if (cfg.provider === "openai" && !cfg.apiKeyConfigured) missing.push("OPENAI_API_KEY");
  return {
    ready: missing.length === 0,
    provider: cfg.provider,
    model: cfg.provider === "openai" ? env.LLM_MODEL_TUTOR?.trim() || "gpt-4o-mini" : cfg.provider,
    missing,
    isMock: cfg.provider === "mock",
  };
}

/** Engine for synthetic-learner runs. Calls are logged, with no student to account to. */
function previewDeps(db: DbClient): OpenTopicDeps {
  return {
    resolveEngine: async () => {
      if (!getProviderReadiness().ready) return { denied: "runtime_disabled" };
      const caller = createModelCaller({ db, provider: getLlmProvider() });
      // Real models need longer than the tutor's short timeout to write a step.
      return { engine: new OpenTopicEngine(caller, Math.max(readAiEnv().timeoutMs, 30000)) };
    },
  };
}

export async function createPreviewLesson(
  request: OpenLessonRequest,
  db: DbClient,
  orgId: string | null,
): Promise<OpenLessonResponse> {
  const readiness = getProviderReadiness();
  if (!readiness.ready) {
    return {
      status: "unavailable",
      reason: "ai_not_enabled",
      message: `No model provider is configured. Set ${readiness.missing.join(" and ")} in .env and restart the server.`,
      retryable: false,
    };
  }
  const learnerId = await ensureSyntheticLearner(db, orgId);
  return createOpenLesson(learnerId, request, db, previewDeps(db));
}

export function resumePreviewLesson(lessonId: string, db: DbClient) {
  return startOrResumeOpenLesson(SYNTHETIC_LEARNER_ID, lessonId, db, previewDeps(db));
}

export function respondToPreviewLesson(
  lessonId: string,
  activityId: string,
  response: unknown,
  db: DbClient,
): Promise<LessonRespondResponse> {
  return respondToOpenLesson(
    SYNTHETIC_LEARNER_ID,
    lessonId,
    activityId,
    response,
    db,
    previewDeps(db),
  );
}

async function loadPreviewState(lessonId: string, db: DbClient): Promise<OpenTopicState | null> {
  const session = await createStudentRepo(SYNTHETIC_LEARNER_ID, db).getSession(
    lessonId.slice(OPEN_LESSON_PREFIX.length),
  );
  const state = (session?.counters as Record<string, unknown> | null)?.openTopicState;
  return isOpenTopicState(state) ? state : null;
}

export interface PreviewTraceStep {
  seq: number;
  action: string;
  role: string;
  origin: "generated" | "server";
  activityType: string;
  title: string;
  /** Question text and answer key. Developer view only. */
  question: string | null;
  answerKey: string | null;
  answerVerification: string | null;
  assistance: "independent" | "assisted" | null;
  eligibleActions: string[];
  lessonStage: string | null;
  /** The model's own words. Unverified. */
  modelRationale: string | null;
  idealInteraction: string | null;
  learnerAnswer: string | null;
  isCorrect: boolean | null;
}

export interface PreviewTrace {
  lessonId: string;
  title: string;
  level: number;
  learningGoal: string;
  contentStatus: OpenTopicState["contentStatus"];
  generator: OpenTopicState["generator"];
  /** Proposed by the model. Not verified curriculum relationships or learner evidence. */
  modelProposed: OpenTopicState["modelProposed"];
  awaitingNextStep: boolean;
  steps: PreviewTraceStep[];
}

function traceStep(step: OpenStep): PreviewTraceStep {
  const config = step.activity.config;
  const isCheck = config.type === "independent_check";
  return {
    seq: step.seq,
    action: step.action,
    role: step.role,
    origin: step.decision.origin,
    activityType: step.activity.type,
    title: step.activity.title,
    question: isCheck ? config.prompt : null,
    answerKey: isCheck ? config.correctAnswer : null,
    answerVerification: step.verification ?? null,
    assistance:
      step.role === "assessment" ? (step.assistanceLevel === 0 ? "independent" : "assisted") : null,
    eligibleActions: step.decision.eligibleActions,
    lessonStage: step.decision.lessonStage,
    modelRationale: step.decision.origin === "generated" ? step.decision.rationale : null,
    idealInteraction: step.decision.idealInteraction,
    learnerAnswer: step.outcome?.submittedAnswer ?? null,
    isCorrect: step.outcome?.isCorrect ?? null,
  };
}

export async function getPreviewTrace(
  lessonId: string,
  db: DbClient,
): Promise<PreviewTrace | null> {
  const state = await loadPreviewState(lessonId, db);
  if (!state) return null;
  return {
    lessonId,
    title: state.title,
    level: state.level,
    learningGoal: state.learningGoal,
    contentStatus: state.contentStatus,
    generator: state.generator,
    modelProposed: state.modelProposed,
    awaitingNextStep: state.awaitingNextStep,
    steps: state.steps.map(traceStep),
  };
}

const MAX_AUTOPLAY_STEPS = 20;

/**
 * Plays a scripted synthetic learner through the stored lesson, one persisted
 * response at a time, until it closes, pauses or waits for the provider.
 */
export async function autoplayPreviewLesson(
  lessonId: string,
  profile: SyntheticProfile,
  db: DbClient,
): Promise<{
  stoppedBecause: "completed" | "paused" | "waiting" | "step_limit";
  trace: PreviewTrace;
}> {
  let stoppedBecause: "completed" | "paused" | "waiting" | "step_limit" = "step_limit";
  await resumePreviewLesson(lessonId, db);

  for (let i = 0; i < MAX_AUTOPLAY_STEPS; i++) {
    const state = await loadPreviewState(lessonId, db);
    const step = state ? currentOpenStep(state) : undefined;
    if (!state || !step) break;
    if (state.awaitingNextStep) {
      stoppedBecause = "waiting";
      break;
    }
    if (step.resolvedAt) {
      stoppedBecause = "completed";
      break;
    }
    if (step.role === "pause") {
      stoppedBecause = "paused";
      break;
    }
    const misses = state.steps.filter((s) => s.outcome?.isCorrect === false).length;
    const result = await respondToPreviewLesson(
      lessonId,
      step.activity.id,
      syntheticAnswer(step, profile, misses),
      db,
    );
    if (result.isCompleted) {
      stoppedBecause = "completed";
      break;
    }
  }

  const trace = await getPreviewTrace(lessonId, db);
  if (!trace) throw new Error("Preview lesson not found");
  return { stoppedBecause, trace };
}
