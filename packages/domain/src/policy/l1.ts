import type { Belief, BeliefStatus, ChapterId, ConceptId, ConceptNode } from "../types";

export const STRAND_CONCEPTS: readonly ConceptNode[] = [
  {
    id: "MATH-FRAC-PART",
    studentTitle: "Parts of a whole",
    chapter: "A",
    topoOrder: 1,
    prerequisites: [],
  },
  {
    id: "MATH-FRAC-NUMLINE",
    studentTitle: "Fractions on a number line",
    chapter: "A",
    topoOrder: 2,
    prerequisites: ["MATH-FRAC-PART"],
  },
  {
    id: "MATH-NUM-HCF",
    studentTitle: "Factors and HCF",
    chapter: "A",
    topoOrder: 3,
    prerequisites: [],
  },
  {
    id: "MATH-FRAC-EQUIV",
    studentTitle: "Equivalent fractions",
    chapter: "A",
    topoOrder: 4,
    prerequisites: ["MATH-FRAC-PART", "MATH-FRAC-NUMLINE"],
  },
  {
    id: "MATH-FRAC-SIMPLIFY",
    studentTitle: "Simplest form",
    chapter: "A",
    topoOrder: 5,
    prerequisites: ["MATH-FRAC-EQUIV", "MATH-NUM-HCF"],
  },
  {
    id: "MATH-FRAC-COMPARE",
    studentTitle: "Comparing fractions",
    chapter: "A",
    topoOrder: 6,
    prerequisites: ["MATH-FRAC-EQUIV"],
  },
  {
    id: "MATH-FRAC-MIXED",
    studentTitle: "Mixed numbers and improper fractions",
    chapter: "A",
    topoOrder: 7,
    prerequisites: ["MATH-FRAC-PART", "MATH-FRAC-NUMLINE"],
  },
  {
    id: "MATH-NUM-LCM",
    studentTitle: "Multiples and LCM",
    chapter: "B",
    topoOrder: 8,
    prerequisites: [],
  },
  {
    id: "MATH-FRAC-ADDLIKE",
    studentTitle: "Adding and subtracting like fractions",
    chapter: "B",
    topoOrder: 9,
    prerequisites: ["MATH-FRAC-PART"],
  },
  {
    id: "MATH-FRAC-ADDUNLIKE",
    studentTitle: "Adding and subtracting unlike fractions",
    chapter: "B",
    topoOrder: 10,
    prerequisites: ["MATH-FRAC-EQUIV", "MATH-FRAC-ADDLIKE", "MATH-NUM-LCM"],
  },
  {
    id: "MATH-FRAC-MULT",
    studentTitle: "Multiplying fractions",
    chapter: "B",
    topoOrder: 11,
    prerequisites: ["MATH-FRAC-PART", "MATH-FRAC-SIMPLIFY"],
  },
  {
    id: "MATH-FRAC-DIV",
    studentTitle: "Dividing fractions",
    chapter: "B",
    topoOrder: 12,
    prerequisites: ["MATH-FRAC-MULT"],
  },
  {
    id: "MATH-FRAC-DEC",
    studentTitle: "Fractions and decimals",
    chapter: "C",
    topoOrder: 13,
    prerequisites: ["MATH-FRAC-EQUIV"],
  },
  {
    id: "MATH-FRAC-WORD",
    studentTitle: "Fraction word problems",
    chapter: "C",
    topoOrder: 14,
    prerequisites: ["MATH-FRAC-ADDUNLIKE", "MATH-FRAC-MULT"],
  },
];

const CONCEPT_BY_ID = new Map<ConceptId, ConceptNode>(STRAND_CONCEPTS.map((c) => [c.id, c]));

export type Grade = 6 | 7 | 8;

export const GRADE_ENTRY: Readonly<Record<Grade, ConceptId>> = {
  6: "MATH-FRAC-PART",
  7: "MATH-FRAC-EQUIV",
  8: "MATH-FRAC-ADDUNLIKE",
};

export function getConceptNode(id: ConceptId): ConceptNode {
  const node = CONCEPT_BY_ID.get(id);
  if (!node) {
    throw new Error(`Unknown conceptId: ${id}`);
  }
  return node;
}

export function getChapterConcepts(
  chapter: ChapterId,
  concepts: readonly ConceptNode[] = STRAND_CONCEPTS,
): readonly ConceptNode[] {
  return concepts.filter((c) => c.chapter === chapter);
}

/**
 * L1 focus path selector per SPEC §19.5.
 * Concepts before startConceptId left not_assessed stay grey and are never assumed mastered.
 */
export function focusConcept(
  state: { readonly grade: Grade; readonly startConceptId: ConceptId | null },
  beliefs: Partial<Record<ConceptId, Pick<Belief, "status">>>,
  concepts: readonly ConceptNode[] = STRAND_CONCEPTS,
): ConceptId | "STRAND_COMPLETE" {
  const startId = state.startConceptId ?? GRADE_ENTRY[state.grade];
  const startTopo = getConceptNode(startId).topoOrder;

  const support = concepts.find((c) => beliefs[c.id]?.status === "needs_support");
  if (support) {
    return support.id;
  }

  const ahead = concepts.find((c) => {
    if (c.topoOrder < startTopo) {
      return false;
    }
    const status: BeliefStatus = beliefs[c.id]?.status ?? "not_assessed";
    return status !== "demonstrated" && status !== "retained";
  });

  return ahead ? ahead.id : "STRAND_COMPLETE";
}
