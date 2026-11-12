import { type MisconceptionMap, matchMisconception } from "./misconceptions";
import { parseAnswer } from "./parse";
import { eq, isInteger, rational } from "./rational";
import {
  type AnswerSpec,
  type AttemptOutcome,
  type MisconceptionId,
  type Parsed,
  type Rational,
  type RationalAcceptKind,
  type RationalForm,
  VERIFIER_VERSION,
} from "./types";

export interface VerifyResult {
  readonly outcome: AttemptOutcome;
  readonly parsed?: Parsed;
  readonly misconceptionId?: MisconceptionId;
  readonly formatMismatch?: boolean;
  readonly expectedFormat?: string;
  readonly verifierVersion: typeof VERIFIER_VERSION;
}

const DEFAULT_RATIONAL_ACCEPT: readonly RationalAcceptKind[] = ["integer", "fraction", "mixed"];

function checkRationalForm(
  parsed: Parsed,
  value: Rational,
  target: Rational,
  form: RationalForm,
): "correct" | "not_simplified" {
  switch (form) {
    case "any":
      return "correct";
    case "simplest":
      return parsed.lowestTerms ? "correct" : "not_simplified";
    case "mixed": {
      if (isInteger(target)) {
        return parsed.kind === "integer" ? "correct" : "not_simplified";
      }
      const absN = target.n < 0n ? -target.n : target.n;
      if (absN < target.d) {
        return (parsed.kind === "fraction" || parsed.kind === "mixed") && parsed.lowestTerms
          ? "correct"
          : "not_simplified";
      }
      return parsed.kind === "mixed" && parsed.lowestTerms ? "correct" : "not_simplified";
    }
    case "improper":
      return parsed.kind === "fraction" && parsed.lowestTerms ? "correct" : "not_simplified";
  }
}

function isRationalKind(kind: Parsed["kind"]): kind is RationalAcceptKind {
  return kind === "integer" || kind === "fraction" || kind === "mixed" || kind === "decimal";
}

function isRationalValue(v: Parsed["value"]): v is Rational {
  return typeof v === "object" && !Array.isArray(v) && "n" in v && "d" in v;
}

function formatExpectation(accept: readonly RationalAcceptKind[]): string {
  return accept.join(", ");
}

/**
 * Deterministic answer verifier per SPEC §19.2 & §19.3.
 * Never uses floating-point arithmetic or dynamic code evaluation.
 */
