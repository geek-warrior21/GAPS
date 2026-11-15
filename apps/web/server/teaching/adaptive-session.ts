import {
  type DbClient,
  attempts,
  createStudentRepo,
  learningSessions,
  and,
  desc,
  eq,
} from "@gaps/db";
import type {
  AdaptiveLessonProgress,
  LessonPlan,
  LessonRespondResponse,
  LessonSessionResponse,
  ObjectiveBeliefStatus,
} from "@gaps/contracts";
import type { TeachingDecisionEngine } from "./types";
import { type AdaptiveLessonDefinition, toLessonShell } from "./adaptive-lessons";
import {
  type AdaptiveLessonState,
  type DeliveredStep,
  type StepOutcome,
  StepResponseError,
  appendStep,
  beginNewRound,
  buildDecisionInput,
  createAdaptiveLessonState,
  currentStep,
  decideNextStep,
  gradeStepResponse,
  isAdaptiveLessonState,
  isClosingStep,
  resolveCurrentStep,
} from "./sequencer";
import { CANONICAL_MISCONCEPTION_IDS } from "./item-bank";
import { getTeachingDecisionEngine } from "./factory";
import { redactActivityForStudent } from "../lesson/redact";
import { LessonServiceError, recordLessonAssessment } from "../lesson/service";
import { generateDomainId } from "../session/engine";
import { log } from "../log";

/**
 * Engine-driven lesson sessions, persisted in learning_sessions (mode "lesson").
 *
 * Each step is decided by the teaching decision engine inside the server policy
 * envelope, stored with its full activity snapshot and assistance level, and
 * only then returned. A refresh or retry therefore reuses the stored step.
 * Beliefs are changed only by the belief reducer, through recordLessonAssessment.
 */

export interface AdaptiveSessionOptions {
  /** Engine override, used by tests to exercise failure and guard paths. */
  engine?: TeachingDecisionEngine;
}

type SessionRow = typeof learningSessions.$inferSelect;
type StudentRepo = ReturnType<typeof createStudentRepo>;

const LESSON_SPARKS = 15;

function resolveEngine(options?: AdaptiveSessionOptions): TeachingDecisionEngine {
  // Real sessions use the authored engine. A model-backed engine needs the
  // per-student AI consent scope and class flag checks (Non-negotiable 6),
  // which are not available to this module yet.
  return options?.engine ?? getTeachingDecisionEngine();
}

function readState(session: SessionRow): AdaptiveLessonState | null {
  const counters = session.counters as Record<string, unknown> | null;
  const state = counters?.adaptiveState;
  return isAdaptiveLessonState(state) ? state : null;
}

function progressOf(
  state: AdaptiveLessonState,
  status: SessionRow["status"],
): AdaptiveLessonProgress {
  const step = currentStep(state);
  return {
    objectiveId: state.objectiveId,
    stepNumber: state.steps.length,
    isClosingStep: step ? isClosingStep(step) : false,
    isPaused: status === "active" && step?.role === "pause" && !step.resolvedAt,
  };
}

function assistanceStatusOf(state: AdaptiveLessonState): Record<string, string> {
  const status: Record<string, string> = {};
  for (const step of state.steps) {
    if (step.role === "assessment") {
      status[step.activity.id] = step.assistanceLevel === 0 ? "independent" : "assisted";
    }
  }
  return status;
}

function buildCounters(
  def: AdaptiveLessonDefinition,
  state: AdaptiveLessonState,
  previous: Record<string, unknown> = {},
): Record<string, unknown> {
  const resolved = state.steps.filter((s) => s.resolvedAt);
  return {
    ...previous,
    lessonId: def.lessonId,
    subject: def.subject,
    topicId: def.topicId,
    adaptive: true,
    adaptiveState: state,
    currentActivityIndex: Math.max(0, state.steps.length - 1),
    activeBranch: null,
    completedActivities: resolved.map((s) => s.activity.id),
    activityResponses: Object.fromEntries(resolved.map((s) => [s.activity.id, s.response])),
    assistanceStatus: assistanceStatusOf(state),
    stoppingPointSaved: state.stoppingPointSaved,
    updatedAt: new Date().toISOString(),
  };
}

