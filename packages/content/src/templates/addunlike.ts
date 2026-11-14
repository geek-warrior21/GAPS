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

export interface AddUnlikeParams {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export const addUnlikeMultipleTemplate: Template<AddUnlikeParams> = {
  id: "MATH-FRAC-ADDUNLIKE/one-multiple",
  version: 1,
  conceptId: "MATH-FRAC-ADDUNLIKE",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): AddUnlikeParams | null {
    const b = rng.pick([2, 3, 4, 5]);
    const mult = rng.int(2, 3);
    const d = b * mult;
    const a = rng.int(1, b - 1);
    const c = rng.int(1, d - 1);
    // ensure proper sum < 1
    if (a * mult + c >= d) return null;
    return { a, b, c, d };
  },
  prompt(p: AddUnlikeParams): RichText {
    return [
      { t: "text", v: "Add the unlike fractions: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " + " },
      { t: "frac", n: p.c, d: p.d },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: AddUnlikeParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    return { kind: "rational", value: add(r1, r2), form: "simplest" };
  },
  hints(p: AddUnlikeParams) {
    return [
      [{ t: "text", v: `Notice that ${p.d} is a multiple of ${p.b}.` }],
      [{ t: "text", v: `Rewrite ${p.a}/${p.b} with denominator ${p.d}.` }],
      [{ t: "text", v: `Add the numerators over ${p.d} and simplify.` }],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: `1/3 + 1/6: Rewrite 1/3 as 2/6.` }],
        [{ t: "text", v: `Add: 2/6 + 1/6 = 3/6.` }],
        [{ t: "text", v: `Simplify 3/6 to 1/2.` }],
      ],
      result: [
        { t: "text", v: `1/3 + 1/6 = ` },
        { t: "frac", n: 1, d: 2 },
      ],
    };
  },
};

export const addUnlikeTwoTemplate: Template<AddUnlikeParams> = {
  id: "MATH-FRAC-ADDUNLIKE/add-two",
  version: 1,
  conceptId: "MATH-FRAC-ADDUNLIKE",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): AddUnlikeParams | null {
    const b = rng.int(2, 12);
    let d = rng.int(2, 12);
    while (d === b) d = rng.int(2, 12);
    const L = Number(lcm(BigInt(b), BigInt(d)));
    if (L > 60) return null;

    const a = rng.int(1, b - 1);
    const c = rng.int(1, d - 1);

    const r1 = rational(BigInt(a), BigInt(b));
    const r2 = rational(BigInt(c), BigInt(d));
    const sum = add(r1, r2);

    // Misconception check: (a+c)/(b+d) must not equal the correct sum
    const mcVal = rational(BigInt(a + c), BigInt(b + d));
    if (mcVal.n * sum.d === sum.n * mcVal.d) return null;

    return { a, b, c, d };
  },
  prompt(p: AddUnlikeParams): RichText {
    return [
      { t: "text", v: "Add and write your answer in simplest form: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " + " },
      { t: "frac", n: p.c, d: p.d },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: AddUnlikeParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    return { kind: "rational", value: add(r1, r2), form: "simplest" };
  },
  misconceptions(p: AddUnlikeParams) {
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
  hints(p: AddUnlikeParams) {
    return [
      [
        {
          t: "text",
          v: "The fractions have different denominators. What is their least common multiple?",
        },
      ],
      [
        {
          t: "text",
          v: `Find the least common multiple of ${p.b} and ${p.d} to get a common denominator.`,
        },
      ],
      [
        {
          t: "text",
          v: "Rewrite both fractions with that common denominator, then add the numerators.",
        },
      ],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: "1/4 + 2/3: Common denominator is 12." }],
        [{ t: "text", v: "1/4 = 3/12 and 2/3 = 8/12." }],
        [{ t: "text", v: "Add: 3/12 + 8/12 = 11/12." }],
      ],
      result: [
        { t: "text", v: "1/4 + 2/3 = " },
        { t: "frac", n: 11, d: 12 },
      ],
    };
  },
  visual(p: AddUnlikeParams) {
    return {
      type: "number_line",
      min: 0,
      max: 2,
      divisions: Number(lcm(BigInt(p.b), BigInt(p.d))) * 2,
    };
  },
};

export const subtractUnlikeTemplate: Template<AddUnlikeParams> = {
  id: "MATH-FRAC-ADDUNLIKE/subtract-two",
  version: 1,
  conceptId: "MATH-FRAC-ADDUNLIKE",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): AddUnlikeParams | null {
    const b = rng.int(2, 10);
    let d = rng.int(2, 10);
    while (d === b) d = rng.int(2, 10);
    const L = Number(lcm(BigInt(b), BigInt(d)));
    if (L > 60) return null;

    const a = rng.int(1, b - 1);
    const c = rng.int(1, d - 1);

    const r1 = rational(BigInt(a), BigInt(b));
    const r2 = rational(BigInt(c), BigInt(d));
    // require r1 > r2
    if (r1.n * r2.d <= r2.n * r1.d) return null;

    const diff = sub(r1, r2);
    // ensure MC-SUB-ACROSS doesn't divide by zero or collide
    if (b === d || a === c) return null;
    const mcNum = a - c;
    const mcDen = b - d;
    if (mcDen === 0) return null;
    const mcVal = rational(BigInt(mcNum), BigInt(mcDen));
    if (mcVal.n * diff.d === diff.n * mcVal.d) return null;

    return { a, b, c, d };
  },
  prompt(p: AddUnlikeParams): RichText {
    return [
      { t: "text", v: "Subtract and write in simplest form: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " - " },
      { t: "frac", n: p.c, d: p.d },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: AddUnlikeParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    return { kind: "rational", value: sub(r1, r2), form: "simplest" };
  },
  misconceptions(p: AddUnlikeParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    if (p.b !== p.d && p.a !== p.c) {
      const mcNum = p.a - p.c;
      const mcDen = p.b - p.d;
      if (mcDen !== 0) {
        const mcVal = rational(BigInt(mcNum), BigInt(mcDen));
        const r1 = rational(BigInt(p.a), BigInt(p.b));
        const r2 = rational(BigInt(p.c), BigInt(p.d));
        const diff = sub(r1, r2);
        if (mcVal.n * diff.d !== diff.n * mcVal.d) {
          result["MC-SUB-ACROSS"] = mcVal;
        }
      }
    }
    return result;
  },
  hints(p: AddUnlikeParams) {
    return [
      [
        {
          t: "text",
          v: `Find the least common multiple of ${p.b} and ${p.d} for the common denominator.`,
        },
      ],
      [{ t: "text", v: "Scale both fractions so their denominators match." }],
      [{ t: "text", v: "Subtract the numerators and reduce to lowest terms." }],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: "3/4 - 1/3: Common denominator is 12." }],
        [{ t: "text", v: "3/4 = 9/12 and 1/3 = 4/12." }],
        [{ t: "text", v: "Subtract: 9/12 - 4/12 = 5/12." }],
      ],
      result: [
        { t: "text", v: "3/4 - 1/3 = " },
        { t: "frac", n: 5, d: 12 },
      ],
    };
  },
};

export const addunlikeTemplates = [
  addUnlikeMultipleTemplate,
  addUnlikeTwoTemplate,
  subtractUnlikeTemplate,
] as const;
