import { type Rng, createRng, hashStringToSeed } from "../rng";
import type {
  AttemptOutcome,
  Belief,
  BeliefStatus,
  ChapterId,
  ConceptId,
  ConceptNode,
} from "../types";
import {
  GRADE_ENTRY,
  type Grade,
  STRAND_CONCEPTS,
  focusConcept,
  getChapterConcepts,
  getConceptNode,
} from "./l1";

export const LEARN_SESSION_BUDGET_SECONDS = 15 * 60;
export const BOSS_BATTLE_ITEM_COUNT = 8;
export const BOSS_BATTLE_PASS_SCORE = 6;
export const BOSS_BATTLE_DIFFICULTY = 2 as const;

export interface DueReviewItem {
  readonly conceptId: ConceptId;
  readonly dueAt: string;
}

export interface LearnSessionOpenPlan {
  readonly budgetSeconds: number;
  readonly firstAction: "RETRIEVAL_REVIEW" | "LEARN_FOCUS";
  readonly reviewConceptId: ConceptId | null;
}

/**
 * Plan start of a Learn session per SPEC §19.6:
 * 15-minute budget; if a review is due for another concept, serve one RETRIEVAL_REVIEW first.
 */
export function planLearnSessionOpen(
  focusConceptId: ConceptId | "STRAND_COMPLETE",
  dueReviews: readonly DueReviewItem[],
): LearnSessionOpenPlan {
  const otherDue = [...dueReviews]
    .filter((r) => r.conceptId !== focusConceptId)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  if (otherDue) {
    return {
      budgetSeconds: LEARN_SESSION_BUDGET_SECONDS,
      firstAction: "RETRIEVAL_REVIEW",
      reviewConceptId: otherDue.conceptId,
    };
  }
  return {
    budgetSeconds: LEARN_SESSION_BUDGET_SECONDS,
    firstAction: "LEARN_FOCUS",
    reviewConceptId: null,
  };
}

export function targetDifficulty(
  status: BeliefStatus,
  consecutiveIndependentCorrect: number,
): 1 | 2 | 3 {
  if (status === "not_assessed" || status === "needs_support") {
    return 1;
  }
  if (consecutiveIndependentCorrect >= 2) {
    return 3;
  }
  return 2;
}

export interface TemplateCandidate {
  readonly id: string;
  readonly difficulty: 1 | 2 | 3;
  readonly reviewed: boolean;
}

/**
 * Choose a template per SPEC §19.6:
 * - only reviewed templates when requireReviewed is true
 * - prefer target difficulty (fallback to nearest available difficulty)
 * - prefer a template not used in the last 3 items
 */
export function selectTemplate<T extends TemplateCandidate>(
  candidates: readonly T[],
  recentTemplateIds: readonly string[],
  desiredDifficulty: 1 | 2 | 3,
  rng: Rng,
  requireReviewed = true,
): T | null {
  const allowed = requireReviewed ? candidates.filter((c) => c.reviewed) : [...candidates];
  if (allowed.length === 0) {
    return null;
  }
  const recentSet = new Set(recentTemplateIds.slice(-3));
  const nonRecent = allowed.filter((c) => !recentSet.has(c.id));
  const pool = nonRecent.length > 0 ? nonRecent : allowed;

  const exactDiff = pool.filter((c) => c.difficulty === desiredDifficulty);
  if (exactDiff.length > 0) {
    return rng.pick(exactDiff);
  }
  const sortedByDiff = [...pool].sort(
    (a, b) =>
      Math.abs(a.difficulty - desiredDifficulty) - Math.abs(b.difficulty - desiredDifficulty),
  );
  const closest = sortedByDiff[0];
  if (!closest) {
    return null;
  }
  const bestDistance = Math.abs(closest.difficulty - desiredDifficulty);
  const nearestGroup = sortedByDiff.filter(
    (c) => Math.abs(c.difficulty - desiredDifficulty) === bestDistance,
  );
  return rng.pick(nearestGroup);
}

/**
 * Draw a deterministic non-repeating seed excluding keys seen in the last 7 days.
 */
