import { type DbClient, getDb, learningSessions, createStudentRepo } from "@gaps/db";
import { and, desc, eq } from "drizzle-orm";
import {
  type CurriculumTopicsResponse,
  type LessonPlan,
  type LessonSessionResponse,
  type LessonRespondResponse,
  type LessonActivity,
  type ActiveBranchState,
} from "@gaps/contracts";
import { getAllCurriculumTopics, getLessonById, MATHS_FRAC_PART_LESSON } from "@gaps/content";
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

  const createdSession = await studentRepo.createSession({
    id: sessionId,
    mode: "lesson",
    focusConceptId: null,
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

  // 1. Locate active session
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

  const session = existingSessions.find((s) => {
    const c = s.counters as Record<string, unknown> | null;
    return c?.lessonId === lessonId;
  });

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

        await studentRepo.recordEvent({
          sessionId: session.id,
          type: "lesson_remediation_check",
          payload: {
            lessonId,
            parentActivityId: parentActivity.id,
            activityId,
            conceptId: checkConfig.conceptId,
            submittedAnswer,
            isCorrect: isFollowUpCorrect,
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

      // Stage 3: Stopping Point Acknowledged
      if (activeBranch.stage === "stopping_point") {
        if (activityId !== remediation.stoppingPoint?.id) {
          throw new LessonServiceError(
            `Activity mismatch in stopping point: expected ${remediation.stoppingPoint?.id}, received ${activityId}`,
            409,
            "ACTIVITY_MISMATCH",
          );
        }

        await studentRepo.recordEvent({
          sessionId: session.id,
          type: "lesson_stopping_point_acknowledged",
          payload: {
            lessonId,
            parentActivityId: parentActivity.id,
            activityId,
            response,
          },
        });

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
    };

    const submittedAnswer =
      typeof response === "string"
        ? response
        : typeof response === "object" && response !== null && "answer" in response
          ? String((response as { answer: unknown }).answer)
          : "";

    isCorrect = submittedAnswer === config.correctAnswer;
    feedback = config.explanation;

    await studentRepo.recordEvent({
      sessionId: session.id,
      type: "lesson_independent_check",
      payload: {
        lessonId,
        activityId,
        conceptId: config.conceptId,
        submittedAnswer,
        isCorrect,
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
