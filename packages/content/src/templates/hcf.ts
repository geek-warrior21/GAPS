import { type RichText, type Rng, gcd } from "@gaps/domain";
import type { Template } from "../types";

export interface HcfParams {
  readonly x: number;
  readonly y: number;
}

export const hcfTwoNumbersTemplate: Template<HcfParams> = {
  id: "MATH-NUM-HCF/two-numbers",
  version: 1,
  conceptId: "MATH-NUM-HCF",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): HcfParams | null {
    const g = rng.int(2, 6);
    const m = rng.int(2, 4);
    let n = rng.int(2, 5);
    while (n === m || Number(gcd(BigInt(m), BigInt(n))) !== 1) {
      n = rng.int(2, 5);
    }
    const x = g * m;
    const y = g * n;
    return { x: Math.min(x, y), y: Math.max(x, y) };
  },
  prompt(p: HcfParams): RichText {
    return [{ t: "text", v: `What is the highest common factor (HCF) of ${p.x} and ${p.y}?` }];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: HcfParams) {
    const val = gcd(BigInt(p.x), BigInt(p.y));
    return { kind: "integer", value: val };
  },
  hints(p: HcfParams) {
    return [
      [{ t: "text", v: `List all numbers that divide ${p.x} without remainder.` }],
      [{ t: "text", v: `List all numbers that divide ${p.y} without remainder.` }],
      [{ t: "text", v: "Find the greatest factor present in both lists." }],
    ];
  },
  workedExample(_rng: Rng, p: HcfParams) {
    let exX = 12;
    let exY = 18;
    if (p.x === 12 && p.y === 18) {
      exX = 10;
      exY = 15;
    }
    const ans = Number(gcd(BigInt(exX), BigInt(exY)));
    return {
      steps: [
        [{ t: "text", v: `Factors of ${exX}: 1, 2, 3, 6, 12.` }],
        [{ t: "text", v: `Factors of ${exY}: 1, 2, 3, 6, 9, 18.` }],
      ],
      result: [{ t: "text", v: `The common factors are 1, 2, 3, 6. The HCF is ${ans}.` }],
    };
  },
};

export const hcfMediumTemplate: Template<HcfParams> = {
  id: "MATH-NUM-HCF/common-factors",
  version: 1,
  conceptId: "MATH-NUM-HCF",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): HcfParams | null {
    const g = rng.int(3, 8);
    const m = rng.int(2, 5);
    let n = rng.int(3, 6);
    while (n === m || Number(gcd(BigInt(m), BigInt(n))) !== 1) {
      n = rng.int(3, 6);
    }
    const x = g * m;
    const y = g * n;
    return { x: Math.min(x, y), y: Math.max(x, y) };
  },
  prompt(p: HcfParams): RichText {
    return [{ t: "text", v: `Find the HCF of ${p.x} and ${p.y}.` }];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: HcfParams) {
    const val = gcd(BigInt(p.x), BigInt(p.y));
    return { kind: "integer", value: val };
  },
  hints(p: HcfParams) {
    return [
      [{ t: "text", v: `Think of prime factors of ${p.x} and ${p.y}.` }],
      [{ t: "text", v: "Multiply the common prime factors together." }],
      [{ t: "text", v: "The product of common factors gives the HCF." }],
    ];
  },
  workedExample(_rng: Rng, _p: HcfParams) {
    const exX = 20;
    const exY = 30;
    return {
      steps: [
        [{ t: "text", v: `Prime factors of ${exX} = 2 × 2 × 5.` }],
        [{ t: "text", v: `Prime factors of ${exY} = 2 × 3 × 5.` }],
      ],
      result: [{ t: "text", v: "Common factors are 2 and 5. HCF = 2 × 5 = 10." }],
    };
  },
};

export const hcfLargeTemplate: Template<HcfParams> = {
  id: "MATH-NUM-HCF/large-pair",
  version: 1,
  conceptId: "MATH-NUM-HCF",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): HcfParams | null {
    const g = rng.int(6, 14);
    const m = rng.int(2, 5);
    let n = rng.int(3, 7);
    while (n === m || Number(gcd(BigInt(m), BigInt(n))) !== 1) {
      n = rng.int(3, 7);
    }
    const x = g * m;
    const y = g * n;
    return { x: Math.min(x, y), y: Math.max(x, y) };
  },
  prompt(p: HcfParams): RichText {
    return [
      {
        t: "text",
        v: `A carpenter cuts wooden planks of length ${p.x} cm and ${p.y} cm into pieces of equal length. What is the greatest possible length of each piece?`,
      },
    ];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: HcfParams) {
    const val = gcd(BigInt(p.x), BigInt(p.y));
    return { kind: "integer", value: val };
  },
  hints(p: HcfParams) {
    return [
      [{ t: "text", v: "Equal pieces with zero waste means finding the HCF." }],
      [{ t: "text", v: `Find common factors that divide both ${p.x} and ${p.y}.` }],
      [{ t: "text", v: "The greatest common factor gives the maximum piece length." }],
    ];
  },
  workedExample(_rng: Rng, _p: HcfParams) {
    const exX = 24;
    const exY = 36;
    return {
      steps: [
        [
          {
            t: "text",
            v: `Find HCF of ${exX} and ${exY}. Factors of ${exX} include 12; factors of ${exY} include 12.`,
          },
        ],
        [{ t: "text", v: "12 is the largest divisor of both." }],
      ],
      result: [{ t: "text", v: "Maximum length = 12 cm." }],
    };
  },
};

export const hcfTemplates = [hcfTwoNumbersTemplate, hcfMediumTemplate, hcfLargeTemplate] as const;
