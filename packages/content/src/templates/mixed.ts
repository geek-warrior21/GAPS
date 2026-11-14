import {
  type ComparisonSymbol,
  type MisconceptionId,
  type Rational,
  type RichText,
  type Rng,
  rational,
} from "@gaps/domain";
import type { Template } from "../types";

export interface MixedParams {
  readonly w: number;
  readonly a: number;
  readonly b: number;
}

export const improperToMixedTemplate: Template<MixedParams> = {
  id: "MATH-FRAC-MIXED/improper-to-mixed",
  version: 1,
  conceptId: "MATH-FRAC-MIXED",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): MixedParams | null {
    const w = rng.int(1, 4);
    const b = rng.int(2, 6);
    const a = rng.int(1, b - 1);
    return { w, a, b };
  },
  prompt(p: MixedParams): RichText {
    const num = p.w * p.b + p.a;
    return [
      { t: "text", v: "Convert the improper fraction to a mixed number: " },
      { t: "frac", n: num, d: p.b },
    ];
  },
  input() {
    return { kind: "mixed" };
  },
  answer(p: MixedParams) {
    const num = p.w * p.b + p.a;
    return { kind: "rational", value: rational(BigInt(num), BigInt(p.b)), form: "mixed" };
  },
  hints(p: MixedParams) {
    const num = p.w * p.b + p.a;
    return [
      [{ t: "text", v: `Divide ${num} by ${p.b} to find the whole number of times it fits.` }],
      [
        {
          t: "text",
          v: "The quotient becomes the whole number; the remainder becomes the new numerator.",
        },
      ],
      [{ t: "text", v: `Keep the original denominator ${p.b} for the fractional part.` }],
    ];
  },
  workedExample(_rng: Rng, _p: MixedParams) {
    const exW = 2;
    const exA = 1;
    const exB = 3;
    const exNum = exW * exB + exA;
    return {
      steps: [
        [
          {
            t: "text",
            v: `Convert ${exNum}/${exB} to mixed: ${exNum} ÷ ${exB} = ${exW} remainder ${exA}.`,
          },
        ],
        [{ t: "text", v: `Whole is ${exW}; leftover fraction is ${exA}/${exB}.` }],
      ],
      result: [
        { t: "text", v: `${exNum}/${exB} = ` },
        { t: "mixed", w: exW, n: exA, d: exB },
      ],
    };
  },
};

export const mixedToImproperTemplate: Template<MixedParams> = {
  id: "MATH-FRAC-MIXED/mixed-to-improper",
  version: 1,
  conceptId: "MATH-FRAC-MIXED",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): MixedParams | null {
    const w = rng.int(1, 4);
    const b = rng.int(2, 6);
    const a = rng.int(1, b - 1);
    const correctNum = w * b + a;
    const mcAdd = w + a;
    const mcProd = w * a + b;
    // ensure misconceptions do not collide with answer or each other
    if (mcAdd === correctNum || mcProd === correctNum || mcAdd === mcProd) {
      return null;
    }
    return { w, a, b };
  },
  prompt(p: MixedParams): RichText {
    return [
      { t: "text", v: "Write the mixed number as an improper fraction: " },
      { t: "mixed", w: p.w, n: p.a, d: p.b },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: MixedParams) {
    const num = p.w * p.b + p.a;
    return { kind: "rational", value: rational(BigInt(num), BigInt(p.b)), form: "improper" };
  },
  misconceptions(p: MixedParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    const correctNum = p.w * p.b + p.a;
    const mcAdd = p.w + p.a;
    const mcProd = p.w * p.a + p.b;

    if (mcAdd !== correctNum && mcAdd !== mcProd) {
      result["MC-MIXED-ADD-PARTS"] = rational(BigInt(mcAdd), BigInt(p.b));
    }
    if (mcProd !== correctNum && mcProd !== mcAdd) {
      result["MC-MIXED-WRONG-PRODUCT"] = rational(BigInt(mcProd), BigInt(p.b));
    }
    return result;
  },
  hints(p: MixedParams) {
    return [
      [{ t: "text", v: `Multiply the whole number by the denominator: ${p.w} × ${p.b}.` }],
      [{ t: "text", v: `Add the numerator ${p.a} to that product.` }],
      [{ t: "text", v: `Write the total sum over ${p.b}.` }],
    ];
  },
  workedExample(_rng: Rng, _p: MixedParams) {
    const exW = 3;
    const exA = 1;
    const exB = 4;
    const exNum = exW * exB + exA;
    return {
      steps: [
        [{ t: "text", v: `Convert 3 1/4: Multiply 3 × 4 = 12.` }],
        [{ t: "text", v: `Add the top number: 12 + 1 = 13. Put over 4.` }],
      ],
      result: [
        { t: "text", v: `3 1/4 = ` },
        { t: "frac", n: exNum, d: exB },
      ],
    };
  },
};

export const mixedWordTemplate: Template<MixedParams> = {
  id: "MATH-FRAC-MIXED/roti-plates",
  version: 1,
  conceptId: "MATH-FRAC-MIXED",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): MixedParams | null {
    const w = rng.int(2, 5);
    const b = rng.int(3, 8);
    const a = rng.int(1, b - 1);
    return { w, a, b };
  },
  prompt(p: MixedParams): RichText {
    return [
      {
        t: "text",
        v: `A cook made ${p.w} full plates of rotis, and each plate has ${p.b} equal pieces. There are ${p.a} extra pieces. Write total pieces as an improper fraction of a plate:`,
      },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: MixedParams) {
    const num = p.w * p.b + p.a;
    return { kind: "rational", value: rational(BigInt(num), BigInt(p.b)), form: "improper" };
  },
  hints(p: MixedParams) {
    return [
      [{ t: "text", v: `Calculate total pieces in the ${p.w} full plates: ${p.w} × ${p.b}.` }],
      [{ t: "text", v: `Add the ${p.a} extra pieces.` }],
      [{ t: "text", v: `Write that total count over the plate size (${p.b}).` }],
    ];
  },
  workedExample(_rng: Rng, _p: MixedParams) {
    const exW = 2;
    const exA = 3;
    const exB = 5;
    const exTot = exW * exB + exA;
    return {
      steps: [
        [{ t: "text", v: `2 full plates of 5 pieces each = 2 × 5 = 10 pieces.` }],
        [{ t: "text", v: `Add 3 extra pieces: 10 + 3 = 13 pieces.` }],
      ],
      result: [
        { t: "text", v: `Fraction = ` },
        { t: "frac", n: exTot, d: exB },
      ],
    };
  },
};

export const mixedTemplates = [
  improperToMixedTemplate,
  mixedToImproperTemplate,
  mixedWordTemplate,
] as const;
