import {
  type LessonPlan,
  LessonPlanSchema,
  type LessonPlanGenerateResponse,
  type SyntheticLearnerProfile,
} from "@gaps/contracts";
import {
  getDefaultLessonForTopic,
  getLessonById,
  MATHS_FRAC_PART_LESSON,
  SCI_CIRCUITS_LESSON,
} from "@gaps/content";
import { getLlmProvider, isAiRuntimeEnabled } from "@gaps/ai";
import { log } from "../log";
import {
  OBJECTIVE_SOURCE_PACKS,
  buildPlannerPrompt,
  type ObjectiveSourcePack,
} from "./planner-source-pack";
import { validateLessonPlan } from "./planner-validator";
import {
  FIXTURE_MATHS_CHALLENGE,
  FIXTURE_MATHS_STRUGGLING_REV,
  FIXTURE_SCIENCE_CHALLENGE,
  FIXTURE_SCIENCE_STRUGGLING_AIRGAP,
} from "./planner-fixtures";

export interface LessonPlanningContext {
  subject: "maths" | "science";
  topicId: string;
  level: number;
  objectiveId?: string;
  learnerProfile?: SyntheticLearnerProfile;
  studentId?: string;
  lessonId?: string;
}

export interface LessonPlanner {
  planLesson(context: LessonPlanningContext): Promise<LessonPlan>;
  planLessonWithDetails?(context: LessonPlanningContext): Promise<LessonPlanGenerateResponse>;
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

  async planLessonWithDetails(context: LessonPlanningContext): Promise<LessonPlanGenerateResponse> {
    const t0 = performance.now();
    const plan = await this.planLesson(context);
    const latencyMs = Math.round(performance.now() - t0);

    const validation = validateLessonPlan(
      plan,
      context.objectiveId ?? plan.topicId,
      context.learnerProfile,
    );

    return {
      plan,
      isFallback: true,
      fallbackReason: "AUTHORED_CURRICULUM_BASELINE",
      metadata: {
        model: "authored-curriculum-v1",
        version: "1.0",
        latencyMs,
        validation: validation.outcome,
        learnerProfileUsed: {
          profileType: context.learnerProfile?.profileType ?? "new_learner",
          namedMisconception: context.learnerProfile?.namedMisconception,
        },
      },
    };
  }
}

export class LlmLessonPlanner implements LessonPlanner {
  constructor(private readonly fallbackPlanner: LessonPlanner = new AuthoredLessonPlanner()) {}

  async planLesson(context: LessonPlanningContext): Promise<LessonPlan> {
    const res = await this.planLessonWithDetails(context);
    return res.plan;
  }

