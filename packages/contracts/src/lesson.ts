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
});
export type CurriculumTopic = z.infer<typeof CurriculumTopicSchema>;

export const CurriculumTopicsResponseSchema = z.object({
  topics: z.array(CurriculumTopicSchema),
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
  simulation: SimulationConfigSchema,
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
  prompt: z.string(),
  questionType: z.enum(["choice", "number", "fraction"]),
  choices: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  correctAnswer: z.string(),
  explanation: z.string(),
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

export const LessonSessionResponseSchema = z.object({
  session: z.object({
    id: z.string(),
    studentId: z.string(),
    status: z.enum(["active", "completed", "abandoned"]),
    mode: z.string(),
    stepSeq: z.number(),
  }),
  lesson: LessonPlanSchema,
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
