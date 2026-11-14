import {
  type ComparisonSymbol,
  type MisconceptionId,
  type Rational,
  type RichText,
  type Rng,
  gcd,
  rational,
} from "@gaps/domain";
import type { Template } from "../types";

export interface EquivNumParams {
  readonly a: number;
  readonly b: number;
  readonly k: number;
}

export const equivMissingNumeratorTemplate: Template<EquivNumParams> = {
  id: "MATH-FRAC-EQUIV/missing-numerator",
  version: 1,
  conceptId: "MATH-FRAC-EQUIV",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): EquivNumParams | null {
    const b = rng.int(2, 9);
    const a = rng.int(1, b - 1);
    if (Number(gcd(BigInt(a), BigInt(b))) !== 1) return null;
    const k = rng.int(2, 6);
    const D = b * k;
    if (D > 60) return null;
    // Misconception collision check
    if (a + (D - b) === a * k) return null;
    return { a, b, k };
  },
  prompt(p: EquivNumParams): RichText {
    const D = p.b * p.k;
    return [
      { t: "text", v: "Fill in the missing numerator: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " = " },
      { t: "blank" },
      { t: "text", v: ` / ${D}` },
    ];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: EquivNumParams) {
    return { kind: "integer", value: BigInt(p.a * p.k) };
  },
  misconceptions(p: EquivNumParams) {
    const D = p.b * p.k;
    const addResult = (val: number) => val + (D - p.b);
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    if (addResult(p.a) !== p.a * p.k) {
      result["MC-EQUIV-ADDITIVE"] = rational(BigInt(addResult(p.a)), 1n);
    }
    return result;
  },
  hints(p: EquivNumParams) {
    const D = p.b * p.k;
    return [
      [{ t: "text", v: `What number did we multiply ${p.b} by to get ${D}?` }],
      [{ t: "text", v: `Divide the new denominator ${D} by ${p.b} to find the multiplier.` }],
      [
        {
          t: "text",
          v: `Multiply the numerator ${p.a} by that multiplier to find the missing number.`,
        },
      ],
    ];
  },
  workedExample(_rng: Rng, p: EquivNumParams) {
    let exB = 5;
    let exA = 3;
    let exK = 4;
    if (p.b === 5 && p.a === 3) {
      exB = 4;
      exA = 1;
      exK = 3;
    }
    const exD = exB * exK;
    const exAns = exA * exK;
    return {
      steps: [
        [{ t: "text", v: `${exA}/${exB} = ☐/${exD} → ${exB} × ${exK} = ${exD}.` }],
        [{ t: "text", v: `Multiply the top number: ${exA} × ${exK} = ${exAns}.` }],
      ],
      result: [{ t: "text", v: `${exA}/${exB} = ${exAns}/${exD}` }],
    };
  },
  visual(p: EquivNumParams) {
    return {
      type: "fraction_bar",
      bars: [
        { parts: p.b, shaded: p.a },
        { parts: p.b * p.k, shaded: p.a * p.k },
      ],
    };
  },
};

export const equivMissingDenominatorTemplate: Template<EquivNumParams> = {
  id: "MATH-FRAC-EQUIV/missing-denominator",
  version: 1,
  conceptId: "MATH-FRAC-EQUIV",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): EquivNumParams | null {
    const b = rng.int(3, 10);
    const a = rng.int(1, b - 1);
    if (Number(gcd(BigInt(a), BigInt(b))) !== 1) return null;
    const k = rng.int(2, 6);
    if (b * k > 60) return null;
    return { a, b, k };
  },
  prompt(p: EquivNumParams): RichText {
    const N = p.a * p.k;
    return [
      { t: "text", v: "Fill in the missing denominator: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: ` = ${N} / ` },
      { t: "blank" },
    ];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: EquivNumParams) {
    return { kind: "integer", value: BigInt(p.b * p.k) };
  },
  hints(p: EquivNumParams) {
    const N = p.a * p.k;
    return [
      [{ t: "text", v: `What number did we multiply ${p.a} by to reach ${N}?` }],
      [{ t: "text", v: `${p.a} × ${p.k} = ${N}. Multiply the denominator by ${p.k} as well.` }],
      [{ t: "text", v: `Calculate: ${p.b} × ${p.k} = ☐.` }],
    ];
  },
  workedExample(_rng: Rng, p: EquivNumParams) {
    let exA = 2;
    let exB = 3;
    let exK = 4;
    if (p.a === 2 && p.b === 3) {
      exA = 3;
      exB = 4;
      exK = 3;
    }
    const exN = exA * exK;
    const exAns = exB * exK;
    return {
      steps: [
        [{ t: "text", v: `${exA}/${exB} = ${exN}/☐. We see ${exA} × ${exK} = ${exN}.` }],
        [{ t: "text", v: `Do the same to the bottom: ${exB} × ${exK} = ${exAns}.` }],
      ],
      result: [{ t: "text", v: `${exA}/${exB} = ${exN}/${exAns}` }],
    };
  },
};

export const equivScaleDownTemplate: Template<EquivNumParams> = {
  id: "MATH-FRAC-EQUIV/scale-down",
  version: 1,
  conceptId: "MATH-FRAC-EQUIV",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): EquivNumParams | null {
    const b = rng.int(3, 8);
    const a = rng.int(1, b - 1);
    if (Number(gcd(BigInt(a), BigInt(b))) !== 1) return null;
    const k = rng.int(2, 5);
    return { a, b, k };
  },
  prompt(p: EquivNumParams): RichText {
    const N = p.a * p.k;
    const D = p.b * p.k;
    return [
      { t: "text", v: "Fill in the missing numerator: " },
      { t: "frac", n: N, d: D },
      { t: "text", v: " = " },
      { t: "blank" },
      { t: "text", v: ` / ${p.b}` },
    ];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: EquivNumParams) {
    return { kind: "integer", value: BigInt(p.a) };
  },
  hints(p: EquivNumParams) {
    const D = p.b * p.k;
    const N = p.a * p.k;
    return [
      [{ t: "text", v: `What number divides ${D} down to ${p.b}?` }],
      [{ t: "text", v: `Divide the old denominator ${D} by ${p.b} to find the factor.` }],
      [
        {
          t: "text",
          v: `Divide the numerator ${N} by that same factor to find the missing number.`,
        },
      ],
    ];
  },
  workedExample(_rng: Rng, _p: EquivNumParams) {
    const exN = 12;
    const exD = 18;
    const exB = 3;
    const exAns = 2;
    return {
      steps: [
        [{ t: "text", v: `${exN}/${exD} = ☐/${exB}. Note that ${exD} ÷ 6 = ${exB}.` }],
        [{ t: "text", v: `Divide top by 6: ${exN} ÷ 6 = ${exAns}.` }],
      ],
      result: [{ t: "text", v: `${exN}/${exD} = ${exAns}/${exB}` }],
    };
  },
};

export const equivTemplates = [
  equivMissingNumeratorTemplate,
  equivMissingDenominatorTemplate,
  equivScaleDownTemplate,
] as const;
