import { describe, expect, it } from "vitest";
import {
  beliefReducer,
  computeEffectiveReliability,
  createInitialBeliefState,
  replayBeliefs,
  toPublicBelief,
} from "./belief";
import type { AttemptOutcome, CheckedAttempt, ConceptId, MisconceptionId } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_MS = Date.UTC(2026, 10, 1, 10, 0, 0);

function makeAttempt(seq: number, overrides: Partial<CheckedAttempt> = {}): CheckedAttempt {
  const hourOffset = seq * 60 * 60 * 1000;
  return {
    attemptId: `att_01J000000000000000000000${String(seq).padStart(2, "0")}`,
    studentId: "stu_01J00000000000000000000001",
    sessionId: "ses_01J00000000000000000000001",
    clientAttemptId: `11111111-1111-4111-8111-0000000000${String(seq).padStart(2, "0")}`,
    itemInstanceId: `itm_01J000000000000000000000${String(seq).padStart(2, "0")}`,
    templateId: seq % 2 === 1 ? "MATH-FRAC-EQUIV/t1" : "MATH-FRAC-EQUIV/t2",
    conceptId: "MATH-FRAC-EQUIV",
    mode: "learn",
    outcome: "correct",
    assistance: 0,
    tryNo: 1,
    isReview: false,
    verifierVersion: "verify-1.0",
    at: new Date(BASE_MS + hourOffset).toISOString(),
    ...overrides,
  };
}

function isoPlus(hours: number): string {
  return new Date(BASE_MS + hours * 60 * 60 * 1000).toISOString();
}

