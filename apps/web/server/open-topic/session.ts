import { type DbClient, createStudentRepo, learningSessions, and, eq } from "@gaps/db";
import type {
  AdaptiveLessonProgress,
  LessonContentStatus,
  LessonRespondResponse,
  LessonSessionResponse,
  OpenLessonRequest,
  OpenLessonResponse,
} from "@gaps/contracts";
import { readAiEnv } from "@gaps/ai";
import { type AiDenialReason, checkStudentAiPermission, createModelCaller } from "../ai/gateway";
import { redactActivityForStudent } from "../lesson/redact";
import { LessonServiceError, isLessonAvailable } from "../lesson/service";
import { areDraftsServable, isReviewed } from "../runtime-policy";
import { generateDomainId } from "../session/engine";
import { getAdaptiveLesson } from "../teaching/adaptive-lessons";
import { log } from "../log";
import { advanceOpenLesson, initialOpenState } from "./advance";
import { type GenerationFailure, OpenTopicEngine } from "./engine";
import {
  type OpenStep,
  type OpenTopicState,
  OpenResponseError,
  buildOpenPolicyInput,
  currentOpenStep,
  gradeOpenStep,
  isOpenClosingStep,
  isOpenTopicState,
  resolveOpenStep,
} from "./machine";
import { allowedSimulations, findAuthoredLesson, findSources, sanitizeTopic } from "./topics";

/**
 * Open-topic lessons as persisted student sessions.
 *
 * A learner names a topic; no source file, enum entry or page is needed for it.
 * Each accepted activity is stored before it is shown. Responses are graded on
 * the server and stored as practice events only: no attempt is recorded and the
 * belief reducer is never involved, so a generated lesson cannot create mastery.
 * Model calls run only when the student's consent, class and kill-switch
 * controls allow them, and only where unreviewed content may be served.
 */

export const OPEN_LESSON_PREFIX = "open-";

export function isOpenLessonId(lessonId: string): boolean {
  return lessonId.startsWith(OPEN_LESSON_PREFIX);
}

type SessionRow = typeof learningSessions.$inferSelect;

export interface OpenTopicDeps {
  /**
   * Returns the engine to use for this student, or the reason no model may be
   * called. Tests inject a scripted engine here; production uses the gateway.
   */
  resolveEngine?: (
    studentId: string,
    db: DbClient,
    sessionId?: string,
  ) => Promise<{ engine: OpenTopicEngine } | { denied: AiDenialReason }>;
}

async function gatewayEngine(
  studentId: string,
  db: DbClient,
  sessionId?: string,
): Promise<{ engine: OpenTopicEngine } | { denied: AiDenialReason }> {
  const permission = await checkStudentAiPermission(studentId, db);
  if (!permission.allowed) return { denied: permission.reason };
  const caller = createModelCaller({ db, studentId, sessionId });
  return { engine: new OpenTopicEngine(caller, readAiEnv().timeoutMs) };
}

const DENIAL_MESSAGES: Readonly<Record<AiDenialReason, string>> = {
  runtime_disabled: "Learning any topic needs AI features, which are switched off right now.",
  kill_switch: "Learning any topic needs AI features, which are switched off right now.",
  class_not_enabled:
    "Learning any topic needs AI features, which are not switched on for your class.",
  no_consent:
    "Learning any topic needs permission from your parent or guardian for AI features. Ask your teacher about it.",
  daily_limit: "You have used today's AI lessons. Come back tomorrow for more.",
};

function describeFailure(failure: GenerationFailure): string {
  return failure.kind === "provider"
    ? `provider:${failure.reason}`
    : `rejected:${failure.issues.map((i) => i.split(":")[0]).join(",")}`;
}

function lessonIdOf(sessionId: string): string {
  return `${OPEN_LESSON_PREFIX}${sessionId}`;
}

function readState(session: SessionRow): OpenTopicState | null {
  const state = (session.counters as Record<string, unknown> | null)?.openTopicState;
  return isOpenTopicState(state) ? state : null;
}

function progressOf(state: OpenTopicState, status: SessionRow["status"]): AdaptiveLessonProgress {
  const step = currentOpenStep(state);
  const unresolved = step !== undefined && !step.resolvedAt;
  return {
    objectiveId: `open:${state.slug}`,
    stepNumber: Math.max(1, state.steps.length),
    isClosingStep: unresolved && isOpenClosingStep(step),
    isPaused: status === "active" && unresolved && step.role === "pause",
    awaitingNextStep: status === "active" && state.awaitingNextStep,
  };
}

