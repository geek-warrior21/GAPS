import {
  type ComparisonSymbol,
  type MisconceptionId,
  type Rational,
  type RichText,
  type Rng,
  rational,
} from "@gaps/domain";
import type { Template } from "../types";

export interface NumlineParams {
  readonly a: number;
  readonly b: number;
}

export const numlineUnitTemplate: Template<NumlineParams> = {
  id: "MATH-FRAC-NUMLINE/unit-interval",
  version: 1,
  conceptId: "MATH-FRAC-NUMLINE",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): NumlineParams | null {
    const b = rng.int(2, 8);
    const a = rng.int(1, b - 1);
    return { a, b };
  },
  prompt(p: NumlineParams): RichText {
    return [
      {
        t: "text",
        v: `On a number line from 0 to 1, the space is split into ${p.b} equal hops. Point P is ${p.a} hops from 0. What fraction does point P show?`,
      },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: NumlineParams) {
    return { kind: "rational", value: rational(BigInt(p.a), BigInt(p.b)), form: "any" };
  },
  misconceptions(p: NumlineParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    result["MC-NUMLINE-TICKS"] = rational(BigInt(p.a), BigInt(p.b + 1));
    return result;
  },
  hints() {
    return [
      [{ t: "text", v: "Count the equal gaps between 0 and 1." }],
      [{ t: "text", v: "The total number of gaps is the denominator." }],
      [{ t: "text", v: "The number of hops from 0 is the numerator." }],
    ];
  },
  workedExample(rng: Rng, p: NumlineParams) {
    let exB = rng.int(3, 7);
    while (exB === p.b) exB = rng.int(3, 7);
    const exA = rng.int(1, exB - 1);
    return {
      steps: [
        [{ t: "text", v: `From 0 to 1 there are ${exB} equal gaps. A dot is at gap ${exA}.` }],
        [{ t: "text", v: "Gaps hopped goes on top; total gaps goes on the bottom." }],
      ],
      result: [
        { t: "text", v: `Point = ` },
        { t: "frac", n: exA, d: exB },
        { t: "text", v: "." },
      ],
    };
  },
  visual(p: NumlineParams) {
    return {
      type: "number_line",
      min: 0,
      max: 1,
      divisions: p.b,
      markers: [{ value: rational(BigInt(p.a), BigInt(p.b)) }],
    };
  },
};

export interface NumlineMixedParams {
  readonly whole: number;
  readonly a: number;
  readonly b: number;
}

export const numlineMixedTemplate: Template<NumlineMixedParams> = {
  id: "MATH-FRAC-NUMLINE/beyond-one",
  version: 1,
  conceptId: "MATH-FRAC-NUMLINE",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): NumlineMixedParams | null {
    const whole = rng.int(1, 2);
    const b = rng.int(2, 8);
    const a = rng.int(1, b - 1);
    return { whole, a, b };
  },
  prompt(p: NumlineMixedParams): RichText {
    return [
      {
        t: "text",
        v: `A number line has each whole divided into ${p.b} equal parts. Point Q is ${p.a} parts past ${p.whole}. What improper fraction does Q show?`,
      },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: NumlineMixedParams) {
    const num = p.whole * p.b + p.a;
    return { kind: "rational", value: rational(BigInt(num), BigInt(p.b)), form: "any" };
  },
  hints(p: NumlineMixedParams) {
    return [
      [{ t: "text", v: `One whole contains ${p.b} equal parts.` }],
      [{ t: "text", v: `Add the extra ${p.a} parts past 1 to find the total parts from 0.` }],
      [{ t: "text", v: `Write the total parts over ${p.b}.` }],
    ];
  },
  workedExample(rng: Rng, p: NumlineMixedParams) {
    let exB = rng.int(3, 5);
    while (exB === p.b) exB = rng.int(3, 5);
    const exA = rng.int(1, exB - 1);
    const exTot = exB + exA;
    return {
      steps: [
        [{ t: "text", v: `1 whole is ${exB}/${exB}. Point is ${exA} parts past 1.` }],
        [{ t: "text", v: `Total parts from 0 = ${exB} + ${exA} = ${exTot}.` }],
      ],
      result: [
        { t: "text", v: `Fraction = ` },
        { t: "frac", n: exTot, d: exB },
        { t: "text", v: "." },
      ],
    };
  },
  visual(p: NumlineMixedParams) {
    return {
      type: "number_line",
      min: 0,
      max: 2,
      divisions: p.b * 2,
      markers: [{ value: rational(BigInt(p.whole * p.b + p.a), BigInt(p.b)) }],
    };
  },
};

export const numlineStepTemplate: Template<NumlineParams> = {
  id: "MATH-FRAC-NUMLINE/step-count",
  version: 1,
  conceptId: "MATH-FRAC-NUMLINE",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): NumlineParams | null {
    const b = rng.int(6, 12);
    const a = rng.int(2, b - 2);
    return { a, b };
  },
  prompt(p: NumlineParams): RichText {
    return [
      {
        t: "text",
        v: `On a ruler from 0 to 1 centimetre with ${p.b} equal divisions, a beetle crawls ${p.a} divisions. What fraction of a centimetre did it crawl?`,
      },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: NumlineParams) {
    return { kind: "rational", value: rational(BigInt(p.a), BigInt(p.b)), form: "any" };
  },
  misconceptions(p: NumlineParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    result["MC-NUMLINE-TICKS"] = rational(BigInt(p.a), BigInt(p.b + 1));
    return result;
  },
  hints() {
    return [
      [{ t: "text", v: "Find how many equal divisions make one full centimetre." }],
      [{ t: "text", v: "The crawled divisions form the top number." }],
      [{ t: "text", v: "Divisions crawled over total divisions gives the fraction." }],
    ];
  },
  workedExample(rng: Rng, p: NumlineParams) {
    let exB = rng.int(8, 12);
    while (exB === p.b) exB = rng.int(8, 12);
    const exA = rng.int(3, exB - 2);
    return {
      steps: [
        [{ t: "text", v: `Total divisions = ${exB}. Beetle moved ${exA} divisions.` }],
        [{ t: "text", v: "Denominator is total divisions in 1 cm." }],
      ],
      result: [
        { t: "text", v: `Fraction = ` },
        { t: "frac", n: exA, d: exB },
        { t: "text", v: "." },
      ],
    };
  },
};

export const numlineTemplates = [
  numlineUnitTemplate,
  numlineMixedTemplate,
  numlineStepTemplate,
] as const;
