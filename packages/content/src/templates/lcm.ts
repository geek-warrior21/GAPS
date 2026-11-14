import { type RichText, type Rng, lcm } from "@gaps/domain";
import type { Template } from "../types";

export interface LcmParams {
  readonly x: number;
  readonly y: number;
}

export const lcmSmallPairTemplate: Template<LcmParams> = {
  id: "MATH-NUM-LCM/small-pair",
  version: 1,
  conceptId: "MATH-NUM-LCM",
  difficulty: 1,
  review: { status: "draft" },
  generate(rng: Rng): LcmParams | null {
    const x = rng.int(2, 10);
    let y = rng.int(3, 12);
    while (y === x) y = rng.int(3, 12);
    const L = Number(lcm(BigInt(x), BigInt(y)));
    if (L > 60) return null;
    return { x: Math.min(x, y), y: Math.max(x, y) };
  },
  prompt(p: LcmParams): RichText {
    return [{ t: "text", v: `What is the least common multiple (LCM) of ${p.x} and ${p.y}?` }];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: LcmParams) {
    const L = lcm(BigInt(p.x), BigInt(p.y));
    return { kind: "integer", value: L };
  },
  hints(p: LcmParams) {
    return [
      [{ t: "text", v: `List multiples of ${p.x}: count by ${p.x}.` }],
      [{ t: "text", v: `List multiples of ${p.y}: count by ${p.y}.` }],
      [{ t: "text", v: "Find the smallest non-zero number on both lists." }],
    ];
  },
  workedExample(_rng: Rng, _p: LcmParams) {
    const exX = 4;
    const exY = 6;
    return {
      steps: [
        [{ t: "text", v: `Multiples of ${exX}: 4, 8, 12, 16, 20.` }],
        [{ t: "text", v: `Multiples of ${exY}: 6, 12, 18, 24.` }],
      ],
      result: [{ t: "text", v: "The smallest common multiple is 12." }],
    };
  },
};

export const lcmCompositeTemplate: Template<LcmParams> = {
  id: "MATH-NUM-LCM/composite-pair",
  version: 1,
  conceptId: "MATH-NUM-LCM",
  difficulty: 2,
  review: { status: "draft" },
  generate(rng: Rng): LcmParams | null {
    const x = rng.pick([4, 6, 8, 9, 10, 12, 14, 15, 16, 18]);
    let y = rng.pick([6, 8, 9, 10, 12, 14, 15, 16, 18, 20]);
    while (y === x) y = rng.pick([6, 8, 9, 10, 12, 14, 15, 16, 18, 20]);
    const L = Number(lcm(BigInt(x), BigInt(y)));
    if (L > 80) return null;
    return { x: Math.min(x, y), y: Math.max(x, y) };
  },
  prompt(p: LcmParams): RichText {
    return [{ t: "text", v: `Find the least common multiple of ${p.x} and ${p.y}.` }];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: LcmParams) {
    const L = lcm(BigInt(p.x), BigInt(p.y));
    return { kind: "integer", value: L };
  },
  hints(p: LcmParams) {
    return [
      [{ t: "text", v: `Take the prime factorizations of ${p.x} and ${p.y}.` }],
      [{ t: "text", v: "Take the highest power of each prime factor." }],
      [{ t: "text", v: "Multiply these highest powers to get the LCM." }],
    ];
  },
  workedExample(_rng: Rng, _p: LcmParams) {
    return {
      steps: [
        [{ t: "text", v: `Prime factors: 8 = 2³; 12 = 2² × 3.` }],
        [{ t: "text", v: `LCM = 2³ × 3 = 8 × 3 = 24.` }],
      ],
      result: [{ t: "text", v: "LCM = 24." }],
    };
  },
};

export const lcmWordTemplate: Template<LcmParams> = {
  id: "MATH-NUM-LCM/bell-intervals",
  version: 1,
  conceptId: "MATH-NUM-LCM",
  difficulty: 3,
  review: { status: "draft" },
  generate(rng: Rng): LcmParams | null {
    const x = rng.pick([4, 5, 6, 8, 10, 12, 15, 16, 20]);
    let y = rng.pick([6, 8, 10, 12, 15, 18, 20, 24, 30]);
    while (y === x) y = rng.pick([6, 8, 10, 12, 15, 18, 20, 24, 30]);
    const L = Number(lcm(BigInt(x), BigInt(y)));
    if (L > 90) return null;
    return { x: Math.min(x, y), y: Math.max(x, y) };
  },
  prompt(p: LcmParams): RichText {
    return [
      {
        t: "text",
        v: `Two school bells toll at intervals of ${p.x} minutes and ${p.y} minutes. If they toll together now, after how many minutes will they next toll together?`,
      },
    ];
  },
  input() {
    return { kind: "number" };
  },
  answer(p: LcmParams) {
    const L = lcm(BigInt(p.x), BigInt(p.y));
    return { kind: "integer", value: L };
  },
  hints(p: LcmParams) {
    return [
      [{ t: "text", v: "The next simultaneous toll happens at the least common multiple." }],
      [{ t: "text", v: `Find LCM(${p.x}, ${p.y}).` }],
      [{ t: "text", v: "Calculate the smallest positive multiple shared by both numbers." }],
    ];
  },
  workedExample(_rng: Rng, _p: LcmParams) {
    return {
      steps: [
        [{ t: "text", v: `Find LCM(15, 20). Multiples of 15: 15, 30, 45, 60.` }],
        [{ t: "text", v: `Multiples of 20: 20, 40, 60.` }],
      ],
      result: [{ t: "text", v: "They toll together again after 60 minutes." }],
    };
  },
};

export const lcmTemplates = [lcmSmallPairTemplate, lcmCompositeTemplate, lcmWordTemplate] as const;
