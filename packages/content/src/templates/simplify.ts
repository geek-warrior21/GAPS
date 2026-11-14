import { type RichText, type Rng, gcd, rational } from "@gaps/domain";
import type { Template } from "../types";

export interface SimplifyParams {
  readonly a: number;
  readonly b: number;
  readonly k: number;
}

export const simplifyBasicTemplate: Template<SimplifyParams> = {
  id: "MATH-FRAC-SIMPLIFY/basic-factor",
  version: 1,
  conceptId: "MATH-FRAC-SIMPLIFY",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): SimplifyParams | null {
    const k = rng.pick([2, 3, 5]);
    const b = rng.int(2, 6);
    const a = rng.int(1, b - 1);
    if (Number(gcd(BigInt(a), BigInt(b))) !== 1) return null;
    return { a, b, k };
  },
  prompt(p: SimplifyParams): RichText {
    const num = p.a * p.k;
    const den = p.b * p.k;
    return [
      { t: "text", v: "Write the fraction in simplest form: " },
      { t: "frac", n: num, d: den },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: SimplifyParams) {
    return { kind: "rational", value: rational(BigInt(p.a), BigInt(p.b)), form: "simplest" };
  },
  hints(p: SimplifyParams) {
    const num = p.a * p.k;
    const den = p.b * p.k;
    return [
      [{ t: "text", v: `Find a common factor that divides both ${num} and ${den}.` }],
      [{ t: "text", v: "Divide both the numerator and denominator by that common factor." }],
      [{ t: "text", v: "Continue dividing until no common factors remain." }],
    ];
  },
  workedExample(_rng: Rng, p: SimplifyParams) {
    let exA = 2;
    let exB = 5;
    let exK = 3;
    if (p.a === 2 && p.b === 5) {
      exA = 3;
      exB = 4;
      exK = 2;
    }
    const exNum = exA * exK;
    const exDen = exB * exK;
    return {
      steps: [
        [{ t: "text", v: `Simplify ${exNum}/${exDen}. Common factor is ${exK}.` }],
        [{ t: "text", v: `${exNum} ÷ ${exK} = ${exA}; ${exDen} ÷ ${exK} = ${exB}.` }],
      ],
      result: [
        { t: "text", v: `Simplest form = ` },
        { t: "frac", n: exA, d: exB },
      ],
    };
  },
};

export const simplifyMediumTemplate: Template<SimplifyParams> = {
  id: "MATH-FRAC-SIMPLIFY/two-step",
  version: 1,
  conceptId: "MATH-FRAC-SIMPLIFY",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): SimplifyParams | null {
    const k = rng.int(4, 8);
    const b = rng.int(3, 7);
    const a = rng.int(1, b - 1);
    if (Number(gcd(BigInt(a), BigInt(b))) !== 1) return null;
    return { a, b, k };
  },
  prompt(p: SimplifyParams): RichText {
    const num = p.a * p.k;
    const den = p.b * p.k;
    return [
      { t: "text", v: "Reduce to lowest terms: " },
      { t: "frac", n: num, d: den },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: SimplifyParams) {
    return { kind: "rational", value: rational(BigInt(p.a), BigInt(p.b)), form: "simplest" };
  },
  hints(p: SimplifyParams) {
    const num = p.a * p.k;
    const den = p.b * p.k;
    return [
      [{ t: "text", v: `Find the HCF of ${num} and ${den}.` }],
      [{ t: "text", v: "Divide both numerator and denominator by their HCF." }],
      [{ t: "text", v: "Write the irreducible fraction in lowest terms." }],
    ];
  },
  workedExample(_rng: Rng, _p: SimplifyParams) {
    const exNum = 12;
    const exDen = 20;
    return {
      steps: [
        [{ t: "text", v: `Find HCF of ${exNum} and ${exDen}, which is 4.` }],
        [{ t: "text", v: `${exNum} ÷ 4 = 3 and ${exDen} ÷ 4 = 5.` }],
      ],
      result: [
        { t: "text", v: `Lowest terms = ` },
        { t: "frac", n: 3, d: 5 },
      ],
    };
  },
};

export const simplifyLargeTemplate: Template<SimplifyParams> = {
  id: "MATH-FRAC-SIMPLIFY/large-terms",
  version: 1,
  conceptId: "MATH-FRAC-SIMPLIFY",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): SimplifyParams | null {
    const k = rng.int(6, 12);
    const b = rng.int(3, 8);
    const a = rng.int(2, b - 1);
    if (Number(gcd(BigInt(a), BigInt(b))) !== 1) return null;
    if (b * k > 96) return null;
    return { a, b, k };
  },
  prompt(p: SimplifyParams): RichText {
    const num = p.a * p.k;
    const den = p.b * p.k;
    return [
      {
        t: "text",
        v: `Kabir collected ${num} out of ${den} points in a quiz. Express this fraction in simplest form:`,
      },
      { t: "frac", n: num, d: den },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: SimplifyParams) {
    return { kind: "rational", value: rational(BigInt(p.a), BigInt(p.b)), form: "simplest" };
  },
  hints(p: SimplifyParams) {
    const num = p.a * p.k;
    const den = p.b * p.k;
    return [
      [{ t: "text", v: `What is the greatest number that divides both ${num} and ${den}?` }],
      [{ t: "text", v: "Divide by the HCF to reach simplest form in one step." }],
      [{ t: "text", v: "Verify that no remaining common factor exists." }],
    ];
  },
  workedExample(_rng: Rng, _p: SimplifyParams) {
    const exNum = 28;
    const exDen = 42;
    return {
      steps: [
        [{ t: "text", v: `Find HCF of ${exNum} and ${exDen}, which is 14.` }],
        [{ t: "text", v: `${exNum} ÷ 14 = 2 and ${exDen} ÷ 14 = 3.` }],
      ],
      result: [
        { t: "text", v: `Simplest form = ` },
        { t: "frac", n: 2, d: 3 },
      ],
    };
  },
};

export const simplifyTemplates = [
  simplifyBasicTemplate,
  simplifyMediumTemplate,
  simplifyLargeTemplate,
] as const;
