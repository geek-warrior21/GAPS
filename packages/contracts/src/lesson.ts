import { z } from "zod";

export const SubjectIdSchema = z.enum(["maths", "science"]);
export type SubjectId = z.infer<typeof SubjectIdSchema>;

export const TopicIdSchema = z.string().min(1);

export const CurriculumTopicSchema = z.object({
  id: z.string(),
  subject: SubjectIdSchema,
  level: z.number().int().min(1).max(12),
  title: z.string(),
  studentTitle: z.string(),
  description: z.string(),
  defaultLessonId: z.string(),
  conceptId: z.string().optional(),
  strand: z.string().optional(),
  /** Lesson a learner enters from Learn: their lesson in progress, else the primary lesson. */
  entryLessonId: z.string().optional(),
  /** True when entryLessonId resumes a lesson the learner already started. */
  entryIsResume: z.boolean().optional(),
  /** False when the lesson's content may not be served in this environment. */
  lessonAvailable: z.boolean().optional(),
});
export type CurriculumTopic = z.infer<typeof CurriculumTopicSchema>;

export const CurriculumTopicsResponseSchema = z.object({
  topics: z.array(CurriculumTopicSchema),
  /** True when a learner may enter a topic in their own words here. */
  openTopicEntry: z.boolean().optional(),
});
export type CurriculumTopicsResponse = z.infer<typeof CurriculumTopicsResponseSchema>;

export const LessonActivityTypeSchema = z.enum([
  "intro",
  "interactive_manipulation",
  "predict_and_observe",
  "guided_practice",
  "independent_check",
  "stopping_point",
]);
export type LessonActivityType = z.infer<typeof LessonActivityTypeSchema>;

export const FractionStripSimulationSchema = z.object({
  simulationKind: z.literal("fraction_strip"),
  initialParts: z.number().int().min(1).max(16).default(4),
  initialShaded: z.number().int().min(0).max(16).default(1),
  allowChangeParts: z.boolean().default(true),
  allowChangeShaded: z.boolean().default(true),
  minParts: z.number().int().min(1).default(1),
  maxParts: z.number().int().max(16).default(12),
  targetFraction: z.object({ n: z.number(), d: z.number() }).optional(),
  instruction: z.string(),
});
export type FractionStripSimulation = z.infer<typeof FractionStripSimulationSchema>;

export const CircuitSimulationSchema = z.object({
  simulationKind: z.literal("circuit_loop"),
  initialSwitchState: z.enum(["open", "closed"]).default("open"),
  initialWireConnected: z.boolean().default(true),
  hasBattery: z.boolean().default(true),
  hasBulb: z.boolean().default(true),
  conductiveObject: z.enum(["none", "copper_key", "rubber_eraser"]).default("none"),
  instruction: z.string(),
});
export type CircuitSimulation = z.infer<typeof CircuitSimulationSchema>;

export const SimulationConfigSchema = z.discriminatedUnion("simulationKind", [
  FractionStripSimulationSchema,
  CircuitSimulationSchema,
]);
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;

export const IntroConfigSchema = z.object({
  type: z.literal("intro"),
  headline: z.string(),
  body: z.string(),
  hookQuestion: z.string().optional(),
  imageUrl: z.string().optional(),
});
export type IntroConfig = z.infer<typeof IntroConfigSchema>;

export const InteractiveManipulationConfigSchema = z.object({
  type: z.literal("interactive_manipulation"),
  simulation: SimulationConfigSchema,
});
export type InteractiveManipulationConfig = z.infer<typeof InteractiveManipulationConfigSchema>;

export const PredictAndObserveConfigSchema = z.object({
  type: z.literal("predict_and_observe"),
  prompt: z.string(),
  predictionChoices: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      isExpected: z.boolean().optional(),
    }),
  ),
  /**
   * Optional: without a simulation the learner predicts, then reads the
   * explanation. Used for topics that have no tested simulation.
   */
  simulation: SimulationConfigSchema.optional(),
  observationReveal: z.object({
    expectedObservation: z.string(),
    explanation: z.string(),
  }),
});
export type PredictAndObserveConfig = z.infer<typeof PredictAndObserveConfigSchema>;

