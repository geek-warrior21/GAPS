import {
  type ComparisonSymbol,
  type MisconceptionId,
  type Rational,
  type RichText,
  type Rng,
  cmp,
  lcm,
  rational,
} from "@gaps/domain";
import type { Template } from "../types";

export interface CompareLikeParams {
  readonly a: number;
  readonly c: number;
  readonly b: number;
}

export const compareLikeTemplate: Template<CompareLikeParams> = {
  id: "MATH-FRAC-COMPARE/like-denominators",
  version: 1,
  conceptId: "MATH-FRAC-COMPARE",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): CompareLikeParams | null {
    const b = rng.int(3, 10);
    const a = rng.int(1, b - 1);
    let c = rng.int(1, b - 1);
    while (c === a) c = rng.int(1, b - 1);
    return { a, c, b };
  },
  prompt(p: CompareLikeParams): RichText {
    return [
      { t: "text", v: "Compare the fractions using <, =, or >: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " ☐ " },
      { t: "frac", n: p.c, d: p.b },
    ];
  },
  input() {
    return { kind: "comparison" };
  },
  answer(p: CompareLikeParams) {
    const sym: ComparisonSymbol = p.a < p.c ? "<" : p.a > p.c ? ">" : "=";
    return { kind: "comparison", value: sym };
  },
  hints(p: CompareLikeParams) {
    return [
      [{ t: "text", v: `Both fractions have the same denominator (${p.b}).` }],
      [{ t: "text", v: `Compare the numerators directly: ${p.a} and ${p.c}.` }],
      [{ t: "text", v: `Choose < if ${p.a} is smaller, or > if ${p.a} is larger.` }],
    ];
  },
  workedExample() {
    const exA = 3;
    const exC = 5;
    const exB = 7;
    return {
      steps: [
        [{ t: "text", v: `Compare ${exA}/${exB} and ${exC}/${exB}. Denominators match.` }],
        [{ t: "text", v: `Since ${exA} < ${exC}, ${exA}/${exB} < ${exC}/${exB}.` }],
      ],
      result: [{ t: "text", v: `${exA}/${exB} < ${exC}/${exB}` }],
    };
  },
  visual(p: CompareLikeParams) {
    return {
      type: "fraction_bar",
      bars: [
        { parts: p.b, shaded: p.a },
        { parts: p.b, shaded: p.c },
      ],
    };
  },
};