function buildSessionResponse(
  session: SessionRow,
  def: AdaptiveLessonDefinition,
  state: AdaptiveLessonState,
): LessonSessionResponse {
  const isCompleted = session.status === "completed";
  const step = currentStep(state);
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
      ...toLessonShell(def),
      activities: state.steps.map((s) => redactActivityForStudent(s.activity)),
    },
    adaptive: progressOf(state, session.status),
    currentActivityIndex: Math.max(0, state.steps.length - 1),
    activeActivity: !isCompleted && step ? redactActivityForStudent(step.activity) : undefined,
    activeBranch: null,
    assistanceStatus: assistanceStatusOf(state),
    completedActivities: resolved.map((s) => s.activity.id),
    activityResponses: Object.fromEntries(resolved.map((s) => [s.activity.id, s.response])),
    isCompleted,
  };
}

async function findSession(
  db: DbClient,
  studentId: string,
  lessonId: string,
  statuses: readonly string[],
): Promise<SessionRow | undefined> {
  const rows = await db
    .select()
    .from(learningSessions)
    .where(and(eq(learningSessions.studentId, studentId), eq(learningSessions.mode, "lesson")))
    .orderBy(desc(learningSessions.startedAt))
    .limit(20);
  for (const status of statuses) {
    const found = rows.find(
      (s) =>
        s.status === status &&
        (s.counters as Record<string, unknown> | null)?.lessonId === lessonId,
    );
    if (found) return found;
  }
  return undefined;
}

async function readObjectiveStatus(
  studentRepo: StudentRepo,
  objectiveId: string,
): Promise<ObjectiveBeliefStatus> {
  // The stored belief row is the belief reducer's projection of the evidence.
  const belief = await studentRepo.getConceptBelief(objectiveId);
  return (belief?.status as ObjectiveBeliefStatus | undefined) ?? "not_assessed";
}

async function recordDecision(
  studentRepo: StudentRepo,
  sessionId: string,
  state: AdaptiveLessonState,
  step: DeliveredStep,
  objectiveStatus: ObjectiveBeliefStatus,
): Promise<void> {
  // Context holds objective ids, authored choice ids and outcomes only: no names
  // or free text. `state` is the state the decision was made from.
  const { sourceMaterial: _unused, ...context } = buildDecisionInput(state, objectiveStatus);
  void _unused;
  await studentRepo.recordDecisionTrace({
    id: generateDomainId("decision"),
    sessionId,
    context,
    result: {
      seq: step.seq,
      action: step.action,
      role: step.role,
      activityId: step.activity.id,
      activityType: step.activity.type,
      activityTitle: step.activity.title,
      itemId: step.itemId ?? null,
      assistanceLevel: step.assistanceLevel,
      ...step.decision,
    },
    policyVersion: step.decision.policyVersion,
    provider: step.decision.source,
    fallbackUsed: step.decision.source === "fallback",
    latencyMs: 0,
  });
}

export async function startOrResumeAdaptiveLesson(
  studentId: string,
  def: AdaptiveLessonDefinition,
  db: DbClient,
  options?: AdaptiveSessionOptions,
): Promise<LessonSessionResponse> {
  const studentRepo = createStudentRepo(studentId, db);

  const existing = await findSession(db, studentId, def.lessonId, ["active"]);
  if (existing) {
    const state = readState(existing);
    if (state) {
      // Resume: the stored step is returned as is. Nothing is decided again.
      return buildSessionResponse(existing, def, state);
    }
    // Rule F.3: unreadable stored state never fails the request. The session
    // is closed and a fresh authored-engine session replaces it.
    log.warn("lesson.adaptive.state_unreadable", { lessonId: def.lessonId });
    await studentRepo.updateSession(existing.id, { status: "abandoned", endedAt: new Date() });
  }

  const priorAttempts = await db
    .select({ itemInstanceId: attempts.itemInstanceId })
    .from(attempts)
    .where(and(eq(attempts.studentId, studentId), eq(attempts.conceptId, def.objectiveId)));

  const objectiveStatus = await readObjectiveStatus(studentRepo, def.objectiveId);
  const initial = createAdaptiveLessonState({
    objectiveId: def.objectiveId,
    subject: def.subject,
    level: def.level,
    priorItemIds: [...new Set(priorAttempts.map((a) => a.itemInstanceId))],
  });
  const firstStep = await decideNextStep(initial, objectiveStatus, resolveEngine(options));
  const state = appendStep(initial, firstStep);

  // The session, its first activity and the decision behind it are stored
  // together before anything is returned to the student.
  const created = await db.transaction(async (tx) => {
    const txDb = tx as unknown as DbClient;
    const txRepo = createStudentRepo(studentId, txDb);
    const session = await txRepo.createSession({
      id: generateDomainId("session"),
      mode: "lesson",
      focusConceptId: def.objectiveId,
      status: "active",
      budgetS: 1200,
      stepSeq: state.steps.length,
      counters: buildCounters(def, state, { startedAt: new Date().toISOString() }),
      plan: { ...toLessonShell(def), activities: [] } satisfies Omit<LessonPlan, "activities"> & {
        activities: never[];
      },
    });
    await recordDecision(txRepo, session.id, initial, firstStep, objectiveStatus);
    return session;
  });

  return buildSessionResponse(created, def, state);
}

