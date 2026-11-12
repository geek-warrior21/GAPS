const REDACTED_KEYS = new Set([
  "pin",
  "pinhash",
  "password",
  "passwordhash",
  "token",
  "sessiontoken",
  "totp",
  "totpsecret",
  "totpsecretenc",
  "freetext",
  "studenttext",
  "rawanswer",
  "authorization",
  "cookie",
  "apikey",
  "openaiapikey",
  "secret",
  "sessionsecret",
  "databaseurl",
]);

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[truncated]";
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (REDACTED_KEYS.has(key.toLowerCase())) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = scrubValue(entry, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export type LogLevel = "info" | "warn" | "error";

export interface StructuredLogEntry {
  readonly ts: string;
  readonly level: LogLevel;
  readonly event: string;
  readonly meta?: Record<string, unknown>;
}

/**
 * Formats a structured JSON log line while scrubbing credentials, tokens,
 * PINs, TOTP secrets, and student free text.
 */
export function formatLogEntry(
  level: LogLevel,
  event: string,
  meta?: Record<string, unknown>,
): string {
  const scrubbedMeta = meta ? (scrubValue(meta) as Record<string, unknown>) : undefined;
  const payload: StructuredLogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(scrubbedMeta !== undefined ? { meta: scrubbedMeta } : {}),
  };
  return JSON.stringify(payload);
}

function writeLine(stream: "stdout" | "stderr", line: string): void {
  if (stream === "stderr") {
    process.stderr.write(`${line}\n`);
    return;
  }
  process.stdout.write(`${line}\n`);
}

export const log = {
  info(event: string, meta?: Record<string, unknown>): void {
    writeLine("stdout", formatLogEntry("info", event, meta));
  },
  warn(event: string, meta?: Record<string, unknown>): void {
    writeLine("stderr", formatLogEntry("warn", event, meta));
  },
  error(event: string, meta?: Record<string, unknown>): void {
    writeLine("stderr", formatLogEntry("error", event, meta));
  },
};
