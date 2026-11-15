import {
  type DbClient,
  getDb,
  learningSessions,
  createStudentRepo,
  findOrCreateItemInstance,
  attempts,
  itemInstances,
  and,
  asc,
  desc,
  eq,
} from "@gaps/db";
import {
  type CurriculumTopicsResponse,
  type LessonPlan,
  type LessonSessionResponse,
  type LessonRespondResponse,
  type LessonActivity,
  type ActiveBranchState,
  type RecommendedNextAction,
} from "@gaps/contracts";
import {
  getAllCurriculumTopics,
  getLessonById,
  getTopicById,
  MATHS_FRAC_PART_LESSON,
  CURRICULUM_TOPICS,
} from "@gaps/content";
import {
  type CheckedAttempt,
  type ConceptId,
  type BeliefState,
  type MisconceptionId,
  replayTransitions,
} from "@gaps/domain";
import { getLessonPlanner } from "./planner";
import { generateDomainId } from "../session/engine";
import { log } from "../log";

export class LessonServiceError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = "LESSON_ERROR") {
    super(message);
    this.name = "LessonServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function resolveActiveActivity(
  lesson: LessonPlan,
  currentActivityIndex: number,
  activeBranch: ActiveBranchState | null,
): LessonActivity | undefined {
  if (!activeBranch) {
    return lesson.activities[currentActivityIndex];
  }

  const parentActivity = lesson.activities.find((a) => a.id === activeBranch.parentActivityId);
  if (!parentActivity?.remediation) {
    return lesson.activities[currentActivityIndex];
  }

  if (activeBranch.stage === "remediation_activity") {
    return parentActivity.remediation.remediationActivity;
  }
  if (activeBranch.stage === "followup_check") {
    return parentActivity.remediation.followUpCheck;
  }
  if (activeBranch.stage === "stopping_point") {
    return parentActivity.remediation.stoppingPoint ?? parentActivity;
  }

  return lesson.activities[currentActivityIndex];
}

interface RecordLessonAssessmentParams {
  db: DbClient;
  studentRepo: ReturnType<typeof createStudentRepo>;
  studentId: string;
  sessionId: string;
  clientAttemptId: string;
  stepSeq: number;
  lessonPlan: LessonPlan;
  activityId: string;
  templateId?: string;
  itemInstanceId?: string;
  seed?: number;
  conceptId: ConceptId;
  questionText: string;
  submittedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  assistanceLevel: 0 | 1;
}

