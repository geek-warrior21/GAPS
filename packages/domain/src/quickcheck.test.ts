import { describe, expect, it } from "vitest";
import { createQuickCheck, runQuickCheck, stepQuickCheck } from "./quickcheck";

describe("quickCheck", () => {
  it("advances +2 topo positions on correct answers and caps at 5 items", () => {
    // Grade 6 starts at #1 PART -> +2 -> #3 HCF -> +2 -> #5 SIMPLIFY -> +2 -> #7 MIXED -> +2 -> #9 ADDLIKE (5 items)
    // highestHit = #9 ADDLIKE -> nextAfter = #10 ADDUNLIKE
    const result = runQuickCheck(6, () => true);
    expect(result.tested).toEqual([
      "MATH-FRAC-PART",
      "MATH-NUM-HCF",
      "MATH-FRAC-SIMPLIFY",
      "MATH-FRAC-MIXED",
      "MATH-FRAC-ADDLIKE",
    ]);
    expect(result.done).toBe(true);
    expect(result.startConceptId).toBe("MATH-FRAC-ADDUNLIKE");
  });

  it("steps backward to first untested prerequisite on miss and picks lowestMiss", () => {
    // Grade 8 starts at #10 ADDUNLIKE (prereqs: EQUIV, ADDLIKE, NUM-LCM)
    let state = createQuickCheck(8);
    expect(state.currentConceptId).toBe("MATH-FRAC-ADDUNLIKE");

    // Miss ADDUNLIKE -> goes to EQUIV (#4)
    state = stepQuickCheck(state, false);
    expect(state.currentConceptId).toBe("MATH-FRAC-EQUIV");

    // Hit EQUIV -> +2 is COMPARE (#6)
    state = stepQuickCheck(state, true);
    expect(state.currentConceptId).toBe("MATH-FRAC-COMPARE");

    // Miss COMPARE -> prereq EQUIV is already tested, so stops early!
    state = stepQuickCheck(state, false);
    expect(state.done).toBe(true);
    expect(state.lowestMiss).toBe("MATH-FRAC-COMPARE");
    expect(state.startConceptId).toBe("MATH-FRAC-COMPARE");
  });

  it("handles immediate miss on Grade 6 entry (no prerequisites)", () => {
    const res = runQuickCheck(6, () => false);
    expect(res.tested).toEqual(["MATH-FRAC-PART"]);
    expect(res.done).toBe(true);
    expect(res.startConceptId).toBe("MATH-FRAC-PART");
  });

  it("caps cleanly at strand end (#14 WORD) without jumping backward", () => {
    // Grade 8 all correct: #10 -> #12 -> #14 -> stops (no #16)
    const res = runQuickCheck(8, () => true);
    expect(res.tested).toEqual(["MATH-FRAC-ADDUNLIKE", "MATH-FRAC-DIV", "MATH-FRAC-WORD"]);
    expect(res.done).toBe(true);
    expect(res.startConceptId).toBe("MATH-FRAC-WORD");
  });
});
