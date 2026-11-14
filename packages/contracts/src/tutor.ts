import { z } from "zod";
import { VisualSpecSchema } from "./step";

export const TutorIntentSchema = z.enum([
  "hint",
  "explain",
  "example",
  "visual",
  "why_incorrect",
  "free_text",
]);
export type TutorIntent = z.infer<typeof TutorIntentSchema>;

export const TutorActionTypeSchema = z.enum([
  "hint",
  "explain",
  "example",
  "visual",
  "clarification",
  "encouragement",
  "prerequisite",
  "off_topic",
]);
export type TutorActionType = z.infer<typeof TutorActionTypeSchema>;

export const TutorMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["student", "assistant"]),
  text: z.string(),
  actionType: TutorActionTypeSchema.optional(),
  visual: VisualSpecSchema.optional(),
  clientMessageId: z.string().optional(),
  createdAt: z.string(),
});
export type TutorMessageDto = z.infer<typeof TutorMessageSchema>;

export const TutorRequestSchema = z.object({
  message: z.string().min(1).max(500),
  intent: TutorIntentSchema.optional(),
  clientMessageId: z.string().uuid("clientMessageId must be a valid UUID v4"),
});
export type TutorRequestDto = z.infer<typeof TutorRequestSchema>;

export const TutorResponseSchema = z.object({
  reply: TutorMessageSchema,
  conversation: z.array(TutorMessageSchema),
  remainingTurns: z.number().int().nonnegative(),
});
export type TutorResponseDto = z.infer<typeof TutorResponseSchema>;

export const TutorHistoryResponseSchema = z.object({
  conversation: z.array(TutorMessageSchema),
  remainingTurns: z.number().int().nonnegative(),
  maxTurns: z.number().int().positive(),
});
export type TutorHistoryResponseDto = z.infer<typeof TutorHistoryResponseSchema>;
