import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DisabledProvider } from "./providers/disabled";
import { MockProvider } from "./providers/mock";
import { getLlmProvider } from "./factory";

const TestSchema = z.object({
  message: z.string(),
  actionType: z.string().optional(),
});

describe("DisabledProvider", () => {
  it("returns disabled failure reason", async () => {
    const provider = new DisabledProvider();
    expect(provider.name).toBe("disabled");

    const res = await provider.generate({
      purpose: "tutor",
      system: "system",
      input: "input",
      schema: TestSchema,
      maxOutputTokens: 100,
      timeoutMs: 1000,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("disabled");
    }
  });

  it("returns unflagged moderation", async () => {
    const provider = new DisabledProvider();
    const mod = await provider.moderate("hello");
    expect(mod.ok).toBe(true);
    expect(mod.flagged).toBe(false);
  });
});

describe("MockProvider", () => {
  it("returns structured mock value on success and records call", async () => {
    const provider = new MockProvider();
    expect(provider.name).toBe("mock");

    const res = await provider.generate({
      purpose: "tutor",
      system: "You are Gaps tutor",
      input: "Help me",
      schema: TestSchema,
      maxOutputTokens: 100,
      timeoutMs: 1000,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(typeof res.value.message).toBe("string");
      expect(res.usage.inTok).toBeGreaterThan(0);
      expect(res.usage.outTok).toBeGreaterThan(0);
    }
    expect(provider.recordedCalls.length).toBe(1);
    expect(provider.recordedCalls[0]?.input).toBe("Help me");
  });

  it("handles fault modes: timeout, error, refused, invalid_json", async () => {
    const pTimeout = new MockProvider({ fault: "timeout" });
    const r1 = await pTimeout.generate({
      purpose: "tutor",
      system: "",
      input: "",
      schema: TestSchema,
      maxOutputTokens: 50,
      timeoutMs: 1000,
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe("timeout");

    const pError = new MockProvider({ fault: "error" });
    const r2 = await pError.generate({
      purpose: "tutor",
      system: "",
      input: "",
      schema: TestSchema,
      maxOutputTokens: 50,
      timeoutMs: 1000,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe("error");

    const pRefused = new MockProvider({ fault: "refused" });
    const r3 = await pRefused.generate({
      purpose: "tutor",
      system: "",
      input: "",
      schema: TestSchema,
      maxOutputTokens: 50,
      timeoutMs: 1000,
    });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.reason).toBe("refused");

    const pInvalid = new MockProvider({ fault: "invalid_json" });
    const r4 = await pInvalid.generate({
      purpose: "tutor",
      system: "",
      input: "",
      schema: TestSchema,
      maxOutputTokens: 50,
      timeoutMs: 1000,
    });
    expect(r4.ok).toBe(false);
    if (!r4.ok) expect(r4.reason).toBe("invalid_output");
  });

  it("handles moderation flagging fault", async () => {
    const provider = new MockProvider({ fault: "moderation_flagged" });
    const mod = await provider.moderate("harmful text");
    expect(mod.ok).toBe(true);
    expect(mod.flagged).toBe(true);
    expect(mod.categories).toContain("violence");
  });
});

describe("getLlmProvider factory", () => {
  it("defaults to DisabledProvider when LLM_PROVIDER is unset or disabled", () => {
    const provider = getLlmProvider({ LLM_PROVIDER: "disabled" });
    expect(provider.name).toBe("disabled");
  });

  it("returns MockProvider when LLM_PROVIDER=mock", () => {
    const provider = getLlmProvider({ LLM_PROVIDER: "mock" });
    expect(provider.name).toBe("mock");
  });

  it("returns OpenAiProvider when configured", () => {
    const provider = getLlmProvider({
      LLM_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test",
    });
    expect(provider.name).toBe("openai");
  });
});