/** The step a learner should see now, if there is one. */
function activeStep(state: OpenTopicState, status: SessionRow["status"]): OpenStep | undefined {
  const step = currentOpenStep(state);
  return status === "active" && step && !step.resolvedAt ? step : undefined;
}

function buildCounters(
  session: { lessonId: string },
  state: OpenTopicState,
  previous: Record<string, unknown> = {},
): Record<string, unknown> {
  const resolved = state.steps.filter((s) => s.resolvedAt);
  return {
    ...previous,
    lessonId: session.lessonId,
    subject: state.subject,
    topicId: `open:${state.slug}`,
    openTopic: true,
    openTopicState: state,
    currentActivityIndex: Math.max(0, state.steps.length - 1),
    activeBranch: null,
    completedActivities: resolved.map((s) => s.activity.id),
    stoppingPointSaved: state.stoppingPointSaved,
    updatedAt: new Date().toISOString(),
  };
}

function buildSessionResponse(session: SessionRow, state: OpenTopicState): LessonSessionResponse {
  const active = activeStep(state, session.status);
  const resolved = state.steps.filter((s) => s.resolvedAt);
  return {
    session: {
      id: session.id,
      studentId: session.studentId,
      status: session.status as "active" | "completed" | "abandoned",
      mode: session.mode,
      stepSeq: session.stepSeq,
    },
    lesson: {
      lessonId: lessonIdOf(session.id),
      version: "1.0",
      subject: state.subject,
      level: state.level,
      topicId: `open:${state.slug}`,
      title: state.title,
      description: state.learningGoal,
      learningObjectives: [state.learningGoal],
      activities: state.steps.map((s) => redactActivityForStudent(s.activity)),
    },
    adaptive: progressOf(state, session.status),
    contentStatus: state.contentStatus,
    currentActivityIndex: Math.max(0, state.steps.length - 1),
    activeActivity: active ? redactActivityForStudent(active.activity) : undefined,
    activeBranch: null,
    assistanceStatus: Object.fromEntries(
      state.steps
        .filter((s) => s.role === "assessment")
        .map((s) => [s.activity.id, s.assistanceLevel === 0 ? "independent" : "assisted"]),
    ),
    completedActivities: resolved.map((s) => s.activity.id),
    activityResponses: Object.fromEntries(resolved.map((s) => [s.activity.id, s.response])),
    isCompleted: session.status === "completed",
  };
}

/** Next step for a student's lesson, with the model reached only through the gateway. */
async function advance(
  state: OpenTopicState,
  studentId: string,
  db: DbClient,
  sessionId: string | undefined,
  deps: OpenTopicDeps,
): Promise<OpenTopicState> {
  const outcome = await advanceOpenLesson(state, async () => {
    const resolved = await (deps.resolveEngine ?? gatewayEngine)(studentId, db, sessionId);
    return "denied" in resolved ? resolved : resolved.engine;
  });
  if (outcome.waiting) log.warn("open_topic.next_step.unavailable", { reason: outcome.reason });
  return outcome.state;
}

async function recordStepDecision(
  repo: ReturnType<typeof createStudentRepo>,
  sessionId: string,
  before: OpenTopicState,
  step: OpenStep,
  generator: OpenTopicState["generator"],
): Promise<void> {
  // The trace holds the topic, choice ids, numeric answers and outcomes. It
  // holds no learner name or account detail.
  await repo.recordDecisionTrace({
    id: generateDomainId("decision"),
    sessionId,
    context: {
      topic: before.title,
      level: before.level,
      policyInput: buildOpenPolicyInput(before),
    },
    result: {
      seq: step.seq,
      action: step.action,
      role: step.role,
      activityId: step.activity.id,
      activityType: step.activity.type,
      activityTitle: step.activity.title,
      assistanceLevel: step.assistanceLevel,
      answerVerification: step.verification ?? null,
      contentBasis: before.contentStatus.basis,
      provisional: true,
      ...step.decision,
      model: step.decision.origin === "generated" ? generator.model : null,
    },
    policyVersion: step.decision.policyVersion,
    provider: step.decision.origin === "generated" ? "llm_suggested" : "server",
    fallbackUsed: false,
    latencyMs: 0,
  });
}

