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

export interface DecTenthsParams {
  readonly a: number;
}

export const decTenthsTemplate: Template<DecTenthsParams> = {
  id: "MATH-FRAC-DEC/tenths-to-decimal",
  version: 1,
  conceptId: "MATH-FRAC-DEC",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): DecTenthsParams | null {
    const a = rng.int(1, 35);
    if (a % 10 === 0) return null;
    return { a };
  },
  prompt(p: DecTenthsParams): RichText {
    return [
      { t: "text", v: "Convert to a decimal: " },
      { t: "frac", n: p.a, d: 10 },
    ];
  },
  input() {
    return { kind: "decimal" };
  },
  answer(p: DecTenthsParams) {
    return { kind: "decimal", value: rational(BigInt(p.a), 10n) };
  },
  hints() {
    return [
      [{ t: "text", v: "Tenths place is one place after the decimal point." }],
      [{ t: "text", v: "Dividing by 10 shifts the decimal point one place to the left." }],
      [{ t: "text", v: "Place the decimal point before the last digit." }],
    ];
  },
  workedExample(rng: Rng, p: DecTenthsParams) {
    let exA = 3;
    if (p.a === 3) exA = 7;
    return {
      steps: [
        [{ t: "text", v: `${exA}/10 means ${exA} tenths.` }],
        [{ t: "text", v: `Place ${exA} in the tenths spot after the decimal point.` }],
      ],
      result: [{ t: "text", v: `${exA}/10 = 0.${exA}` }],
    };
  },
};

export interface DecHundredthsParams {
  readonly a: number;
  readonly b: number;
}

export const decHundredthsTemplate: Template<DecHundredthsParams> = {
  id: "MATH-FRAC-DEC/hundredths-to-decimal",
  version: 1,
  conceptId: "MATH-FRAC-DEC",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): DecHundredthsParams | null {
    const b = rng.pick([2, 4, 5, 20, 25, 50]);
    const a = rng.int(1, b - 1);
    if (Number(gcd(BigInt(a), BigInt(b))) !== 1) return null;
    return { a, b };
  },
  prompt(p: DecHundredthsParams): RichText {
    return [
      { t: "text", v: "Write as a decimal: " },
      { t: "frac", n: p.a, d: p.b },
    ];
  },
  input() {
    return { kind: "decimal" };
  },
  answer(p: DecHundredthsParams) {
    return { kind: "decimal", value: rational(BigInt(p.a), BigInt(p.b)) };
  },
  misconceptions(p: DecHundredthsParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    // MC-DEC-DIGITS concatenates numerator and denominator as digits e.g. 1/4 -> 0.14
    // 0.ab = (a*10 + b) / 100 if b < 10, or (a*100 + b) / 1000
    const mcVal =
      p.b < 10 ? rational(BigInt(p.a * 10 + p.b), 100n) : rational(BigInt(p.a * 100 + p.b), 1000n);
    const correct = rational(BigInt(p.a), BigInt(p.b));
    if (mcVal.n * correct.d !== correct.n * mcVal.d) {
      result["MC-DEC-DIGITS"] = mcVal;
    }
    return result;
  },
  hints(p: DecHundredthsParams) {
    const factor = 100 / p.b;
    return [
      [{ t: "text", v: `Scale the denominator to 100: multiply by ${factor}.` }],
      [
        {
          t: "text",
          v: `Multiply the numerator by ${factor} as well: ${p.a} × ${factor} = ${p.a * factor}.`,
        },
      ],
      [{ t: "text", v: `Write ${p.a * factor}/100 as a hundredths decimal.` }],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: "Convert 1/4 to a decimal: Multiply by 25 to make denominator 100." }],
        [{ t: "text", v: "1/4 = 25/100, which is 25 hundredths." }],
      ],
      result: [{ t: "text", v: "1/4 = 0.25" }],
    };
  },
};

export interface DecToFracParams {
  readonly num: number;
  readonly den: number;
}

export const decToFracTemplate: Template<DecToFracParams> = {
  id: "MATH-FRAC-DEC/decimal-to-fraction",
  version: 1,
  conceptId: "MATH-FRAC-DEC",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): DecToFracParams | null {
    const den = rng.pick([2, 4, 5, 10, 20, 25]);
    const num = rng.int(1, den - 1);
    if (Number(gcd(BigInt(num), BigInt(den))) !== 1) return null;
    return { num, den };
  },
  prompt(p: DecToFracParams): RichText {
    const hundredths = (p.num * 100) / p.den;
    const decStr = (hundredths / 100).toFixed(hundredths % 10 === 0 ? 1 : 2);
    return [{ t: "text", v: `Convert ${decStr} to a fraction in simplest form:` }];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: DecToFracParams) {
    return { kind: "rational", value: rational(BigInt(p.num), BigInt(p.den)), form: "simplest" };
  },
  hints() {
    return [
      [
        {
          t: "text",
          v: "Read the decimal place value (tenths or hundredths) and write it as a fraction.",
        },
      ],
      [{ t: "text", v: "Find the highest common factor of the numerator and denominator." }],
      [{ t: "text", v: "Divide top and bottom by their HCF to reduce to simplest form." }],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: "Convert 0.75 to simplest fraction: 0.75 = 75/100." }],
        [{ t: "text", v: "Divide 75 and 100 by their HCF 25: 75÷25 = 3; 100÷25 = 4." }],
      ],
      result: [
        { t: "text", v: "0.75 = " },
        { t: "frac", n: 3, d: 4 },
      ],
    };
  },
};

export const decTemplates = [decTenthsTemplate, decHundredthsTemplate, decToFracTemplate] as const;
