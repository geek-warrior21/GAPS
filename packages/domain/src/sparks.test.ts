import { describe, expect, it } from "vitest";
import {
  DAILY_SPARKS_CAP,
  SPARK_AMOUNTS,
  SPARK_MILESTONES,
  computeSparksAward,
  computeWeeklyRhythm,
  getNewlyUnlockedMilestones,
  istWeekDates,
  sparkIdempotencyKey,
  toIstDateString,
} from "./sparks";

describe("sparks and weekly rhythm", () => {
  it("calculates exact award amounts and idempotency keys per SPEC §19.7", () => {
    expect(SPARK_MILESTONES).toEqual([100, 250, 500, 1000, 2000]);
    expect(SPARK_AMOUNTS.demonstrated).toBe(30);
    expect(SPARK_AMOUNTS.retained).toBe(50);

    const ind = computeSparksAward({
      kind: "correct",
      sourceId: "att_01J00000000000000000000001",
      assistance: 0,
      currentDailyTotal: 0,
      currentLifetimeTotal: 90,
    });
    expect(ind.awarded).toBe(10);
    expect(ind.key).toBe(sparkIdempotencyKey("att_01J00000000000000000000001", "correct"));
    expect(ind.milestonesUnlocked).toEqual([100]);

    const assisted = computeSparksAward({
      kind: "correct",
      sourceId: "att_01J00000000000000000000002",
      assistance: 2,
      currentDailyTotal: 0,
      currentLifetimeTotal: 0,
    });
    expect(assisted.awarded).toBe(5);

    expect(
      computeSparksAward({
        kind: "demonstrated",
        sourceId: "evt_01J00000000000000000000001",
        currentDailyTotal: 0,
        currentLifetimeTotal: 0,
      }).awarded,
    ).toBe(30);

    expect(
      computeSparksAward({
        kind: "quest",
        sourceId: "qst_01J00000000000000000000002",
        currentDailyTotal: 0,
        currentLifetimeTotal: 0,
      }).awarded,
    ).toBe(20);

    expect(
      computeSparksAward({
        kind: "boss_finish",
        sourceId: "bos_01J00000000000000000000002",
        currentDailyTotal: 0,
        currentLifetimeTotal: 0,
      }).awarded,
    ).toBe(10);
  });

  it("enforces idempotency, daily cap of 300, and non-negative awards", () => {
    const existing = new Set([sparkIdempotencyKey("qst_01J00000000000000000000001", "quest")]);
    const dup = computeSparksAward({
      kind: "quest",
      sourceId: "qst_01J00000000000000000000001",
      currentDailyTotal: 50,
      currentLifetimeTotal: 50,
      existingKeys: existing,
    });
    expect(dup.duplicate).toBe(true);
    expect(dup.awarded).toBe(0);

    const nearCap = computeSparksAward({
      kind: "boss_win",
      sourceId: "bos_01J00000000000000000000001",
      currentDailyTotal: 280,
      currentLifetimeTotal: 490,
    });
    expect(nearCap.awarded).toBe(20);
    expect(nearCap.capped).toBe(true);
    expect(nearCap.newDailyTotal).toBe(DAILY_SPARKS_CAP);
    expect(nearCap.milestonesUnlocked).toEqual([500]);

    const atCap = computeSparksAward({
      kind: "retained",
      sourceId: "evt_01J00000000000000000000002",
      currentDailyTotal: 300,
      currentLifetimeTotal: 510,
    });
    expect(atCap.awarded).toBe(0);
    expect(atCap.capped).toBe(true);
  });

  it("detects crossing multiple milestones on one award", () => {
    expect(getNewlyUnlockedMilestones(95, 260)).toEqual([100, 250]);
  });

  it("converts UTC timestamps to IST date boundaries (UTC+05:30) and builds Mon-Sun weekly rhythm", () => {
    // 2026-11-12T18:29:59Z -> 2026-11-12 23:59:59 IST
    expect(toIstDateString("2026-11-12T18:29:59.000Z")).toBe("2026-11-12");
    // 2026-11-12T18:30:00Z -> 2026-11-13 00:00:00 IST
    expect(toIstDateString("2026-11-12T18:30:00.000Z")).toBe("2026-11-13");

    // 2026-11-12 is a Thursday in IST -> Mon 2026-11-09 .. Sun 2026-11-15
    const week = istWeekDates("2026-11-12T10:00:00.000Z");
    expect(week).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);

    const rhythm = computeWeeklyRhythm(
      [
        "2026-11-08T10:00:00.000Z", // previous Sunday IST -> ignored after Monday reset
        "2026-11-09T09:00:00.000Z", // Monday IST
        "2026-11-11T19:00:00.000Z", // Thursday 00:30 IST (2026-11-12)
      ],
      "2026-11-12T10:00:00.000Z",
    );
    expect(rhythm.dots).toEqual([true, false, false, true, false, false, false]);
  });
});