function unavailable(
  reason: Extract<OpenLessonResponse, { status: "unavailable" }>["reason"],
  message: string,
  retryable = false,
): OpenLessonResponse {
  return { status: "unavailable", reason, message, retryable };
}

function authoredContentStatus(lessonId: string): LessonContentStatus {
  const def = getAdaptiveLesson(lessonId);
  return {
    basis: def && isReviewed(def.review) ? "reviewed" : "authored_draft",
    generatedPreview: false,
    practiceOnly: false,
    sources: [],
  };
}

/** Starts a lesson for a topic in the learner's own words. */
export async function createOpenLesson(
  studentId: string,
  request: OpenLessonRequest,
  db: DbClient,
  deps: OpenTopicDeps = {},
): Promise<OpenLessonResponse> {
  const topic = sanitizeTopic(
    request.clarification ? `${request.topic} (${request.clarification})` : request.topic,
  );
  if (topic.replace(/[^a-z0-9]/gi, "").length < 2) {
    return unavailable("out_of_scope", "Tell us a maths or science topic you would like to learn.");
  }

  // An authored lesson for exactly this topic is always preferred: it is the
  // only kind that can produce verified evidence.
  const authored = findAuthoredLesson(topic);
  if (authored && isLessonAvailable(authored.lessonId)) {
    return {
      status: "ready",
      lessonId: authored.lessonId,
      title: authored.title,
      contentStatus: authoredContentStatus(authored.lessonId),
    };
  }

  // Generated lessons are unreviewed previews. Where unreviewed content may not
  // be served (production), they are not offered at all.
  if (!areDraftsServable()) {
    return unavailable("preview_not_allowed", "Lessons on new topics are not available here yet.");
  }

  const resolved = await (deps.resolveEngine ?? gatewayEngine)(studentId, db);
  if ("denied" in resolved) {
    return unavailable(
      resolved.denied === "daily_limit" ? "daily_limit_reached" : "ai_not_enabled",
      DENIAL_MESSAGES[resolved.denied],
    );
  }
  const engine = resolved.engine;

  if (await engine.isTopicFlagged(topic)) {
    return unavailable(
      "out_of_scope",
      "That does not look like a school maths or science topic. Try another topic.",
    );
  }

  const sources = findSources(topic);
  const simulations = allowedSimulations(topic);
  const beliefs = await createStudentRepo(studentId, db).getConceptBeliefs();
  const relatedConcepts = new Set(sources.packs.map((p) => p.objectiveId));
  const learnerEvidence = beliefs
    .filter((b) => relatedConcepts.has(b.conceptId))
    .map((b) => `${b.conceptId}: ${b.status}`);

  const opening = await engine.planOpening({
    topic: sanitizeTopic(request.topic),
    level: request.level,
    ...(request.clarification ? { clarification: sanitizeTopic(request.clarification) } : {}),
    sources,
    allowedSimulations: simulations,
    learnerEvidence,
  });

  if (opening.kind === "clarify") {
    return { status: "needs_clarification", question: opening.question, options: opening.options };
  }
  if (opening.kind === "out_of_scope") {
    return unavailable(
      "out_of_scope",
      "That does not look like a school maths or science topic. Try another topic.",
    );
  }
  if (opening.kind === "failed") {
    log.warn("open_topic.opening.failed", { failure: describeFailure(opening.failure) });
    return unavailable(
      "generation_failed",
      "We could not prepare this lesson just now. Please try again in a moment.",
      true,
    );
  }

  const initial = initialOpenState({
    topic,
    level: request.level,
    plan: opening,
    sources: sources.references,
    generator: engine.provider,
  });
  const contentStatus = initial.contentStatus;

  // The opening was validated above, so the first step comes from the queue.
  const state = await advance(initial, studentId, db, undefined, {
    resolveEngine: async () => ({ engine }),
  });
  const first = currentOpenStep(state);
  if (!first) {
    return unavailable(
      "generation_failed",
      "We could not prepare this lesson just now. Please try again in a moment.",
      true,
    );
  }

  const sessionId = generateDomainId("session");
  const lessonId = lessonIdOf(sessionId);
  await db.transaction(async (tx) => {
    const repo = createStudentRepo(studentId, tx as unknown as DbClient);
    await repo.createSession({
      id: sessionId,
      mode: "lesson",
      focusConceptId: null,
      status: "active",
      budgetS: 1200,
      stepSeq: state.steps.length,
      counters: buildCounters({ lessonId }, state, { startedAt: new Date().toISOString() }),
      plan: {},
    });
    await repo.recordDecisionTrace({
      id: generateDomainId("decision"),
      sessionId,
      context: { topic: state.title, level: state.level, sources: contentStatus.sources },
      result: {
        kind: "opening_plan",
        contentBasis: contentStatus.basis,
        learningGoal: state.learningGoal,
        // Proposed by the model; not verified curriculum relationships.
        modelProposedPrerequisites: state.modelProposed.prerequisites,
        modelSuspectedMisconceptions: state.modelProposed.misconceptions,
        openingActions: opening.opening.map((s) => s.action),
        model: engine.provider.model,
      },
      policyVersion: first.decision.policyVersion,
      provider: "llm_suggested",
      fallbackUsed: false,
      latencyMs: 0,
    });
    await recordStepDecision(repo, sessionId, initial, first, state.generator);
  });

  return { status: "ready", lessonId, title: state.title, contentStatus };
}