export const GuidedPracticeConfigSchema = z.object({
  type: z.literal("guided_practice"),
  prompt: z.string(),
  simulation: SimulationConfigSchema.optional(),
  targetCriteria: z.object({
    property: z.string(),
    expectedValue: z.string(),
  }),
  successFeedback: z.string(),
  retryFeedback: z.string(),
});
export type GuidedPracticeConfig = z.infer<typeof GuidedPracticeConfigSchema>;

export const IndependentCheckConfigSchema = z.object({
  type: z.literal("independent_check"),
  conceptId: z.string().optional(),
  templateId: z.string().optional(),
  itemInstanceId: z.string().optional(),
  seed: z.number().int().positive().optional(),
  prompt: z.string(),
  questionType: z.enum(["choice", "number", "fraction"]),
  choices: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  correctAnswer: z.string(),
  explanation: z.string(),
  /**
   * Set by the server on student-facing copies of an activity. The answer and
   * explanation are blanked and the response is graded on the server, so the
   * correct answer never reaches the client before the item is resolved.
   */
  serverGraded: z.boolean().optional(),
});
export type IndependentCheckConfig = z.infer<typeof IndependentCheckConfigSchema>;

export const StoppingPointConfigSchema = z.object({
  type: z.literal("stopping_point"),
  headline: z.string(),
  body: z.string(),
  recommendation: z.string(),
  keyTakeaways: z.array(z.string()).optional(),
});
export type StoppingPointConfig = z.infer<typeof StoppingPointConfigSchema>;

export const LessonActivityConfigSchema = z.discriminatedUnion("type", [
  IntroConfigSchema,
  InteractiveManipulationConfigSchema,
  PredictAndObserveConfigSchema,
  GuidedPracticeConfigSchema,
  IndependentCheckConfigSchema,
  StoppingPointConfigSchema,
]);
export type LessonActivityConfig = z.infer<typeof LessonActivityConfigSchema>;

export interface LessonActivity {
  id: string;
  type: LessonActivityType;
  title: string;
  instructions: string;
  config: LessonActivityConfig;
  remediation?: RemediationBranch;
}

export interface RemediationBranch {
  branchId: string;
  triggerCondition?: "incorrect_prediction" | "incorrect_check" | "any_incorrect";
  targetedExplanation: string;
  remediationActivity: LessonActivity;
  followUpCheck: LessonActivity;
  stoppingPoint?: LessonActivity;
}

export const RemediationBranchSchema: z.ZodType<RemediationBranch> = z.lazy(() =>
  z.object({
    branchId: z.string(),
    triggerCondition: z
      .enum(["incorrect_prediction", "incorrect_check", "any_incorrect"])
      .default("any_incorrect")
      .optional(),
    targetedExplanation: z.string(),
    remediationActivity: LessonActivitySchema,
    followUpCheck: LessonActivitySchema,
    stoppingPoint: LessonActivitySchema.optional(),
  }),
);

export const LessonActivitySchema: z.ZodType<LessonActivity> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: LessonActivityTypeSchema,
    title: z.string(),
    instructions: z.string(),
    config: LessonActivityConfigSchema,
    remediation: RemediationBranchSchema.optional(),
  }),
);

/**
 * Review record carried by lesson content (lessons, assessment items, authored
 * teaching activities). Absent review metadata is treated as "draft".
 * A "reviewed" record must name the reviewer and the review time.
 */
export const ContentReviewSchema = z
  .object({
    status: z.enum(["draft", "reviewed", "retired"]),
    /** Version of the content this record describes. Bump on any content change. */
    version: z.number().int().positive(),
    /** Who or what produced the content, e.g. "ai-drafted:gem". */
    authoredBy: z.string().min(1),
    /** Named educator who reviewed this exact version. */
    reviewedBy: z.string().min(1).optional(),
    /** ISO timestamp of that review. */
    reviewedAt: z.string().datetime().optional(),
    notes: z.string().optional(),
  })
  .superRefine((review, ctx) => {
    if (review.status === "reviewed" && (!review.reviewedBy || !review.reviewedAt)) {
      ctx.addIssue({
        code: "custom",
        message: "reviewed content must record reviewedBy and reviewedAt",
      });
    }
    if (review.status === "draft" && (review.reviewedBy || review.reviewedAt)) {
      ctx.addIssue({
        code: "custom",
        message: "draft content must not carry reviewer details",
      });
    }
  });
