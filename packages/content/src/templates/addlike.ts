import {
  type ComparisonSymbol,
  type MisconceptionId,
  type Rational,
  type RichText,
  type Rng,
  rational,
} from "@gaps/domain";
import type { Template } from "../types";

export interface AddLikeParams {
  readonly a: number;
  readonly c: number;
  readonly b: number;
}

export const addLikeSimpleTemplate: Template<AddLikeParams> = {
  id: "MATH-FRAC-ADDLIKE/add-two",
  version: 1,
  conceptId: "MATH-FRAC-ADDLIKE",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): AddLikeParams | null {
    const b = rng.int(4, 10);
    const a = rng.int(1, b - 2);
    const c = rng.int(1, b - 1 - a);
    return { a, c, b };
  },
  prompt(p: AddLikeParams): RichText {
    return [
      { t: "text", v: "Add the fractions: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " + " },
      { t: "frac", n: p.c, d: p.b },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: AddLikeParams) {
    return {
      kind: "rational",
      value: rational(BigInt(p.a + p.c), BigInt(p.b)),
      form: "any",
    };
  },
  misconceptions(p: AddLikeParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    const sum = p.a + p.c;
    const doubleB = p.b * 2;
    // When adding like fractions, adding denominators gives (a+c)/(2b)
    result["MC-ADD-DENOMS-LIKE"] = rational(BigInt(sum), BigInt(doubleB));
    return result;
  },
  hints(p: AddLikeParams) {
    return [
      [{ t: "text", v: `The bottom numbers are both ${p.b}. Keep the denominator unchanged.` }],
      [{ t: "text", v: `Add the top numbers: ${p.a} + ${p.c} = ☐.` }],
      [{ t: "text", v: `Write the sum over ${p.b}.` }],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: `Add 2/7 + 3/7. Denominators are the same (7).` }],
        [{ t: "text", v: `Add numerators: 2 + 3 = 5. Keep denominator 7.` }],
      ],
      result: [
        { t: "text", v: `2/7 + 3/7 = ` },
        { t: "frac", n: 5, d: 7 },
      ],
    };
  },
  visual(p: AddLikeParams) {
    return {
      type: "fraction_bar",
      bars: [
        { parts: p.b, shaded: p.a },
        { parts: p.b, shaded: p.c },
      ],
    };
  },
};

export const subtractLikeTemplate: Template<AddLikeParams> = {
  id: "MATH-FRAC-ADDLIKE/subtract-two",
  version: 1,
  conceptId: "MATH-FRAC-ADDLIKE",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): AddLikeParams | null {
    const b = rng.int(4, 10);
    const a = rng.int(2, b - 1);
    const c = rng.int(1, a - 1);
    return { a, c, b };
  },
  prompt(p: AddLikeParams): RichText {
    return [
      { t: "text", v: "Subtract the fractions: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " - " },
      { t: "frac", n: p.c, d: p.b },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: AddLikeParams) {
    return {
      kind: "rational",
      value: rational(BigInt(p.a - p.c), BigInt(p.b)),
      form: "any",
    };
  },
  hints(p: AddLikeParams) {
    return [
      [{ t: "text", v: `The denominators are equal (${p.b}). The bottom stays ${p.b}.` }],
      [{ t: "text", v: `Subtract the top numbers: ${p.a} - ${p.c} = ☐.` }],
      [{ t: "text", v: `Write the result over ${p.b}.` }],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: `Subtract 5/9 - 2/9. Keep denominator 9.` }],
        [{ t: "text", v: `Subtract numerators: 5 - 2 = 3.` }],
      ],
      result: [
        { t: "text", v: `5/9 - 2/9 = ` },
        { t: "frac", n: 3, d: 9 },
      ],
    };
  },
};

export const addLikeSimplifyTemplate: Template<AddLikeParams> = {
  id: "MATH-FRAC-ADDLIKE/sum-simplify",
  version: 1,
  conceptId: "MATH-FRAC-ADDLIKE",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): AddLikeParams | null {
    // Generate like addition that requires simplest form reduction
    const b = rng.pick([6, 8, 10, 12]);
    const a = rng.int(1, b - 3);
    const c = rng.int(1, b - 1 - a);
    const sum = a + c;
    if (sum >= b) return null;
    const r = rational(BigInt(sum), BigInt(b));
    if (r.d === BigInt(b)) return null; // must be reducible
    return { a, c, b };
  },
  prompt(p: AddLikeParams): RichText {
    return [
      { t: "text", v: "Add and express in simplest form: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " + " },
      { t: "frac", n: p.c, d: p.b },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: AddLikeParams) {
    return {
      kind: "rational",
      value: rational(BigInt(p.a + p.c), BigInt(p.b)),
      form: "simplest",
    };
  },
  hints(p: AddLikeParams) {
    return [
      [{ t: "text", v: `First add the numerators over the common denominator ${p.b}.` }],
      [{ t: "text", v: `Then find any common factors between ${p.a + p.c} and ${p.b}.` }],
      [{ t: "text", v: `Divide by the HCF to write the answer in lowest terms.` }],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: `1/8 + 3/8 = 4/8.` }],
        [{ t: "text", v: `Simplify 4/8: divide top and bottom by 4.` }],
      ],
      result: [
        { t: "text", v: `4/8 = ` },
        { t: "frac", n: 1, d: 2 },
      ],
    };
  },
};

export const addlikeTemplates = [
  addLikeSimpleTemplate,
  subtractLikeTemplate,
  addLikeSimplifyTemplate,
] as const;
