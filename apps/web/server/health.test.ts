import { describe, expect, it } from "vitest";
import { getHealthSnapshot } from "./health";

describe("GET /api/v1/health snapshot", () => {
  it("returns 200 and db: ok when database is reachable", async () => {
    const result = await getHealthSnapshot({
      checkDb: async () => ({ ok: true, latencyMs: 3 }),
      checkLlm: () => "disabled",
      version: "0.1.0",
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body).toEqual({
      status: "ok",
      db: "ok",
      llm: "disabled",
      version: "0.1.0",
    });
  });

  it("returns 503 and db: error when database is unreachable", async () => {
    const result = await getHealthSnapshot({
      checkDb: async () => ({ ok: false, latencyMs: 5 }),
      checkLlm: () => "disabled",
      version: "0.1.0",
    });

    expect(result.httpStatus).toBe(503);
    expect(result.body).toEqual({
      status: "degraded",
      db: "error",
      llm: "disabled",
      version: "0.1.0",
    });
  });
});
