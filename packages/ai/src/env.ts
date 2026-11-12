import { z } from "zod";

const LlmProviderSchema = z.enum(["disabled", "mock", "openai"]);

export type LlmProviderKind = z.infer<typeof LlmProviderSchema>;
export type LlmHealthStatus = "ok" | "disabled" | "degraded";

export interface AiEnvConfig {
  readonly provider: LlmProviderKind;
  readonly apiKeyConfigured: boolean;
  readonly zdrConfirmed: boolean;
  readonly timeoutMs: number;
  readonly dailyCallsPerStudent: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Reads AI runtime flags defensively. Defaults to LLM_PROVIDER="disabled" and
 * AI_ZDR_CONFIRMED=false so no external model calls can run unintentionally.
 */
export function readAiEnv(env: Record<string, string | undefined> = process.env): AiEnvConfig {
  const providerParsed = LlmProviderSchema.safeParse(env.LLM_PROVIDER ?? "disabled");
  const provider: LlmProviderKind = providerParsed.success ? providerParsed.data : "disabled";
  return {
    provider,
    apiKeyConfigured: Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0),
    zdrConfirmed: env.AI_ZDR_CONFIRMED === "true",
    timeoutMs: parsePositiveInt(env.LLM_TIMEOUT_MS, 8000),
    dailyCallsPerStudent: parsePositiveInt(env.LLM_DAILY_CALLS_PER_STUDENT, 40),
  };
}

/** Returns public health status without leaking credentials or key metadata. */
export function getLlmHealthStatus(
  env: Record<string, string | undefined> = process.env,
): LlmHealthStatus {
  const cfg = readAiEnv(env);
  if (cfg.provider === "disabled") {
    return "disabled";
  }
  if (cfg.provider === "openai" && !cfg.apiKeyConfigured) {
    return "degraded";
  }
  return "ok";
}

/**
 * Global runtime AI readiness gate. Phase 7 adds per-class, per-student
 * ai_free_text consent, daily budget, and kill-switch checks on top of this.
 */
export function isAiRuntimeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const cfg = readAiEnv(env);
  if (cfg.provider === "disabled") return false;
  if (!cfg.zdrConfirmed) return false;
  if (cfg.provider === "openai" && !cfg.apiKeyConfigured) return false;
  return true;
}
