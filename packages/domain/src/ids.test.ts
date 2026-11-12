import { describe, expect, it } from "vitest";
import { ID_PREFIXES, isValidPrefixedId, makeId, makeUlid } from "./ids";
import { createRng } from "./rng";

describe("ids", () => {
  it("supports all 12 spec prefixes", () => {
    expect(Object.keys(ID_PREFIXES)).toHaveLength(12);
    expect(Object.values(ID_PREFIXES)).toEqual([
      "usr_",
      "stu_",
      "coh_",
      "ses_",
      "att_",
      "evt_",
      "dec_",
      "itm_",
      "qst_",
      "bos_",
      "slv_",
      "flg_",
    ]);
  });

  it("generates deterministic 26-char Crockford Base32 ULIDs", () => {
    const ts = Date.UTC(2026, 10, 12, 9, 30, 0);
    const u1 = makeUlid(ts, createRng(100));
    const u2 = makeUlid(ts, createRng(100));
    expect(u1).toBe(u2);
    expect(u1).toHaveLength(26);
    expect(u1).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("encodes timestamps lexicographically in order", () => {
    const t1 = makeUlid(1_700_000_000_000, createRng(1));
    const t2 = makeUlid(1_700_000_100_000, createRng(1));
    expect(t1.slice(0, 10) < t2.slice(0, 10)).toBe(true);
  });

  it("formats and validates prefixed IDs", () => {
    const id = makeId("student", Date.UTC(2026, 0, 1), createRng(55));
    expect(id.startsWith("stu_")).toBe(true);
    expect(isValidPrefixedId(id)).toBe(true);
    expect(isValidPrefixedId(id, "student")).toBe(true);
    expect(isValidPrefixedId(id, "attempt")).toBe(false);
    expect(isValidPrefixedId("stu_INVALIDILOU0000000000000")).toBe(false);
    expect(isValidPrefixedId("bad_01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(false);
  });

  it("rejects negative or non-integer timestamps", () => {
    expect(() => makeUlid(-1, createRng(1))).toThrow();
    expect(() => makeUlid(1.5, createRng(1))).toThrow();
  });
});
