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
 * Returns pure structured data citing the stored evidence that established demonstration (okL4).
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

  const indEvidence = input.history
    .filter(
      (a) =>
        a.conceptId === input.conceptId &&
        a.assistance === 0 &&
        (a.outcome === "correct" || a.outcome === "incorrect") &&
        Date.parse(a.at) <= achievedMs,
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  let retentionAttemptId: string | undefined;

  if (input.status === "retained") {
    const reviewAttempt = indEvidence
      .filter((a) => a.isReview && a.outcome === "correct")
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    if (reviewAttempt) {
      retentionAttemptId = reviewAttempt.attemptId;
    }
  }

  const demoCandidates = indEvidence.filter((a) => {
    if (input.demonstratedAt) {
      return Date.parse(a.at) <= Date.parse(input.demonstratedAt);
    }
    if (input.status === "retained" && retentionAttemptId) {
      return a.attemptId !== retentionAttemptId && Date.parse(a.at) < Date.parse(input.achievedAt);
    }
    return Date.parse(a.at) <= achievedMs;
  });

  // Find the earliest qualifying window of 4 attempts that established demonstration
  let originalDemoL4: readonly CheckedAttempt[] | null = null;
  let originalDemoOkL4: readonly CheckedAttempt[] | null = null;

  for (let i = 3; i < demoCandidates.length; i++) {
    const window = demoCandidates.slice(i - 3, i + 1);
    const ok = window.filter((a) => a.outcome === "correct");
    const distinctTemplates = new Set(ok.map((a) => a.templateId)).size;
    if (ok.length >= 3 && distinctTemplates >= 2) {
      originalDemoL4 = window;
      originalDemoOkL4 = ok;
      break;
    }
  }

  const l4 = originalDemoL4 ?? demoCandidates.slice(-4);
  const okL4 = originalDemoOkL4 ?? l4.filter((a) => a.outcome === "correct");
  if (okL4.length < 3) {
    return null;
  }

  const presentAttemptIds = okL4.map((a) => a.attemptId);
  const presentCorrect = presentAttemptIds.length;
  const presentTotal = l4.length;

  const presentDates = new Set(okL4.map((a) => toIstDateString(a.at)));
  const demoEstablishedAt = l4[l4.length - 1]?.at ?? input.achievedAt;
  const demoDate = toIstDateString(demoEstablishedAt);
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
    demonstratedAt: input.demonstratedAt ?? demoEstablishedAt,
    retainedAt: input.retainedAt ?? (input.status === "retained" ? input.achievedAt : null),
    spansMultipleDays,
    messageKey,
    copyParams,
  };

  return cardData;
}
