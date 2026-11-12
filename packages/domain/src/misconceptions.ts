import { eq, isInteger, rational } from "./rational";
import type { ComparisonSymbol, ConceptId, MisconceptionId, Rational } from "./types";

export interface MisconceptionMeta {
  readonly id: MisconceptionId;
  readonly concepts: readonly ConceptId[];
  readonly pattern: string;
  readonly example: string;
}

export const MISCONCEPTION_CATALOG: Readonly<Record<MisconceptionId, MisconceptionMeta>> = {
  "MC-PART-RATIO": {
    id: "MC-PART-RATIO",
    concepts: ["MATH-FRAC-PART"],
    pattern: "Shaded over unshaded instead of over total: a/(b - a)",
    example: "3 of 8 shaded -> 3/5",
  },
  "MC-NUMLINE-TICKS": {
    id: "MC-NUMLINE-TICKS",
    concepts: ["MATH-FRAC-NUMLINE"],
    pattern: "Counts tick marks instead of intervals: a/(b + 1)",
    example: "3rd mark of 4 parts -> 3/5",
  },
  "MC-EQUIV-ADDITIVE": {
    id: "MC-EQUIV-ADDITIVE",
    concepts: ["MATH-FRAC-EQUIV"],
    pattern: "Adds the same number to top and bottom",
    example: "2/3 = _/6 -> 5",
  },
  "MC-NUMERATOR-ONLY": {
    id: "MC-NUMERATOR-ONLY",
    concepts: ["MATH-FRAC-COMPARE"],
    pattern: "Compares numerators and ignores denominators",
    example: "3/10 > 2/3",
  },
  "MC-BIGGER-DENOM": {
    id: "MC-BIGGER-DENOM",
    concepts: ["MATH-FRAC-COMPARE"],
    pattern: "Treats a larger denominator as a larger fraction",
    example: "1/8 > 1/4",
  },
  "MC-MIXED-ADD-PARTS": {
    id: "MC-MIXED-ADD-PARTS",
    concepts: ["MATH-FRAC-MIXED"],
    pattern: "Converts w a/b to (w + a)/b",
    example: "2 1/3 -> 3/3",
  },
  "MC-MIXED-WRONG-PRODUCT": {
    id: "MC-MIXED-WRONG-PRODUCT",
    concepts: ["MATH-FRAC-MIXED"],
    pattern: "Converts w a/b to (w * a + b)/b",
    example: "2 1/3 -> 5/3",
  },
  "MC-ADD-ACROSS": {
    id: "MC-ADD-ACROSS",
    concepts: ["MATH-FRAC-ADDLIKE", "MATH-FRAC-ADDUNLIKE", "MATH-FRAC-WORD"],
    pattern: "Adds numerators and denominators directly",
    example: "1/2 + 1/3 -> 2/5",
  },
  "MC-ADD-DENOMS-LIKE": {
    id: "MC-ADD-DENOMS-LIKE",
    concepts: ["MATH-FRAC-ADDLIKE"],
    pattern: "Adds denominators of like fractions",
    example: "2/7 + 3/7 -> 5/14",
  },
  "MC-SUB-ACROSS": {
    id: "MC-SUB-ACROSS",
    concepts: ["MATH-FRAC-ADDUNLIKE"],
    pattern: "Subtracts numerators and denominators directly",
    example: "3/4 - 1/2 -> 2/2",
  },
  "MC-MULT-SAME-DENOM": {
    id: "MC-MULT-SAME-DENOM",
    concepts: ["MATH-FRAC-MULT"],
    pattern: "Keeps the common denominator when multiplying",
    example: "2/5 * 3/5 -> 6/5",
  },
  "MC-FRACTION-OF-UNIT": {
    id: "MC-FRACTION-OF-UNIT",
    concepts: ["MATH-FRAC-MULT", "MATH-FRAC-WORD"],
    pattern: "Computes a/b of N as N / b only",
    example: "3/4 of 20 -> 5",
  },
  "MC-DIV-FLIP-FIRST": {
    id: "MC-DIV-FLIP-FIRST",
    concepts: ["MATH-FRAC-DIV"],
    pattern: "Inverts the dividend instead of the divisor",
    example: "2/3 / 4/5 -> 6/5",
  },
  "MC-DIV-NO-FLIP": {
    id: "MC-DIV-NO-FLIP",
    concepts: ["MATH-FRAC-DIV"],
    pattern: "Multiplies straight across without inverting",
    example: "2/3 / 4/5 -> 8/15",
  },
  "MC-DEC-DIGITS": {
    id: "MC-DEC-DIGITS",
    concepts: ["MATH-FRAC-DEC"],
    pattern: "Writes numerator and denominator digits as a decimal",
    example: "1/4 -> 0.14",
  },
};

export function getMisconceptionMeta(id: MisconceptionId): MisconceptionMeta {
  return MISCONCEPTION_CATALOG[id];
}

export type MisconceptionValue = Rational | ComparisonSymbol | bigint | string;
export type MisconceptionMap = Partial<Record<MisconceptionId, MisconceptionValue>>;

function valuesEqual(a: MisconceptionValue, b: MisconceptionValue): boolean {
  if (typeof a === "object" && typeof b === "object") {
    return eq(a, b);
  }
  if (typeof a === "bigint" && typeof b === "bigint") {
    return a === b;
  }
  if (typeof a === "object" && typeof b === "bigint") {
    return isInteger(a) && a.n === b;
  }
  if (typeof a === "bigint" && typeof b === "object") {
    return isInteger(b) && a === b.n;
  }
  return a === b;
}

/**
 * Compare a wrong student value against misconception predictions per SPEC §19.3:
 * exact single match returns that misconceptionId; 0 or >= 2 matches returns undefined.
 */
export function matchMisconception(
  candidate: MisconceptionValue,
  correctValue: MisconceptionValue,
  misconceptions?: MisconceptionMap,
): MisconceptionId | undefined {
  if (!misconceptions) {
    return undefined;
  }
  const normalizedCorrect =
    typeof correctValue === "bigint" ? rational(correctValue, 1n) : correctValue;
  const matches: MisconceptionId[] = [];
  for (const [id, wrongValue] of Object.entries(misconceptions) as Array<
    [MisconceptionId, MisconceptionValue | undefined]
  >) {
    if (wrongValue === undefined) {
      continue;
    }
    if (valuesEqual(wrongValue, normalizedCorrect)) {
      continue;
    }
    if (valuesEqual(candidate, wrongValue)) {
      matches.push(id);
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}
