import { GRADE_ENTRY, type Grade, STRAND_CONCEPTS, getConceptNode } from "./policy/l1";
import type { ConceptId, ConceptNode } from "./types";

export const QUICK_CHECK_MAX_ITEMS = 5;
export const QUICK_CHECK_DIFFICULTY = 2 as const;

export interface QuickCheckState {
  readonly grade: Grade;
  readonly currentConceptId: ConceptId | null;
  readonly tested: readonly ConceptId[];
  readonly lowestMiss: ConceptId | null;
  readonly highestHit: ConceptId | null;
  readonly done: boolean;
  readonly startConceptId: ConceptId | null;
}

export function createQuickCheck(grade: Grade): QuickCheckState {
  return {
    grade,
    currentConceptId: GRADE_ENTRY[grade],
    tested: [],
    lowestMiss: null,
    highestHit: null,
    done: false,
    startConceptId: null,
  };
}

function minByTopo(a: ConceptId | null, b: ConceptId): ConceptId {
  if (a === null) {
    return b;
  }
  return getConceptNode(a).topoOrder <= getConceptNode(b).topoOrder ? a : b;
}

function maxByTopo(a: ConceptId | null, b: ConceptId): ConceptId {
  if (a === null) {
    return b;
  }
  return getConceptNode(a).topoOrder >= getConceptNode(b).topoOrder ? a : b;
}

function nextAfter(
  conceptId: ConceptId | null,
  concepts: readonly ConceptNode[],
): ConceptId | null {
  if (conceptId === null) {
    return null;
  }
  const targetTopo = getConceptNode(conceptId).topoOrder + 1;
  return concepts.find((c) => c.topoOrder === targetTopo)?.id ?? conceptId;
}

/**
 * Advance Quick Check state by one answered item per SPEC §19.5.
 * Max 5 items, difficulty 2, independent attempts.
 */
export function stepQuickCheck(
  state: QuickCheckState,
  correct: boolean,
  concepts: readonly ConceptNode[] = STRAND_CONCEPTS,
): QuickCheckState {
  if (state.done || state.currentConceptId === null) {
    return state;
  }

  const current = getConceptNode(state.currentConceptId);
  const tested = [...state.tested, current.id];
  const testedSet = new Set<ConceptId>(tested);

  const highestHit = correct ? maxByTopo(state.highestHit, current.id) : state.highestHit;
  const lowestMiss = correct ? state.lowestMiss : minByTopo(state.lowestMiss, current.id);

  let nextConceptId: ConceptId | null = null;
  if (correct) {
    const candidate = concepts.find((c) => c.topoOrder === current.topoOrder + 2);
    if (candidate && !testedSet.has(candidate.id)) {
      nextConceptId = candidate.id;
    }
  } else {
    const untestedPrereq = current.prerequisites.find((pid) => !testedSet.has(pid));
    if (untestedPrereq !== undefined) {
      nextConceptId = untestedPrereq;
    }
  }

  const done = tested.length >= QUICK_CHECK_MAX_ITEMS || nextConceptId === null;
  const startConceptId = done
    ? (lowestMiss ?? nextAfter(highestHit, concepts) ?? GRADE_ENTRY[state.grade])
    : null;

  return {
    grade: state.grade,
    currentConceptId: done ? null : nextConceptId,
    tested,
    lowestMiss,
    highestHit,
    done,
    startConceptId,
  };
}

/** Run Quick Check to completion against a deterministic outcome predicate. */
export function runQuickCheck(
  grade: Grade,
  isCorrect: (conceptId: ConceptId) => boolean,
  concepts: readonly ConceptNode[] = STRAND_CONCEPTS,
): QuickCheckState {
  let state = createQuickCheck(grade);
  while (!state.done && state.currentConceptId !== null) {
    state = stepQuickCheck(state, isCorrect(state.currentConceptId), concepts);
  }
  return state;
}
