import {
  type ComparisonSymbol,
  type MisconceptionId,
  type Rational,
  type RichText,
  type Rng,
  add,
  lcm,
  rational,
  sub,
} from "@gaps/domain";
import type { Template } from "../types";

export interface WordLaddooParams {
  readonly a: number;
  readonly b: number;
  readonly n: number;
}

export const wordSharingTemplate: Template<WordLaddooParams> = {
  id: "MATH-FRAC-WORD/sharing-laddoos",
  version: 1,
  conceptId: "MATH-FRAC-WORD",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): WordLaddooParams | null {
    const b = rng.pick([3, 4, 5, 6]);
    const a = rng.int(2, b - 1);
    const k = rng.int(3, 6);
    const n = b * k;
    return { a, b, n };
  },
  prompt(p: WordLaddooParams): RichText {
    return [
      { t: "text", v: `Grandmother made ${p.n} laddoos for Diwali. The children ate ` },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: ` of the laddoos. How many laddoos did the children eat?` },
    ];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: WordLaddooParams) {
    const unit = p.n / p.b;
    return { kind: "integer", value: BigInt(unit * p.a) };
  },
  misconceptions(p: WordLaddooParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    const unit = p.n / p.b;
    const correct = unit * p.a;
    if (unit !== correct) {
      result["MC-FRACTION-OF-UNIT"] = rational(BigInt(unit), 1n);
    }
    return result;
  },
  hints(p: WordLaddooParams) {
    const unit = p.n / p.b;
    return [
      [{ t: "text", v: `First find 1/${p.b} of ${p.n} laddoos: divide ${p.n} by ${p.b}.` }],
      [{ t: "text", v: `${p.n} ÷ ${p.b} = ${unit} laddoos in each share.` }],
      [{ t: "text", v: `Multiply by ${p.a}: ${unit} × ${p.a} = ☐.` }],
    ];
  },
  workedExample(_rng: Rng, _p: WordLaddooParams) {
    return {
      steps: [
        [{ t: "text", v: `3/4 of 24: Divide 24 by 4 = 6 laddoos per share.` }],
        [{ t: "text", v: `Multiply by 3 shares: 6 × 3 = 18 laddoos.` }],
      ],
      result: [{ t: "text", v: `Children ate 18 laddoos.` }],
    };
  },
};

export interface WordRibbonParams {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export const wordRibbonTemplate: Template<WordRibbonParams> = {
  id: "MATH-FRAC-WORD/ribbon-sum",
  version: 1,
  conceptId: "MATH-FRAC-WORD",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): WordRibbonParams | null {
    const b = rng.int(2, 6);
    let d = rng.int(2, 6);
    while (d === b) d = rng.int(2, 6);
    const L = Number(lcm(BigInt(b), BigInt(d)));
    if (L > 30) return null;

    const a = rng.int(1, b - 1);
    const c = rng.int(1, d - 1);

    const r1 = rational(BigInt(a), BigInt(b));
    const r2 = rational(BigInt(c), BigInt(d));
    const sum = add(r1, r2);

    // MC-ADD-ACROSS check
    const mcVal = rational(BigInt(a + c), BigInt(b + d));
    if (mcVal.n * sum.d === sum.n * mcVal.d) return null;

    return { a, b, c, d };
  },
  prompt(p: WordRibbonParams): RichText {
    return [
      { t: "text", v: `Meera bought ` },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: ` metre of blue ribbon and ` },
      { t: "frac", n: p.c, d: p.d },
      {
        t: "text",
        v: ` metre of red ribbon. What is the total length of ribbon in metres? Give your answer in simplest form.`,
      },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: WordRibbonParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    return { kind: "rational", value: add(r1, r2), form: "simplest" };
  },
  misconceptions(p: WordRibbonParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    const sum = add(r1, r2);
    const mcVal = rational(BigInt(p.a + p.c), BigInt(p.b + p.d));
    if (mcVal.n * sum.d !== sum.n * mcVal.d) {
      result["MC-ADD-ACROSS"] = mcVal;
    }
    return result;
  },
  hints(p: WordRibbonParams) {
    return [
      [{ t: "text", v: "Total length means adding both lengths together." }],
      [
        {
          t: "text",
          v: `Find the least common multiple of ${p.b} and ${p.d} for the common denominator.`,
        },
      ],
      [
        {
          t: "text",
          v: "Convert to like fractions, add the numerators, and simplify to lowest terms.",
        },
      ],
    ];
  },
  workedExample(_rng: Rng, _p: WordRibbonParams) {
    return {
      steps: [
        [{ t: "text", v: "1/2 metre + 1/4 metre: Common denominator is 4." }],
        [{ t: "text", v: "1/2 = 2/4. Add: 2/4 + 1/4 = 3/4." }],
      ],
      result: [
        { t: "text", v: "Total ribbon = " },
        { t: "frac", n: 3, d: 4 },
        { t: "text", v: " metre" },
      ],
    };
  },
};

export interface WordRemainParams {
  readonly a: number;
  readonly b: number;
}

export const wordRemainTemplate: Template<WordRemainParams> = {
  id: "MATH-FRAC-WORD/remaining-money",
  version: 1,
  conceptId: "MATH-FRAC-WORD",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): WordRemainParams | null {
    const b = rng.int(4, 9);
    const a = rng.int(1, b - 2);
    return { a, b };
  },
  prompt(p: WordRemainParams): RichText {
    return [
      { t: "text", v: `Rohan spent ` },
      { t: "frac", n: p.a, d: p.b },
      {
        t: "text",
        v: ` of his monthly pocket money on books. What fraction of his pocket money is left?`,
      },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: WordRemainParams) {
    const spent = rational(BigInt(p.a), BigInt(p.b));
    const whole = rational(1n, 1n);
    return { kind: "rational", value: sub(whole, spent), form: "simplest" };
  },
  hints(p: WordRemainParams) {
    return [
      [{ t: "text", v: `Total pocket money represents 1 whole, which is ${p.b}/${p.b}.` }],
      [
        {
          t: "text",
          v: `Subtract the spent fraction from the whole: ${p.b}/${p.b} - ${p.a}/${p.b}.`,
        },
      ],
      [{ t: "text", v: `Calculate: (${p.b} - ${p.a}) / ${p.b} and simplify if needed.` }],
    ];
  },
  workedExample(_rng: Rng, _p: WordRemainParams) {
    return {
      steps: [
        [{ t: "text", v: `Total is 1 whole = 5/5. Spent fraction is 2/5.` }],
        [{ t: "text", v: `Leftover = 5/5 - 2/5 = 3/5.` }],
      ],
      result: [
        { t: "text", v: "Leftover fraction = " },
        { t: "frac", n: 3, d: 5 },
      ],
    };
  },
};

export const wordTemplates = [wordSharingTemplate, wordRibbonTemplate, wordRemainTemplate] as const;