function replayResponse(
  session: SessionRow,
  state: AdaptiveLessonState,
  step: DeliveredStep,
): LessonRespondResponse {
  const active = currentStep(state);
  const isCompleted = session.status === "completed";
  return {
    activityId: step.activity.id,
    accepted: true,
    feedback: step.outcome?.feedback,
    isCorrect: step.outcome?.isCorrect,
    nextActivityIndex: Math.max(0, state.steps.length - 1),
    activeBranch: null,
    activeActivity: !isCompleted && active ? redactActivityForStudent(active.activity) : undefined,
    isCompleted,
    sparksAwarded: 0,
    adaptive: progressOf(state, session.status),
  };
}

function isSaveAndExit(response: unknown): boolean {
  return (
    typeof response === "object" &&
    response !== null &&
    Boolean((response as { saveAndExit?: unknown }).saveAndExit)
  );
}

/** One attempt key per delivered step, so no retry of a step can count twice. */
function attemptKeyOf(sessionId: string, step: DeliveredStep): string {
  return `att_${sessionId}_s${step.seq}`;
}

export async function respondToAdaptiveLesson(
  studentId: string,
  def: AdaptiveLessonDefinition,
  activityId: string,
  response: unknown,
  db: DbClient,
  options?: AdaptiveSessionOptions,
): Promise<LessonRespondResponse> {
  try {
    return await respondOnce(studentId, def, activityId, response, db, options);
  } catch (err) {
    if (err instanceof LessonServiceError) throw err;
    // A concurrent submission of the same step may have won the race (unique
    // attempt key or step guard). If so, answer with the stored result.
    const session = await findSession(db, studentId, def.lessonId, ["active", "completed"]);
    const state = session ? readState(session) : null;
    const answered = state?.steps.find((s) => s.activity.id === activityId && s.resolvedAt);
    if (session && state && answered) return replayResponse(session, state, answered);
    throw err;
  }
}