describe("beliefReducer", () => {
  const concept: ConceptId = "MATH-FRAC-EQUIV";
  const ctx = { templatesForConcept: 3 };

  it("ignores unparseable and not_simplified submissions", () => {
    const init = createInitialBeliefState(concept);
    const s1 = beliefReducer(init, makeAttempt(1, { outcome: "unparseable" }), ctx);
    const s2 = beliefReducer(init, makeAttempt(2, { outcome: "not_simplified" }), ctx);
    expect(s1).toEqual(init);
    expect(s2).toEqual(init);
  });

  it("transitions from not_assessed -> developing -> demonstrated with review schedules", () => {
    let b = createInitialBeliefState(concept);
    b = beliefReducer(b, makeAttempt(1, { outcome: "correct" }), ctx);
    expect(b.status).toBe("developing");
    expect(b.estimate).toBeNull();

    b = beliefReducer(b, makeAttempt(2, { outcome: "correct" }), ctx);
    expect(b.status).toBe("developing");
    expect(b.estimate).toBeCloseTo((2 + 1) / (2 + 2));

    b = beliefReducer(b, makeAttempt(3, { outcome: "correct" }), ctx);
    expect(b.status).toBe("demonstrated");
    expect(b.demonstratedAt).toBe(isoPlus(3));
    expect(b.reliability).toBe("supported");
    expect(b.lastEffects).toEqual([
      {
        type: "schedule_review",
        kind: "warmup",
        conceptId: concept,
        dueAt: new Date(BASE_MS + 3 * 3600_000 + 2 * DAY_MS).toISOString(),
      },
      {
        type: "schedule_review",
        kind: "retention",
        conceptId: concept,
        dueAt: new Date(BASE_MS + 3 * 3600_000 + 7 * DAY_MS).toISOString(),
      },
    ]);
  });

  it("requires distinct templates when templatesForConcept >= 2 and distinct items >= 3", () => {
    let b = createInitialBeliefState(concept);
    b = beliefReducer(b, makeAttempt(1, { templateId: "T1" }), ctx);
    b = beliefReducer(b, makeAttempt(2, { templateId: "T1" }), ctx);
    b = beliefReducer(b, makeAttempt(3, { templateId: "T1" }), ctx);
    expect(b.status).toBe("developing");

    b = beliefReducer(b, makeAttempt(4, { templateId: "T2" }), ctx);
    expect(b.status).toBe("demonstrated");

    // Same itemInstanceId reused does not count as 3 distinct items
    let bSameItem = createInitialBeliefState("MATH-NUM-HCF");
    for (let i = 1; i <= 3; i++) {
      bSameItem = beliefReducer(
        bSameItem,
        makeAttempt(i, {
          conceptId: "MATH-NUM-HCF",
          itemInstanceId: "itm_same",
          templateId: i % 2 === 0 ? "T1" : "T2",
        }),
        { templatesForConcept: 1 },
      );
    }
    expect(bSameItem.status).toBe("developing");
  });

  it("requires 3 of last 4 AND latest 2 independent correct to demonstrate", () => {
    // Pattern C, C, I, C -> L4 has 3 corrects, but L2 is [I, C], so NOT demonstrated yet
    const pattern: readonly AttemptOutcome[] = ["correct", "correct", "incorrect", "correct"];
    let b = createInitialBeliefState(concept);
    pattern.forEach((outcome, idx) => {
      b = beliefReducer(b, makeAttempt(idx + 1, { outcome }), ctx);
    });
    expect(b.status).toBe("developing");

    // One more correct -> L4=[C, I, C, C] (3 of 4) and L2=[C, C] -> demonstrated
    b = beliefReducer(b, makeAttempt(5, { outcome: "correct" }), ctx);
    expect(b.status).toBe("demonstrated");
  });

  it("transitions to needs_support on two independent misses or repeated misconception", () => {
    let b = createInitialBeliefState(concept);
    b = beliefReducer(b, makeAttempt(1, { outcome: "incorrect" }), ctx);
    expect(b.status).toBe("developing");
    b = beliefReducer(b, makeAttempt(2, { outcome: "incorrect" }), ctx);
    expect(b.status).toBe("needs_support");
    expect(b.firstNeedsSupportAt).toBe(isoPlus(2));

    // Repeated MC across last 4 checked attempts even when interspersed with assisted attempts
    let bMc = createInitialBeliefState(concept);
    const mc: MisconceptionId = "MC-EQUIV-ADDITIVE";
    bMc = beliefReducer(
      bMc,
      makeAttempt(1, { outcome: "incorrect", misconceptionId: mc, assistance: 0 }),
      ctx,
    );
    bMc = beliefReducer(bMc, makeAttempt(2, { outcome: "correct", assistance: 1 }), ctx);
    bMc = beliefReducer(
      bMc,
      makeAttempt(3, { outcome: "incorrect", misconceptionId: mc, assistance: 1 }),
      ctx,
    );
    expect(bMc.status).toBe("needs_support");
    expect(bMc.activeMisconceptionIds).toEqual([mc]);
  });

  it("never promotes mastery from assisted attempts (invariant I2)", () => {
    let b = createInitialBeliefState(concept);
    // 2 independent corrects + 1 assisted miss + 3 assisted corrects -> never demonstrated
    b = beliefReducer(b, makeAttempt(1, { assistance: 0, outcome: "correct" }), ctx);
    b = beliefReducer(b, makeAttempt(2, { assistance: 0, outcome: "correct" }), ctx);
    for (let i = 3; i <= 8; i++) {
      b = beliefReducer(b, makeAttempt(i, { assistance: 1, outcome: "correct" }), ctx);
    }
    expect(b.status).toBe("developing");

    // 3rd independent correct promotes to demonstrated
    b = beliefReducer(b, makeAttempt(9, { assistance: 0, outcome: "correct" }), ctx);
    expect(b.status).toBe("demonstrated");

    // Assisted review after 7 days NEVER promotes to retained
    const after8Days = new Date(BASE_MS + 9 * 3600_000 + 8 * DAY_MS).toISOString();
    const stillDemo = beliefReducer(
      b,
      makeAttempt(10, { assistance: 1, outcome: "correct", isReview: true, at: after8Days }),
      ctx,
    );
    expect(stillDemo.status).toBe("demonstrated");
    expect(stillDemo.retainedAt).toBeNull();
  });

  it("enforces exact 6d23h (no) vs 7d (yes) retention boundary", () => {
    let b = createInitialBeliefState(concept);
    b = beliefReducer(b, makeAttempt(1), ctx);
    b = beliefReducer(b, makeAttempt(2), ctx);
    b = beliefReducer(b, makeAttempt(3), ctx);
    const demoMs = Date.parse(b.demonstratedAt ?? "");

    const at6d23h = new Date(demoMs + 6 * DAY_MS + 23 * 3600_000).toISOString();
    const warmup = beliefReducer(
      b,
      makeAttempt(4, { isReview: true, outcome: "correct", at: at6d23h }),
      ctx,
    );
    expect(warmup.status).toBe("demonstrated");
    expect(warmup.retainedAt).toBeNull();

    const at7dExact = new Date(demoMs + 7 * DAY_MS).toISOString();
    const retained = beliefReducer(
      warmup,
      makeAttempt(5, { isReview: true, outcome: "correct", at: at7dExact }),
      ctx,
    );
    expect(retained.status).toBe("retained");
    expect(retained.retainedAt).toBe(at7dExact);
  });

  it("handles failed review (conflicting +1d retry) and demotion on two independent misses", () => {
    let b = createInitialBeliefState(concept);
    b = beliefReducer(b, makeAttempt(1), ctx);
    b = beliefReducer(b, makeAttempt(2), ctx);
    b = beliefReducer(b, makeAttempt(3), ctx);

    const demoMs = Date.parse(b.demonstratedAt ?? "");
    const failedReviewAt = new Date(demoMs + 7 * DAY_MS).toISOString();
    const afterOneMiss = beliefReducer(
      b,
      makeAttempt(4, { isReview: true, outcome: "incorrect", at: failedReviewAt }),
      ctx,
    );
    expect(afterOneMiss.status).toBe("demonstrated");
    expect(afterOneMiss.reliability).toBe("conflicting");
    expect(afterOneMiss.lastEffects).toEqual([
      {
        type: "schedule_review",
        kind: "retry",
        conceptId: concept,
        dueAt: new Date(demoMs + 8 * DAY_MS).toISOString(),
      },
    ]);

    const secondMissAt = new Date(demoMs + 8 * DAY_MS).toISOString();
    const demoted = beliefReducer(
      afterOneMiss,
      makeAttempt(5, { isReview: true, outcome: "incorrect", at: secondMissAt }),
      ctx,
    );
    expect(demoted.status).toBe("needs_support");
    expect(demoted.demonstratedAt).toBeNull();
    expect(demoted.retainedAt).toBeNull();
    expect(demoted.lastEffects).toEqual([{ type: "cancel_reviews", conceptId: concept }]);
  });

  it("demotes from retained to needs_support on two independent misses", () => {
    let b = createInitialBeliefState(concept);
    b = beliefReducer(b, makeAttempt(1), ctx);
    b = beliefReducer(b, makeAttempt(2), ctx);
    b = beliefReducer(b, makeAttempt(3), ctx);
    const demoMs = Date.parse(b.demonstratedAt ?? "");
    b = beliefReducer(
      b,
      makeAttempt(4, {
        isReview: true,
        outcome: "correct",
        at: new Date(demoMs + 7 * DAY_MS).toISOString(),
      }),
      ctx,
    );
    expect(b.status).toBe("retained");

    b = beliefReducer(
      b,
      makeAttempt(5, {
        outcome: "incorrect",
        at: new Date(demoMs + 9 * DAY_MS).toISOString(),
      }),
      ctx,
    );
    expect(b.status).toBe("retained");

    b = beliefReducer(
      b,
      makeAttempt(6, {
        outcome: "incorrect",
        at: new Date(demoMs + 10 * DAY_MS).toISOString(),
      }),
      ctx,
    );
    expect(b.status).toBe("needs_support");
    expect(b.demonstratedAt).toBeNull();
    expect(b.retainedAt).toBeNull();
  });

  it("marks alternating C,I,C,I reliability as conflicting and computes stale at read time", () => {
    let b = createInitialBeliefState(concept);
    const outcomes: readonly AttemptOutcome[] = ["correct", "incorrect", "correct", "incorrect"];
    outcomes.forEach((outcome, i) => {
      b = beliefReducer(b, makeAttempt(i + 1, { outcome }), ctx);
    });
    expect(b.reliability).toBe("conflicting");

    const init = createInitialBeliefState(concept);
    expect(computeEffectiveReliability(init, isoPlus(1000))).toBe("missing");

    const day31 = new Date(BASE_MS + 31 * DAY_MS).toISOString();
    expect(computeEffectiveReliability(b, day31)).toBe("stale");
    expect(computeEffectiveReliability(b, isoPlus(5))).toBe("conflicting");
  });

  it("replays attempts deterministically regardless of input order and strips internal history cleanly", () => {
    const attempts = [
      makeAttempt(3, { outcome: "correct" }),
      makeAttempt(1, { outcome: "incorrect", misconceptionId: "MC-EQUIV-ADDITIVE" }),
      makeAttempt(4, { outcome: "correct" }),
      makeAttempt(2, { outcome: "correct" }),
      makeAttempt(5, { outcome: "correct" }),
    ];
    const replayed = replayBeliefs(concept, attempts, ctx);
    const ordered = [...attempts]
      .sort((a, b) => a.at.localeCompare(b.at))
      .reduce((acc, att) => beliefReducer(acc, att, ctx), createInitialBeliefState(concept));

    expect(toPublicBelief(replayed)).toEqual(toPublicBelief(ordered));
    expect(replayed.status).toBe("demonstrated");
    expect("history" in toPublicBelief(replayed)).toBe(false);
  });
});