export async function recordLessonAssessment(params: RecordLessonAssessmentParams): Promise<{
  attemptId: string;
  isDuplicate: boolean;
  newState: BeliefState;
  sparksAwarded: number;
}> {
  const {
    db,
    studentRepo,
    studentId,
    sessionId,
    clientAttemptId,
    stepSeq,
    lessonPlan,
    activityId,
    conceptId,
    questionText,
    submittedAnswer,
    correctAnswer,
    isCorrect,
    assistanceLevel,
  } = params;

  // 1. Idempotency check: (sessionId, clientAttemptId)
  const existing = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.sessionId, sessionId), eq(attempts.clientAttemptId, clientAttemptId)))
    .limit(1);

  if (existing[0]) {
    const currentBelief = await studentRepo.getConceptBelief(conceptId);
    return {
      attemptId: existing[0].id,
      isDuplicate: true,
      newState: currentBelief as unknown as BeliefState,
      sparksAwarded: 0,
    };
  }

  // 2. Ensure item instance in item_instances table
  const templateId = params.templateId ?? `tpl_lesson_${lessonPlan.topicId}_${activityId}`;
  const itemInstanceId = params.itemInstanceId ?? `itm_lesson_${lessonPlan.lessonId}_${activityId}`;

  let seed = params.seed ?? 1;
  if (!params.seed && params.itemInstanceId) {
    const match = /_(\d+)$/.exec(params.itemInstanceId);
    if (match && match[1]) {
      seed = parseInt(match[1], 10);
    } else {
      let h = 0;
      for (let i = 0; i < params.itemInstanceId.length; i++) {
        h = (h * 31 + params.itemInstanceId.charCodeAt(i)) & 0x7fffffff;
      }
      seed = (h % 100000) + 1;
    }
  }

  const item = await findOrCreateItemInstance(db, {
    id: itemInstanceId,
    templateId,
    templateVersion: 1,
    seed,
    conceptId,
    prompt: { text: questionText },
    answer: { value: correctAnswer },
    hints: [],
    workedExample: { steps: [], result: correctAnswer },
  });

  // 3. Record attempt into attempts table
  const attemptId = generateDomainId("attempt");
  await studentRepo.recordAttempt({
    id: attemptId,
    sessionId,
    clientAttemptId,
    stepSeq,
    itemInstanceId: item.id,
    conceptId,
    rawAnswer: submittedAnswer.slice(0, 64),
    parsed: { kind: "choice", value: submittedAnswer, lowestTerms: true },
    outcome: isCorrect ? "correct" : "incorrect",
    assistanceLevel,
    tryNo: 1,
    isReview: false,
    mode: "lesson",
    verifierVersion: "verify-1.0",
    latencyMs: 1000,
  });

  // 4. Fetch all stored attempts for this concept, joined with itemInstances
  const storedAttempts = await db
    .select({
      attemptId: attempts.id,
      studentId: attempts.studentId,
      sessionId: attempts.sessionId,
      clientAttemptId: attempts.clientAttemptId,
      itemInstanceId: attempts.itemInstanceId,
      templateId: itemInstances.templateId,
      conceptId: attempts.conceptId,
      mode: attempts.mode,
      outcome: attempts.outcome,
      misconceptionId: attempts.misconceptionId,
      assistance: attempts.assistanceLevel,
      tryNo: attempts.tryNo,
      isReview: attempts.isReview,
      verifierVersion: attempts.verifierVersion,
      at: attempts.createdAt,
    })
    .from(attempts)
    .innerJoin(itemInstances, eq(attempts.itemInstanceId, itemInstances.id))
    .where(and(eq(attempts.studentId, studentId), eq(attempts.conceptId, conceptId)))
    .orderBy(asc(attempts.createdAt), asc(attempts.id));

  const checkedAttempts: CheckedAttempt[] = storedAttempts.map((row) => ({
    attemptId: row.attemptId,
    studentId: row.studentId,
    sessionId: row.sessionId,
    clientAttemptId: row.clientAttemptId,
    itemInstanceId: row.itemInstanceId,
    templateId: row.templateId,
    conceptId: row.conceptId as ConceptId,
    mode: row.mode as CheckedAttempt["mode"],
    outcome: row.outcome as CheckedAttempt["outcome"],
    misconceptionId: row.misconceptionId ? (row.misconceptionId as MisconceptionId) : undefined,
    assistance: (row.assistance >= 0 && row.assistance <= 3 ? row.assistance : 0) as 0 | 1 | 2 | 3,
    tryNo: (row.tryNo === 1 || row.tryNo === 2 ? row.tryNo : 1) as 1 | 2,
    isReview: row.isReview,
    verifierVersion: "verify-1.0",
    at: row.at.toISOString(),
  }));

  // 5. Replay authoritative transitions
  const transitionHistory = replayTransitions(conceptId, checkedAttempts, {
    templatesForConcept: 2,
  });
  const newState = transitionHistory.state;

  // 6. Persist updated concept belief
  const existingBelief = await studentRepo.getConceptBelief(conceptId);

  await studentRepo.upsertConceptBelief({
    studentId,
    conceptId,
    status: newState.status,
    estimate: newState.estimate ? String(newState.estimate) : null,
    reliability: newState.reliability,
    demonstratedAt: newState.demonstratedAt ? new Date(newState.demonstratedAt) : null,
    retainedAt: newState.retainedAt ? new Date(newState.retainedAt) : null,
    firstNeedsSupportAt: newState.firstNeedsSupportAt
      ? new Date(newState.firstNeedsSupportAt)
      : null,
    lastEvidenceAt: new Date(),
    activeMisconceptionIds: [...newState.activeMisconceptionIds],
    independentN: checkedAttempts.filter((a) => a.assistance === 0).length,
    independentCorrectN: checkedAttempts.filter(
      (a) => a.assistance === 0 && a.outcome === "correct",
    ).length,
  });

  // 7. Check Sparks rewards: +20 for newly demonstrated mastery
  let sparksAwarded = 0;
  if (
    newState.status === "demonstrated" &&
    existingBelief?.status !== "demonstrated" &&
    existingBelief?.status !== "retained"
  ) {
    const spk = await studentRepo.awardSparks(attemptId, "mastery_demonstrated", 20);
    if (spk.awarded) {
      sparksAwarded += 20;
      await studentRepo.recordEvent({
        sessionId,
        type: "sparks_awarded",
        payload: {
          amount: 20,
          sourceKind: "mastery_demonstrated",
          conceptId,
          attemptId,
        },
      });
    }
  }

  return {
    attemptId,
    isDuplicate: false,
    newState,
    sparksAwarded,
  };
}

export async function getCurriculumTopicsOverview(): Promise<CurriculumTopicsResponse> {
  const topics = getAllCurriculumTopics();
  return { topics: [...topics] };
}

