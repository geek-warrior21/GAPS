import { z } from "zod";

export type LlmPurpose =
  | "explain"
  | "solve_parse"
  | "solve_step"
  | "tutor"
  /** Open-topic teaching: choose a short opening sequence for a learning goal. */
  | "lesson_open"
  /** Open-topic teaching: choose the next step from the learner's responses. */
  | "lesson_step";

export interface GenerateRequest<T> {
  purpose: LlmPurpose;
  system: string;
  input: string;
  schema: z.ZodType<T>;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface GenerateUsage {
  inTok: number;
  outTok: number;
}

export type GenerateFailureReason = "timeout" | "error" | "refused" | "invalid_output" | "disabled";

export type GenerateResult<T> =
  { ok: true; value: T; usage: GenerateUsage } | { ok: false; reason: GenerateFailureReason };

export interface ModerationResult {
  ok: boolean;
  flagged?: boolean;
  categories?: string[];
}

export interface LLMProvider {
  readonly name: "openai" | "mock" | "disabled";
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
  moderate(text: string): Promise<ModerationResult>;
}