  async planLessonWithDetails(context: LessonPlanningContext): Promise<LessonPlanGenerateResponse> {
    const t0 = performance.now();
    const effectiveObjectiveId =
      context.objectiveId ??
      (context.subject === "science" ? "SCI-ELEC-CIRCUITS" : "MATH-FRAC-PART");

    const sourcePack: ObjectiveSourcePack =
      OBJECTIVE_SOURCE_PACKS[effectiveObjectiveId] ??
      (context.subject === "science"
        ? OBJECTIVE_SOURCE_PACKS["SCI-ELEC-CIRCUITS"]!
        : OBJECTIVE_SOURCE_PACKS["MATH-FRAC-PART"]!);

    const learnerProfile: SyntheticLearnerProfile = context.learnerProfile ?? {
      profileType: "new_learner",
      priorMastery: "not_started",
    };

    // If AI runtime is disabled or provider is disabled, use fallback with audit
    if (!isAiRuntimeEnabled()) {
      const fallbackPlan = await this.getProfileAwareFallbackPlan(
        context,
        effectiveObjectiveId,
        learnerProfile,
      );
      const latencyMs = Math.round(performance.now() - t0);
      const validation = validateLessonPlan(fallbackPlan, effectiveObjectiveId, learnerProfile);

      return {
        plan: fallbackPlan,
        isFallback: true,
        fallbackReason: "LLM_PROVIDER_DISABLED",
        metadata: {
          model: "authored-fallback-v1",
          version: "1.0",
          latencyMs,
          validation: validation.outcome,
          learnerProfileUsed: {
            profileType: learnerProfile.profileType,
            namedMisconception: learnerProfile.namedMisconception,
          },
        },
      };
    }

    try {
      const provider = getLlmProvider();
      if (!provider || provider.name === "disabled") {
        const fallbackPlan = await this.getProfileAwareFallbackPlan(
          context,
          effectiveObjectiveId,
          learnerProfile,
        );
        const latencyMs = Math.round(performance.now() - t0);
        const validation = validateLessonPlan(fallbackPlan, effectiveObjectiveId, learnerProfile);

        return {
          plan: fallbackPlan,
          isFallback: true,
          fallbackReason: "LLM_PROVIDER_DISABLED",
          metadata: {
            model: "authored-fallback-v1",
            version: "1.0",
            latencyMs,
            validation: validation.outcome,
            learnerProfileUsed: {
              profileType: learnerProfile.profileType,
              namedMisconception: learnerProfile.namedMisconception,
            },
          },
        };
      }

      // If Mock provider: serve high-fidelity synthetic profile fixtures
      if (provider.name === "mock") {
        const fixturePlan = this.selectMockFixture(effectiveObjectiveId, learnerProfile);
        const latencyMs = Math.round(performance.now() - t0);
        const validation = validateLessonPlan(fixturePlan, effectiveObjectiveId, learnerProfile);

        return {
          plan: fixturePlan,
          isFallback: false,
          metadata: {
            model: "mock-curriculum-planner-v1",
            version: "1.0",
            latencyMs,
            validation: validation.outcome,
            learnerProfileUsed: {
              profileType: learnerProfile.profileType,
              namedMisconception: learnerProfile.namedMisconception,
            },
          },
        };
      }

      // Live LLM Provider (e.g. OpenAI)
      const prompt = buildPlannerPrompt({
        sourcePack,
        learnerProfile,
      });

      const result = await provider.generate<LessonPlan>({
        purpose: "tutor",
        system:
          "You are an expert middle school curriculum designer. Output strictly valid JSON conforming to the version 1.0 LessonPlan schema.",
        input: prompt,
        schema: LessonPlanSchema,
        maxOutputTokens: 2500,
        timeoutMs: 12000,
      });

      const latencyMs = Math.round(performance.now() - t0);

      if (!result.ok || !result.value) {
        log.warn("lesson.planner.llm_generation_failed", {
          reason: !result.ok ? result.reason : "unknown",
        });
        const fallbackPlan = await this.getProfileAwareFallbackPlan(
          context,
          effectiveObjectiveId,
          learnerProfile,
        );
        const validation = validateLessonPlan(fallbackPlan, effectiveObjectiveId, learnerProfile);

        return {
          plan: fallbackPlan,
          isFallback: true,
          fallbackReason: `LLM_GENERATION_FAILED_${!result.ok ? result.reason.toUpperCase() : "UNKNOWN"}`,
          metadata: {
            model: "gpt-4o-mini-fallback",
            version: "1.0",
            latencyMs,
            validation: validation.outcome,
            learnerProfileUsed: {
              profileType: learnerProfile.profileType,
              namedMisconception: learnerProfile.namedMisconception,
            },
          },
        };
      }

      // Multi-Stage Semantic & Factual Validation
      const validation = validateLessonPlan(result.value, effectiveObjectiveId, learnerProfile);

      if (validation.outcome.status !== "passed" || !validation.validatedPlan) {
        log.warn("lesson.planner.factual_validation_failed", {
          issues: validation.outcome.issues,
        });

        const fallbackPlan = await this.getProfileAwareFallbackPlan(
          context,
          effectiveObjectiveId,
          learnerProfile,
        );
        return {
          plan: fallbackPlan,
          isFallback: true,
          fallbackReason: `VALIDATION_FAILED: ${validation.outcome.issues[0] ?? "Semantic criteria not met"}`,
          metadata: {
            model: "gpt-4o-mini",
            version: "1.0",
            latencyMs,
            validation: validation.outcome,
            learnerProfileUsed: {
              profileType: learnerProfile.profileType,
              namedMisconception: learnerProfile.namedMisconception,
            },
          },
        };
      }

      return {
        plan: validation.validatedPlan,
        isFallback: false,
        metadata: {
          model: "gpt-4o-mini",
          version: "1.0",
          latencyMs,
          validation: validation.outcome,
          learnerProfileUsed: {
            profileType: learnerProfile.profileType,
            namedMisconception: learnerProfile.namedMisconception,
          },
        },
      };
    } catch (err) {
      log.error("lesson.planner.llm_exception", {
        error: err instanceof Error ? err.message : String(err),
      });

      const latencyMs = Math.round(performance.now() - t0);
      const fallbackPlan = await this.getProfileAwareFallbackPlan(
        context,
        effectiveObjectiveId,
        learnerProfile,
      );
      const validation = validateLessonPlan(fallbackPlan, effectiveObjectiveId, learnerProfile);

      return {
        plan: fallbackPlan,
        isFallback: true,
        fallbackReason: `EXCEPTION: ${err instanceof Error ? err.message : "Unknown error"}`,
        metadata: {
          model: "authored-fallback-v1",
          version: "1.0",
          latencyMs,
          validation: validation.outcome,
          learnerProfileUsed: {
            profileType: learnerProfile.profileType,
            namedMisconception: learnerProfile.namedMisconception,
          },
        },
      };
    }
  }

  private selectMockFixture(
    objectiveId: string,
    learnerProfile: SyntheticLearnerProfile,
  ): LessonPlan {
    if (objectiveId === "MATH-FRAC-PART") {
      if (learnerProfile.profileType === "struggling") {
        return FIXTURE_MATHS_STRUGGLING_REV;
      }
      if (learnerProfile.profileType === "ready_for_challenge") {
        return FIXTURE_MATHS_CHALLENGE;
      }
      return MATHS_FRAC_PART_LESSON;
    }

    if (objectiveId === "SCI-ELEC-CIRCUITS") {
      if (learnerProfile.profileType === "struggling") {
        return FIXTURE_SCIENCE_STRUGGLING_AIRGAP;
      }
      if (learnerProfile.profileType === "ready_for_challenge") {
        return FIXTURE_SCIENCE_CHALLENGE;
      }
      return SCI_CIRCUITS_LESSON;
    }

    return MATHS_FRAC_PART_LESSON;
  }

  private async getProfileAwareFallbackPlan(
    context: LessonPlanningContext,
    objectiveId: string,
    learnerProfile: SyntheticLearnerProfile,
  ): Promise<LessonPlan> {
    // If a profile-specific fixture exists, use it even in fallback mode for developer preview richness
    if (learnerProfile.profileType !== "new_learner") {
      return this.selectMockFixture(objectiveId, learnerProfile);
    }
    return this.fallbackPlanner.planLesson(context);
  }
}

let activePlanner: LessonPlanner = new LlmLessonPlanner();

export function setLessonPlanner(planner: LessonPlanner): void {
  activePlanner = planner;
}

export function getLessonPlanner(): LessonPlanner {
  return activePlanner;
}