export async function startOrResumeLessonSession(
  studentId: string,
  lessonId: string,
  db: DbClient = getDb(),
): Promise<LessonSessionResponse> {
  const studentRepo = createStudentRepo(studentId, db);

  // 1. Resolve lesson plan via planner
  const planner = getLessonPlanner();
  let lesson: LessonPlan | null = null;

  try {
    const staticLesson = getLessonById(lessonId);
    if (staticLesson) {
      lesson = await planner.planLesson({
        subject: staticLesson.subject,
        level: staticLesson.level,
        topicId: staticLesson.topicId,
        lessonId: staticLesson.lessonId,
      });
    }
  } catch (err) {
    log.warn("lesson.session.planner_error", {
      lessonId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (!lesson) {
    lesson = getLessonById(lessonId) ?? null;
  }

  if (!lesson) {
    throw new LessonServiceError(`Lesson ${lessonId} not found`, 404, "LESSON_NOT_FOUND");
  }

  // 2. Check for an active session with this lessonId
  const existingSessions = await db
    .select()
    .from(learningSessions)
    .where(
      and(
        eq(learningSessions.studentId, studentId),
        eq(learningSessions.mode, "lesson"),
        eq(learningSessions.status, "active"),
      ),
    )
    .orderBy(desc(learningSessions.startedAt))
    .limit(5);

  const activeLessonSession = existingSessions.find((s) => {
    const c = s.counters as Record<string, unknown> | null;
    return c?.lessonId === lesson!.lessonId;
  });

  if (activeLessonSession) {
    const counters = (activeLessonSession.counters as Record<string, unknown>) ?? {};
    const currentActivityIndex =
      typeof counters.currentActivityIndex === "number" ? counters.currentActivityIndex : 0;
    const completedActivities = Array.isArray(counters.completedActivities)
      ? (counters.completedActivities as string[])
      : [];
    const activityResponses =
      typeof counters.activityResponses === "object" && counters.activityResponses !== null
        ? (counters.activityResponses as Record<string, unknown>)
        : {};
    const activeBranch = (counters.activeBranch as ActiveBranchState | null) ?? null;
    const assistanceStatus =
      typeof counters.assistanceStatus === "object" && counters.assistanceStatus !== null
        ? (counters.assistanceStatus as Record<string, string>)
        : {};

    const sessionPlan = activeLessonSession.plan as LessonPlan | null;
    const finalLesson =
      sessionPlan && sessionPlan.lessonId === lesson.lessonId ? sessionPlan : lesson;

    const activeActivity = resolveActiveActivity(finalLesson, currentActivityIndex, activeBranch);

    return {
      session: {
        id: activeLessonSession.id,
        studentId: activeLessonSession.studentId,
        status: activeLessonSession.status as "active" | "completed" | "abandoned",
        mode: activeLessonSession.mode,
        stepSeq: activeLessonSession.stepSeq,
      },
      lesson: finalLesson,
      currentActivityIndex,
      activeActivity,
      activeBranch,
      assistanceStatus,
      completedActivities,
      activityResponses,
      isCompleted: activeLessonSession.status === "completed",
    };
  }

  // 3. Create a new lesson session
  const sessionId = generateDomainId("session");
  const initialCounters = {
    lessonId: lesson.lessonId,
    subject: lesson.subject,
    topicId: lesson.topicId,
    currentActivityIndex: 0,
    activeBranch: null as ActiveBranchState | null,
    assistanceStatus: {} as Record<string, string>,
    branchDecisions: [] as Array<Record<string, unknown>>,
    completedActivities: [] as string[],
    activityResponses: {} as Record<string, unknown>,
    startedAt: new Date().toISOString(),
  };

  const topic = getTopicById(lesson.topicId);
  const focusConceptId = (topic?.conceptId as ConceptId) ?? null;

  const createdSession = await studentRepo.createSession({
    id: sessionId,
    mode: "lesson",
    focusConceptId,
    status: "active",
    budgetS: 1200,
    stepSeq: 0,
    counters: initialCounters,
    plan: lesson,
  });

  return {
    session: {
      id: createdSession.id,
      studentId: createdSession.studentId,
      status: createdSession.status as "active" | "completed" | "abandoned",
      mode: createdSession.mode,
      stepSeq: createdSession.stepSeq,
    },
    lesson,
    currentActivityIndex: 0,
    activeActivity: lesson.activities[0],
    activeBranch: null,
    assistanceStatus: {},
    completedActivities: [],
    activityResponses: {},
    isCompleted: false,
  };
}

export async function getLessonSession(
  studentId: string,
  lessonId: string,
  db: DbClient = getDb(),
): Promise<LessonSessionResponse> {
  return startOrResumeLessonSession(studentId, lessonId, db);
}

export async function submitLessonActivityResponse(
  studentId: string,
  lessonId: string,
  activityId: string,
  response: unknown,
  db: DbClient = getDb(),
): Promise<LessonRespondResponse> {
  const studentRepo = createStudentRepo(studentId, db);

  // 1. Locate active session (or completed session for idempotent retries)
  const existingSessions = await db
    .select()
    .from(learningSessions)
    .where(and(eq(learningSessions.studentId, studentId), eq(learningSessions.mode, "lesson")))
    .orderBy(desc(learningSessions.startedAt))
    .limit(5);

  let session = existingSessions.find((s) => {
    const c = s.counters as Record<string, unknown> | null;
    return c?.lessonId === lessonId && s.status === "active";
  });

  if (!session) {
    session = existingSessions.find((s) => {
      const c = s.counters as Record<string, unknown> | null;
      return c?.lessonId === lessonId && s.status === "completed";
    });
  }

  if (!session) {
    throw new LessonServiceError(
      `No active lesson session found for lesson ${lessonId}`,
      404,
      "SESSION_NOT_FOUND",
    );
  }

  const lessonPlan =
    (session.plan as LessonPlan) ?? getLessonById(lessonId) ?? MATHS_FRAC_PART_LESSON;
  const counters = (session.counters as Record<string, unknown>) ?? {};
  const currentActivityIndex =
    typeof counters.currentActivityIndex === "number" ? counters.currentActivityIndex : 0;
  const completedActivities = Array.isArray(counters.completedActivities)
    ? [...(counters.completedActivities as string[])]
    : [];

  // Idempotent retry on an already completed session
  if (session.status === "completed" && completedActivities.includes(activityId)) {
    return {
      activityId,
      accepted: true,
      feedback: "Activity already completed.",
      isCorrect: true,
      nextActivityIndex: currentActivityIndex,
      activeBranch: null,
      isCompleted: true,
      sparksAwarded: 0,
    };
  }
  const activityResponses =
    typeof counters.activityResponses === "object" && counters.activityResponses !== null
      ? { ...(counters.activityResponses as Record<string, unknown>) }
      : {};
  const activeBranch = (counters.activeBranch as ActiveBranchState | null) ?? null;
  const assistanceStatus =
    typeof counters.assistanceStatus === "object" && counters.assistanceStatus !== null
      ? { ...(counters.assistanceStatus as Record<string, string>) }
      : {};
  const branchDecisions = Array.isArray(counters.branchDecisions)
    ? [...(counters.branchDecisions as Array<Record<string, unknown>>)]
    : [];

  // =======================================================================
  // CASE 1: Student is responding within an active adaptive remediation branch
  // =======================================================================
  if (activeBranch) {
    const parentActivity = lessonPlan.activities.find(
      (a) => a.id === activeBranch.parentActivityId,
    );
    if (!parentActivity || !parentActivity.remediation) {
      // Fallback: Clear invalid branch
      counters.activeBranch = null;
    } else {
      const remediation = parentActivity.remediation;

      // Stage 1: Remediation Activity Explored
      if (activeBranch.stage === "remediation_activity") {
        if (activityId !== remediation.remediationActivity.id) {
          throw new LessonServiceError(
            `Activity mismatch in remediation: expected ${remediation.remediationActivity.id}, received ${activityId}`,
            409,
            "ACTIVITY_MISMATCH",
          );
        }

        await studentRepo.recordEvent({
          sessionId: session.id,
          type: "lesson_remediation_activity_explored",
          payload: {
            lessonId,
            parentActivityId: parentActivity.id,
            activityId,
            response,
          },
        });

        const nextBranch: ActiveBranchState = {
          ...activeBranch,
          stage: "followup_check",
        };
        activityResponses[activityId] = response;

        await studentRepo.updateSession(session.id, {
          counters: {
            ...counters,
            activeBranch: nextBranch,
            activityResponses,
            updatedAt: new Date().toISOString(),
          },
        });

        return {
          activityId,
          accepted: true,
          feedback: "Now apply this understanding to a fresh question!",
          activeBranch: nextBranch,
          activeActivity: remediation.followUpCheck,
          nextActivityIndex: currentActivityIndex,
          isCompleted: false,
          sparksAwarded: 0,
        };
      }

      // Stage 2: Fresh Question / Follow-Up Check
      if (activeBranch.stage === "followup_check") {
        if (activityId !== remediation.followUpCheck.id) {
          throw new LessonServiceError(
            `Activity mismatch in follow-up check: expected ${remediation.followUpCheck.id}, received ${activityId}`,
            409,
            "ACTIVITY_MISMATCH",
          );
        }

        const checkConfig = remediation.followUpCheck.config as {
          type: "independent_check";
          correctAnswer: string;
          explanation: string;
          conceptId?: string;
          prompt?: string;
        };

        const submittedAnswer =
          typeof response === "string"
            ? response
            : typeof response === "object" && response !== null && "answer" in response
              ? String((response as { answer: unknown }).answer)
              : typeof response === "object" && response !== null && "choiceId" in response
                ? String((response as { choiceId: unknown }).choiceId)
                : "";

        const isFollowUpCorrect =
          submittedAnswer.trim().toLowerCase() === checkConfig.correctAnswer.trim().toLowerCase();

        const conceptId = (checkConfig.conceptId ??
          getTopicById(lessonPlan.topicId)?.conceptId ??
          "MATH-FRAC-PART") as ConceptId;

        const clientAttemptId =
          (typeof response === "object" && response !== null && "clientAttemptId" in response
            ? String((response as { clientAttemptId: unknown }).clientAttemptId)
            : null) ?? `att_${session.id}_${activityId}`;

        const assessResult = await recordLessonAssessment({
          db,
          studentRepo,
          studentId,
          sessionId: session.id,
          clientAttemptId,
          stepSeq: session.stepSeq,
          lessonPlan,
          activityId,
          templateId: (checkConfig as { templateId?: string }).templateId,
          itemInstanceId: (checkConfig as { itemInstanceId?: string }).itemInstanceId,
          conceptId,
          questionText: checkConfig.prompt ?? remediation.followUpCheck.title,
          submittedAnswer,
          correctAnswer: checkConfig.correctAnswer,
          isCorrect: isFollowUpCorrect,
          assistanceLevel: 1, // Supported learning: check taken immediately following remediation
        });

        await studentRepo.recordEvent({
          sessionId: session.id,
          type: "lesson_remediation_check",
          payload: {
            lessonId,
            parentActivityId: parentActivity.id,
            activityId,
            conceptId,
            submittedAnswer,
            isCorrect: isFollowUpCorrect,
            attemptId: assessResult.attemptId,
          },
        });

        if (isFollowUpCorrect) {
          // Success after remediation
          assistanceStatus[parentActivity.id] = "remediated";
          branchDecisions.push({
            parentActivityId: parentActivity.id,
            stage: "followup_check",
            outcome: "resolved",
            at: new Date().toISOString(),
          });

          if (!completedActivities.includes(parentActivity.id)) {
            completedActivities.push(parentActivity.id);
          }
          completedActivities.push(activityId);
          activityResponses[activityId] = response;

          const parentActivityIndex = lessonPlan.activities.findIndex(
            (a) => a.id === parentActivity.id,
          );
          const isFinalActivity = parentActivityIndex + 1 >= lessonPlan.activities.length;
          const nextActivityIndex = isFinalActivity ? parentActivityIndex : parentActivityIndex + 1;

          let sparksAwarded = 0;
          if (isFinalActivity) {
            const awarded = await studentRepo.awardSparks(session.id, "lesson", 15);
            sparksAwarded = awarded.awarded ? 15 : 0;

            await studentRepo.updateSession(session.id, {
              status: "completed",
              stepSeq: nextActivityIndex,
              endedAt: new Date(),
              counters: {
                ...counters,
                activeBranch: null,
                assistanceStatus,
                branchDecisions,
                currentActivityIndex: nextActivityIndex,
                completedActivities,
                activityResponses,
                completedAt: new Date().toISOString(),
              },
            });
          } else {
            await studentRepo.updateSession(session.id, {
              stepSeq: nextActivityIndex,
              counters: {
                ...counters,
                activeBranch: null,
                assistanceStatus,
                branchDecisions,
                currentActivityIndex: nextActivityIndex,
                completedActivities,
                activityResponses,
                updatedAt: new Date().toISOString(),
              },
            });
          }

          return {
            activityId,
            accepted: true,
            isCorrect: true,
            feedback: checkConfig.explanation,
            activeBranch: null,
            activeActivity: lessonPlan.activities[nextActivityIndex],
            nextActivityIndex,
            isCompleted: isFinalActivity,
            sparksAwarded,
          };
        }

        // Continued Difficulty
        assistanceStatus[parentActivity.id] = "needs_support";
        branchDecisions.push({
          parentActivityId: parentActivity.id,
          stage: "followup_check",
          outcome: "continued_difficulty",
          at: new Date().toISOString(),
        });

        if (remediation.stoppingPoint) {
          const stoppingBranch: ActiveBranchState = {
            ...activeBranch,
            stage: "stopping_point",
          };
          activityResponses[activityId] = response;

          await studentRepo.updateSession(session.id, {
            counters: {
              ...counters,
              activeBranch: stoppingBranch,
              assistanceStatus,
              branchDecisions,
              activityResponses,
              updatedAt: new Date().toISOString(),
            },
          });

          return {
            activityId,
            accepted: true,
            isCorrect: false,
            feedback: "Let's pause to review the core idea together.",
            activeBranch: stoppingBranch,
            activeActivity: remediation.stoppingPoint,
            nextActivityIndex: currentActivityIndex,
            isCompleted: false,
            sparksAwarded: 0,
          };
        }
      }

      // Stage 3: Stopping Point Acknowledged or Saved
      if (activeBranch.stage === "stopping_point") {
        if (activityId !== remediation.stoppingPoint?.id) {
          throw new LessonServiceError(
            `Activity mismatch in stopping point: expected ${remediation.stoppingPoint?.id}, received ${activityId}`,
            409,
            "ACTIVITY_MISMATCH",
          );
        }

        const isSaveAndExit =
          typeof response === "object" &&
          response !== null &&
          Boolean((response as { saveAndExit?: boolean }).saveAndExit);

        await studentRepo.recordEvent({
          sessionId: session.id,
          type: isSaveAndExit
            ? "lesson_stopping_point_saved"
            : "lesson_stopping_point_acknowledged",
          payload: {
            lessonId,
            parentActivityId: parentActivity.id,
            activityId,
            response,
            saveAndExit: isSaveAndExit,
          },
        });

        if (isSaveAndExit) {
          await studentRepo.updateSession(session.id, {
            counters: {
              ...counters,
              stoppingPointSaved: true,
              savedAt: new Date().toISOString(),
              activeBranch,
              activityResponses: {
                ...activityResponses,
                [activityId]: response,
              },
            },
          });

          return {
            activityId,
            accepted: true,
            feedback: "Progress saved. You can take a break and resume anytime!",
            activeBranch,
            activeActivity: remediation.stoppingPoint,
            nextActivityIndex: currentActivityIndex,
            isCompleted: false,
            isSavedAndExited: true,
            sparksAwarded: 0,
          };
        }

        if (!completedActivities.includes(parentActivity.id)) {
          completedActivities.push(parentActivity.id);
        }
        completedActivities.push(activityId);
        activityResponses[activityId] = response;
        assistanceStatus[parentActivity.id] = "needs_support";

        const parentActivityIndex = lessonPlan.activities.findIndex(
          (a) => a.id === parentActivity.id,
        );
        const isFinalActivity = parentActivityIndex + 1 >= lessonPlan.activities.length;
        const nextActivityIndex = isFinalActivity ? parentActivityIndex : parentActivityIndex + 1;

        let sparksAwarded = 0;
        if (isFinalActivity) {
          const awarded = await studentRepo.awardSparks(session.id, "lesson", 15);
          sparksAwarded = awarded.awarded ? 15 : 0;

          await studentRepo.updateSession(session.id, {
            status: "completed",
            stepSeq: nextActivityIndex,
            endedAt: new Date(),
            counters: {
              ...counters,
              activeBranch: null,
              assistanceStatus,
              branchDecisions,
              currentActivityIndex: nextActivityIndex,
              completedActivities,
              activityResponses,
              completedAt: new Date().toISOString(),
            },
          });
        } else {
          await studentRepo.updateSession(session.id, {
            stepSeq: nextActivityIndex,
            counters: {
              ...counters,
              activeBranch: null,
              assistanceStatus,
              branchDecisions,
              currentActivityIndex: nextActivityIndex,
              completedActivities,
              activityResponses,
              updatedAt: new Date().toISOString(),
            },
          });
        }

        return {
          activityId,
          accepted: true,
          feedback: "Thank you for reflecting! Let's continue.",
          activeBranch: null,
          activeActivity: lessonPlan.activities[nextActivityIndex],
          nextActivityIndex,
          isCompleted: isFinalActivity,
          sparksAwarded,
        };
      }
    }
  }

  // =======================================================================
  // CASE 2: Student is responding to a regular linear activity
  // =======================================================================
  const currentActivity = lessonPlan.activities[currentActivityIndex];
  if (!currentActivity || currentActivity.id !== activityId) {
    throw new LessonServiceError(
      `Activity mismatch: expected activity ${currentActivity?.id}, received ${activityId}`,
      409,
      "ACTIVITY_MISMATCH",
    );
  }

  // Evaluate response based on activity type
  let isCorrect = true;
  let feedback = "Activity completed!";

  if (currentActivity.type === "intro") {
    feedback = "Let's explore the concept!";
  } else if (currentActivity.type === "interactive_manipulation") {
    await studentRepo.recordEvent({
      sessionId: session.id,
      type: "lesson_interactive_manipulation",
      payload: {
        lessonId,
        activityId,
        response,
      },
    });
    feedback = "Interactive exploration recorded!";
  } else if (currentActivity.type === "predict_and_observe") {
    const config = currentActivity.config as {
      type: "predict_and_observe";
      predictionChoices: Array<{ id: string; text: string; isExpected?: boolean }>;
      observationReveal: { expectedObservation: string; explanation: string };
    };

    const choiceId =
      typeof response === "string"
        ? response
        : typeof response === "object" && response !== null && "choiceId" in response
          ? (response as { choiceId: string }).choiceId
          : "";

    const selectedChoice = config.predictionChoices.find((c) => c.id === choiceId);
    isCorrect = Boolean(selectedChoice?.isExpected);

    await studentRepo.recordEvent({
      sessionId: session.id,
      type: "lesson_prediction_submitted",
      payload: {
        lessonId,
        activityId,
        choiceId,
        isExpected: isCorrect,
      },
    });

    feedback = config.observationReveal.explanation;
  } else if (currentActivity.type === "guided_practice") {
    const config = currentActivity.config as {
      type: "guided_practice";
      targetCriteria: { property: string; expectedValue: string };
      successFeedback: string;
      retryFeedback: string;
    };

    const submittedVal =
      typeof response === "string"
        ? response
        : typeof response === "object" && response !== null && "value" in response
          ? String((response as { value: unknown }).value)
          : "";

    if (submittedVal === config.targetCriteria.expectedValue) {
      isCorrect = true;
      feedback = config.successFeedback;
    } else {
      isCorrect = false;
      feedback = config.retryFeedback;
    }

    await studentRepo.recordEvent({
      sessionId: session.id,
      type: "lesson_guided_practice",
      payload: {
        lessonId,
        activityId,
        submittedVal,
        isCorrect,
      },
    });
  } else if (currentActivity.type === "independent_check") {
    const config = currentActivity.config as {
      type: "independent_check";
      conceptId?: string;
      correctAnswer: string;
      explanation: string;
      prompt?: string;
    };

    const submittedAnswer =
      typeof response === "string"
        ? response
        : typeof response === "object" && response !== null && "answer" in response
          ? String((response as { answer: unknown }).answer)
          : typeof response === "object" && response !== null && "choiceId" in response
            ? String((response as { choiceId: unknown }).choiceId)
            : "";

    isCorrect = submittedAnswer.trim().toLowerCase() === config.correctAnswer.trim().toLowerCase();
    feedback = config.explanation;

    const conceptId = (config.conceptId ??
      getTopicById(lessonPlan.topicId)?.conceptId ??
      "MATH-FRAC-PART") as ConceptId;

    const clientAttemptId =
      (typeof response === "object" && response !== null && "clientAttemptId" in response
        ? String((response as { clientAttemptId: unknown }).clientAttemptId)
        : null) ?? `att_${session.id}_${activityId}`;

    const assessResult = await recordLessonAssessment({
      db,
      studentRepo,
      studentId,
      sessionId: session.id,
      clientAttemptId,
      stepSeq: session.stepSeq,
      lessonPlan,
      activityId,
      templateId: (config as { templateId?: string }).templateId,
      itemInstanceId: (config as { itemInstanceId?: string }).itemInstanceId,
      seed: (config as { seed?: number }).seed,
      conceptId,
      questionText: config.prompt ?? currentActivity.title,
      submittedAnswer,
      correctAnswer: config.correctAnswer,
      isCorrect,
      assistanceLevel: 0, // Independent assessment
    });

    await studentRepo.recordEvent({
      sessionId: session.id,
      type: "lesson_independent_check",
      payload: {
        lessonId,
        activityId,
        conceptId,
        submittedAnswer,
        isCorrect,
        assistanceLevel: 0,
        attemptId: assessResult.attemptId,
      },
    });
  }

  // Trigger Adaptive Branch if incorrect and remediation is configured
  if (!isCorrect && currentActivity.remediation) {
    const newActiveBranch: ActiveBranchState = {
      parentActivityId: activityId,
      stage: "remediation_activity",
      attemptsCount: 1,
      initialResponse: response,
    };

    assistanceStatus[activityId] = "assisted";
    branchDecisions.push({
      parentActivityId: activityId,
      branchId: currentActivity.remediation.branchId,
      trigger: "incorrect_attempt",
      at: new Date().toISOString(),
    });

    await studentRepo.recordEvent({
      sessionId: session.id,
      type: "lesson_branch_triggered",
      payload: {
        lessonId,
        parentActivityId: activityId,
        branchId: currentActivity.remediation.branchId,
        trigger: "incorrect_attempt",
      },
    });

    activityResponses[activityId] = response;

    await studentRepo.updateSession(session.id, {
      counters: {
        ...counters,
        activeBranch: newActiveBranch,
        assistanceStatus,
        branchDecisions,
        activityResponses,
        updatedAt: new Date().toISOString(),
      },
    });

    return {
      activityId,
      accepted: true,
      isCorrect: false,
      feedback: currentActivity.remediation.targetedExplanation,
      activeBranch: newActiveBranch,
      activeActivity: currentActivity.remediation.remediationActivity,
      nextActivityIndex: currentActivityIndex,
      isCompleted: false,
      sparksAwarded: 0,
    };
  }

  // Advance standard activity progression
  if (!completedActivities.includes(activityId)) {
    completedActivities.push(activityId);
  }
  activityResponses[activityId] = response;
  if (isCorrect) {
    assistanceStatus[activityId] = assistanceStatus[activityId] ?? "independent";
  }

  const isFinalActivity = currentActivityIndex + 1 >= lessonPlan.activities.length;
  const nextActivityIndex = isFinalActivity ? currentActivityIndex : currentActivityIndex + 1;

  let sparksAwarded = 0;
  if (isFinalActivity) {
    const awarded = await studentRepo.awardSparks(session.id, "lesson", 15);
    sparksAwarded = awarded.awarded ? 15 : 0;

    await studentRepo.updateSession(session.id, {
      status: "completed",
      stepSeq: nextActivityIndex,
      endedAt: new Date(),
      counters: {
        ...counters,
        activeBranch: null,
        assistanceStatus,
        branchDecisions,
        currentActivityIndex: nextActivityIndex,
        completedActivities,
        activityResponses,
        completedAt: new Date().toISOString(),
      },
    });
  } else {
    await studentRepo.updateSession(session.id, {
      stepSeq: nextActivityIndex,
      counters: {
        ...counters,
        activeBranch: null,
        assistanceStatus,
        branchDecisions,
        currentActivityIndex: nextActivityIndex,
        completedActivities,
        activityResponses,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  return {
    activityId,
    accepted: true,
    feedback,
    isCorrect,
    nextActivityIndex,
    activeBranch: null,
    activeActivity: lessonPlan.activities[nextActivityIndex],
    isCompleted: isFinalActivity,
    sparksAwarded,
  };
}

export async function getRecommendedNextAction(
  studentId: string,
  subject?: "maths" | "science",
  db: DbClient = getDb(),
): Promise<RecommendedNextAction> {
  const studentRepo = createStudentRepo(studentId, db);
  const beliefs = await studentRepo.getConceptBeliefs();
  const beliefMap = new Map(beliefs.map((b) => [b.conceptId, b]));

  // Find active lesson sessions
  const activeSessions = await db
    .select()
    .from(learningSessions)
    .where(
      and(
        eq(learningSessions.studentId, studentId),
        eq(learningSessions.mode, "lesson"),
        eq(learningSessions.status, "active"),
      ),
    )
    .orderBy(desc(learningSessions.startedAt));

  // Determine candidate topics based on subject filter
  const candidateTopics = subject
    ? CURRICULUM_TOPICS.filter((t) => t.subject === subject)
    : CURRICULUM_TOPICS;

  // RULE 1: Check for stopping point saved or concept belief 'needs_support'
  // (Revisit an unresolved objective)
  for (const topic of candidateTopics) {
    if (!topic.conceptId) continue;
    const belief = beliefMap.get(topic.conceptId);
    const session = activeSessions.find((s) => {
      const c = s.counters as Record<string, unknown> | null;
      return c?.topicId === topic.id || c?.lessonId === topic.defaultLessonId;
    });
    const counters = (session?.counters as Record<string, unknown>) ?? {};
    const hasStoppingPoint =
      Boolean(counters.stoppingPointSaved) ||
      (counters.activeBranch as ActiveBranchState | null)?.stage === "stopping_point";

    if (hasStoppingPoint || belief?.status === "needs_support") {
      return {
        actionType: "revisit_unresolved",
        title: `Revisit: ${topic.studentTitle}`,
        description: `You hit a tricky spot earlier. Let's revisit this objective together with step-by-step guidance.`,
        objectiveId: topic.conceptId as ConceptId,
        objectiveTitle: topic.studentTitle,
        subject: topic.subject,
        lessonId: topic.defaultLessonId,
        ctaLabel: "Revisit Objective",
        reasonCode: hasStoppingPoint ? "SAVED_AT_STOPPING_POINT" : "STATUS_NEEDS_SUPPORT",
      };
    }
  }

  // RULE 2: Check for supported learning / assisted check without independent mastery
  // (Attempt a fresh independent check)
  for (const topic of candidateTopics) {
    if (!topic.conceptId) continue;
    const belief = beliefMap.get(topic.conceptId);
    const session = activeSessions.find((s) => {
      const c = s.counters as Record<string, unknown> | null;
      return c?.topicId === topic.id || c?.lessonId === topic.defaultLessonId;
    });
    const counters = (session?.counters as Record<string, unknown>) ?? {};
    const assistanceStatus = (counters.assistanceStatus as Record<string, string>) ?? {};
    const hadAssistance = Object.values(assistanceStatus).some(
      (st) => st === "remediated" || st === "assisted",
    );

    const isMastered = belief?.status === "demonstrated" || belief?.status === "retained";
    if (
      !isMastered &&
      (hadAssistance ||
        (belief && (belief.independentN ?? 0) > 0 && belief.status !== "demonstrated"))
    ) {
      const targetLessonId =
        topic.conceptId === "SCI-ELEC-CIRCUITS"
          ? "lesson-sci-circuits-mastery"
          : topic.defaultLessonId;

      return {
        actionType: "fresh_check",
        title: `Fresh Check: ${topic.studentTitle}`,
        description: `You practiced earlier! Ready to prove your understanding with an independent check?`,
        objectiveId: topic.conceptId as ConceptId,
        objectiveTitle: topic.studentTitle,
        subject: topic.subject,
        lessonId: targetLessonId,
        ctaLabel: "Take Independent Check",
        reasonCode: "ASSISTED_PRACTICE_NEEDS_FRESH_CHECK",
      };
    }
  }

  // RULE 3: Check for demonstrated / retained concepts
  // (Continue to the next eligible objective)
  for (let i = 0; i < candidateTopics.length; i++) {
    const topic = candidateTopics[i]!;
    if (!topic.conceptId) continue;
    const belief = beliefMap.get(topic.conceptId);
    const isMastered = belief?.status === "demonstrated" || belief?.status === "retained";

    if (isMastered) {
      // Find the next topic in the same subject
      const nextTopic = candidateTopics.slice(i + 1).find((t) => t.subject === topic.subject);
      if (nextTopic && nextTopic.conceptId) {
        return {
          actionType: "continue_next_objective",
          title: `Next Objective: ${nextTopic.studentTitle}`,
          description: `You demonstrated understanding of ${topic.studentTitle}! Continue to ${nextTopic.studentTitle}.`,
          objectiveId: nextTopic.conceptId as ConceptId,
          objectiveTitle: nextTopic.studentTitle,
          subject: nextTopic.subject,
          lessonId: nextTopic.defaultLessonId,
          ctaLabel: "Start Next Objective",
          reasonCode: "CURRENT_OBJECTIVE_MASTERED",
        };
      }
    }
  }

  // RULE 4: Default start objective
  const firstTopic = candidateTopics[0] ?? CURRICULUM_TOPICS[0]!;
  return {
    actionType: "start_objective",
    title: `Start: ${firstTopic.studentTitle}`,
    description: firstTopic.description,
    objectiveId: (firstTopic.conceptId ?? "MATH-FRAC-PART") as ConceptId,
    objectiveTitle: firstTopic.studentTitle,
    subject: firstTopic.subject,
    lessonId: firstTopic.defaultLessonId,
    ctaLabel: "Start Learning",
    reasonCode: "DEFAULT_START",
  };
}
