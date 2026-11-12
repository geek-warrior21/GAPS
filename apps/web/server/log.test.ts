import { describe, expect, it } from "vitest";
import { formatLogEntry } from "./log";

describe("structured JSON logger", () => {
  it("redacts sensitive credentials, tokens, PINs, and free text", () => {
    const raw = formatLogEntry("info", "auth.attempt", {
      userId: "usr_01ABC",
      pin: "111111",
      password: "secret-password",
      token: "tok_abc",
      totpSecret: "JBSWY3DPEHPK3PXP",
      freeText: "My name is Asha and I live in Pune",
      nested: {
        databaseUrl: "postgres://gaps:gaps@localhost:5432/gaps",
        ok: true,
      },
    });
    const parsed = JSON.parse(raw) as {
      level: string;
      event: string;
      meta: Record<string, unknown>;
    };
    expect(parsed.level).toBe("info");
    expect(parsed.event).toBe("auth.attempt");
    expect(parsed.meta.userId).toBe("usr_01ABC");
    expect(parsed.meta.pin).toBe("[REDACTED]");
    expect(parsed.meta.password).toBe("[REDACTED]");
    expect(parsed.meta.token).toBe("[REDACTED]");
    expect(parsed.meta.totpSecret).toBe("[REDACTED]");
    expect(parsed.meta.freeText).toBe("[REDACTED]");
    expect((parsed.meta.nested as Record<string, unknown>).databaseUrl).toBe("[REDACTED]");
    expect((parsed.meta.nested as Record<string, unknown>).ok).toBe(true);
  });
});
