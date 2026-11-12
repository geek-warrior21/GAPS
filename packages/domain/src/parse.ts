import { fromDecimalString, gcd, rational } from "./rational";
import type { Parsed, Rational } from "./types";

const INTEGER_RE = /^(-?\d{1,9})$/;
const FRACTION_RE = /^(-?)(\d{1,6})\/(\d{1,6})$/;
const MIXED_RE = /^(-?)(\d{1,6}) (\d{1,6})\/(\d{1,6})$/;
const DECIMAL_RE = /^(-?\d{0,9}\.\d{1,6})$/;
const COMPARISON_RE = /^[<>=]$/;

/**
 * Normalize raw student input per SPEC §19.1:
 * trim, map Unicode minus/division/fraction slash to ASCII,
 * collapse internal whitespace, and remove one trailing full stop.
 */
export function normalizeInput(raw: string): string {
  const mapped = raw
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/\u00f7/g, "/")
    .replace(/\u2044/g, "/")
    .replace(/\s+/g, " ");
  const withoutTrailingDot = mapped.endsWith(".") ? mapped.slice(0, -1) : mapped;
  return withoutTrailingDot.trim();
}

function parseSingleFraction(token: string): { value: Rational; lowestTerms: boolean } | null {
  const match = FRACTION_RE.exec(token);
  if (!match) {
    return null;
  }
  const sign = match[1] === "-" ? -1n : 1n;
  const rawNum = BigInt(match[2] ?? "0");
  const rawDen = BigInt(match[3] ?? "0");
  if (rawDen === 0n) {
    return null;
  }
  return {
    value: rational(sign * rawNum, rawDen),
    lowestTerms: gcd(rawNum, rawDen) === 1n,
  };
}

export interface ParseOptions {
  readonly choiceIds?: readonly string[];
}

/**
 * Strictly parse student input against the SPEC §19.1 grammar.
 * Returns null if the input does not conform.
 */
export function parseAnswer(raw: string, options?: ParseOptions): Parsed | null {
  const normalized = normalizeInput(raw);
  if (normalized.length === 0) {
    return null;
  }

  if (options?.choiceIds && options.choiceIds.includes(normalized)) {
    return { kind: "choice", value: normalized, lowestTerms: true };
  }

  if (COMPARISON_RE.test(normalized)) {
    return { kind: "comparison", value: normalized, lowestTerms: true };
  }

  const intMatch = INTEGER_RE.exec(normalized);
  if (intMatch) {
    const val = BigInt(intMatch[1] ?? "0");
    return { kind: "integer", value: rational(val, 1n), lowestTerms: true };
  }

  const fracParsed = parseSingleFraction(normalized);
  if (fracParsed) {
    return {
      kind: "fraction",
      value: fracParsed.value,
      lowestTerms: fracParsed.lowestTerms,
    };
  }

  const mixedMatch = MIXED_RE.exec(normalized);
  if (mixedMatch) {
    const sign = mixedMatch[1] === "-" ? -1n : 1n;
    const whole = BigInt(mixedMatch[2] ?? "0");
    const num = BigInt(mixedMatch[3] ?? "0");
    const den = BigInt(mixedMatch[4] ?? "0");
    if (den === 0n || num >= den) {
      return null;
    }
    return {
      kind: "mixed",
      value: rational(sign * (whole * den + num), den),
      lowestTerms: gcd(num, den) === 1n,
    };
  }

  if (DECIMAL_RE.test(normalized)) {
    return {
      kind: "decimal",
      value: fromDecimalString(normalized),
      lowestTerms: true,
    };
  }

  if (normalized.includes(",")) {
    const parts = normalized.split(",").map((part) => part.trim());
    if (parts.length < 2 || parts.length > 6) {
      return null;
    }
    const parsedParts: Rational[] = [];
    let allLowest = true;
    for (const part of parts) {
      const f = parseSingleFraction(part);
      if (!f) {
        return null;
      }
      parsedParts.push(f.value);
      if (!f.lowestTerms) {
        allLowest = false;
      }
    }
    return { kind: "order", value: parsedParts, lowestTerms: allLowest };
  }

  return null;
}
