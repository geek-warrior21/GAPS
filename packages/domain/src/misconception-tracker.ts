import type { ConceptId, MisconceptionId } from "./types";
import {
  MISCONCEPTION_CATALOG,
  matchMisconception,
  type MisconceptionMap,
  type MisconceptionValue,
} from "./misconceptions";

export type MisconceptionConfidence = "unclassified" | "low" | "medium" | "high";

export interface MisconceptionDetectionResult {
  readonly primaryMisconceptionId: MisconceptionId | null;
  readonly candidates: readonly MisconceptionId[];
  readonly confidence: MisconceptionConfidence;
  readonly evidenceCount: number;
  readonly isRecurring: boolean;
  readonly explanationHint?: string;
}

export interface AttemptMisconceptionEvidence {
  readonly outcome: "correct" | "incorrect" | "unparseable" | "not_simplified";
  readonly misconceptionId?: MisconceptionId;
}

/**
 * Deterministic heuristic checks for arithmetic misconceptions when not explicitly
 * enumerated in the template's misconception answers map.
 */
export function detectHeuristicMisconceptions(
  conceptId: ConceptId,
  rawAnswer: string,
  _parsedCandidate?: MisconceptionValue,
): MisconceptionId[] {
  const matches: MisconceptionId[] = [];
  const trimmed = rawAnswer.trim();

  // 1. Numerator / Denominator comparison heuristics
  if (conceptId === "MATH-FRAC-COMPARE") {
    if (trimmed === ">" || trimmed === "<") {
      // Possible comparison misconception candidates
      matches.push("MC-NUMERATOR-ONLY", "MC-BIGGER-DENOM");
    }
  }

  // 2. Part / Ratio check (e.g., student wrote 3/5 when parts are 3 and 8)
  if (conceptId === "MATH-FRAC-PART") {
    matches.push("MC-PART-RATIO");
  }

  // 3. Number line ticks check
  if (conceptId === "MATH-FRAC-NUMLINE") {
    matches.push("MC-NUMLINE-TICKS");
  }

  // 4. Decimal digit placement
  if (conceptId === "MATH-FRAC-DEC" && trimmed.startsWith("0.")) {
    matches.push("MC-DEC-DIGITS");
  }

  return matches;
}

/**
 * Detects misconception candidates and calculates confidence based on current attempt
 * and past attempts on this concept.
 * Invariant: Does not treat a single incorrect answer as definitive proof (confidence = "low").
 */
export function detectMisconception(
  conceptId: ConceptId,
  candidateValue: MisconceptionValue,
  correctValue: MisconceptionValue,
  misconceptionMap?: MisconceptionMap,
  history: readonly AttemptMisconceptionEvidence[] = [],
  rawAnswer = "",
): MisconceptionDetectionResult {
  const candidates: MisconceptionId[] = [];

  // 1. Template-mapped matching
  const directMatch = matchMisconception(candidateValue, correctValue, misconceptionMap);
  if (directMatch) {
    candidates.push(directMatch);
  }

  // 2. Heuristic fallback candidates if no direct match or for multi-candidate evaluation
  if (candidates.length === 0) {
    const heuristicMatches = detectHeuristicMisconceptions(conceptId, rawAnswer, candidateValue);
    for (const hId of heuristicMatches) {
      if (!candidates.includes(hId)) {
        candidates.push(hId);
      }
    }
  }

  if (candidates.length === 0) {
    return {
      primaryMisconceptionId: null,
      candidates: [],
      confidence: "unclassified",
      evidenceCount: 0,
      isRecurring: false,
    };
  }

  const primary = candidates[0]!;

  // 3. Evidence count from past attempts on this concept
  const pastMatches = history.filter(
    (a) => a.outcome === "incorrect" && a.misconceptionId === primary,
  ).length;

  const totalEvidence = pastMatches + 1; // including current attempt

  // Confidence tiers:
  // 1 evidence -> "low" (initial hypothesis, not definitive proof)
  // 2 evidence -> "medium" (recurring pattern detected)
  // 3+ evidence -> "high" (strongly confirmed systematic misconception)
  const confidence: MisconceptionConfidence =
    totalEvidence >= 3 ? "high" : totalEvidence >= 2 ? "medium" : "low";

  const isRecurring = totalEvidence >= 2;

  const meta = MISCONCEPTION_CATALOG[primary];
  const explanationHint = meta ? `Pattern observed: ${meta.pattern}` : undefined;

  return {
    primaryMisconceptionId: primary,
    candidates,
    confidence,
    evidenceCount: totalEvidence,
    isRecurring,
    explanationHint,
  };
}

/**
 * Reconciles active misconceptions for a concept belief state.
 * - If an independent attempt is correct, clears active misconceptions.
 * - If misconception is confirmed with recurring evidence (medium/high), marks as active.
 */
export function reconcileActiveMisconceptions(
  currentActiveIds: readonly MisconceptionId[],
  detection: MisconceptionDetectionResult,
  wasCorrect: boolean,
  isIndependent: boolean,
): readonly MisconceptionId[] {
  if (wasCorrect && isIndependent) {
    // Independent success resolves active misconceptions on this concept
    return [];
  }

  if (!detection.primaryMisconceptionId) {
    return currentActiveIds;
  }

  // Only promote to active if recurring (>= 2 occurrences) or already active
  if (detection.isRecurring || currentActiveIds.includes(detection.primaryMisconceptionId)) {
    if (!currentActiveIds.includes(detection.primaryMisconceptionId)) {
      return [...currentActiveIds, detection.primaryMisconceptionId];
    }
  }

  return currentActiveIds;
}
