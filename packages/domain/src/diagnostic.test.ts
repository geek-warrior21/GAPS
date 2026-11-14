import { describe, expect, it } from "vitest";
import { createDiagnostic, projectDiagnosticBeliefs, stepDiagnostic } from "./diagnostic";

describe("Workstream A: Diagnostic Engine", () => {
  it("initializes diagnostic at grade entry point", () => {
    const diag6 = createDiagnostic({ grade: 6 });
    expect(diag6.grade).toBe(6);
    expect(diag6.currentConceptId).toBe("MATH-FRAC-PART");
    expect(diag6.done).toBe(false);
    expect(diag6.itemSeq).toBe(1);

    const diag7 = createDiagnostic({ grade: 7 });
    expect(diag7.currentConceptId).toBe("MATH-FRAC-EQUIV");

    const diag8 = createDiagnostic({ grade: 8 });
    expect(diag8.currentConceptId).toBe("MATH-FRAC-ADDUNLIKE");
  });

  it("skips concepts for which sufficient evidence already exists", () => {
    const diag = createDiagnostic({
      grade: 7,
      existingBeliefs: {
        "MATH-FRAC-EQUIV": "demonstrated",
        "MATH-FRAC-SIMPLIFY": "retained",
      },
    });

    // Should skip demonstrated concepts and start at first unassessed concept
    expect(diag.currentConceptId).not.toBe("MATH-FRAC-EQUIV");
    expect(diag.currentConceptId).not.toBe("MATH-FRAC-SIMPLIFY");
    expect(diag.currentConceptId).toBe("MATH-FRAC-PART");
  });

  it("adapts forward on correct responses along downstream dependencies", () => {
    let state = createDiagnostic({ grade: 6, maxItems: 3 });
    expect(state.currentConceptId).toBe("MATH-FRAC-PART");

    // Correct on PART -> moves downstream to child or higher topo
    state = stepDiagnostic(state, { correct: true });
    expect(state.history).toHaveLength(1);
    expect(state.strengths).toContain("MATH-FRAC-PART");
    expect(state.gaps).toHaveLength(0);
    expect(state.done).toBe(false);

    // Concept should be downstream (e.g. NUMLINE or EQUIV)
    expect(["MATH-FRAC-NUMLINE", "MATH-FRAC-EQUIV", "MATH-NUM-HCF"]).toContain(
      state.currentConceptId,
    );
  });

  it("adapts backward to unassessed prerequisites on incorrect responses", () => {
    // Start at Grade 7: MATH-FRAC-EQUIV (prerequisites are PART and NUMLINE)
    let state = createDiagnostic({ grade: 7, maxItems: 4 });
    expect(state.currentConceptId).toBe("MATH-FRAC-EQUIV");

    // Incorrect answer on EQUIV with misconception MC-EQUIV-ADDITIVE
    state = stepDiagnostic(state, {
      correct: false,
      misconceptionId: "MC-EQUIV-ADDITIVE",
    });

    expect(state.gaps).toContain("MATH-FRAC-EQUIV");
    expect(state.history[0]?.misconceptionId).toBe("MC-EQUIV-ADDITIVE");

    // Must step back to an unassessed prerequisite (PART or NUMLINE)
    expect(["MATH-FRAC-PART", "MATH-FRAC-NUMLINE"]).toContain(state.currentConceptId);

    // Answer prerequisite correctly
    const prereqId = state.currentConceptId!;
    state = stepDiagnostic(state, { correct: true });
    expect(state.strengths).toContain(prereqId);
  });

  it("terminates when max questions reached and computes recommended start concept", () => {
    let state = createDiagnostic({ grade: 7, maxItems: 3 });

    // 1. EQUIV -> incorrect
    state = stepDiagnostic(state, { correct: false });
    expect(state.done).toBe(false);

    // 2. Prereq PART -> correct
    state = stepDiagnostic(state, { correct: true });
    expect(state.done).toBe(false);

    // 3. Third item -> incorrect
    state = stepDiagnostic(state, { correct: false });
    expect(state.done).toBe(true);
    expect(state.currentConceptId).toBeNull();

    // Recommended start concept should be the lowest missed concept (gap)
    expect(state.recommendedStartConceptId).toBeTruthy();
    expect(state.gaps).toContain(state.recommendedStartConceptId);
  });

  it("projects evidence-backed beliefs, preserving untested concepts as not_assessed", () => {
    let state = createDiagnostic({ grade: 6, maxItems: 2 });
    state = stepDiagnostic(state, { correct: false }); // PART miss
    state = stepDiagnostic(state, { correct: true }); // next hit

    const projections = projectDiagnosticBeliefs(state);

    // PART should be needs_support with supported reliability
    expect(projections["MATH-FRAC-PART"].status).toBe("needs_support");
    expect(projections["MATH-FRAC-PART"].reliability).toBe("supported");

    // Untested concepts (e.g. MATH-FRAC-DEC, MATH-FRAC-DIV) must remain not_assessed with missing reliability
    expect(projections["MATH-FRAC-DEC"].status).toBe("not_assessed");
    expect(projections["MATH-FRAC-DEC"].reliability).toBe("missing");
    expect(projections["MATH-FRAC-DIV"].status).toBe("not_assessed");
    expect(projections["MATH-FRAC-DIV"].reliability).toBe("missing");
  });
});
