import {
  type Belief,
  type CheckedAttempt,
  type ConceptId,
  type MisconceptionId,
  POLICY_VERSION,
  type Reliability,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = 30 * DAY_MS;
const RETENTION_DELAY_MS = 7 * DAY_MS;

export type ReviewEffect =
  | {
      readonly type: "schedule_review";
      readonly kind: "warmup" | "retention" | "retry";
      readonly conceptId: ConceptId;
      readonly dueAt: string;
    }
  | {
      readonly type: "cancel_reviews";
      readonly conceptId: ConceptId;
    };

export interface BeliefState extends Belief {
  readonly history: readonly CheckedAttempt[];
  readonly lastEvidenceAt: string | null;
  readonly lastEffects: readonly ReviewEffect[];
}

export interface BeliefReducerContext {
  readonly templatesForConcept: number;
}

export function createInitialBeliefState(conceptId: ConceptId): BeliefState {
  return {
    conceptId,
    status: "not_assessed",
    estimate: null,
    reliability: "missing",
    demonstratedAt: null,
    retainedAt: null,
    firstNeedsSupportAt: null,
    activeMisconceptionIds: [],
    policyVersion: POLICY_VERSION,
    version: 0,
    history: [],
    lastEvidenceAt: null,
    lastEffects: [],
  };
}

export function toPublicBelief(state: BeliefState): Belief {
  return {
    conceptId: state.conceptId,
    status: state.status,
    estimate: state.estimate,
    reliability: state.reliability,
    demonstratedAt: state.demonstratedAt,
    retainedAt: state.retainedAt,
    firstNeedsSupportAt: state.firstNeedsSupportAt,
    activeMisconceptionIds: state.activeMisconceptionIds,
    policyVersion: state.policyVersion,
    version: state.version,
  };
}

function addDaysIso(isoUtc: string, days: number): string {
  const ms = Date.parse(isoUtc);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid ISO timestamp: ${isoUtc}`);
  }
  return new Date(ms + days * DAY_MS).toISOString();
}

function distinctCount(values: readonly string[]): number {
  return new Set(values).size;
}

function hasRepeatedMisconception(lastFourChecked: readonly CheckedAttempt[]): boolean {
  const counts = new Map<MisconceptionId, number>();
  for (const att of lastFourChecked) {
    if (!att.misconceptionId) {
      continue;
    }
    const next = (counts.get(att.misconceptionId) ?? 0) + 1;
    if (next >= 2) {
      return true;
    }
    counts.set(att.misconceptionId, next);
  }
  return false;
}

function collectActiveMisconceptions(
  lastFourChecked: readonly CheckedAttempt[],
): readonly MisconceptionId[] {
  const seen = new Set<MisconceptionId>();
  const result: MisconceptionId[] = [];
  for (const att of lastFourChecked) {
    if (att.misconceptionId && !seen.has(att.misconceptionId)) {
      seen.add(att.misconceptionId);
      result.push(att.misconceptionId);
    }
  }
  return result;
}

function isAlternating(lastFourInd: readonly CheckedAttempt[]): boolean {
  if (lastFourInd.length !== 4) {
    return false;
  }
  for (let i = 0; i < 3; i++) {
    const curr = lastFourInd[i];
    const next = lastFourInd[i + 1];
    if (!curr || !next || curr.outcome === next.outcome) {
      return false;
    }
  }
  return true;
}

/**
 * Pure, replayable belief reducer per SPEC §9 and §19.4.
 * Unparseable and not_simplified submissions are ignored.
 * Assisted attempts (assistance > 0) never promote mastery (invariant I2).
 */
export function beliefReducer(
  b: BeliefState,
  a: CheckedAttempt,
  ctx: BeliefReducerContext,
): BeliefState {
  if (a.conceptId !== b.conceptId) {
    throw new Error(
      `Attempt conceptId ${a.conceptId} does not match belief conceptId ${b.conceptId}`,
    );
  }
  if (a.outcome !== "correct" && a.outcome !== "incorrect") {
    return b;
  }

  const history = [...b.history, a];
  const ind = history.filter((x) => x.assistance === 0);
  const l4 = ind.slice(-4);
  const l2 = ind.slice(-2);
  const recentChecked = history.slice(-4);

  const twoMisses = l2.length === 2 && l2.every((x) => x.outcome === "incorrect");
  const repeatedMc = hasRepeatedMisconception(recentChecked);
  const okL4 = l4.filter((x) => x.outcome === "correct");
  const demonstratedCond =
    okL4.length >= 3 &&
    l2.length === 2 &&
    l2.every((x) => x.outcome === "correct") &&
    distinctCount(okL4.map((x) => x.itemInstanceId)) >= 3 &&
    (ctx.templatesForConcept < 2 || distinctCount(okL4.map((x) => x.templateId)) >= 2);

  let status = b.status;
  let demonstratedAt = b.demonstratedAt;
  let retainedAt = b.retainedAt;
  let firstNeedsSupportAt = b.firstNeedsSupportAt;
  let reliabilityOverride: Reliability | null = null;
  const effects: ReviewEffect[] = [];

  if ((status === "demonstrated" || status === "retained") && twoMisses) {
    status = "needs_support";
    demonstratedAt = null;
    retainedAt = null;
    firstNeedsSupportAt = firstNeedsSupportAt ?? a.at;
    effects.push({ type: "cancel_reviews", conceptId: b.conceptId });
  } else if (
    status === "demonstrated" &&
    a.assistance === 0 &&
    a.outcome === "correct" &&
    a.isReview &&
    demonstratedAt !== null &&
    Date.parse(a.at) - Date.parse(demonstratedAt) >= RETENTION_DELAY_MS
  ) {
    status = "retained";
    retainedAt = a.at;
  } else if (
    (status === "demonstrated" || status === "retained") &&
    a.isReview &&
    a.outcome === "incorrect"
  ) {
    reliabilityOverride = "conflicting";
    effects.push({
      type: "schedule_review",
      kind: "retry",
      conceptId: b.conceptId,
      dueAt: addDaysIso(a.at, 1),
    });
  } else if (status !== "demonstrated" && status !== "retained") {
    if (demonstratedCond && a.assistance === 0) {
      status = "demonstrated";
      demonstratedAt = a.at;
      effects.push(
        {
          type: "schedule_review",
          kind: "warmup",
          conceptId: b.conceptId,
          dueAt: addDaysIso(a.at, 2),
        },
        {
          type: "schedule_review",
          kind: "retention",
          conceptId: b.conceptId,
          dueAt: addDaysIso(a.at, 7),
        },
      );
    } else if (twoMisses || repeatedMc) {
      status = "needs_support";
      firstNeedsSupportAt = firstNeedsSupportAt ?? a.at;
    } else {
      status = "developing";
    }
  }

  const indCorrectCount = ind.filter((x) => x.outcome === "correct").length;
  const estimate = ind.length >= 2 ? (indCorrectCount + 1) / (ind.length + 2) : null;
  const reliability: Reliability =
    reliabilityOverride ?? (isAlternating(l4) ? "conflicting" : "supported");

  return {
    conceptId: b.conceptId,
    status,
    estimate,
    reliability,
    demonstratedAt,
    retainedAt,
    firstNeedsSupportAt,
    activeMisconceptionIds: collectActiveMisconceptions(recentChecked),
    policyVersion: POLICY_VERSION,
    version: b.version + 1,
    history,
    lastEvidenceAt: a.at,
    lastEffects: effects,
  };
}

/** Replay a concept's attempt list in chronological order to reconstruct exact BeliefState. */
export function replayBeliefs(
  conceptId: ConceptId,
  attempts: readonly CheckedAttempt[],
  ctx: BeliefReducerContext,
): BeliefState {
  const ordered = [...attempts]
    .filter((a) => a.conceptId === conceptId)
    .sort((a, b) => {
      const diff = Date.parse(a.at) - Date.parse(b.at);
      return diff !== 0 ? diff : a.attemptId.localeCompare(b.attemptId);
    });
  return ordered.reduce(
    (state, attempt) => beliefReducer(state, attempt, ctx),
    createInitialBeliefState(conceptId),
  );
}

/** Compute read-time effective reliability (staleness is > 30 days since lastEvidenceAt). */
export function computeEffectiveReliability(state: BeliefState, nowIso: string): Reliability {
  if (state.history.length === 0 || state.lastEvidenceAt === null) {
    return "missing";
  }
  const ageMs = Date.parse(nowIso) - Date.parse(state.lastEvidenceAt);
  if (ageMs > STALE_AFTER_MS) {
    return "stale";
  }
  return state.reliability;
}