export function verify(
  spec: AnswerSpec,
  raw: string,
  misconceptions?: MisconceptionMap,
): VerifyResult {
  const choiceIds = spec.kind === "choice" ? spec.options.map((opt) => opt.id) : undefined;
  const parsed = parseAnswer(raw, choiceIds ? { choiceIds } : undefined);

  if (!parsed) {
    return {
      outcome: "unparseable",
      verifierVersion: VERIFIER_VERSION,
    };
  }

  switch (spec.kind) {
    case "rational": {
      const accept = spec.accept ?? DEFAULT_RATIONAL_ACCEPT;
      if (
        !isRationalKind(parsed.kind) ||
        !accept.includes(parsed.kind) ||
        !isRationalValue(parsed.value)
      ) {
        const mc = isRationalValue(parsed.value)
          ? matchMisconception(parsed.value, spec.value, misconceptions)
          : undefined;
        return {
          outcome: "incorrect",
          parsed,
          formatMismatch: true,
          expectedFormat: formatExpectation(accept),
          ...(mc ? { misconceptionId: mc } : {}),
          verifierVersion: VERIFIER_VERSION,
        };
      }
      if (!eq(parsed.value, spec.value)) {
        const mc = matchMisconception(parsed.value, spec.value, misconceptions);
        return {
          outcome: "incorrect",
          parsed,
          ...(mc ? { misconceptionId: mc } : {}),
          verifierVersion: VERIFIER_VERSION,
        };
      }
      const outcome = checkRationalForm(parsed, parsed.value, spec.value, spec.form);
      return {
        outcome,
        parsed,
        verifierVersion: VERIFIER_VERSION,
      };
    }

    case "integer": {
      const targetRational = rational(spec.value, 1n);
      if (parsed.kind !== "integer" || !isRationalValue(parsed.value)) {
        const mc = isRationalValue(parsed.value)
          ? matchMisconception(parsed.value, targetRational, misconceptions)
          : undefined;
        return {
          outcome: "incorrect",
          parsed,
          formatMismatch: true,
          expectedFormat: "integer",
          ...(mc ? { misconceptionId: mc } : {}),
          verifierVersion: VERIFIER_VERSION,
        };
      }
      if (parsed.value.n === spec.value) {
        return { outcome: "correct", parsed, verifierVersion: VERIFIER_VERSION };
      }
      const mc = matchMisconception(parsed.value, targetRational, misconceptions);
      return {
        outcome: "incorrect",
        parsed,
        ...(mc ? { misconceptionId: mc } : {}),
        verifierVersion: VERIFIER_VERSION,
      };
    }

    case "decimal": {
      if (parsed.kind !== "decimal" || !isRationalValue(parsed.value)) {
        const mc = isRationalValue(parsed.value)
          ? matchMisconception(parsed.value, spec.value, misconceptions)
          : undefined;
        return {
          outcome: "incorrect",
          parsed,
          formatMismatch: true,
          expectedFormat: "decimal",
          ...(mc ? { misconceptionId: mc } : {}),
          verifierVersion: VERIFIER_VERSION,
        };
      }
      if (eq(parsed.value, spec.value)) {
        return { outcome: "correct", parsed, verifierVersion: VERIFIER_VERSION };
      }
      const mc = matchMisconception(parsed.value, spec.value, misconceptions);
      return {
        outcome: "incorrect",
        parsed,
        ...(mc ? { misconceptionId: mc } : {}),
        verifierVersion: VERIFIER_VERSION,
      };
    }

    case "comparison": {
      if (parsed.kind !== "comparison" || typeof parsed.value !== "string") {
        return {
          outcome: "incorrect",
          parsed,
          formatMismatch: true,
          expectedFormat: "comparison",
          verifierVersion: VERIFIER_VERSION,
        };
      }
      if (parsed.value === spec.value) {
        return { outcome: "correct", parsed, verifierVersion: VERIFIER_VERSION };
      }
      const mc = matchMisconception(parsed.value, spec.value, misconceptions);
      return {
        outcome: "incorrect",
        parsed,
        ...(mc ? { misconceptionId: mc } : {}),
        verifierVersion: VERIFIER_VERSION,
      };
    }

    case "choice": {
      if (parsed.kind !== "choice" || typeof parsed.value !== "string") {
        return {
          outcome: "incorrect",
          parsed,
          formatMismatch: true,
          expectedFormat: "choice",
          verifierVersion: VERIFIER_VERSION,
        };
      }
      if (parsed.value === spec.value) {
        return { outcome: "correct", parsed, verifierVersion: VERIFIER_VERSION };
      }
      const mc = matchMisconception(parsed.value, spec.value, misconceptions);
      return {
        outcome: "incorrect",
        parsed,
        ...(mc ? { misconceptionId: mc } : {}),
        verifierVersion: VERIFIER_VERSION,
      };
    }

    case "order": {
      if (parsed.kind !== "order" || !Array.isArray(parsed.value)) {
        return {
          outcome: "incorrect",
          parsed,
          formatMismatch: true,
          expectedFormat: "order",
          verifierVersion: VERIFIER_VERSION,
        };
      }
      const parsedOrder = parsed.value as readonly Rational[];
      const matches =
        parsedOrder.length === spec.value.length &&
        parsedOrder.every((item, idx) => {
          const target = spec.value[idx];
          return target !== undefined && eq(item, target);
        });
      return {
        outcome: matches ? "correct" : "incorrect",
        parsed,
        verifierVersion: VERIFIER_VERSION,
      };
    }
  }
}
