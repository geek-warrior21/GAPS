import { type LessonPlan, LessonPlanSchema } from "@gaps/contracts";
import {
  getDefaultLessonForTopic,
  getLessonById,
  MATHS_FRAC_PART_LESSON,
  SCI_CIRCUITS_LESSON,
} from "@gaps/content";
import { getLlmProvider, isAiRuntimeEnabled } from "@gaps/ai";
import { log } from "../log";

export interface LessonPlanningContext {
  subject: "maths" | "science";
  topicId: string;
  level: number;
  studentId?: string;
  lessonId?: string;
}

export interface LessonPlanner {
  planLesson(context: LessonPlanningContext): Promise<LessonPlan>;
}

export class AuthoredLessonPlanner implements LessonPlanner {
  async planLesson(context: LessonPlanningContext): Promise<LessonPlan> {
    // 1. Try direct lesson ID lookup if provided
    if (context.lessonId) {
      const lesson = getLessonById(context.lessonId);
      if (lesson) return lesson;
    }

    // 2. Try default lesson for topic
    const topicLesson = getDefaultLessonForTopic(context.topicId);
    if (topicLesson) return topicLesson;

    // 3. Robust fallback to primary authored lesson based on subject
    log.warn("lesson.planner.fallback_to_subject_default", {
      subject: context.subject,
      topicId: context.topicId,
    });

    if (context.subject === "science") {
      return SCI_CIRCUITS_LESSON;
    }
    return MATHS_FRAC_PART_LESSON;
  }
}

export class LlmLessonPlanner implements LessonPlanner {
  constructor(private readonly fallbackPlanner: LessonPlanner = new AuthoredLessonPlanner()) {}

  async planLesson(context: LessonPlanningContext): Promise<LessonPlan> {
    // If AI runtime is disabled or provider is disabled, immediately use authored fallback
    if (!isAiRuntimeEnabled()) {
      return this.fallbackPlanner.planLesson(context);
    }

    try {
      const provider = getLlmProvider();
      if (!provider || provider.name === "disabled") {
        return this.fallbackPlanner.planLesson(context);
      }

      const prompt = `You are a curriculum designer for Class 6-8 students.
Generate a structured, interactive lesson plan for:
Subject: ${context.subject}
Level: Class ${context.level}
Topic ID: ${context.topicId}

The lesson plan MUST adhere strictly to the JSON schema:
- version: "1.0"
- at least 2 activities
- activities can include: intro, interactive_manipulation, predict_and_observe, guided_practice, independent_check.
`;

      const result = await provider.generate<LessonPlan>({
        purpose: "tutor",
        system: "You generate version 1.0 JSON lesson plans for middle school students.",
        input: prompt,
        schema: LessonPlanSchema,
        maxOutputTokens: 2000,
        timeoutMs: 10000,
      });

      if (!result.ok || !result.value) {
        log.warn("lesson.planner.llm_generation_failed", {
          reason: !result.ok ? result.reason : "unknown",
        });
        return this.fallbackPlanner.planLesson(context);
      }

      // Strictly validate with Zod
      const validated = LessonPlanSchema.safeParse(result.value);
      if (!validated.success) {
        log.warn("lesson.planner.llm_validation_failed", { errors: validated.error.issues });
        return this.fallbackPlanner.planLesson(context);
      }

      return validated.data;
    } catch (err) {
      log.error("lesson.planner.llm_exception", {
        error: err instanceof Error ? err.message : String(err),
      });
      return this.fallbackPlanner.planLesson(context);
    }
  }
}

let activePlanner: LessonPlanner = new AuthoredLessonPlanner();

export function setLessonPlanner(planner: LessonPlanner): void {
  activePlanner = planner;
}

export function getLessonPlanner(): LessonPlanner {
  return activePlanner;
}