export type ContentReview = z.infer<typeof ContentReviewSchema>;

export const LessonPlanSchema = z.object({
  lessonId: z.string(),
  version: z.literal("1.0"),
  subject: SubjectIdSchema,
  level: z.number().int().min(1).max(12),
  topicId: z.string(),
  title: z.string(),
  description: z.string(),
  learningObjectives: z.array(z.string()),
  activities: z.array(LessonActivitySchema).min(2),
  /** Covers the whole plan, including its embedded checks and remediation. */
  review: ContentReviewSchema.optional(),
});
export type LessonPlan = z.infer<typeof LessonPlanSchema>;

export const ActiveBranchStageSchema = z.enum([
  "remediation_activity",
  "followup_check",
  "stopping_point",
]);
export type ActiveBranchStage = z.infer<typeof ActiveBranchStageSchema>;

export const ActiveBranchStateSchema = z.object({
  parentActivityId: z.string(),
  stage: ActiveBranchStageSchema,
  attemptsCount: z.number().int().nonnegative(),
  initialResponse: z.unknown().optional(),
});
export type ActiveBranchState = z.infer<typeof ActiveBranchStateSchema>;

/**
 * Progress summary for a lesson whose steps are chosen one at a time by the
 * teaching decision engine. Contains no assessment answers or decision evidence.
 */
export const AdaptiveLessonProgressSchema = z.object({
  objectiveId: z.string(),
  stepNumber: z.number().int().positive(),
  isClosingStep: z.boolean(),
  isPaused: z.boolean(),
  /**
   * True when the learner's last response is saved but the next step could not
   * be prepared (provider unavailable). The learner can retry or come back later.
   */
  awaitingNextStep: z.boolean().optional(),
});
export type AdaptiveLessonProgress = z.infer<typeof AdaptiveLessonProgressSchema>;

/**
 * Where a lesson's content comes from. These are kept apart on purpose:
 *  - reviewed: authored content reviewed by a named educator.
 *  - authored_draft: authored content awaiting educator review.
 *  - source_grounded: generated by a model from the listed approved sources.
 *    Grounding is not review.
 *  - model_knowledge: generated from the model's own knowledge, with no source.
 * Generated content is always a preview and its feedback is practice only.
 */
export const ContentBasisSchema = z.enum([
  "reviewed",
  "authored_draft",
  "source_grounded",
  "model_knowledge",
]);
export type ContentBasis = z.infer<typeof ContentBasisSchema>;

export const SourceReferenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Review state of the source itself. */
  reviewStatus: z.enum(["draft", "reviewed"]),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const LessonContentStatusSchema = z.object({
  basis: ContentBasisSchema,
  /** True for model-generated lessons: shown to the learner as a preview. */
  generatedPreview: z.boolean(),
  /** True when results are practice feedback only and never change the GapMap. */
  practiceOnly: z.boolean(),
  /** Only sources actually supplied to the model. Never model-written citations. */
  sources: z.array(SourceReferenceSchema),
});
export type LessonContentStatus = z.infer<typeof LessonContentStatusSchema>;

export const OPEN_TOPIC_LEVELS = [6, 7, 8] as const;

export const OpenLessonRequestSchema = z.object({
  /** The topic in the learner's own words. */
  topic: z.string().trim().min(2).max(120),
  level: z.union([z.literal(6), z.literal(7), z.literal(8)]),
  /** The learner's answer to a clarification question, when one was asked. */
  clarification: z.string().trim().min(1).max(120).optional(),
});
export type OpenLessonRequest = z.infer<typeof OpenLessonRequestSchema>;

