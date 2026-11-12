import { describe, expect, it } from "vitest";
import { getLlmHealthStatus, isAiRuntimeEnabled, readAiEnv } from "./index";

describe("@gaps/ai phase 0 safety defaults", () => {
  it("defaults to LLM_PROVIDER=disabled and AI_ZDR_CONFIRMED=false", () => {
    const cfg = readAiEnv({});
    expect(cfg.provider).toBe("disabled");
    expect(cfg.zdrConfirmed).toBe(false);
    expect(getLlmHealthStatus({})).toBe("disabled");
    expect(isAiRuntimeEnabled({})).toBe(false);
  });

  it("blocks runtime AI when AI_ZDR_CONFIRMED is not true", () => {
    expect(isAiRuntimeEnabled({ LLM_PROVIDER: "mock", AI_ZDR_CONFIRMED: "false" })).toBe(false);
    expect(
      isAiRuntimeEnabled({
        LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
        AI_ZDR_CONFIRMED: "false",
      }),
    ).toBe(false);
  });

  it("reports degraded when openai provider has no API key", () => {
    expect(getLlmHealthStatus({ LLM_PROVIDER: "openai" })).toBe("degraded");
    expect(isAiRuntimeEnabled({ LLM_PROVIDER: "openai", AI_ZDR_CONFIRMED: "true" })).toBe(false);
  });

  it("allows mock runtime only when explicitly enabled and ZDR-confirmed", () => {
    expect(getLlmHealthStatus({ LLM_PROVIDER: "mock" })).toBe("ok");
    expect(isAiRuntimeEnabled({ LLM_PROVIDER: "mock", AI_ZDR_CONFIRMED: "true" })).toBe(true);
  });
});
