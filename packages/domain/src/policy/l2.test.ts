import { describe, expect, it } from "vitest";
import { createRng } from "../rng";
import type { BeliefStatus, ConceptId } from "../types";
import {
  canStartBossToday,
  canUnlockChapterBoss,
  composeBossBattle,
  composeDailyQuest,
  evaluateBossBattle,
  planLearnSessionOpen,
  selectTemplate,
  targetDifficulty,
} from "./l2";

describe("L2 session composition", () => {
  it("plans at most one due review first on another concept in a learn session", () => {
    const plan = planLearnSessionOpen("MATH-FRAC-EQUIV", [
      { conceptId: "MATH-FRAC-EQUIV", dueAt: "2026-11-12T08:00:00.000Z" },
      { conceptId: "MATH-FRAC-PART", dueAt: "2026-11-12T09:00:00.000Z" },
    ]);
    expect(plan).toEqual({
      budgetSeconds: 900,
      firstAction: "RETRIEVAL_REVIEW",
      reviewConceptId: "MATH-FRAC-PART",
    });

    expect(planLearnSessionOpen("MATH-FRAC-EQUIV", [])).toEqual({
      budgetSeconds: 900,
      firstAction: "LEARN_FOCUS",
      reviewConceptId: null,
    });
  });

  it("computes target difficulty and prefers unused templates", () => {
    expect(targetDifficulty("not_assessed", 0)).toBe(1);
    expect(targetDifficulty("needs_support", 2)).toBe(1);
    expect(targetDifficulty("developing", 0)).toBe(2);
    expect(targetDifficulty("developing", 1)).toBe(2);
    expect(targetDifficulty("developing", 2)).toBe(3);

    const picked = selectTemplate(
      [
        { id: "T1", difficulty: 2, reviewed: true },
        { id: "T2", difficulty: 2, reviewed: true },
        { id: "T3", difficulty: 2, reviewed: false },
      ],
      ["T1"],
      2,
      createRng(42),
      true,
    );
    expect(picked?.id).toBe("T2");

    // Nearest difficulty fallback & empty reviewed pool
    expect(
      selectTemplate([{ id: "T1", difficulty: 1, reviewed: false }], [], 2, createRng(1)),
    ).toBeNull();
    expect(
      selectTemplate(
        [
          { id: "T1", difficulty: 1, reviewed: true },
          { id: "T2", difficulty: 3, reviewed: true },
        ],
        ["T1"],
        2,
        createRng(1),
      )?.id,
    ).toBe("T2");
  });

  it("draws fresh deterministic seeds while excluding seeds seen in the last 7 days", async () => {
    const { drawFreshSeed } = await import("./l2");
    const rngA = createRng(100);
    const first = drawFreshSeed("T1", new Set(), (s) => ({ s }), rngA);
    expect(first).not.toBeNull();

    const seen = new Set([`T1#${first?.seed ?? 0}`]);
    const second = drawFreshSeed(
      "T1",
      seen,
      (s) => (s === first?.seed ? null : { s }),
      createRng(100),
    );
    expect(second).not.toBeNull();
    expect(second?.seed).not.toBe(first?.seed);

    const exhausted = drawFreshSeed("T1", new Set(), () => null, createRng(100), 3);
    expect(exhausted).toBeNull();
  });

  it("composes cold-start Daily Quest with 3 grade-entry items", () => {
    const quest = composeDailyQuest({
      studentId: "stu_01J00000000000000000000001",
      istDate: "2026-11-12",
      grade: 7,
      startConceptId: null,
      beliefs: {},
      dueReviewConceptIds: [],
    });
    expect(quest.slots).toHaveLength(3);
    expect(quest.slots.every((s) => s.conceptId === "MATH-FRAC-EQUIV" && s.kind === "focus")).toBe(
      true,
    );
  });

  it("composes deterministic 4-5 slot Daily Quests with due reviews, focus, and stretch", () => {
    const beliefs: Partial<Record<ConceptId, { status: BeliefStatus }>> = {
      "MATH-FRAC-PART": { status: "demonstrated" },
      "MATH-FRAC-NUMLINE": { status: "developing" },
      "MATH-NUM-HCF": { status: "not_assessed" },
      "MATH-FRAC-EQUIV": { status: "developing" },
    };

    const qNoReview = composeDailyQuest({
      studentId: "stu_01J",
      istDate: "2026-11-12",
      grade: 7,
      startConceptId: null,
      beliefs,
      dueReviewConceptIds: [],
    });
    expect(qNoReview.slots.map((s) => s.kind)).toEqual(["focus", "focus", "focus", "stretch"]);
    expect(qNoReview.slots[3]?.conceptId).toBe("MATH-FRAC-COMPARE");

    const qTwoReviews = composeDailyQuest({
      studentId: "stu_01J",
      istDate: "2026-11-12",
      grade: 7,
      startConceptId: null,
      beliefs,
      dueReviewConceptIds: ["MATH-FRAC-PART", "MATH-FRAC-NUMLINE", "MATH-NUM-HCF"],
    });
    expect(qTwoReviews.slots.map((s) => s.kind)).toEqual([
      "review",
      "review",
      "focus",
      "focus",
      "stretch",
    ]);
    expect(qTwoReviews).toEqual(
      composeDailyQuest({
        studentId: "stu_01J",
        istDate: "2026-11-12",
        grade: 7,
        startConceptId: null,
        beliefs,
        dueReviewConceptIds: ["MATH-FRAC-PART", "MATH-FRAC-NUMLINE", "MATH-NUM-HCF"],
      }),
    );
  });

  it("handles Boss Battle unlock (>= ceil(n/2)), 8-item weighted spread, daily gate, and >= 6/8 win", () => {
    // Chapter B has 5 concepts -> needs 3 developing+ to unlock
    expect(
      canUnlockChapterBoss("B", {
        "MATH-NUM-LCM": { status: "developing" },
        "MATH-FRAC-ADDLIKE": { status: "demonstrated" },
      }),
    ).toBe(false);

    const beliefsB: Partial<Record<ConceptId, { status: BeliefStatus }>> = {
      "MATH-NUM-LCM": { status: "developing" },
      "MATH-FRAC-ADDLIKE": { status: "demonstrated" },
      "MATH-FRAC-ADDUNLIKE": { status: "developing" },
    };
    expect(canUnlockChapterBoss("B", beliefsB)).toBe(true);

    const battle = composeBossBattle({
      studentId: "stu_01J",
      istDate: "2026-11-12",
      chapter: "B",
      beliefs: beliefsB,
    });
    expect(battle.items).toHaveLength(8);
    expect(battle.items.every((i) => i.difficulty === 2 && !i.helpAllowed)).toBe(true);
    const devCount = battle.items.filter(
      (i) => i.conceptId === "MATH-NUM-LCM" || i.conceptId === "MATH-FRAC-ADDUNLIKE",
    ).length;
    expect(devCount).toBeGreaterThanOrEqual(4);

    expect(canStartBossToday(null, "2026-11-12")).toBe(true);
    expect(canStartBossToday("2026-11-12", "2026-11-12")).toBe(false);
    expect(canStartBossToday("2026-11-11", "2026-11-12")).toBe(true);

    expect(
      evaluateBossBattle(Array(6).fill("correct").concat(["incorrect", "incorrect"])).defeated,
    ).toBe(true);
    expect(
      evaluateBossBattle(Array(5).fill("correct").concat(["incorrect", "incorrect", "incorrect"]))
        .defeated,
    ).toBe(false);
  });
});
