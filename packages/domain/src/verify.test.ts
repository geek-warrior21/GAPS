import { describe, expect, it } from "vitest";
import { rational } from "./rational";
import { VERIFIER_VERSION } from "./types";
import { verify } from "./verify";

describe("verify", () => {
  it("handles rational form: any", () => {
    const spec = { kind: "rational" as const, value: rational(1n, 2n), form: "any" as const };
    expect(verify(spec, "1/2").outcome).toBe("correct");
    expect(verify(spec, "2/4").outcome).toBe("correct");
    expect(verify(spec, "1/3").outcome).toBe("incorrect");
    expect(verify(spec, "abc").outcome).toBe("unparseable");
  });

  it("handles rational form: simplest (improper or mixed accepted, unreduced -> not_simplified)", () => {
    const spec = { kind: "rational" as const, value: rational(7n, 2n), form: "simplest" as const };
    expect(verify(spec, "7/2").outcome).toBe("correct");
    expect(verify(spec, "3 1/2").outcome).toBe("correct");
    expect(verify(spec, "14/4").outcome).toBe("not_simplified");
    expect(verify(spec, "3 2/4").outcome).toBe("not_simplified");

    const half = { kind: "rational" as const, value: rational(1n, 2n), form: "simplest" as const };
    expect(verify(half, "2/4").outcome).toBe("not_simplified");
    expect(verify(half, "1/2").outcome).toBe("correct");
    expect(verify(half, "1/2").verifierVersion).toBe(VERIFIER_VERSION);
  });

  it("handles rational form: mixed (mixed or integer when whole; fraction -> not_simplified)", () => {
    const spec = { kind: "rational" as const, value: rational(7n, 3n), form: "mixed" as const };
    expect(verify(spec, "2 1/3").outcome).toBe("correct");
    expect(verify(spec, "7/3").outcome).toBe("not_simplified");
    expect(verify(spec, "2 2/6").outcome).toBe("not_simplified");

    const wholeSpec = {
      kind: "rational" as const,
      value: rational(3n, 1n),
      form: "mixed" as const,
    };
    expect(verify(wholeSpec, "3").outcome).toBe("correct");
    expect(verify(wholeSpec, "6/2").outcome).toBe("not_simplified");
  });

  it("handles rational form: improper (single fraction in lowest terms)", () => {
    const spec = { kind: "rational" as const, value: rational(7n, 3n), form: "improper" as const };
    expect(verify(spec, "7/3").outcome).toBe("correct");
    expect(verify(spec, "14/6").outcome).toBe("not_simplified");
    expect(verify(spec, "2 1/3").outcome).toBe("not_simplified");
  });

  it("enforces spec.accept and flags formatMismatch", () => {
    const spec = { kind: "rational" as const, value: rational(3n, 4n), form: "simplest" as const };
    const decRes = verify(spec, "0.75");
    expect(decRes.outcome).toBe("incorrect");
    expect(decRes.formatMismatch).toBe(true);

    const acceptDecimalSpec = {
      ...spec,
      accept: ["integer", "fraction", "mixed", "decimal"] as const,
    };
    expect(verify(acceptDecimalSpec, "0.75").outcome).toBe("correct");
  });

  it("handles integer spec", () => {
    const spec = { kind: "integer" as const, value: 12n };
    expect(verify(spec, "12").outcome).toBe("correct");
    const wrong = verify(spec, "5", { "MC-EQUIV-ADDITIVE": 5n });
    expect(wrong.outcome).toBe("incorrect");
    expect(wrong.misconceptionId).toBe("MC-EQUIV-ADDITIVE");

    const fmtWrong = verify(spec, "24/2");
    expect(fmtWrong.outcome).toBe("incorrect");
    expect(fmtWrong.formatMismatch).toBe(true);
  });

  it("handles decimal spec with exact equality and misconception detection", () => {
    const spec = { kind: "decimal" as const, value: rational(1n, 4n) };
    expect(verify(spec, "0.25").outcome).toBe("correct");
    expect(verify(spec, ".25").outcome).toBe("correct");
    expect(verify(spec, "0.250").outcome).toBe("correct");

    const mc = verify(spec, "0.14", { "MC-DEC-DIGITS": rational(14n, 100n) });
    expect(mc.outcome).toBe("incorrect");
    expect(mc.misconceptionId).toBe("MC-DEC-DIGITS");

    const fracInput = verify(spec, "1/4");
    expect(fracInput.outcome).toBe("incorrect");
    expect(fracInput.formatMismatch).toBe(true);
  });

  it("handles comparison spec and comparison misconceptions", () => {
    const spec = { kind: "comparison" as const, value: ">" as const };
    expect(verify(spec, ">").outcome).toBe("correct");
    const miss = verify(spec, "<", { "MC-BIGGER-DENOM": "<" });
    expect(miss.outcome).toBe("incorrect");
    expect(miss.misconceptionId).toBe("MC-BIGGER-DENOM");
    expect(verify(spec, "3").formatMismatch).toBe(true);
  });

  it("handles choice spec", () => {
    const spec = {
      kind: "choice" as const,
      value: "opt_a",
      options: [
        { id: "opt_a", label: [{ t: "text" as const, v: "A" }] },
        { id: "opt_b", label: [{ t: "text" as const, v: "B" }] },
      ],
    };
    expect(verify(spec, "opt_a").outcome).toBe("correct");
    expect(verify(spec, "opt_b").outcome).toBe("incorrect");
    expect(verify(spec, "opt_c").outcome).toBe("unparseable");
  });

  it("handles order spec", () => {
    const spec = {
      kind: "order" as const,
      value: [rational(1n, 4n), rational(1n, 2n), rational(3n, 4n)],
    };
    expect(verify(spec, "1/4, 2/4, 3/4").outcome).toBe("correct");
    expect(verify(spec, "3/4, 1/2, 1/4").outcome).toBe("incorrect");
    expect(verify(spec, "1/4, 1/2").outcome).toBe("incorrect");
    expect(verify(spec, "1/4").formatMismatch).toBe(true);
  });
});