async function loadSession(
  studentId: string,
  lessonId: string,
  db: DbClient,
): Promise<{ session: SessionRow; state: OpenTopicState }> {
  const sessionId = lessonId.slice(OPEN_LESSON_PREFIX.length);
  const session = await createStudentRepo(studentId, db).getSession(sessionId);
  const state = session ? readState(session) : null;
  if (!session || !state) {
    throw new LessonServiceError("This lesson could not be found.", 404, "LESSON_NOT_FOUND");
  }
  if (!areDraftsServable()) {
    throw new LessonServiceError("This lesson is not available yet.", 404, "LESSON_NOT_AVAILABLE");
  }
  return { session, state };
}

/** Guarded write: only succeeds if nobody else has advanced the session meanwhile. */
async function saveIfUnchanged(
  db: DbClient,
  studentId: string,
  session: SessionRow,
  next: OpenTopicState,
  completed: boolean,
  after: (repo: ReturnType<typeof createStudentRepo>) => Promise<void>,
): Promise<SessionRow | null> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(learningSessions)
      .set({
        stepSeq: session.stepSeq + 1,
        ...(completed ? { status: "completed", endedAt: new Date() } : {}),
        counters: buildCounters(
          { lessonId: lessonIdOf(session.id) },
          next,
          session.counters as Record<string, unknown>,
        ),
      })
      .where(
        and(
          eq(learningSessions.id, session.id),
          eq(learningSessions.studentId, studentId),
          eq(learningSessions.status, "active"),
          eq(learningSessions.stepSeq, session.stepSeq),
        ),
      )
      .returning();
    if (!updated) return null;
    await after(createStudentRepo(studentId, tx as unknown as DbClient));
    return updated;
  });
}

/** Resume. If the lesson was waiting for a next step, this is the retry. */
export async function startOrResumeOpenLesson(
  studentId: string,
  lessonId: string,
  db: DbClient,
  deps: OpenTopicDeps = {},
): Promise<LessonSessionResponse> {
  const { session, state } = await loadSession(studentId, lessonId, db);
  if (session.status !== "active" || !state.awaitingNextStep) {
    return buildSessionResponse(session, state);
  }

  const next = await advance(
    { ...state, awaitingNextStep: false },
    studentId,
    db,
    session.id,
    deps,
  );
  const appended = next.steps.length > state.steps.length ? currentOpenStep(next) : undefined;
  if (!appended) return buildSessionResponse(session, state);

  const updated = await saveIfUnchanged(db, studentId, session, next, false, (repo) =>
    recordStepDecision(repo, session.id, state, appended, state.generator),
  );
  if (!updated) {
    const fresh = await loadSession(studentId, lessonId, db);
    return buildSessionResponse(fresh.session, fresh.state);
  }
  return buildSessionResponse(updated, next);
}

function replay(session: SessionRow, state: OpenTopicState, step: OpenStep): LessonRespondResponse {
  const active = activeStep(state, session.status);
  return {
    activityId: step.activity.id,
    accepted: true,
    feedback: step.outcome?.feedback,
    isCorrect: step.outcome?.isCorrect,
    nextActivityIndex: Math.max(0, state.steps.length - 1),
    activeBranch: null,
    activeActivity: active ? redactActivityForStudent(active.activity) : undefined,
    isCompleted: session.status === "completed",
    sparksAwarded: 0,
    adaptive: progressOf(state, session.status),
  };
}

