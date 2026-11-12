import { describe, expect, it } from "vitest";
import { createRng, hashStringToSeed } from "./rng";

describe("rng", () => {
  it("produces identical sequences for identical seeds", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("bounds next() to [0, 1) and int(min, max) inclusively", () => {
    const rng = createRng(999);
    for (let i = 0; i < 200; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it("rejects inverted bounds in int()", () => {
    const rng = createRng(42);
    expect(() => rng.int(5, 3)).toThrow();
  });

  it("picks items and shuffles deterministically without mutating input", () => {
    const items = ["a", "b", "c", "d", "e"] as const;
    const rng1 = createRng(77);
    const rng2 = createRng(77);
    expect(rng1.pick(items)).toBe(rng2.pick(items));
    expect(rng1.shuffle(items)).toEqual(rng2.shuffle(items));
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("throws when picking from an empty list", () => {
    const rng = createRng(1);
    expect(() => rng.pick([])).toThrow();
  });

  it("hashes strings to deterministic 32-bit unsigned seeds", () => {
    const s1 = hashStringToSeed("stu_123:2026-11-12");
    const s2 = hashStringToSeed("stu_123:2026-11-12");
    const s3 = hashStringToSeed("stu_123:2026-11-13");
    expect(s1).toBe(s2);
    expect(s1).not.toBe(s3);
    expect(s1).toBeGreaterThanOrEqual(0);
    expect(s1).toBeLessThan(2 ** 32);
  });
});
