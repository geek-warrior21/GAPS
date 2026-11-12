import { toIstDateString } from "./sparks";
import type { BeliefStatus, CheckedAttempt, ConceptId } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ComebackCardData {
  readonly conceptId: ConceptId;
  readonly pastDate: string;
  readonly pastCorrect: number;
  readonly pastTotal: number;
  readonly pastAttemptIds: readonly string[];
  readonly presentCorrect: number;
  readonly presentAttemptIds: readonly string[];
  readonly achievedAt: string;
  readonly message: string;
}

/**
 * Build a Comeback Card per SPEC §19.7 when a concept becomes demonstrated or retained
 * at least 24 hours after firstNeedsSupportAt. Every cited value comes from stored evidence.
 */
export function buildComebackCard(input: {
  readonly conceptId: ConceptId;
  readonly studentTitle: string;
  readonly status: BeliefStatus;
  readonly firstNeedsSupportAt: string | null;
  readonly achievedAt: string;
  readonly history: readonly CheckedAttempt[];
}): ComebackCardData | null {
  if (input.status !== "demonstrated" && input.status !== "retained") {
    return null;
  }
  if (input.firstNeedsSupportAt === null) {
    return null;
  }
  const supportMs = Date.parse(input.firstNeedsSupportAt);
  const achievedMs = Date.parse(input.achievedAt);
  if (Number.isNaN(supportMs) || Number.isNaN(achievedMs) || achievedMs - supportMs < DAY_MS) {
    return null;
  }

  const pastDate = toIstDateString(input.firstNeedsSupportAt);
  const pastDayAttempts = input.history.filter(
    (a) =>
      a.conceptId === input.conceptId &&
      (a.outcome === "correct" || a.outcome === "incorrect") &&
      toIstDateString(a.at) === pastDate,
  );
  const pastIncorrectInd = pastDayAttempts.filter(
    (a) => a.assistance === 0 && a.outcome === "incorrect",
  );
  if (pastIncorrectInd.length === 0) {
    return null;
  }

  const pastAttemptIds = pastIncorrectInd.slice(0, 3).map((a) => a.attemptId);
  const pastCorrect = pastDayAttempts.filter((a) => a.outcome === "correct").length;
  const pastTotal = pastDayAttempts.length;

  // Present streak: consecutive independent correct attempts ending at achievedAt
  const indEvidence = input.history.filter(
    (a) =>
      a.conceptId === input.conceptId &&
      a.assistance === 0 &&
      (a.outcome === "correct" || a.outcome === "incorrect") &&
      Date.parse(a.at) <= achievedMs,
  );
  const streakIds: string[] = [];
  for (let i = indEvidence.length - 1; i >= 0; i--) {
    const item = indEvidence[i];
    if (!item || item.outcome !== "correct") {
      break;
    }
    streakIds.unshift(item.attemptId);
  }
  if (streakIds.length === 0) {
    return null;
  }

  const message =
    `On ${pastDate} you got ${pastCorrect} of ${pastTotal} ${input.studentTitle} questions. ` +
    `Today you got ${streakIds.length} in a row on your own. That's a comeback!`;

  return {
    conceptId: input.conceptId,
    pastDate,
    pastCorrect,
    pastTotal,
    pastAttemptIds,
    presentCorrect: streakIds.length,
    presentAttemptIds: streakIds,
    achievedAt: input.achievedAt,
    message,
  };
}
