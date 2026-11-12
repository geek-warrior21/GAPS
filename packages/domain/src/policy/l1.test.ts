import { describe, expect, it } from "vitest";
import { GRADE_ENTRY, STRAND_CONCEPTS, focusConcept, getConceptNode } from "./l1";
import type { BeliefStatus, ConceptId } from "../types";

function beliefsFromMap(
  map: Partial<Record<ConceptId, BeliefStatus>>,
): Partial<Record<ConceptId, { status: BeliefStatus }>> {
  const out: Partial<Record<ConceptId, { status: BeliefStatus }>> = {};
  for (const [k, v] of Object.entries(map) as Array<[ConceptId, BeliefStatus]>) {
    out[k] = { status: v };
  }
  return out;
}

describe("L1 focusConcept and concept DAG", () => {
  it("contains 14 strictly topologically ordered concepts across chapters A, B, C", () => {
    expect(STRAND_CONCEPTS).toHaveLength(14);
    const seen = new Set<ConceptId>();
    for (let i = 0; i < STRAND_CONCEPTS.length; i++) {
      const c = STRAND_CONCEPTS[i];
      expect(c).toBeDefined();
      if (!c) continue;
      expect(c.topoOrder).toBe(i + 1);
      for (const prereq of c.prerequisites) {
        expect(seen.has(prereq)).toBe(true);
        expect(getConceptNode(prereq).topoOrder).toBeLessThan(c.topoOrder);
      }
      seen.add(c.id);
    }
  });

  it("uses GRADE_ENTRY when startConceptId is null", () => {
    expect(focusConcept({ grade: 6, startConceptId: null }, {})).toBe(GRADE_ENTRY[6]);
    expect(focusConcept({ grade: 7, startConceptId: null }, {})).toBe(GRADE_ENTRY[7]);
    expect(focusConcept({ grade: 8, startConceptId: null }, {})).toBe(GRADE_ENTRY[8]);
  });

  it("prioritizes earliest needs_support over ahead concepts", () => {
    const focus = focusConcept(
      { grade: 8, startConceptId: "MATH-FRAC-ADDUNLIKE" },
      beliefsFromMap({
        "MATH-FRAC-PART": "needs_support",
        "MATH-FRAC-EQUIV": "needs_support",
      }),
    );
    expect(focus).toBe("MATH-FRAC-PART");
  });

  it("leaves concepts before startConceptId untouched when not_assessed and advances ahead", () => {
    const focus = focusConcept(
      { grade: 7, startConceptId: "MATH-FRAC-EQUIV" },
      beliefsFromMap({
        "MATH-FRAC-EQUIV": "demonstrated",
        "MATH-FRAC-SIMPLIFY": "retained",
        "MATH-FRAC-COMPARE": "developing",
      }),
    );
    expect(focus).toBe("MATH-FRAC-COMPARE");
  });

  it("returns STRAND_COMPLETE when no support concepts exist and ahead concepts are mastered", () => {
    const map: Partial<Record<ConceptId, BeliefStatus>> = {};
    for (const c of STRAND_CONCEPTS) {
      if (c.topoOrder >= 4) {
        map[c.id] = c.topoOrder % 2 === 0 ? "demonstrated" : "retained";
      }
    }
    expect(focusConcept({ grade: 7, startConceptId: "MATH-FRAC-EQUIV" }, beliefsFromMap(map))).toBe(
      "STRAND_COMPLETE",
    );
  });
});
