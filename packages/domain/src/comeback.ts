import { replayTransitions } from "./belief";
import { toIstDateString } from "./sparks";
import type { BeliefStatus, CheckedAttempt, ConceptId } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ComebackCardData {
  readonly conceptId: ConceptId;
  readonly studentTitle: string;
  readonly status: "demonstrated" | "retained";
  readonly pastDate: string;
  readonly pastCorrect: number;
  readonly pastTotal: number;
  readonly pastAttemptIds: readonly string[];
  readonly presentCorrect: number;
  readonly presentTotal: number;
  readonly presentAttemptIds: readonly string[];
  readonly retentionAttemptId?: string;
  readonly achievedAt: string;
  readonly demonstratedAt: string | null;
  readonly retainedAt: string | null;
  readonly spansMultipleDays: boolean;
  readonly messageKey: "comeback.singleDay" | "comeback.multiDay" | "comeback.retention";
  readonly copyParams: {
    readonly pastDate: string;
    readonly pastCorrect: number;
    readonly pastTotal: number;
    readonly studentTitle: string;
    readonly presentCorrect: number;
    readonly presentTotal: number;
  };
}

/**
 * Build a Comeback Card per SPEC §19.7 when a concept becomes demonstrated or retained
 * at least 24 hours after firstNeedsSupportAt.
 * Uses authoritative transition evidence from replayTransitions / beliefReducer.
 * Copy templates live in apps/web/messages/en.json.
 */
export function buildComebackCard(input: {
  readonly conceptId: ConceptId;
  readonly studentTitle: string;
  readonly status: BeliefStatus;
  readonly firstNeedsSupportAt: string | null;
  readonly achievedAt: string;
  readonly demonstratedAt?: string | null;
  readonly retainedAt?: string | null;
  readonly history: readonly CheckedAttempt[];
  readonly templatesForConcept?: number;
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

  const evidenceUpToAchieved = input.history.filter(
    (a) => a.conceptId === input.conceptId && Date.parse(a.at) <= achievedMs,
  );

  const transitions = replayTransitions(input.conceptId, evidenceUpToAchieved, {
    templatesForConcept: input.templatesForConcept ?? 2,
  });

  const demo = transitions.retentionTransition?.demonstration ?? transitions.currentDemonstration;
  if (!demo || demo.supportingAttemptIds.length < 3) {
    return null;
  }

  let retentionAttemptId: string | undefined;
  if (input.status === "retained") {
    retentionAttemptId = transitions.retentionTransition?.retentionAttemptId;
    if (!retentionAttemptId) {
      const reviewAttempt = evidenceUpToAchieved
        .filter((a) => a.assistance === 0 && a.isReview && a.outcome === "correct")
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
      if (reviewAttempt) {
        retentionAttemptId = reviewAttempt.attemptId;
      }
    }
  }

  const presentAttemptIds = demo.supportingAttemptIds;
  const presentCorrect = presentAttemptIds.length;
  const presentTotal = demo.totalAttemptIds.length;

  const supportingAttempts = evidenceUpToAchieved.filter((a) =>
    presentAttemptIds.includes(a.attemptId),
  );
  const presentDates = new Set(supportingAttempts.map((a) => toIstDateString(a.at)));
  const demoDate = toIstDateString(demo.demonstratedAt);
  const spansMultipleDays = presentDates.size > 1 || !presentDates.has(demoDate);

  const messageKey: ComebackCardData["messageKey"] =
    input.status === "retained"
      ? "comeback.retention"
      : spansMultipleDays
        ? "comeback.multiDay"
        : "comeback.singleDay";

  const copyParams = {
    pastDate,
    pastCorrect,
    pastTotal,
    studentTitle: input.studentTitle,
    presentCorrect,
    presentTotal,
  };

  const cardData: ComebackCardData = {
    conceptId: input.conceptId,
    studentTitle: input.studentTitle,
    status: input.status,
    pastDate,
    pastCorrect,
    pastTotal,
    pastAttemptIds,
    presentCorrect,
    presentTotal,
    presentAttemptIds,
    ...(retentionAttemptId ? { retentionAttemptId } : {}),
    achievedAt: input.achievedAt,
    demonstratedAt: input.demonstratedAt ?? demo.demonstratedAt,
    retainedAt:
      input.retainedAt ??
      (input.status === "retained"
        ? (transitions.retentionTransition?.retainedAt ?? input.achievedAt)
        : null),
    spansMultipleDays,
    messageKey,
    copyParams,
  };

  return cardData;
}
