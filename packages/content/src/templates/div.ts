import {
  type ComparisonSymbol,
  type MisconceptionId,
  type Rational,
  type RichText,
  type Rng,
  div,
  rational,
} from "@gaps/domain";
import type { Template } from "../types";

export interface DivUnitParams {
  readonly n: number;
  readonly d: number;
}

export const divWholeByUnitTemplate: Template<DivUnitParams> = {
  id: "MATH-FRAC-DIV/whole-by-unit",
  version: 1,
  conceptId: "MATH-FRAC-DIV",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): DivUnitParams | null {
    const n = rng.int(2, 6);
    const d = rng.int(2, 6);
    return { n, d };
  },
  prompt(p: DivUnitParams): RichText {
    return [
      { t: "text", v: `Compute: ${p.n} ÷ ` },
      { t: "frac", n: 1, d: p.d },
    ];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: DivUnitParams) {
    return { kind: "integer", value: BigInt(p.n * p.d) };
  },
  hints(p: DivUnitParams) {
    return [
      [{ t: "text", v: `Dividing by 1/${p.d} asks: how many 1/${p.d} pieces fit into ${p.n}?` }],
      [{ t: "text", v: `Each single whole has ${p.d} pieces.` }],
      [{ t: "text", v: `Multiply: ${p.n} × ${p.d} = ☐.` }],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: `3 ÷ 1/2 asks how many half-rotis are in 3 rotis.` }],
        [{ t: "text", v: `Each roti gives 2 halves, so 3 × 2 = 6 halves.` }],
      ],
      result: [{ t: "text", v: `3 ÷ 1/2 = 6` }],
    };
  },
};

export interface DivTwoParams {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export const divTwoFractionsTemplate: Template<DivTwoParams> = {
  id: "MATH-FRAC-DIV/two-fractions",
  version: 1,
  conceptId: "MATH-FRAC-DIV",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): DivTwoParams | null {
    const b = rng.int(2, 7);
    const d = rng.int(2, 7);
    const a = rng.int(1, b - 1);
    const c = rng.int(1, d - 1);

    const r1 = rational(BigInt(a), BigInt(b));
    const r2 = rational(BigInt(c), BigInt(d));
    const ans = div(r1, r2);

    const mcFlipFirst = rational(BigInt(b * c), BigInt(a * d));
    const mcNoFlip = rational(BigInt(a * c), BigInt(b * d));

    // ensure no collision with answer or between misconceptions
    if (mcFlipFirst.n * ans.d === ans.n * mcFlipFirst.d) return null;
    if (mcNoFlip.n * ans.d === ans.n * mcNoFlip.d) return null;
    if (mcFlipFirst.n * mcNoFlip.d === mcNoFlip.n * mcFlipFirst.d) return null;

    return { a, b, c, d };
  },
  prompt(p: DivTwoParams): RichText {
    return [
      { t: "text", v: "Divide and simplify: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " ÷ " },
      { t: "frac", n: p.c, d: p.d },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: DivTwoParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    return { kind: "rational", value: div(r1, r2), form: "simplest" };
  },
  misconceptions(p: DivTwoParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    const ans = div(r1, r2);

    const mcFlipFirst = rational(BigInt(p.b * p.c), BigInt(p.a * p.d));
    const mcNoFlip = rational(BigInt(p.a * p.c), BigInt(p.b * p.d));

    if (
      mcFlipFirst.n * ans.d !== ans.n * mcFlipFirst.d &&
      mcFlipFirst.n * mcNoFlip.d !== mcNoFlip.n * mcFlipFirst.d
    ) {
      result["MC-DIV-FLIP-FIRST"] = mcFlipFirst;
    }
    if (
      mcNoFlip.n * ans.d !== ans.n * mcNoFlip.d &&
      mcNoFlip.n * mcFlipFirst.d !== mcFlipFirst.n * mcNoFlip.d
    ) {
      result["MC-DIV-NO-FLIP"] = mcNoFlip;
    }
    return result;
  },
  hints(p: DivTwoParams) {
    return [
      [{ t: "text", v: "Keep the first fraction as it is." }],
      [{ t: "text", v: `Flip the second fraction to ${p.d}/${p.c} and change ÷ to ×.` }],
      [{ t: "text", v: `Multiply across: (${p.a} × ${p.d}) / (${p.b} × ${p.c}) and simplify.` }],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: "2/3 ÷ 4/5: Flip the second fraction to 5/4." }],
        [{ t: "text", v: "Multiply: 2/3 × 5/4 = 10/12." }],
        [{ t: "text", v: "Simplify 10/12 to 5/6." }],
      ],
      result: [
        { t: "text", v: "2/3 ÷ 4/5 = " },
        { t: "frac", n: 5, d: 6 },
      ],
    };
  },
};

export interface DivWholeDivisorParams {
  readonly a: number;
  readonly b: number;
  readonly n: number;
}

export const divFractionByWholeTemplate: Template<DivWholeDivisorParams> = {
  id: "MATH-FRAC-DIV/fraction-by-integer",
  version: 1,
  conceptId: "MATH-FRAC-DIV",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): DivWholeDivisorParams | null {
    const b = rng.int(2, 6);
    const a = rng.int(1, b - 1);
    const n = rng.int(2, 5);
    return { a, b, n };
  },
  prompt(p: DivWholeDivisorParams): RichText {
    return [
      { t: "text", v: `Divide: ` },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: ` ÷ ${p.n}` },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: DivWholeDivisorParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.n), 1n);
    return { kind: "rational", value: div(r1, r2), form: "simplest" };
  },
  hints(p: DivWholeDivisorParams) {
    return [
      [{ t: "text", v: `Write the whole number ${p.n} as ${p.n}/1.` }],
      [{ t: "text", v: `Flip ${p.n}/1 to 1/${p.n} and multiply.` }],
      [{ t: "text", v: `Multiply: ${p.a}/${p.b} × 1/${p.n}.` }],
    ];
  },
  workedExample() {
    return {
      steps: [
        [{ t: "text", v: `3/4 ÷ 2: Write 2 as 2/1, flip to 1/2.` }],
        [{ t: "text", v: `Multiply: 3/4 × 1/2 = 3/8.` }],
      ],
      result: [
        { t: "text", v: `3/4 ÷ 2 = ` },
        { t: "frac", n: 3, d: 8 },
      ],
    };
  },
};

export const divTemplates = [
  divWholeByUnitTemplate,
  divTwoFractionsTemplate,
  divFractionByWholeTemplate,
] as const;
