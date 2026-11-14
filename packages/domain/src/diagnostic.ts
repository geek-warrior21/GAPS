import { GRADE_ENTRY, type Grade, STRAND_CONCEPTS, getConceptNode } from "./policy/l1";
import type { BeliefStatus, ConceptId, ConceptNode } from "./types";

export const DEFAULT_DIAGNOSTIC_MAX_ITEMS = 5;

export interface DiagnosticItemResult {
  readonly conceptId: ConceptId;
  readonly correct: boolean;
  readonly misconceptionId?: string;
}

export interface DiagnosticState {
  readonly grade: Grade;
  readonly currentConceptId: ConceptId | null;
  readonly itemSeq: number;
  readonly maxItems: number;
  readonly history: readonly DiagnosticItemResult[];
  readonly testedConceptIds: readonly ConceptId[];
  readonly gaps: readonly ConceptId[];
  readonly strengths: readonly ConceptId[];
  readonly done: boolean;
  readonly recommendedStartConceptId: ConceptId | null;
}

export interface CreateDiagnosticOptions {
  readonly grade: Grade;
  readonly maxItems?: number;
  readonly existingBeliefs?: Partial<Record<ConceptId, BeliefStatus>>;
  readonly concepts?: readonly ConceptNode[];
}

function minByTopo(a: ConceptId | null, b: ConceptId): ConceptId {
  if (a === null) return b;
  return getConceptNode(a).topoOrder <= getConceptNode(b).topoOrder ? a : b;
}

function maxByTopo(a: ConceptId | null, b: ConceptId): ConceptId {
  if (a === null) return b;
  return getConceptNode(a).topoOrder >= getConceptNode(b).topoOrder ? a : b;
}

/**
 * Initializes a new diagnostic assessment tailored to student grade and prior knowledge.
 */
export function createDiagnostic(options: CreateDiagnosticOptions): DiagnosticState {
  const {
    grade,
    maxItems = DEFAULT_DIAGNOSTIC_MAX_ITEMS,
    existingBeliefs = {},
    concepts = STRAND_CONCEPTS,
  } = options;

  // Determine starting concept: grade entry point, unless already demonstrated
  let startId: ConceptId = GRADE_ENTRY[grade];
  const startStatus = existingBeliefs[startId];

  if (startStatus === "demonstrated" || startStatus === "retained") {
    // Pick the first unassessed concept after the startId in topo order
    const unassessed = concepts
      .filter((c) => {
        const s = existingBeliefs[c.id];
        return !s || s === "not_assessed";
      })
      .sort((a, b) => a.topoOrder - b.topoOrder);

    if (unassessed.length > 0) {
      startId = unassessed[0]!.id;
    }
  }

  return {
    grade,
    currentConceptId: startId,
    itemSeq: 1,
    maxItems,
    history: [],
    testedConceptIds: [],
    gaps: [],
    strengths: [],
    done: false,
    recommendedStartConceptId: null,
  };
}

/**
 * Advance diagnostic state by evaluating a student response.
 * Adaptive rule:
 * - If correct: advance along DAG to downstream concepts (or topo + 2).
 * - If incorrect: step back to an unassessed prerequisite in the DAG!
 */