export function drawFreshSeed<P>(
  templateId: string,
  seenKeys7Days: ReadonlySet<string>,
  generateForSeed: (seed: number) => P | null,
  rng: Rng,
  maxAttempts = 50,
): { readonly seed: number; readonly params: P } | null {
  for (let i = 0; i < maxAttempts; i++) {
    const seed = rng.int(1, 0x7fff_fffe);
    if (seenKeys7Days.has(`${templateId}#${seed}`)) {
      continue;
    }
    const params = generateForSeed(seed);
    if (params !== null) {
      return { seed, params };
    }
  }
  return null;
}

export interface QuestSlot {
  readonly slotIndex: number;
  readonly kind: "review" | "focus" | "stretch";
  readonly conceptId: ConceptId;
  readonly assistanceAllowed: true;
  readonly maxTries: 2;
}

export interface DailyQuestPlan {
  readonly studentId: string;
  readonly istDate: string;
  readonly slots: readonly QuestSlot[];
}

function isDevelopingOrBetter(status: BeliefStatus | undefined): boolean {
  return status === "developing" || status === "demonstrated" || status === "retained";
}

function findStretchConcept(
  focus: ConceptId,
  beliefs: Partial<Record<ConceptId, Pick<Belief, "status">>>,
  concepts: readonly ConceptNode[],
): ConceptId {
  const focusTopo = getConceptNode(focus).topoOrder;
  const candidate = concepts.find((c) => {
    if (c.id === focus || c.topoOrder <= focusTopo) {
      return false;
    }
    const status = beliefs[c.id]?.status;
    if (status === "demonstrated" || status === "retained") {
      return false;
    }
    return c.prerequisites.every((pid) => isDevelopingOrBetter(beliefs[pid]?.status));
  });
  return candidate ? candidate.id : focus;
}

/**
 * Compose a deterministic Daily Quest for (studentId, istDate) per SPEC §19.6.
 * Yields 3-5 items: cold start = 3 grade-entry items; otherwise up to 2 reviews,
 * 2 focus (or 3 if 0 reviews), and 1 stretch (or focus fallback).
 */
export function composeDailyQuest(input: {
  readonly studentId: string;
  readonly istDate: string;
  readonly grade: Grade;
  readonly startConceptId: ConceptId | null;
  readonly beliefs: Partial<Record<ConceptId, Pick<Belief, "status">>>;
  readonly dueReviewConceptIds: readonly ConceptId[];
  readonly concepts?: readonly ConceptNode[];
}): DailyQuestPlan {
  const concepts = input.concepts ?? STRAND_CONCEPTS;
  const hasAnyEvidence = concepts.some((c) => {
    const st = input.beliefs[c.id]?.status;
    return st !== undefined && st !== "not_assessed";
  });

  const makeSlot = (
    slotIndex: number,
    kind: QuestSlot["kind"],
    conceptId: ConceptId,
  ): QuestSlot => ({
    slotIndex,
    kind,
    conceptId,
    assistanceAllowed: true,
    maxTries: 2,
  });

  if (!hasAnyEvidence && input.dueReviewConceptIds.length === 0) {
    const entry = input.startConceptId ?? GRADE_ENTRY[input.grade];
    return {
      studentId: input.studentId,
      istDate: input.istDate,
      slots: [
        makeSlot(0, "focus", entry),
        makeSlot(1, "focus", entry),
        makeSlot(2, "focus", entry),
      ],
    };
  }

  const rng = createRng(hashStringToSeed(`${input.studentId}:${input.istDate}:quest`));
  const resolvedFocus = focusConcept(
    { grade: input.grade, startConceptId: input.startConceptId },
    input.beliefs,
    concepts,
  );
  const focusId: ConceptId =
    resolvedFocus === "STRAND_COMPLETE"
      ? (concepts[concepts.length - 1]?.id ?? GRADE_ENTRY[input.grade])
      : resolvedFocus;

  const slots: QuestSlot[] = [];
  const reviewIds = input.dueReviewConceptIds.slice(0, 2);
  for (const cid of reviewIds) {
    slots.push(makeSlot(slots.length, "review", cid));
  }

  const focusCount = reviewIds.length === 0 ? 3 : 2;
  for (let i = 0; i < focusCount; i++) {
    slots.push(makeSlot(slots.length, "focus", focusId));
  }

  const stretchId = findStretchConcept(focusId, input.beliefs, concepts);
  slots.push(makeSlot(slots.length, "stretch", stretchId));

  // Deterministic seed touch ensures quest composition keeps stable RNG salt if shuffled later
  rng.next();

  return {
    studentId: input.studentId,
    istDate: input.istDate,
    slots,
  };
}

