import type { AssistanceLevel } from "./types";

export const DAILY_SPARKS_CAP = 300;
export const SPARK_MILESTONES = [100, 250, 500, 1000, 2000] as const;

export const SPARK_AMOUNTS = {
  independentCorrect: 10,
  assistedCorrect: 5,
  demonstrated: 30,
  retained: 50,
  quest: 20,
  boss_finish: 10,
  boss_win: 40,
} as const;

export type SparkKind =
  "correct" | "demonstrated" | "retained" | "quest" | "boss_finish" | "boss_win";

export interface SparkAwardInput {
  readonly kind: SparkKind;
  readonly sourceId: string;
  readonly assistance?: AssistanceLevel;
  readonly currentDailyTotal: number;
  readonly currentLifetimeTotal: number;
  readonly existingKeys?: ReadonlySet<string>;
}

export interface SparkAwardResult {
  readonly key: string;
  readonly baseAmount: number;
  readonly awarded: number;
  readonly capped: boolean;
  readonly duplicate: boolean;
  readonly newDailyTotal: number;
  readonly newLifetimeTotal: number;
  readonly milestonesUnlocked: readonly number[];
}

export function sparkIdempotencyKey(sourceId: string, kind: SparkKind): string {
  return `${sourceId}:${kind}`;
}

export function getNewlyUnlockedMilestones(
  previousTotal: number,
  nextTotal: number,
): readonly number[] {
  return SPARK_MILESTONES.filter((m) => previousTotal < m && nextTotal >= m);
}

/**
 * Compute Sparks awarded for an event per SPEC §19.7.
 * Enforces idempotency on (sourceId, kind) and daily cap of 300 Sparks.
 */
export function computeSparksAward(input: SparkAwardInput): SparkAwardResult {
  const key = sparkIdempotencyKey(input.sourceId, input.kind);
  if (input.existingKeys?.has(key)) {
    return {
      key,
      baseAmount: 0,
      awarded: 0,
      capped: false,
      duplicate: true,
      newDailyTotal: input.currentDailyTotal,
      newLifetimeTotal: input.currentLifetimeTotal,
      milestonesUnlocked: [],
    };
  }

  let baseAmount: number;
  switch (input.kind) {
    case "correct":
      baseAmount =
        (input.assistance ?? 0) === 0
          ? SPARK_AMOUNTS.independentCorrect
          : SPARK_AMOUNTS.assistedCorrect;
      break;
    case "demonstrated":
      baseAmount = SPARK_AMOUNTS.demonstrated;
      break;
    case "retained":
      baseAmount = SPARK_AMOUNTS.retained;
      break;
    case "quest":
      baseAmount = SPARK_AMOUNTS.quest;
      break;
    case "boss_finish":
      baseAmount = SPARK_AMOUNTS.boss_finish;
      break;
    case "boss_win":
      baseAmount = SPARK_AMOUNTS.boss_win;
      break;
  }

  const remainingCap = Math.max(0, DAILY_SPARKS_CAP - input.currentDailyTotal);
  const awarded = Math.min(baseAmount, remainingCap);
  const newDailyTotal = input.currentDailyTotal + awarded;
  const newLifetimeTotal = input.currentLifetimeTotal + awarded;

  return {
    key,
    baseAmount,
    awarded,
    capped: awarded < baseAmount,
    duplicate: false,
    newDailyTotal,
    newLifetimeTotal,
    milestonesUnlocked: getNewlyUnlockedMilestones(input.currentLifetimeTotal, newLifetimeTotal),
  };
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatUtcDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convert an ISO UTC timestamp into an Asia/Kolkata (UTC+05:30) YYYY-MM-DD date string. */
export function toIstDateString(isoUtc: string): string {
  const ms = Date.parse(isoUtc);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid ISO timestamp: ${isoUtc}`);
  }
  return formatUtcDate(ms + IST_OFFSET_MS);
}

/** Return the 7 Monday..Sunday IST YYYY-MM-DD date strings for the week containing isoUtc. */
export function istWeekDates(isoUtc: string): readonly string[] {
  const ms = Date.parse(isoUtc);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid ISO timestamp: ${isoUtc}`);
  }
  const istShifted = new Date(ms + IST_OFFSET_MS);
  const utcDay = istShifted.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const offsetFromMonday = (utcDay + 6) % 7;
  const midnightIstAsUtcMs =
    Date.UTC(istShifted.getUTCFullYear(), istShifted.getUTCMonth(), istShifted.getUTCDate()) -
    offsetFromMonday * DAY_MS;

  return Array.from({ length: 7 }, (_, i) => formatUtcDate(midnightIstAsUtcMs + i * DAY_MS));
}

export interface WeeklyRhythm {
  readonly weekDates: readonly string[];
  readonly dots: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
}

/**
 * Compute Monday-Sunday (IST) weekly rhythm dots per SPEC §19.7.
 * Resets quietly each Monday; never tracks streak losses.
 */
export function computeWeeklyRhythm(
  completedItemTimestamps: readonly string[],
  nowIsoUtc: string,
): WeeklyRhythm {
  const weekDates = istWeekDates(nowIsoUtc);
  const activeDates = new Set(completedItemTimestamps.map((ts) => toIstDateString(ts)));
  const dots = weekDates.map((date) => activeDates.has(date)) as unknown as WeeklyRhythm["dots"];
  return { weekDates, dots };
}
