import { describe, expect, it } from "vitest";
import { checkDatabaseHealth, getSqlClient } from "./index";

describe("@gaps/db health probe", () => {
  it("returns ok: true when ping resolves", async () => {
    const result = await checkDatabaseHealth({
      ping: async () => undefined,
    });
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok: false when ping throws", async () => {
    const result = await checkDatabaseHealth({
      ping: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(result.ok).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok: false when DATABASE_URL is empty", async () => {
    const result = await checkDatabaseHealth({ databaseUrl: "" });
    expect(result).toEqual({ ok: false, latencyMs: 0 });
  });

  it("throws a safe error without credentials when DATABASE_URL is unset", () => {
    expect(() => getSqlClient("")).toThrow("DATABASE_URL is not configured");
  });
});
