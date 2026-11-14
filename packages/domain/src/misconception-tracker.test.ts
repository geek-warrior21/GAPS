import { describe, expect, it } from "vitest";
import { detectMisconception, reconcileActiveMisconceptions } from "./misconception-tracker";

describe("Workstream B: Misconception Detection & Confidence Tracking", () => {
  it("detects single template-mapped misconception with 'low' initial confidence", () => {
    // 2/3 = _/6 -> student answers 5 (additive misconception: adds 3 to numerator and denominator)
    const result = detectMisconception(
      "MATH-FRAC-EQUIV",
      5n,
      4n, // correct is 4
      { "MC-EQUIV-ADDITIVE": 5n },
      [], // no history
      "5",
    );

    expect(result.primaryMisconceptionId).toBe("MC-EQUIV-ADDITIVE");
    expect(result.candidates).toContain("MC-EQUIV-ADDITIVE");
    // INVARIANT: Single incorrect answer is never treated as definitive proof
    expect(result.confidence).toBe("low");
    expect(result.evidenceCount).toBe(1);
    expect(result.isRecurring).toBe(false);
  });

  it("promotes confidence to 'medium' and 'high' as recurring evidence accumulates", () => {
    // 1 prior occurrence -> current attempt makes it 2
    const result2 = detectMisconception(
      "MATH-FRAC-EQUIV",
      5n,
      4n,
      { "MC-EQUIV-ADDITIVE": 5n },
      [{ outcome: "incorrect", misconceptionId: "MC-EQUIV-ADDITIVE" }],
      "5",
    );

    expect(result2.confidence).toBe("medium");
    expect(result2.evidenceCount).toBe(2);
    expect(result2.isRecurring).toBe(true);

    // 2 prior occurrences -> current attempt makes it 3
    const result3 = detectMisconception(
      "MATH-FRAC-EQUIV",
      5n,
      4n,
      { "MC-EQUIV-ADDITIVE": 5n },
      [
        { outcome: "incorrect", misconceptionId: "MC-EQUIV-ADDITIVE" },
        { outcome: "incorrect", misconceptionId: "MC-EQUIV-ADDITIVE" },
      ],
      "5",
    );

    expect(result3.confidence).toBe("high");
    expect(result3.evidenceCount).toBe(3);
    expect(result3.isRecurring).toBe(true);
  });

  it("returns unclassified when wrong answer does not match any known pattern", () => {
    const result = detectMisconception(
      "MATH-FRAC-EQUIV",
      99n,
      4n,
      { "MC-EQUIV-ADDITIVE": 5n },
      [],
      "99",
    );

    expect(result.primaryMisconceptionId).toBeNull();
    expect(result.candidates).toHaveLength(0);
    expect(result.confidence).toBe("unclassified");
    expect(result.evidenceCount).toBe(0);
    expect(result.isRecurring).toBe(false);
  });

  it("supports multiple plausible candidates when ambiguous", () => {
    // In comparison, a wrong symbol may suggest numerator-only or bigger-denom
    const result = detectMisconception(
      "MATH-FRAC-COMPARE",
      ">",
      "<",
      undefined, // no explicit map
      [],
      ">",
    );

    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.confidence).toBe("low");
  });

  it("reconciles active misconceptions: clears on independent success", () => {
    const active = reconcileActiveMisconceptions(
      ["MC-EQUIV-ADDITIVE"],
      {
        primaryMisconceptionId: null,
        candidates: [],
        confidence: "unclassified",
        evidenceCount: 0,
        isRecurring: false,
      },
      true, // was correct
      true, // was independent
    );

    expect(active).toHaveLength(0);
  });

  it("reconciles active misconceptions: only adds when recurring", () => {
    // Single isolated error (not recurring) should not add to persistent active list
    const active1 = reconcileActiveMisconceptions(
      [],
      {
        primaryMisconceptionId: "MC-EQUIV-ADDITIVE",
        candidates: ["MC-EQUIV-ADDITIVE"],
        confidence: "low",
        evidenceCount: 1,
        isRecurring: false,
      },
      false,
      true,
    );
    expect(active1).toHaveLength(0);

    // Recurring error (medium confidence) adds to persistent active list
    const active2 = reconcileActiveMisconceptions(
      [],
      {
        primaryMisconceptionId: "MC-EQUIV-ADDITIVE",
        candidates: ["MC-EQUIV-ADDITIVE"],
        confidence: "medium",
        evidenceCount: 2,
        isRecurring: true,
      },
      false,
      true,
    );
    expect(active2).toContain("MC-EQUIV-ADDITIVE");
  });
});
