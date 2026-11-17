import {
  type Rational,
  add,
  div,
  eq,
  fromDecimalString,
  mul,
  neg,
  rational,
  sub,
} from "@gaps/domain";

/**
 * Exact arithmetic for checking generated answer keys.
 *
 * A model may attach a plain arithmetic expression to a numeric question. The
 * server evaluates it here with exact rationals (no floating point, no eval)
 * and accepts the question only if the result equals the model's answer key.
 * Grammar: numbers (integers, decimals), + - * / (also × ÷ −), parentheses,
 * unary minus.
 */

const MAX_EXPRESSION_LENGTH = 80;

export class ArithmeticError extends Error {}

function tokenize(source: string): string[] {
  const normalized = source
    .replace(/[×xX]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, "");
  if (normalized.length === 0 || normalized.length > MAX_EXPRESSION_LENGTH) {
    throw new ArithmeticError("expression is empty or too long");
  }
  const tokens = normalized.match(/\d+\.\d+|\d+|[-+*/()]/g) ?? [];
  if (tokens.join("") !== normalized) {
    throw new ArithmeticError("expression contains unsupported characters");
  }
  return tokens;
}

export function evaluateArithmetic(source: string): Rational {
  const tokens = tokenize(source);
  let pos = 0;

  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  const parseNumber = (token: string): Rational =>
    token.includes(".") ? fromDecimalString(token) : rational(BigInt(token), 1n);

  const parseFactor = (): Rational => {
    const token = take();
    if (token === undefined) throw new ArithmeticError("unexpected end of expression");
    if (token === "-") return neg(parseFactor());
    if (token === "+") return parseFactor();
    if (token === "(") {
      const value = parseExpression();
      if (take() !== ")") throw new ArithmeticError("missing closing bracket");
      return value;
    }
    if (/^\d/.test(token)) return parseNumber(token);
    throw new ArithmeticError(`unexpected "${token}"`);
  };

  const parseTerm = (): Rational => {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = take();
      const right = parseFactor();
      if (op === "/") {
        if (right.n === 0n) throw new ArithmeticError("division by zero");
        value = div(value, right);
      } else {
        value = mul(value, right);
      }
    }
    return value;
  };

  function parseExpression(): Rational {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = take();
      const right = parseTerm();
      value = op === "+" ? add(value, right) : sub(value, right);
    }
    return value;
  }

  const result = parseExpression();
  if (pos !== tokens.length) throw new ArithmeticError("unexpected trailing input");
  return result;
}

/** Parses a learner's or key's numeric answer: -3, +4, 2.5, 3/4, -1/2. */
export function parseNumericAnswer(raw: string): Rational | null {
  const text = raw.trim().replace(/[−–]/g, "-").replace(/\s+/g, "");
  if (!/^[+-]?(\d+(\.\d+)?)(\/\d+)?$/.test(text) || text.length > 24) return null;
  try {
    const value = evaluateArithmetic(text);
    return value;
  } catch {
    return null;
  }
}

export function numericAnswersEqual(a: string, b: string): boolean {
  const left = parseNumericAnswer(a);
  const right = parseNumericAnswer(b);
  return left !== null && right !== null && eq(left, right);
}