export const OpenLessonResponseSchema = z.discriminatedUnion("status", [
  /** A session is stored and ready: open /lesson/{lessonId}. */
  z.object({
    status: z.literal("ready"),
    lessonId: z.string(),
    title: z.string(),
    contentStatus: LessonContentStatusSchema,
  }),
  /** The request was ambiguous. Ask once, then resubmit with `clarification`. */
  z.object({
    status: z.literal("needs_clarification"),
    question: z.string(),
    options: z.array(z.string()).min(2).max(4),
  }),
  /** Nothing could be started. `retryable` is true for provider failures. */
  z.object({
    status: z.literal("unavailable"),
    reason: z.enum([
      "ai_not_enabled",
      "out_of_scope",
      "generation_failed",
      "preview_not_allowed",
      "daily_limit_reached",
    ]),
    message: z.string(),
    retryable: z.boolean(),
  }),
]);
export type OpenLessonResponse = z.infer<typeof OpenLessonResponseSchema>;

export const LessonSessionResponseSchema = z.object({
  session: z.object({
    id: z.string(),
    studentId: z.string(),
    status: z.enum(["active", "completed", "abandoned"]),
    mode: z.string(),
    stepSeq: z.number(),
  }),
  // An adaptive lesson lists only the steps delivered so far, so it may hold
  // fewer than the two activities an authored plan requires.
  lesson: LessonPlanSchema.extend({ activities: z.array(LessonActivitySchema) }),
  adaptive: AdaptiveLessonProgressSchema.optional(),
  contentStatus: LessonContentStatusSchema.optional(),
  currentActivityIndex: z.number().int().nonnegative(),
  activeActivity: LessonActivitySchema.optional(),
  activeBranch: ActiveBranchStateSchema.nullable().optional(),
  assistanceStatus: z.record(z.string(), z.string()).optional(),
  completedActivities: z.array(z.string()),
  activityResponses: z.record(z.string(), z.unknown()),
  isCompleted: z.boolean(),
  sparksAwarded: z.number().optional(),
});
export type LessonSessionResponse = z.infer<typeof LessonSessionResponseSchema>;

export const LessonRespondRequestSchema = z.object({
  activityId: z.string(),
  response: z.unknown(),
});
export type LessonRespondRequest = z.infer<typeof LessonRespondRequestSchema>;

export const LessonRespondResponseSchema = z.object({
  activityId: z.string(),
  accepted: z.boolean(),
  feedback: z.string().optional(),
  isCorrect: z.boolean().optional(),
  nextActivityIndex: z.number().int().nonnegative(),
  activeBranch: ActiveBranchStateSchema.nullable().optional(),
  activeActivity: LessonActivitySchema.optional(),
  isCompleted: z.boolean(),
  isSavedAndExited: z.boolean().optional(),
  sparksAwarded: z.number(),
  adaptive: AdaptiveLessonProgressSchema.optional(),
});
export type LessonRespondResponse = z.infer<typeof LessonRespondResponseSchema>;

export const RecommendedNextActionSchema = z.object({
  actionType: z.enum([
    "revisit_unresolved",
    "fresh_check",
    "continue_next_objective",
    "start_objective",
  ]),
  title: z.string(),
  description: z.string(),
  objectiveId: z.string(),
  objectiveTitle: z.string(),
  subject: SubjectIdSchema,
  lessonId: z.string(),
  ctaLabel: z.string(),
  reasonCode: z.string(),
});
export type RecommendedNextAction = z.infer<typeof RecommendedNextActionSchema>;

// ============================================================================
// Developer Preview: Lesson Planner Schemas
// ============================================================================

export const LearnerProfileTypeSchema = z.enum([
  "new_learner",
  "struggling",
  "ready_for_challenge",
]);
export type LearnerProfileType = z.infer<typeof LearnerProfileTypeSchema>;

export const SyntheticLearnerProfileSchema = z.object({
  profileType: LearnerProfileTypeSchema,
  priorMastery: z
    .enum(["not_started", "struggling", "developing", "demonstrated"])
    .default("not_started"),
  namedMisconception: z.string().optional(),
  notes: z.string().optional(),
});
export type SyntheticLearnerProfile = z.infer<typeof SyntheticLearnerProfileSchema>;

