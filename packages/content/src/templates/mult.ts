import {
  type ComparisonSymbol,
  type MisconceptionId,
  type Rational,
  type RichText,
  type Rng,
  mul,
  rational,
} from "@gaps/domain";
import type { Template } from "../types";

export interface MultWholeParams {
  readonly a: number;
  readonly b: number;
  readonly n: number;
}

export const multWholeTemplate: Template<MultWholeParams> = {
  id: "MATH-FRAC-MULT/fraction-by-whole",
  version: 1,
  conceptId: "MATH-FRAC-MULT",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): MultWholeParams | null {
    const b = rng.pick([3, 4, 5, 6, 8]);
    const a = rng.int(2, b - 1);
    const k = rng.int(2, 6);
    const n = b * k;
    if (a === 1) return null;
    return { a, b, n };
  },
  prompt(p: MultWholeParams): RichText {
    return [
      { t: "text", v: "Find: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: ` of ${p.n}` },
    ];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: MultWholeParams) {
    const unit = p.n / p.b;
    return { kind: "integer", value: BigInt(unit * p.a) };
  },
  misconceptions(p: MultWholeParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    const unit = p.n / p.b;
    const correct = unit * p.a;
    if (unit !== correct) {
      result["MC-FRACTION-OF-UNIT"] = rational(BigInt(unit), 1n);
    }
    return result;
  },
  hints(p: MultWholeParams) {
    const unit = p.n / p.b;
    return [
      [{ t: "text", v: `First find 1/${p.b} of ${p.n}: divide ${p.n} by ${p.b}.` }],
      [{ t: "text", v: `${p.n} ÷ ${p.b} = ${unit}. That is one share.` }],
      [{ t: "text", v: `Now multiply that share by ${p.a}: ${unit} × ${p.a} = ☐.` }],
    ];
  },
  workedExample(_rng: Rng, _p: MultWholeParams) {
    return {
      steps: [
        [{ t: "text", v: `Find 3/4 of 20: Divide 20 by 4 to get one part = 5.` }],
        [{ t: "text", v: `Multiply by 3 parts: 5 × 3 = 15.` }],
      ],
      result: [{ t: "text", v: `3/4 of 20 = 15` }],
    };
  },
};

export interface MultFractionsParams {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export const multTwoFractionsTemplate: Template<MultFractionsParams> = {
  id: "MATH-FRAC-MULT/two-fractions",
  version: 1,
  conceptId: "MATH-FRAC-MULT",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): MultFractionsParams | null {
    const b = rng.int(2, 7);
    const d = rng.next() > 0.4 ? b : rng.int(2, 7);
    const a = rng.int(1, b - 1);
    const c = rng.int(1, d - 1);

    const r1 = rational(BigInt(a), BigInt(b));
    const r2 = rational(BigInt(c), BigInt(d));
    const prod = mul(r1, r2);

    // MC-MULT-SAME-DENOM check if b === d
    if (b === d) {
      const mcVal = rational(BigInt(a * c), BigInt(b));
      if (mcVal.n * prod.d === prod.n * mcVal.d) return null;
    }

    return { a, b, c, d };
  },
  prompt(p: MultFractionsParams): RichText {
    return [
      { t: "text", v: "Multiply the fractions: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " × " },
      { t: "frac", n: p.c, d: p.d },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: MultFractionsParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    return { kind: "rational", value: mul(r1, r2), form: "simplest" };
  },
  misconceptions(p: MultFractionsParams) {
    const result: Partial<Record<MisconceptionId, Rational | ComparisonSymbol>> = {};
    if (p.b === p.d) {
      const r1 = rational(BigInt(p.a), BigInt(p.b));
      const r2 = rational(BigInt(p.c), BigInt(p.d));
      const prod = mul(r1, r2);
      const mcVal = rational(BigInt(p.a * p.c), BigInt(p.b));
      if (mcVal.n * prod.d !== prod.n * mcVal.d) {
        result["MC-MULT-SAME-DENOM"] = mcVal;
      }
    }
    return result;
  },
  hints(_p: MultFractionsParams) {
    return [
      [{ t: "text", v: "Multiply the top numbers: numerator × numerator." }],
      [{ t: "text", v: "Multiply the bottom numbers: denominator × denominator." }],
      [{ t: "text", v: "Write the product and simplify to lowest terms." }],
    ];
  },
  workedExample(_rng: Rng, _p: MultFractionsParams) {
    return {
      steps: [
        [{ t: "text", v: `Multiply 2/3 × 3/5: Top is 2 × 3 = 6; bottom is 3 × 5 = 15.` }],
        [{ t: "text", v: `6/15 reduces to 2/5 by dividing top and bottom by 3.` }],
      ],
      result: [
        { t: "text", v: `2/3 × 3/5 = ` },
        { t: "frac", n: 2, d: 5 },
      ],
    };
  },
  visual(p: MultFractionsParams) {
    return {
      type: "area_model",
      rows: p.b,
      cols: p.d,
      shadedRows: p.a,
      shadedCols: p.c,
    };
  },
};

export const multCancelTemplate: Template<MultFractionsParams> = {
  id: "MATH-FRAC-MULT/simplify-cross",
  version: 1,
  conceptId: "MATH-FRAC-MULT",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): MultFractionsParams | null {
    const a = rng.int(2, 6);
    const d = rng.int(2, 6);
    const k1 = rng.int(2, 4);
    const k2 = rng.int(2, 4);
    const b = d * k1;
    const c = a * k2;
    if (b > 24 || c > 24) return null;
    return { a, b, c, d };
  },
  prompt(p: MultFractionsParams): RichText {
    return [
      { t: "text", v: "Multiply and reduce to lowest terms: " },
      { t: "frac", n: p.a, d: p.b },
      { t: "text", v: " × " },
      { t: "frac", n: p.c, d: p.d },
    ];
  },
  input() {
    return { kind: "fraction" };
  },
  answer(p: MultFractionsParams) {
    const r1 = rational(BigInt(p.a), BigInt(p.b));
    const r2 = rational(BigInt(p.c), BigInt(p.d));
    return { kind: "rational", value: mul(r1, r2), form: "simplest" };
  },
  hints(_p: MultFractionsParams) {
    return [
      [{ t: "text", v: "Look for common factors across numerators and denominators." }],
      [{ t: "text", v: "Cancel common factors before multiplying to make calculation easier." }],
      [{ t: "text", v: "Multiply the remaining factors across." }],
    ];
  },
  workedExample(_rng: Rng, _p: MultFractionsParams) {
    return {
      steps: [
        [{ t: "text", v: `3/8 × 4/9: 3 and 9 cancel (1 and 3); 4 and 8 cancel (1 and 2).` }],
        [{ t: "text", v: `Remaining: 1/2 × 1/3 = 1/6.` }],
      ],
      result: [
        { t: "text", v: `3/8 × 4/9 = ` },
        { t: "frac", n: 1, d: 6 },
      ],
    };
  },
};

export const multTemplates = [
  multWholeTemplate,
  multTwoFractionsTemplate,
  multCancelTemplate,
] as const;