export interface CompareUnlikeParams {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export const compareUnlikeTemplate: Template<CompareUnlikeParams> = {
  id: "MATH-FRAC-COMPARE/unlike-denominators",
  version: 1,
  conceptId: "MATH-FRAC-COMPARE",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): CompareUnlikeParams | null {
    const b = rng.int(2, 12);
    let d = rng.int(2, 12);
    while (d === b) d = rng.int(2, 12);

    const L = Number(lcm(BigInt(b), BigInt(d)));
    if (L > 60) return null;

    const a = rng.int(1, b - 1);
    const c = rng.int(1, d - 1);

    const r1 = rational(BigInt(a), BigInt(b));
    const r2 = rational(BigInt(c), BigInt(d));
    const res = cmp(r1, r2);
    if (res === 0) return null;

    return { a, b, c, d };
  },
  prompt(p: CompareUnlikeParams): RichText {
    return [
      { t: "text", v: "Which is greater? Fill in <, =, or >: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " ☐ " },
      { t: "frac", n: p.c, d: p.d },
    ];
  },
  input() {
    return { kind: "comparison" };
  },
  answer(p: CompareUnlikeParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    const cVal = cmp(r1, r2);
    const sym: ComparisonSymbol = cVal < 0 ? "<" : cVal > 0 ? ">" : "=";
    return { kind: "comparison", value: sym };
  },
  misconceptions(p: CompareUnlikeParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    const realSym: ComparisonSymbol = cmp(r1, r2) < 0 ? "<" : ">";

    const numOnlySym: ComparisonSymbol | null = p.a !== p.c ? (p.a < p.c ? "<" : ">") : null;
    const bigDenomSym: ComparisonSymbol = p.b > p.d ? ">" : "<";

    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};

    const numDiff = numOnlySym !== null && numOnlySym !== realSym;
    const denDiff = bigDenomSym !== realSym;

    if (numDiff && denDiff && numOnlySym === bigDenomSym) {
      // If both predict the same symbol: record neither
      return result;
    }
    if (numDiff && numOnlySym !== null) {
      result["MC-NUMERATOR-ONLY"] = numOnlySym;
    }
    if (denDiff) {
      result["MC-BIGGER-DENOM"] = bigDenomSym;
    }
    return result;
  },
  hints(p: CompareUnlikeParams) {
    const L = Number(lcm(BigInt(p.b), BigInt(p.d)));
    return [
      [{ t: "text", v: "Can you make the bottom numbers the same?" }],
      [{ t: "text", v: `Use LCM(${p.b}, ${p.d}) = ${L} as the common denominator.` }],
      [
        {
          t: "text",
          v: `Rewrite: ${p.a}/${p.b} = ☐/${L} and ${p.c}/${p.d} = ☐/${L}. Now compare the top numbers.`,
        },
      ],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: "2/3 vs 3/5 → Common denominator LCM(3, 5) = 15." }],
        [{ t: "text", v: "2/3 = 10/15 and 3/5 = 9/15." }],
      ],
      result: [{ t: "text", v: "Since 10 > 9, 2/3 > 3/5" }],
    };
  },
  visual(p: CompareUnlikeParams) {
    return {
      type: "fraction_bar",
      bars: [
        { parts: p.b, shaded: p.a },
        { parts: p.d, shaded: p.c },
      ],
    };
  },
};

export const compareBenchmarkingTemplate: Template<CompareUnlikeParams> = {
  id: "MATH-FRAC-COMPARE/benchmark-half",
  version: 1,
  conceptId: "MATH-FRAC-COMPARE",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): CompareUnlikeParams | null {
    const b = rng.int(5, 12);
    let d = rng.int(5, 12);
    while (d === b) d = rng.int(5, 12);
    const L = Number(lcm(BigInt(b), BigInt(d)));
    if (L > 72) return null;

    const a = rng.int(2, b - 1);
    const c = rng.int(2, d - 1);

    const r1 = rational(BigInt(a), BigInt(b));
    const r2 = rational(BigInt(c), BigInt(d));
    if (cmp(r1, r2) === 0) return null;
    return { a, b, c, d };
  },
  prompt(p: CompareUnlikeParams): RichText {
    return [
      { t: "text", v: "Determine whether <, =, or > makes the statement true: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " ☐ " },
      { t: "frac", n: p.c, d: p.d },
    ];
  },
  input() {
    return { kind: "comparison" };
  },
  answer(p: CompareUnlikeParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    const sym: ComparisonSymbol = cmp(r1, r2) < 0 ? "<" : ">";
    return { kind: "comparison", value: sym };
  },
  hints(p: CompareUnlikeParams) {
    return [
      [{ t: "text", v: "Check if one fraction is greater than half while the other is less." }],
      [{ t: "text", v: `Or find a common denominator by calculating LCM(${p.b}, ${p.d}).` }],
      [{ t: "text", v: "Cross-multiply: compare numerator times opposite denominator." }],
    ];
  },
  workedExample() {
    const exA = 5;
    const exB = 9;
    const exC = 4;
    const exD = 7;
    return {
      steps: [
        [{ t: "text", v: `Compare ${exA}/${exB} and ${exC}/${exD}.` }],
        [{ t: "text", v: `Cross multiply: ${exA} × ${exD} = 35; ${exC} × ${exB} = 36.` }],
      ],
      result: [{ t: "text", v: `35 < 36, so ${exA}/${exB} < ${exC}/${exD}` }],
    };
  },
};

export const compareTemplates = [
  compareLikeTemplate,
  compareUnlikeTemplate,
  compareBenchmarkingTemplate,
] as const;
