import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  abs,
  add,
  cmp,
  div,
  eq,
  format,
  fromDecimalString,
  gcd,
  isInteger,
  lcm,
  mul,
  neg,
  rational,
  sub,
  toMixed,
} from "./rational";
import type { Rational } from "./types";

const arbRational = fc
  .tuple(fc.bigInt({ min: -10_000n, max: 10_000n }), fc.bigInt({ min: -500n, max: 500n }))
  .filter(([, d]) => d !== 0n)
  .map(([n, d]) => rational(n, d));

const arbNonZeroRational = arbRational.filter((r) => r.n !== 0n);

function assertReduced(r: Rational): void {
  expect(r.d).toBeGreaterThan(0n);
  expect(gcd(r.n, r.d)).toBe(1n);
  if (r.n === 0n) {
    expect(r.d).toBe(1n);
  }
}

describe("rational", () => {
  it("normalizes signs, zero, and lowest terms", () => {
    expect(rational(6n, -8n)).toEqual({ n: -3n, d: 4n });
    expect(rational(-6n, -8n)).toEqual({ n: 3n, d: 4n });
    expect(rational(0n, -9n)).toEqual({ n: 0n, d: 1n });
    expect(rational(5)).toEqual({ n: 5n, d: 1n });
    expect(lcm(12n, 18n)).toBe(36n);
  });

  it("throws on zero denominator or non-integer numbers", () => {
    expect(() => rational(1n, 0n)).toThrow();
    expect(() => div(rational(1n, 2n), rational(0n, 1n))).toThrow();
    expect(() => rational(1.5, 2)).toThrow();
  });

  it("satisfies invariant reduction on random rationals (fast-check)", () => {
    fc.assert(
      fc.property(arbRational, (r) => {
        assertReduced(r);
      }),
    );
  });

  it("satisfies commutative and associative field laws (fast-check)", () => {
    fc.assert(
      fc.property(arbRational, arbRational, arbRational, (a, b, c) => {
        expect(eq(add(a, b), add(b, a))).toBe(true);
        expect(eq(mul(a, b), mul(b, a))).toBe(true);
        expect(eq(add(add(a, b), c), add(a, add(b, c)))).toBe(true);
        expect(eq(mul(mul(a, b), c), mul(a, mul(b, c)))).toBe(true);
        expect(eq(mul(a, add(b, c)), add(mul(a, b), mul(a, c)))).toBe(true);
      }),
    );
  });

  it("satisfies identity, inverse, and subtraction/division laws (fast-check)", () => {
    const zero = rational(0n, 1n);
    const one = rational(1n, 1n);
    fc.assert(
      fc.property(arbRational, arbNonZeroRational, (a, nz) => {
        expect(eq(add(a, zero), a)).toBe(true);
        expect(eq(mul(a, one), a)).toBe(true);
        expect(eq(add(a, neg(a)), zero)).toBe(true);
        expect(eq(sub(a, a), zero)).toBe(true);
        expect(eq(mul(nz, div(one, nz)), one)).toBe(true);
        expect(eq(div(a, nz), mul(a, div(one, nz)))).toBe(true);
        expect(cmp(abs(a), zero)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("orders rationals consistently across trichotomy and transitivity (fast-check)", () => {
    fc.assert(
      fc.property(arbRational, arbRational, arbRational, (a, b, c) => {
        const ab = cmp(a, b);
        const ba = cmp(b, a);
        expect(ab).toBe(-ba === 0 ? 0 : -ba);
        expect(eq(a, b)).toBe(ab === 0);
        if (cmp(a, b) <= 0 && cmp(b, c) <= 0) {
          expect(cmp(a, c)).toBeLessThanOrEqual(0);
        }
      }),
    );
  });

  it("handles isInteger, toMixed, and format across positive, negative, and zero", () => {
    expect(isInteger(rational(6n, 2n))).toBe(true);
    expect(isInteger(rational(5n, 2n))).toBe(false);

    expect(toMixed(rational(7n, 3n))).toEqual({ whole: 2n, num: 1n, den: 3n });
    expect(toMixed(rational(-7n, 3n))).toEqual({ whole: -2n, num: 1n, den: 3n });
    expect(toMixed(rational(-1n, 3n))).toEqual({ whole: 0n, num: -1n, den: 3n });
    expect(toMixed(rational(6n, 2n))).toEqual({ whole: 3n, num: 0n, den: 1n });

    expect(format(rational(0n, 1n))).toBe("0");
    expect(format(rational(6n, 2n))).toBe("3");
    expect(format(rational(7n, 3n))).toBe("7/3");
    expect(format(rational(7n, 3n), "mixed")).toBe("2 1/3");
    expect(format(rational(-7n, 3n), "mixed")).toBe("-2 1/3");
    expect(format(rational(-1n, 3n), "mixed")).toBe("-1/3");
    expect(format(rational(4n, 1n), "mixed")).toBe("4");
  });

  it("parses exact terminating decimal strings without floating point", () => {
    expect(fromDecimalString("0.75")).toEqual({ n: 3n, d: 4n });
    expect(fromDecimalString(".5")).toEqual({ n: 1n, d: 2n });
    expect(fromDecimalString("-1.25")).toEqual({ n: -5n, d: 4n });
    expect(fromDecimalString("-.2")).toEqual({ n: -1n, d: 5n });
    expect(fromDecimalString("0.100000")).toEqual({ n: 1n, d: 10n });
    expect(fromDecimalString("2.0")).toEqual({ n: 2n, d: 1n });
    expect(() => fromDecimalString("1.")).toThrow();
    expect(() => fromDecimalString("abc")).toThrow();
  });
});