export function canUnlockChapterBoss(
  chapter: ChapterId,
  beliefs: Partial<Record<ConceptId, Pick<Belief, "status">>>,
  concepts: readonly ConceptNode[] = STRAND_CONCEPTS,
): boolean {
  const chapterConcepts = getChapterConcepts(chapter, concepts);
  const threshold = Math.ceil(chapterConcepts.length / 2);
  const activeCount = chapterConcepts.filter((c) =>
    isDevelopingOrBetter(beliefs[c.id]?.status),
  ).length;
  return activeCount >= threshold;
}

export function canStartBossToday(lastBossIstDate: string | null, todayIstDate: string): boolean {
  return lastBossIstDate !== todayIstDate;
}

export interface BossItemSlot {
  readonly index: number;
  readonly conceptId: ConceptId;
  readonly difficulty: typeof BOSS_BATTLE_DIFFICULTY;
  readonly helpAllowed: false;
}

export interface BossBattlePlan {
  readonly chapter: ChapterId;
  readonly items: readonly BossItemSlot[];
}

/**
 * Compose an 8-item Boss Battle for a chapter per SPEC §19.6:
 * spread evenly over the chapter's concepts, weighted toward developing concepts, difficulty 2.
 */
export function composeBossBattle(input: {
  readonly studentId: string;
  readonly istDate: string;
  readonly chapter: ChapterId;
  readonly beliefs: Partial<Record<ConceptId, Pick<Belief, "status">>>;
  readonly concepts?: readonly ConceptNode[];
}): BossBattlePlan {
  const chapterConcepts = getChapterConcepts(input.chapter, input.concepts ?? STRAND_CONCEPTS);
  const rng = createRng(
    hashStringToSeed(`${input.studentId}:${input.chapter}:${input.istDate}:boss`),
  );

  // One guaranteed slot per chapter concept (since max chapter size is 7 <= 8)
  const selected: ConceptId[] = chapterConcepts.map((c) => c.id);

  // Build weighted pool for remaining slots (developing gets 3x weight, others 1x)
  const weightedPool: ConceptId[] = [];
  for (const c of chapterConcepts) {
    const status = input.beliefs[c.id]?.status ?? "not_assessed";
    const weight = status === "developing" ? 3 : 1;
    for (let w = 0; w < weight; w++) {
      weightedPool.push(c.id);
    }
  }

  // Prefer unused or developing concepts for extra slots
  while (selected.length < BOSS_BATTLE_ITEM_COUNT) {
    selected.push(rng.pick(weightedPool));
  }

  const ordered = rng.shuffle(selected);
  return {
    chapter: input.chapter,
    items: ordered.map((conceptId, index) => ({
      index,
      conceptId,
      difficulty: BOSS_BATTLE_DIFFICULTY,
      helpAllowed: false,
    })),
  };
}

export function evaluateBossBattle(
  outcomes: readonly AttemptOutcome[],
  options?: { readonly requireComplete?: boolean },
): {
  readonly score: number;
  readonly total: number;
  readonly completed: boolean;
  readonly defeated: boolean;
} {
  if (outcomes.length > BOSS_BATTLE_ITEM_COUNT) {
    throw new RangeError(
      `Boss battle cannot exceed ${BOSS_BATTLE_ITEM_COUNT} items, received ${outcomes.length}`,
    );
  }
  const isResolved = (o: AttemptOutcome): boolean => o === "correct" || o === "incorrect";
  const resolvedOutcomes = outcomes.filter(isResolved);
  const resolvedCount = resolvedOutcomes.length;
  const completed =
    outcomes.length === BOSS_BATTLE_ITEM_COUNT && resolvedCount === BOSS_BATTLE_ITEM_COUNT;

  if (options?.requireComplete && !completed) {
    throw new RangeError(
      `Boss battle requires exactly ${BOSS_BATTLE_ITEM_COUNT} resolved items, received ${resolvedCount}`,
    );
  }
  const score = resolvedOutcomes.filter((o) => o === "correct").length;
  return {
    score,
    total: resolvedCount,
    completed,
    defeated: completed && score >= BOSS_BATTLE_PASS_SCORE,
  };
}