async function respondOnce(
  studentId: string,
  def: AdaptiveLessonDefinition,
  activityId: string,
  response: unknown,
  db: DbClient,
  options?: AdaptiveSessionOptions,
): Promise<LessonRespondResponse> {
  const session = await findSession(db, studentId, def.lessonId, ["active", "completed"]);
  if (!session) {
    throw new LessonServiceError(
      `No active lesson session found for lesson ${def.lessonId}`,
      404,
      "SESSION_NOT_FOUND",
    );
  }
  const state = readState(session);
  if (!state) {
    throw new LessonServiceError(
      "This lesson needs to be reopened before continuing.",
      409,
      "SESSION_STATE_INVALID",
    );
  }

  const step = currentStep(state);
  const alreadyAnswered = state.steps.find((s) => s.activity.id === activityId && s.resolvedAt);
  if (alreadyAnswered) {
    // Retry of a stored response: return the stored result, record nothing.
    return replayResponse(session, state, alreadyAnswered);
  }
  if (!step || step.activity.id !== activityId || session.status !== "active") {
    throw new LessonServiceError(
      `Activity mismatch: expected activity ${step?.activity.id}, received ${activityId}`,
      409,
      "ACTIVITY_MISMATCH",
    );
  }

  // ---- Save and pause: keep the stopping point so the learner can resume ----
  if (step.role === "pause" && !isClosingStep(step) && isSaveAndExit(response)) {
    const saved: AdaptiveLessonState = { ...state, stoppingPointSaved: true };
    const studentRepo = createStudentRepo(studentId, db);
    await studentRepo.updateSession(session.id, {
      counters: {
        ...buildCounters(def, saved, session.counters as Record<string, unknown>),
        savedAt: new Date().toISOString(),
      },
    });
    if (!state.stoppingPointSaved) {
      await studentRepo.recordEvent({
        sessionId: session.id,
        type: "lesson_stopping_point_saved",
        payload: { lessonId: def.lessonId, activityId, adaptive: true, saveAndExit: true },
      });
    }
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

  let outcome: StepOutcome;
  try {
    outcome = gradeStepResponse(step, response);
  } catch (err) {
    if (err instanceof StepResponseError) {
      throw new LessonServiceError(err.message, 400, "INVALID_RESPONSE");
    }
    throw err;
  }

  const engine = resolveEngine(options);
  const closing = isClosingStep(step);

  return db.transaction(async (tx) => {
    const txDb = tx as unknown as DbClient;
    const studentRepo = createStudentRepo(studentId, txDb);
    let sparksAwarded = 0;

    // ---- Evidence: only an assessment step reaches the belief reducer --------
    if (step.role === "assessment") {
      const config = step.activity.config;
      if (config.type !== "independent_check") {
        throw new LessonServiceError("Assessment step is malformed.", 409, "SESSION_STATE_INVALID");
      }
      const assessed = await recordLessonAssessment({
        db: txDb,
        studentRepo,
        studentId,
        sessionId: session.id,
        clientAttemptId: attemptKeyOf(session.id, step),
        stepSeq: step.seq,
        lessonPlan: { ...toLessonShell(def), activities: [] },
        activityId: step.activity.id,
        templateId: config.templateId,
        itemInstanceId: config.itemInstanceId,
        seed: config.seed,
        conceptId: def.objectiveId,
        questionText: config.prompt,
        submittedAnswer: outcome.submittedAnswer,
        correctAnswer: config.correctAnswer,
        isCorrect: outcome.isCorrect === true,
        assistanceLevel: step.assistanceLevel,
        misconceptionId: outcome.misconception
          ? CANONICAL_MISCONCEPTION_IDS[outcome.misconception]
          : undefined,
      });
      outcome = { ...outcome, attemptId: assessed.attemptId };
      sparksAwarded += assessed.sparksAwarded;
    }

    await studentRepo.recordEvent({
      sessionId: session.id,
      type: "lesson_adaptive_step",
      payload: {
        lessonId: def.lessonId,
        activityId: step.activity.id,
        seq: step.seq,
        action: step.action,
        role: step.role,
        itemId: step.itemId ?? null,
        submittedAnswer: outcome.submittedAnswer,
        isCorrect: outcome.isCorrect ?? null,
        assistanceLevel: step.role === "assessment" ? step.assistanceLevel : null,
        misconception: outcome.misconception,
        countedAsEvidence: outcome.countedAsEvidence,
        attemptId: outcome.attemptId ?? null,
      },
    });

    let next = resolveCurrentStep(state, response, outcome);
    if (step.role === "pause" && !closing) next = beginNewRound(next);

    let nextStep: DeliveredStep | undefined;
    if (!closing) {
      // The status is read after the attempt above, so the reducer's verdict on
      // this very answer is what authorizes or withholds advancement.
      const objectiveStatus = await readObjectiveStatus(studentRepo, def.objectiveId);
      const decidedFrom = next;
      nextStep = await decideNextStep(decidedFrom, objectiveStatus, engine);
      next = appendStep(decidedFrom, nextStep);
      await recordDecision(studentRepo, session.id, decidedFrom, nextStep, objectiveStatus);
    } else {
      const awarded = await studentRepo.awardSparks(session.id, "lesson", LESSON_SPARKS);
      if (awarded.awarded) sparksAwarded += LESSON_SPARKS;
    }

    // Guarded on the step count read above: a concurrent submission that got
    // here first leaves no row to update, and this transaction rolls back.
    const [updated] = await tx
      .update(learningSessions)
      .set({
        stepSeq: next.steps.length,
        ...(closing ? { status: "completed", endedAt: new Date() } : {}),
        counters: {
          ...buildCounters(def, next, session.counters as Record<string, unknown>),
          ...(closing ? { completedAt: new Date().toISOString() } : {}),
        },
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
    if (!updated) {
      throw new Error("lesson step was already submitted");
    }

    return {
      activityId,
      accepted: true,
      feedback: outcome.feedback,
      isCorrect: outcome.isCorrect,
      nextActivityIndex: Math.max(0, next.steps.length - 1),
      activeBranch: null,
      activeActivity: nextStep ? redactActivityForStudent(nextStep.activity) : undefined,
      isCompleted: closing,
      sparksAwarded,
      adaptive: progressOf(next, updated.status),
    };
  });
}

/** Developer trace of a session's decisions. Not exposed through any student route. */
export async function getAdaptiveLessonTrace(
  studentId: string,
  sessionId: string,
  db: DbClient,
): Promise<Awaited<ReturnType<StudentRepo["listDecisionTraces"]>>> {
  return createStudentRepo(studentId, db).listDecisionTraces(sessionId);
}