export const LessonPlanValidationOutcomeSchema = z.object({
  schemaValid: z.boolean(),
  factualValid: z.boolean(),
  pedagogicalMatch: z.boolean(),
  issues: z.array(z.string()),
  status: z.enum(["passed", "rejected"]),
});
export type LessonPlanValidationOutcome = z.infer<typeof LessonPlanValidationOutcomeSchema>;

export const LessonPlanGenerateRequestSchema = z.object({
  subject: SubjectIdSchema,
  level: z.literal(6).default(6),
  topicId: z.string(),
  objectiveId: z.string(),
  learnerProfile: SyntheticLearnerProfileSchema,
});
export type LessonPlanGenerateRequest = z.infer<typeof LessonPlanGenerateRequestSchema>;

export const LessonPlanGenerateResponseSchema = z.object({
  plan: LessonPlanSchema,
  isFallback: z.boolean(),
  fallbackReason: z.string().optional(),
  metadata: z.object({
    model: z.string(),
    version: z.string(),
    latencyMs: z.number(),
    validation: LessonPlanValidationOutcomeSchema,
    learnerProfileUsed: z.object({
      profileType: LearnerProfileTypeSchema,
      namedMisconception: z.string().optional(),
    }),
  }),
});
export type LessonPlanGenerateResponse = z.infer<typeof LessonPlanGenerateResponseSchema>;

// ============================================================================
// Teaching Decision Engine: Adaptive Next-Step Schemas
// ============================================================================

export const LessonTeachingActionSchema = z.enum([
  "explain",
  "demonstrate",
  "explore",
  "guided_practice",
  "independent_check",
  "revisit_prerequisite",
  "advance",
  "pause",
]);
export type LessonTeachingAction = z.infer<typeof LessonTeachingActionSchema>;

export const TeachingAssessedResponseSchema = z.object({
  activityId: z.string(),
  conceptId: z.string(),
  submittedAnswer: z.string(),
  isCorrect: z.boolean(),
  assistanceLevel: z.number().int().min(0).max(2),
  misconceptionDetected: z.string().nullable().optional(),
  ambiguousError: z.boolean().default(false),
  /**
   * "diagnostic" marks a probe used only to choose a teaching route. Probes are
   * never mastery evidence and never count toward a success streak.
   */
  kind: z.enum(["assessment", "diagnostic"]).optional(),
  timestamp: z.string(),
});
export type TeachingAssessedResponse = z.infer<typeof TeachingAssessedResponseSchema>;

export const DeliveredActivityRecordSchema = z.object({
  id: z.string(),
  type: LessonActivityTypeSchema,
  title: z.string(),
  action: LessonTeachingActionSchema,
  timestamp: z.string(),
});
export type DeliveredActivityRecord = z.infer<typeof DeliveredActivityRecordSchema>;

export const ObjectiveBeliefStatusSchema = z.enum([
  "not_assessed",
  "needs_support",
  "developing",
  "demonstrated",
  "retained",
]);
export type ObjectiveBeliefStatus = z.infer<typeof ObjectiveBeliefStatusSchema>;

/**
 * Where the learner is WITHIN the lesson. This is separate from the objective's
 * belief status: only the belief reducer decides whether an objective is
 * demonstrated, and only a demonstrated objective can be advanced.
 */
export const LessonProgressStageSchema = z.enum([
  "teaching",
  "building_evidence",
  "ready_for_demonstration_check",
  "objective_demonstrated",
  "remediating",
  "paused",
  "consolidating",
]);
export type LessonProgressStage = z.infer<typeof LessonProgressStageSchema>;

export const TeachingDecisionEvidenceSchema = z.object({
  rationale: z.string(),
  inferredMisconception: z.string().nullable().optional(),
  isAmbiguous: z.boolean().default(false),
  consecutiveSuccesses: z.number().int().nonnegative(),
  remediationCycle: z.number().int().nonnegative(),
  eligibleActions: z.array(LessonTeachingActionSchema),
  objectiveStatus: ObjectiveBeliefStatusSchema.optional(),
  lessonStage: LessonProgressStageSchema.optional(),
});
export type TeachingDecisionEvidence = z.infer<typeof TeachingDecisionEvidenceSchema>;