export function stepDiagnostic(
  state: DiagnosticState,
  result: { correct: boolean; misconceptionId?: string },
  concepts: readonly ConceptNode[] = STRAND_CONCEPTS,
): DiagnosticState {
  if (state.done || state.currentConceptId === null) {
    return state;
  }

  const current = getConceptNode(state.currentConceptId);
  const correct = result.correct;

  const itemResult: DiagnosticItemResult = {
    conceptId: current.id,
    correct,
    ...(result.misconceptionId ? { misconceptionId: result.misconceptionId } : {}),
  };

  const history = [...state.history, itemResult];
  const testedConceptIds = [...state.testedConceptIds, current.id];
  const testedSet = new Set<ConceptId>(testedConceptIds);

  const gaps = correct ? state.gaps : [...state.gaps, current.id];
  const strengths = correct ? [...state.strengths, current.id] : state.strengths;

  // Adaptive next concept selection
  let nextConceptId: ConceptId | null = null;

  if (correct) {
    // 1. Try a direct dependent child in DAG that hasn't been tested
    const dependent = concepts.find(
      (c) => c.prerequisites.includes(current.id) && !testedSet.has(c.id),
    );
    if (dependent) {
      nextConceptId = dependent.id;
    } else {
      // 2. Try topoOrder + 2 candidate
      const candidate = concepts.find(
        (c) => c.topoOrder >= current.topoOrder + 2 && !testedSet.has(c.id),
      );
      if (candidate) {
        nextConceptId = candidate.id;
      } else {
        // 3. Any untested concept with higher topo order
        const forward = concepts.find(
          (c) => c.topoOrder > current.topoOrder && !testedSet.has(c.id),
        );
        if (forward) {
          nextConceptId = forward.id;
        }
      }
    }
  } else {
    // Incorrect: step back to an unassessed prerequisite in the DAG!
    const untestedPrereq = current.prerequisites.find((pid) => !testedSet.has(pid));
    if (untestedPrereq !== undefined) {
      nextConceptId = untestedPrereq;
    } else {
      // If direct prerequisites are tested, check any unassessed concept with lower topo order
      const earlier = concepts
        .filter((c) => c.topoOrder < current.topoOrder && !testedSet.has(c.id))
        .sort((a, b) => b.topoOrder - a.topoOrder); // closest earlier

      if (earlier.length > 0) {
        nextConceptId = earlier[0]!.id;
      }
    }
  }

  const isDone = testedConceptIds.length >= state.maxItems || nextConceptId === null;

  // Compute recommended start concept on completion
  let recommendedStartConceptId: ConceptId | null = null;
  if (isDone) {
    if (gaps.length > 0) {
      // Lowest miss by topo order
      recommendedStartConceptId = gaps.reduce<ConceptId>(
        (lowest, curr) => minByTopo(lowest, curr),
        gaps[0]!,
      );
    } else if (strengths.length > 0) {
      // Highest hit: recommend the next concept after highest hit
      const highestHit = strengths.reduce<ConceptId>(
        (highest, curr) => maxByTopo(highest, curr),
        strengths[0]!,
      );
      const nextTopo = getConceptNode(highestHit).topoOrder + 1;
      const next = concepts.find((c) => c.topoOrder === nextTopo);
      recommendedStartConceptId = next?.id ?? highestHit;
    } else {
      recommendedStartConceptId = GRADE_ENTRY[state.grade];
    }
  }

  return {
    grade: state.grade,
    currentConceptId: isDone ? null : nextConceptId,
    itemSeq: state.itemSeq + 1,
    maxItems: state.maxItems,
    history,
    testedConceptIds,
    gaps,
    strengths,
    done: isDone,
    recommendedStartConceptId,
  };
}

/**
 * Projects initial concept belief statuses from diagnostic results:
 * - Gaps (incorrect answers) -> "needs_support"
 * - Strengths (correct answers) -> "developing" (evidence towards mastery)
 * - Untested concepts -> "not_assessed" (insufficient evidence explicitly preserved)
 */
export function projectDiagnosticBeliefs(
  state: DiagnosticState,
  concepts: readonly ConceptNode[] = STRAND_CONCEPTS,
): Record<ConceptId, { status: BeliefStatus; reliability: "missing" | "supported" }> {
  const result = {} as Record<
    ConceptId,
    { status: BeliefStatus; reliability: "missing" | "supported" }
  >;
  const gapSet = new Set(state.gaps);
  const strengthSet = new Set(state.strengths);

  for (const c of concepts) {
    if (gapSet.has(c.id)) {
      result[c.id] = { status: "needs_support", reliability: "supported" };
    } else if (strengthSet.has(c.id)) {
      result[c.id] = { status: "developing", reliability: "supported" };
    } else {
      result[c.id] = { status: "not_assessed", reliability: "missing" };
    }
  }

  return result;
}
