import { describe, expect, it } from "vitest";
import { ErrorResponseSchema, HealthResponseSchema } from "./index";

describe("health and error contracts", () => {
  it("accepts a healthy payload with disabled LLM", () => {
    const parsed = HealthResponseSchema.parse({
      status: "ok",
      db: "ok",
      llm: "disabled",
      version: "0.1.0",
    });
    expect(parsed).toEqual({
      status: "ok",
      db: "ok",
      llm: "disabled",
      version: "0.1.0",
    });
  });

  it("accepts a degraded payload when database is unreachable", () => {
    const parsed = HealthResponseSchema.parse({
      status: "degraded",
      db: "error",
      llm: "disabled",
      version: "0.1.0",
    });
    expect(parsed.db).toBe("error");
  });

  it("rejects malformed health payloads", () => {
    const result = HealthResponseSchema.safeParse({
      status: "unknown",
      db: "ok",
      llm: "disabled",
      version: "0.1.0",
    });
    expect(result.success).toBe(false);
  });

  it("validates standard error envelopes", () => {
    const parsed = ErrorResponseSchema.parse({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong.",
      },
    });
    expect(parsed.error.code).toBe("INTERNAL_ERROR");
  });
});