export const TeachingDecisionInputSchema = z.object({
  objectiveId: z.string(),
  prerequisites: z.array(z.string()).default([]),
  recentAssessedResponses: z.array(TeachingAssessedResponseSchema).default([]),
  assistanceHistory: z.record(z.string(), z.string()).default({}),
  previouslyDeliveredActivities: z.array(DeliveredActivityRecordSchema).default([]),
  sourceMaterial: z.record(z.string(), z.unknown()).optional(),
  availableActivityTypes: z
    .array(LessonActivityTypeSchema)
    .default([
      "intro",
      "interactive_manipulation",
      "predict_and_observe",
      "guided_practice",
      "independent_check",
      "stopping_point",
    ]),
  remediationCycleCount: z.number().int().nonnegative().default(0),
  subject: SubjectIdSchema.default("maths"),
  level: z.number().int().default(6),
  /**
   * Canonical belief status for the objective, computed by the belief reducer
   * over stored evidence. Absent means "no evidence supplied": the policy then
   * never authorizes objective advancement.
   */
  objectiveStatus: ObjectiveBeliefStatusSchema.optional(),
  /** Authored assessment items already used and therefore not to be repeated. */
  excludedItemIds: z.array(z.string()).optional(),
  /** Unused authored assessment items left for this objective (absent = unknown). */
  remainingCheckItems: z.number().int().nonnegative().optional(),
});
export type TeachingDecisionInput = z.infer<typeof TeachingDecisionInputSchema>;

export const TeachingDecisionOutputSchema = z.object({
  action: LessonTeachingActionSchema,
  activity: LessonActivitySchema,
  evidence: TeachingDecisionEvidenceSchema,
  assessmentTarget: z.string(),
  audit: z
    .object({
      source: z.enum(["authored", "llm_suggested", "fallback"]),
      model: z.string().optional(),
      latencyMs: z.number().optional(),
      validationOutcome: LessonPlanValidationOutcomeSchema.optional(),
      fallbackReason: z.string().optional(),
      unverifiedExplanatoryProse: z.boolean().default(false),
    })
    .optional(),
});
export type TeachingDecisionOutput = z.infer<typeof TeachingDecisionOutputSchema>;

export const TeachingDecisionTraceEntrySchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  action: LessonTeachingActionSchema,
  activityId: z.string(),
  activityTitle: z.string(),
  activityType: LessonActivityTypeSchema,
  activity: LessonActivitySchema.optional(),
  rationale: z.string(),
  assessmentTarget: z.string(),
  inferredMisconception: z.string().nullable().optional(),
  isAmbiguous: z.boolean().optional(),
  eligibleActions: z.array(LessonTeachingActionSchema),
  source: z.enum(["authored", "llm_suggested", "fallback"]),
  timestamp: z.string(),
  objectiveStatus: ObjectiveBeliefStatusSchema.optional(),
  lessonStage: LessonProgressStageSchema.optional(),
  /** Assistance level the server fixed for this step when it was delivered. */
  assistanceLevel: z.number().int().min(0).max(2).optional(),
  /** What the learner did with this step (comparison harness and session trace). */
  learnerResponse: z
    .object({
      submittedAnswer: z.string(),
      isCorrect: z.boolean().optional(),
      countedAsEvidence: z.boolean(),
    })
    .optional(),
});
export type TeachingDecisionTraceEntry = z.infer<typeof TeachingDecisionTraceEntrySchema>;

export const TeachingEngineTraceResponseSchema = z.object({
  objectiveId: z.string(),
  subject: SubjectIdSchema,
  traces: z.object({
    struggling: z.object({
      learnerProfile: SyntheticLearnerProfileSchema,
      decisions: z.array(TeachingDecisionTraceEntrySchema),
      finalStatus: z.string(),
      masteryDemonstrated: z.boolean(),
    }),
    succeeding: z.object({
      learnerProfile: SyntheticLearnerProfileSchema,
      decisions: z.array(TeachingDecisionTraceEntrySchema),
      finalStatus: z.string(),
      masteryDemonstrated: z.boolean(),
    }),
  }),
});
export type TeachingEngineTraceResponse = z.infer<typeof TeachingEngineTraceResponseSchema>;
