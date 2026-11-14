import { readAiEnv } from "./env";
import { DisabledProvider } from "./providers/disabled";
import { MockProvider, type MockProviderOptions } from "./providers/mock";
import { OpenAiProvider } from "./providers/openai";
import type { LLMProvider } from "./types";

export function getLlmProvider(
  env: Record<string, string | undefined> = process.env,
  mockOptions?: MockProviderOptions,
): LLMProvider {
  const cfg = readAiEnv(env);

  if (cfg.provider === "mock") {
    return new MockProvider(mockOptions);
  }

  if (cfg.provider === "openai" && cfg.apiKeyConfigured) {
    return new OpenAiProvider({
      apiKey: env.OPENAI_API_KEY ?? "",
      baseUrl: env.OPENAI_BASE_URL,
      model: env.LLM_MODEL_TUTOR ?? "gpt-4o-mini",
    });
  }

  return new DisabledProvider();
}
