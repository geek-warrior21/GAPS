import { z } from "zod";

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const HealthStatusSchema = z.enum(["ok", "degraded"]);
export const DbHealthSchema = z.enum(["ok", "error"]);
export const LlmHealthSchema = z.enum(["ok", "disabled", "degraded"]);

export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  db: DbHealthSchema,
  llm: LlmHealthSchema,
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type DbHealth = z.infer<typeof DbHealthSchema>;
export type LlmHealth = z.infer<typeof LlmHealthSchema>;