export async function respondToOpenLesson(
  studentId: string,
  lessonId: string,
  activityId: string,
  response: unknown,
  db: DbClient,
  deps: OpenTopicDeps = {},
): Promise<LessonRespondResponse> {
  const { session, state } = await loadSession(studentId, lessonId, db);

  const alreadyAnswered = state.steps.find((s) => s.activity.id === activityId && s.resolvedAt);
  if (alreadyAnswered) return replay(session, state, alreadyAnswered);

  const step = currentOpenStep(state);
  if (!step || step.activity.id !== activityId || session.status !== "active") {
    throw new LessonServiceError(
      `Activity mismatch: expected activity ${step?.activity.id}, received ${activityId}`,
      409,
      "ACTIVITY_MISMATCH",
    );
  }

  const saveAndExit =
    typeof response === "object" &&
    response !== null &&
    Boolean((response as { saveAndExit?: unknown }).saveAndExit);

  // Save and pause: the stopping point stays so the learner can resume at it.
  if (step.role === "pause" && saveAndExit) {
    const saved: OpenTopicState = { ...state, stoppingPointSaved: true };
    await createStudentRepo(studentId, db).updateSession(session.id, {
      counters: buildCounters({ lessonId }, saved, session.counters as Record<string, unknown>),
    });
    return {
      activityId,
      accepted: true,
      feedback: "Progress saved. You can take a break and resume anytime!",
      nextActivityIndex: Math.max(0, saved.steps.length - 1),
      activeBranch: null,
      activeActivity: redactActivityForStudent(step.activity),
      isCompleted: false,
      isSavedAndExited: true,
      sparksAwarded: 0,
      adaptive: progressOf(saved, session.status),
    };
  }

  let outcome;
  try {
    outcome = gradeOpenStep(step, response);
  } catch (err) {
    if (err instanceof OpenResponseError) {
      throw new LessonServiceError(err.message, 400, "INVALID_RESPONSE");
    }
    throw err;
  }

  const closing = isOpenClosingStep(step);
  const resolvedState = resolveOpenStep(state, response, outcome);
  // The model is consulted outside any database transaction. Whatever it
  // returns, the learner's response is saved in the write below.
  const next = closing
    ? resolvedState
    : await advance(resolvedState, studentId, db, session.id, deps);
  const appended =
    next.steps.length > resolvedState.steps.length ? currentOpenStep(next) : undefined;

  const updated = await saveIfUnchanged(db, studentId, session, next, closing, async (repo) => {
    await repo.recordEvent({
      sessionId: session.id,
      type: "open_topic_step",
      payload: {
        seq: step.seq,
        action: step.action,
        role: step.role,
        submittedAnswer: outcome.submittedAnswer,
        isCorrect: outcome.isCorrect ?? null,
        assistanceLevel: step.role === "assessment" ? step.assistanceLevel : null,
        answerVerification: step.verification ?? null,
        contentBasis: state.contentStatus.basis,
        // Practice feedback only. Not an attempt; never reaches the belief reducer.
        provisional: true,
        countedAsEvidence: false,
      },
    });
    if (appended)
      await recordStepDecision(repo, session.id, resolvedState, appended, state.generator);
  });

  if (!updated) {
    // A concurrent submission of this step won. Answer with what was stored.
    const fresh = await loadSession(studentId, lessonId, db);
    const stored = fresh.state.steps.find((s) => s.activity.id === activityId && s.resolvedAt);
    if (stored) return replay(fresh.session, fresh.state, stored);
    throw new LessonServiceError("Please try that again.", 409, "SESSION_BUSY");
  }

  const active = activeStep(next, updated.status);
  return {
    activityId,
    accepted: true,
    feedback: outcome.feedback,
    isCorrect: outcome.isCorrect,
    nextActivityIndex: Math.max(0, next.steps.length - 1),
    activeBranch: null,
    activeActivity: active ? redactActivityForStudent(active.activity) : undefined,
    isCompleted: closing,
    sparksAwarded: 0,
    adaptive: progressOf(next, updated.status),
  };
}
