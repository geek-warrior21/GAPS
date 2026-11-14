import { z } from "zod";

export type LlmPurpose = "explain" | "solve_parse" | "solve_step" | "tutor";

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
