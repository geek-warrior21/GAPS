import { z } from "zod";
import {
  BeliefSchema,
  ConceptIdSchema,
  ItemInstanceIdSchema,
  SessionIdSchema,
  StudentIdSchema,
  TeachingActionSchema,
} from "./domain";
import { StepSchema } from "./step";

export const SessionModeSchema = z.enum([
  "learn",
  "review",
  "quest",
  "boss",
  "quick_check",
  "solve_followup",
]);
export type SessionMode = z.infer<typeof SessionModeSchema>;

export const StartSessionRequestSchema = z.object({
  mode: SessionModeSchema.default("learn"),
  focusConceptId: ConceptIdSchema.optional(),
  budgetS: z.number().int().min(60).max(3600).default(900),
});
export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

export const LearningSessionDtoSchema = z.object({
  id: SessionIdSchema,
  studentId: StudentIdSchema,
  mode: SessionModeSchema,
  focusConceptId: ConceptIdSchema.nullable().optional(),
  status: z.enum(["active", "completed", "abandoned"]),
  budgetS: z.number(),
  stepSeq: z.number(),
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
});
export type LearningSessionDto = z.infer<typeof LearningSessionDtoSchema>;

export const StartSessionResponseSchema = z.object({
  session: LearningSessionDtoSchema,
  initialStep: StepSchema,
});
export type StartSessionResponse = z.infer<typeof StartSessionResponseSchema>;

export const SubmitAttemptRequestSchema = z.object({
  clientAttemptId: z.string().uuid("clientAttemptId must be a valid UUID v4"),
  itemInstanceId: ItemInstanceIdSchema,
  rawAnswer: z.string().min(1).max(64),
  assistanceLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  tryNo: z.union([z.literal(1), z.literal(2)]).default(1),
  latencyMs: z.number().int().min(0).default(0),
});
export type SubmitAttemptRequest = z.infer<typeof SubmitAttemptRequestSchema>;

export const ComebackCardDtoSchema = z.object({
  id: z.string(),
  conceptId: ConceptIdSchema,
  message: z.object({
    headline: z.string(),
    story: z.string(),
    pastPrompt: z.string(),
    presentPrompt: z.string(),
  }),
  pastAttemptIds: z.array(z.string()),
  presentAttemptIds: z.array(z.string()),
  seenAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type ComebackCardDto = z.infer<typeof ComebackCardDtoSchema>;

export const SubmitAttemptResponseSchema = z.object({
  attemptId: z.string(),
  outcome: z.enum(["correct", "incorrect", "unparseable", "not_simplified"]),
  misconceptionId: z.string().nullable().optional(),
  feedback: z.string(),
  tryAgain: z.boolean(),
  teachingAction: TeachingActionSchema,
  nextStep: StepSchema.nullable().optional(),
  belief: BeliefSchema.optional(),
  sparksAwarded: z.number().default(0),
  totalSparks: z.number(),
  comebackCard: ComebackCardDtoSchema.nullable().optional(),
  sessionCompleted: z.boolean(),
});
export type SubmitAttemptResponse = z.infer<typeof SubmitAttemptResponseSchema>;

export const RequestHelpRequestSchema = z.object({
  kind: z.enum(["hint", "explanation", "worked_example"]),
  rung: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  route: z.enum(["picture", "everyday", "steps"]).optional(),
});
export type RequestHelpRequest = z.infer<typeof RequestHelpRequestSchema>;

export const RequestHelpResponseSchema = z.object({
  kind: z.enum(["hint", "explanation", "worked_example"]),
  content: z.unknown(),
  assistanceLevel: z.number(),
});
export type RequestHelpResponse = z.infer<typeof RequestHelpResponseSchema>;

export const QuestSlotSchema = z.object({
  slotId: z.string(),
  title: z.string(),
  kind: z.enum(["review", "learn", "challenge"]),
  conceptId: ConceptIdSchema.optional(),
  completed: z.boolean(),
});
export type QuestSlot = z.infer<typeof QuestSlotSchema>;

export const QuestDtoSchema = z.object({
  id: z.string(),
  questDate: z.string(),
  status: z.enum(["in_progress", "completed"]),
  slots: z.array(QuestSlotSchema),
  completedAt: z.string().nullable().optional(),
});
export type QuestDto = z.infer<typeof QuestDtoSchema>;

export const DueReviewItemSchema = z.object({
  id: z.string(),
  conceptId: ConceptIdSchema,
  conceptTitle: z.string(),
  kind: z.enum(["warmup", "retention", "retry"]),
  dueAt: z.string(),
});
export type DueReviewItem = z.infer<typeof DueReviewItemSchema>;

export const HomeDashboardResponseSchema = z.object({
  student: z.object({
    id: z.string(),
    displayName: z.string(),
    cohortName: z.string().nullable().optional(),
    sparksTotal: z.number(),
  }),
  focusConcept: z.object({
    id: ConceptIdSchema,
    title: z.string(),
    studentTitle: z.string(),
    status: z.string(),
  }),
  dailyQuest: QuestDtoSchema,
  dueReviews: z.array(DueReviewItemSchema),
  recentComebackCard: ComebackCardDtoSchema.nullable().optional(),
});
export type HomeDashboardResponse = z.infer<typeof HomeDashboardResponseSchema>;

export const GapMapConceptNodeSchema = z.object({
  id: ConceptIdSchema,
  chapterId: z.string(),
  title: z.string(),
  studentTitle: z.string(),
  description: z.string(),
  topoOrder: z.number(),
  status: z.enum(["not_assessed", "needs_support", "developing", "demonstrated", "retained"]),
  reliability: z.enum(["missing", "low", "medium", "high"]),
  independentN: z.number(),
  independentCorrectN: z.number(),
  prereqIds: z.array(ConceptIdSchema),
});
export type GapMapConceptNode = z.infer<typeof GapMapConceptNodeSchema>;

export const GapMapResponseSchema = z.object({
  chapters: z.array(
    z.object({
      id: z.string(),
      strand: z.string(),
      title: z.string(),
      ord: z.number(),
    }),
  ),
  concepts: z.array(GapMapConceptNodeSchema),
  summary: z.object({
    totalConcepts: z.number(),
    demonstratedCount: z.number(),
    retainedCount: z.number(),
    needsSupportCount: z.number(),
    developingCount: z.number(),
    notAssessedCount: z.number(),
  }),
});
export type GapMapResponse = z.infer<typeof GapMapResponseSchema>;
