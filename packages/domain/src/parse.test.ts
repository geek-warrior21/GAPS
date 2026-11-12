import { describe, expect, it } from "vitest";
import { normalizeInput, parseAnswer } from "./parse";
import { rational } from "./rational";
import type { Rational } from "./types";

describe("normalizeInput", () => {
  it("trims, maps Unicode math symbols, collapses spaces, and drops one trailing period", () => {
    expect(normalizeInput("  −3 ⁄ 4 . ")).toBe("-3 / 4");
    expect(normalizeInput("  2\t\n1÷3.  ")).toBe("2 1/3");
    expect(normalizeInput("0.75.")).toBe("0.75");
    expect(normalizeInput("1..")).toBe("1.");
  });
});

describe("parseAnswer (>= 60 cases)", () => {
  interface Case {
    name: string;
    raw: string;
    choiceIds?: readonly string[];
    expected: null | {
      kind: "integer" | "fraction" | "mixed" | "decimal" | "comparison" | "choice" | "order";
      value: Rational | readonly Rational[] | string;
      lowestTerms: boolean;
    };
  }

  const cases: readonly Case[] = [
    // Integers (1-10)
    {
      name: "zero",
      raw: "0",
      expected: { kind: "integer", value: rational(0n, 1n), lowestTerms: true },
    },
    {
      name: "positive single digit",
      raw: "7",
      expected: { kind: "integer", value: rational(7n, 1n), lowestTerms: true },
    },
    {
      name: "positive 9 digits",
      raw: "123456789",
      expected: { kind: "integer", value: rational(123456789n, 1n), lowestTerms: true },
    },
    {
      name: "negative integer",
      raw: "-42",
      expected: { kind: "integer", value: rational(-42n, 1n), lowestTerms: true },
    },
    {
      name: "unicode minus integer",
      raw: "−15",
      expected: { kind: "integer", value: rational(-15n, 1n), lowestTerms: true },
    },
    {
      name: "integer with trailing dot",
      raw: "12.",
      expected: { kind: "integer", value: rational(12n, 1n), lowestTerms: true },
    },
    {
      name: "padded spaces integer",
      raw: "  99  ",
      expected: { kind: "integer", value: rational(99n, 1n), lowestTerms: true },
    },
    {
      name: "negative zero integer",
      raw: "-0",
      expected: { kind: "integer", value: rational(0n, 1n), lowestTerms: true },
    },
    { name: "over-long 10-digit integer", raw: "1234567890", expected: null },
    { name: "over-long negative integer", raw: "-1234567890", expected: null },

    // Fractions (11-26)
    {
      name: "proper simplest fraction",
      raw: "3/4",
      expected: { kind: "fraction", value: rational(3n, 4n), lowestTerms: true },
    },
    {
      name: "unreduced fraction",
      raw: "2/4",
      expected: { kind: "fraction", value: rational(1n, 2n), lowestTerms: false },
    },
    {
      name: "improper simplest fraction",
      raw: "7/3",
      expected: { kind: "fraction", value: rational(7n, 3n), lowestTerms: true },
    },
    {
      name: "improper unreduced fraction",
      raw: "6/4",
      expected: { kind: "fraction", value: rational(3n, 2n), lowestTerms: false },
    },
    {
      name: "whole value as fraction 6/2",
      raw: "6/2",
      expected: { kind: "fraction", value: rational(3n, 1n), lowestTerms: false },
    },
    {
      name: "whole value over 1",
      raw: "5/1",
      expected: { kind: "fraction", value: rational(5n, 1n), lowestTerms: true },
    },
    {
      name: "zero numerator fraction 0/1",
      raw: "0/1",
      expected: { kind: "fraction", value: rational(0n, 1n), lowestTerms: true },
    },
    {
      name: "zero numerator fraction 0/5",
      raw: "0/5",
      expected: { kind: "fraction", value: rational(0n, 1n), lowestTerms: false },
    },
    {
      name: "negative fraction",
      raw: "-3/8",
      expected: { kind: "fraction", value: rational(-3n, 8n), lowestTerms: true },
    },
    {
      name: "unicode minus and fraction slash",
      raw: "−5⁄6",
      expected: { kind: "fraction", value: rational(-5n, 6n), lowestTerms: true },
    },
    {
      name: "unicode division slash",
      raw: "4÷6.",
      expected: { kind: "fraction", value: rational(2n, 3n), lowestTerms: false },
    },
    {
      name: "6-digit numerator and denominator",
      raw: "999999/100000",
      expected: { kind: "fraction", value: rational(999999n, 100000n), lowestTerms: true },
    },
    { name: "division by zero 2/0", raw: "2/0", expected: null },
    { name: "division by multi-zero 3/000", raw: "3/000", expected: null },
    { name: "7-digit denominator too long", raw: "1/1234567", expected: null },
    { name: "spaced fraction invalid", raw: "1 / 2", expected: null },

    // Mixed numbers (27-38)
    {
      name: "positive mixed simplest",
      raw: "2 1/3",
      expected: { kind: "mixed", value: rational(7n, 3n), lowestTerms: true },
    },
    {
      name: "mixed unreduced fraction part",
      raw: "2 2/4",
      expected: { kind: "mixed", value: rational(5n, 2n), lowestTerms: false },
    },
    {
      name: "mixed collapsed whitespace",
      raw: "1   3/5",
      expected: { kind: "mixed", value: rational(8n, 5n), lowestTerms: true },
    },
    {
      name: "negative mixed number",
      raw: "-2 1/3",
      expected: { kind: "mixed", value: rational(-7n, 3n), lowestTerms: true },
    },
    {
      name: "unicode minus and slash mixed",
      raw: "−3 1⁄4.",
      expected: { kind: "mixed", value: rational(-13n, 4n), lowestTerms: true },
    },
    {
      name: "mixed zero whole",
      raw: "0 1/2",
      expected: { kind: "mixed", value: rational(1n, 2n), lowestTerms: true },
    },
    {
      name: "mixed zero fraction part",
      raw: "2 0/3",
      expected: { kind: "mixed", value: rational(2n, 1n), lowestTerms: false },
    },
    { name: "mixed improper fractional part 2 4/3", raw: "2 4/3", expected: null },
    { name: "mixed equal num and den 2 3/3", raw: "2 3/3", expected: null },
    { name: "mixed zero denominator", raw: "2 1/0", expected: null },
    { name: "mixed negative fraction part", raw: "2 -1/3", expected: null },
    { name: "triple part 3/4/5", raw: "3/4/5", expected: null },

    // Decimals (39-48)
    {
      name: "0.75",
      raw: "0.75",
      expected: { kind: "decimal", value: rational(3n, 4n), lowestTerms: true },
    },
    {
      name: "leading dot .5",
      raw: ".5",
      expected: { kind: "decimal", value: rational(1n, 2n), lowestTerms: true },
    },
    {
      name: "negative decimal",
      raw: "-1.25",
      expected: { kind: "decimal", value: rational(-5n, 4n), lowestTerms: true },
    },
    {
      name: "unicode minus leading dot",
      raw: "−.2",
      expected: { kind: "decimal", value: rational(-1n, 5n), lowestTerms: true },
    },
    {
      name: "6 fractional digits",
      raw: "0.000001",
      expected: { kind: "decimal", value: rational(1n, 1000000n), lowestTerms: true },
    },
    {
      name: "decimal with trailing full stop",
      raw: "2.5.",
      expected: { kind: "decimal", value: rational(5n, 2n), lowestTerms: true },
    },
    {
      name: "decimal trailing zero 1.50",
      raw: "1.50",
      expected: { kind: "decimal", value: rational(3n, 2n), lowestTerms: true },
    },
    { name: "7 fractional digits too long", raw: "0.1234567", expected: null },
    { name: "10 integer digits decimal too long", raw: "1234567890.5", expected: null },
    { name: "double dot decimal", raw: "1.2.3", expected: null },

    // Comparisons (49-54)
    {
      name: "less than",
      raw: "<",
      expected: { kind: "comparison", value: "<", lowestTerms: true },
    },
    {
      name: "greater than padded",
      raw: "  > ",
      expected: { kind: "comparison", value: ">", lowestTerms: true },
    },
    {
      name: "equals with trailing dot",
      raw: "=.",
      expected: { kind: "comparison", value: "=", lowestTerms: true },
    },
    { name: "double comparison", raw: "<=", expected: null },

    // Order lists (52-60)
    {
      name: "two fractions no space",
      raw: "1/2,3/4",
      expected: { kind: "order", value: [rational(1n, 2n), rational(3n, 4n)], lowestTerms: true },
    },
    {
      name: "three fractions with spaces",
      raw: "1/4, 2/4, 3/4",
      expected: {
        kind: "order",
        value: [rational(1n, 4n), rational(1n, 2n), rational(3n, 4n)],
        lowestTerms: false,
      },
    },
    {
      name: "six fractions max",
      raw: "1/7,2/7,3/7,4/7,5/7,6/7",
      expected: {
        kind: "order",
        value: [
          rational(1n, 7n),
          rational(2n, 7n),
          rational(3n, 7n),
          rational(4n, 7n),
          rational(5n, 7n),
          rational(6n, 7n),
        ],
        lowestTerms: true,
      },
    },
    { name: "seven fractions too many", raw: "1/8,2/8,3/8,4/8,5/8,6/8,7/8", expected: null },
    { name: "order list with zero denominator", raw: "1/2,3/0", expected: null },
    { name: "trailing comma list", raw: "1/2,", expected: null },

    // Choice IDs & malformed text (61-68)
    {
      name: "valid choice ID when choiceIds provided",
      raw: "opt_b",
      choiceIds: ["opt_a", "opt_b"],
      expected: { kind: "choice", value: "opt_b", lowestTerms: true },
    },
    {
      name: "invalid choice ID when choiceIds provided",
      raw: "opt_z",
      choiceIds: ["opt_a", "opt_b"],
      expected: null,
    },
    { name: "letters without choiceIds (abc)", raw: "abc", expected: null },
    { name: "empty string", raw: "", expected: null },
    { name: "whitespace only", raw: "   \t\n  ", expected: null },
    { name: "only a dot", raw: ".", expected: null },
    { name: "only a minus", raw: "-", expected: null },
    { name: "plus sign unsupported", raw: "+3/4", expected: null },
    { name: "percent unsupported", raw: "50%", expected: null },
  ];

  it("covers at least 60 parser cases accurately", () => {
    expect(cases.length).toBeGreaterThanOrEqual(60);
    for (const c of cases) {
      const actual = parseAnswer(c.raw, c.choiceIds ? { choiceIds: c.choiceIds } : undefined);
      expect(actual, `Case "${c.name}" (${JSON.stringify(c.raw)})`).toEqual(c.expected);
    }
  });
});
