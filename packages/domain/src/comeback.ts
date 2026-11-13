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
  readonly message: string;
}

export const COMEBACK_COPY_TEMPLATES = {
  singleDay:
    "On {pastDate} you got {pastCorrect} of {pastTotal} {studentTitle} questions. Today you answered {presentCorrect} correctly on your own. That's a comeback!",
  multiDay:
    "On {pastDate} you got {pastCorrect} of {pastTotal} {studentTitle} questions. You answered {presentCorrect} correctly on your own. That's a comeback!",
  retention:
    "On {pastDate} you got {pastCorrect} of {pastTotal} {studentTitle} questions. You locked this in with a successful review. That's a comeback!",
} as const;

export function formatComebackMessage(card: ComebackCardData, template?: string): string {
  const chosenTemplate =
    template ??
    (card.messageKey === "comeback.retention"
      ? COMEBACK_COPY_TEMPLATES.retention
      : card.messageKey === "comeback.multiDay"
        ? COMEBACK_COPY_TEMPLATES.multiDay
        : COMEBACK_COPY_TEMPLATES.singleDay);

  return chosenTemplate
    .replace("{pastDate}", card.copyParams.pastDate)
    .replace("{pastCorrect}", String(card.copyParams.pastCorrect))
    .replace("{pastTotal}", String(card.copyParams.pastTotal))
    .replace("{studentTitle}", card.copyParams.studentTitle)
    .replace("{presentCorrect}", String(card.copyParams.presentCorrect));
}

/**
 * Build a Comeback Card per SPEC §19.7 when a concept becomes demonstrated or retained
 * at least 24 hours after firstNeedsSupportAt.
 * Cites the stored evidence that established demonstration (okL4) and keeps copy in messages/en.json.
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

  const indEvidence = input.history.filter(
    (a) =>
      a.conceptId === input.conceptId &&
      a.assistance === 0 &&
      (a.outcome === "correct" || a.outcome === "incorrect") &&
      Date.parse(a.at) <= achievedMs,
  );

  let demoCutoffMs = achievedMs;
  let retentionAttemptId: string | undefined;

  if (input.status === "retained") {
    const reviewAttempt = indEvidence
      .filter((a) => a.isReview && a.outcome === "correct")
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    if (reviewAttempt) {
      retentionAttemptId = reviewAttempt.attemptId;
    }
    if (input.demonstratedAt) {
      demoCutoffMs = Date.parse(input.demonstratedAt);
    } else if (reviewAttempt) {
      demoCutoffMs = Date.parse(reviewAttempt.at) - 1;
    }
  }

  const demoInd = indEvidence.filter((a) => Date.parse(a.at) <= demoCutoffMs);
  const l4 = demoInd.slice(-4);
  const okL4 = l4.filter((a) => a.outcome === "correct");
  if (okL4.length < 3) {
    return null;
  }

  const presentAttemptIds = okL4.map((a) => a.attemptId);
  const presentCorrect = presentAttemptIds.length;
  const presentTotal = l4.length;

  const presentDates = new Set(okL4.map((a) => toIstDateString(a.at)));
  const achievedDate = toIstDateString(input.achievedAt);
  const spansMultipleDays = presentDates.size > 1 || !presentDates.has(achievedDate);

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
    demonstratedAt:
      input.demonstratedAt ?? (input.status === "demonstrated" ? input.achievedAt : null),
    retainedAt: input.retainedAt ?? (input.status === "retained" ? input.achievedAt : null),
    spansMultipleDays,
    messageKey,
    copyParams,
    message: "",
  };

  return {
    ...cardData,
    message: formatComebackMessage(cardData),
  };
}
