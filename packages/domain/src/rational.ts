import type { Rational } from "./types";

/** Non-negative greatest common divisor of two bigints. */
export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0n ? 1n : x;
}

/** Positive least common multiple of two non-zero bigints (returns 0n if either is 0n). */
export function lcm(a: bigint, b: bigint): bigint {
  const x = a < 0n ? -a : a;
  const y = b < 0n ? -b : b;
  if (x === 0n || y === 0n) {
    return 0n;
  }
  return (x / gcd(x, y)) * y;
}

function toBigInt(value: bigint | number, label: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer, received ${value}`);
  }
  return BigInt(value);
}

/** Construct a reduced Rational with strictly positive denominator. */
export function rational(n: bigint | number, d: bigint | number = 1n): Rational {
  let num = toBigInt(n, "numerator");
  let den = toBigInt(d, "denominator");
  if (den === 0n) {
    throw new RangeError("Rational denominator cannot be zero");
  }
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  if (num === 0n) {
    return { n: 0n, d: 1n };
  }
  const divisor = gcd(num, den);
  return { n: num / divisor, d: den / divisor };
}

export function add(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function sub(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function mul(a: Rational, b: Rational): Rational {
  return rational(a.n * b.n, a.d * b.d);
}

export function div(a: Rational, b: Rational): Rational {
  if (b.n === 0n) {
    throw new RangeError("Division by zero rational");
  }
  return rational(a.n * b.d, a.d * b.n);
}

export function neg(a: Rational): Rational {
  return a.n === 0n ? { n: 0n, d: 1n } : { n: -a.n, d: a.d };
}

export function abs(a: Rational): Rational {
  return a.n < 0n ? { n: -a.n, d: a.d } : a;
}

export function cmp(a: Rational, b: Rational): -1 | 0 | 1 {
  const left = a.n * b.d;
  const right = b.n * a.d;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function eq(a: Rational, b: Rational): boolean {
  return a.n * b.d === b.n * a.d;
}

export function isInteger(a: Rational): boolean {
  return a.d === 1n;
}

/**
 * Convert a reduced rational to mixed-number parts.
 * For improper negatives (e.g. -7/3), whole=-2n, num=1n, den=3n so format renders "-2 1/3".
 * For proper negatives (e.g. -1/3), whole=0n, num=-1n, den=3n so format renders "-1/3".
 */
export function toMixed(a: Rational): { whole: bigint; num: bigint; den: bigint } {
  const r = rational(a.n, a.d);
  if (r.d === 1n) {
    return { whole: r.n, num: 0n, den: 1n };
  }
  const absN = r.n < 0n ? -r.n : r.n;
  const wholeAbs = absN / r.d;
  const rem = absN % r.d;
  if (wholeAbs === 0n) {
    return { whole: 0n, num: r.n, den: r.d };
  }
  return {
    whole: r.n < 0n ? -wholeAbs : wholeAbs,
    num: rem,
    den: r.d,
  };
}

/** Parse a terminating decimal string matching "-?" digit* "." digit+ into an exact Rational. */
export function fromDecimalString(raw: string): Rational {
  const match = /^(-?)(\d*)\.(\d+)$/.exec(raw);
  if (!match) {
    throw new SyntaxError(`Invalid decimal string: "${raw}"`);
  }
  const sign = match[1] === "-" ? -1n : 1n;
  const intPart = match[2] ?? "";
  const fracPart = match[3] ?? "";
  const scale = 10n ** BigInt(fracPart.length);
  const whole = intPart === "" ? 0n : BigInt(intPart);
  const frac = BigInt(fracPart);
  return rational(sign * (whole * scale + frac), scale);
}

export function format(a: Rational, mode: "improper" | "mixed" = "improper"): string {
  const r = rational(a.n, a.d);
  if (r.d === 1n) {
    return r.n.toString();
  }
  if (mode === "mixed") {
    const { whole, num, den } = toMixed(r);
    if (whole === 0n) {
      return `${num}/${den}`;
    }
    return `${whole} ${num}/${den}`;
  }
  return `${r.n}/${r.d}`;
}
