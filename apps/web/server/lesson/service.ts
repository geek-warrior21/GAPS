import { type DbClient, getDb, learningSessions, createStudentRepo } from "@gaps/db";
import { and, desc, eq } from "drizzle-orm";
import {
  type CurriculumTopicsResponse,
  type LessonPlan,
  type LessonSessionResponse,
  type LessonRespondResponse,
  LessonPlanSchema,
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
    this.statusCode = statusCode;
    this.code = code;
  }
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

  // 1. Resolve lesson definition (with graceful fallback if invalid)
  let lesson: LessonPlan | undefined = getLessonById(lessonId);
  if (!lesson) {
    const planner = getLessonPlanner();
    lesson = await planner.planLesson({
      subject: lessonId.includes("sci") ? "science" : "maths",
      topicId: lessonId.includes("sci") ? "sci-elec-circuits" : "maths-frac-part",
      level: 6,
      studentId,
      lessonId,
    });
  }

  // Double check validity with Zod
  const validated = LessonPlanSchema.safeParse(lesson);
  if (!validated.success) {
    log.warn("lesson.service.invalid_lesson_fallback", { lessonId });
    lesson = MATHS_FRAC_PART_LESSON;
  } else {
    lesson = validated.data;
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

    const sessionPlan = activeLessonSession.plan as LessonPlan | null;
    const finalLesson =
      sessionPlan && sessionPlan.lessonId === lesson.lessonId ? sessionPlan : lesson;

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

  // 1. Locate active session for student and lesson
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

  const currentActivity = lessonPlan.activities[currentActivityIndex];
  if (!currentActivity || currentActivity.id !== activityId) {
    throw new LessonServiceError(
      `Activity mismatch: expected activity ${currentActivity?.id}, received ${activityId}`,
      409,
      "ACTIVITY_MISMATCH",
    );
  }

  // 2. Evaluate response based on activity type
  let isCorrect = true;
  let feedback = "Activity completed!";

  if (currentActivity.type === "intro") {
    feedback = "Let's explore the concept!";
  } else if (currentActivity.type === "interactive_manipulation") {
    // Invariant §3 & Rule F.1: Participation is not mastery!
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

    // Record assessment event
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

  // 3. Advance activity progression
  if (!completedActivities.includes(activityId)) {
    completedActivities.push(activityId);
  }
  activityResponses[activityId] = response;

  const isFinalActivity = currentActivityIndex + 1 >= lessonPlan.activities.length;
  const nextActivityIndex = isFinalActivity ? currentActivityIndex : currentActivityIndex + 1;

  let sparksAwarded = 0;
  if (isFinalActivity) {
    // Award +15 sparks for completing the lesson session idempotently
    const awarded = await studentRepo.awardSparks(session.id, "lesson", 15);
    sparksAwarded = awarded.awarded ? 15 : 0;

    await studentRepo.updateSession(session.id, {
      status: "completed",
      stepSeq: nextActivityIndex,
      endedAt: new Date(),
      counters: {
        ...counters,
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
    isCompleted: isFinalActivity,
    sparksAwarded,
  };
}
