import { describe, expect, it } from "vitest";
import { MISCONCEPTION_CATALOG, getMisconceptionMeta, matchMisconception } from "./misconceptions";
import { rational } from "./rational";
import { MISCONCEPTION_IDS } from "./types";

describe("misconceptions", () => {
  it("catalogues all 15 spec misconceptions", () => {
    expect(Object.keys(MISCONCEPTION_CATALOG)).toHaveLength(15);
    for (const id of MISCONCEPTION_IDS) {
      const entry = getMisconceptionMeta(id);
      expect(entry.id).toBe(id);
      expect(entry.concepts.length).toBeGreaterThan(0);
    }
  });

  it("matches a unique rational misconception value", () => {
    const matched = matchMisconception(rational(2n, 5n), rational(5n, 6n), {
      "MC-ADD-ACROSS": rational(2n, 5n),
      "MC-ADD-DENOMS-LIKE": rational(5n, 14n),
    });
    expect(matched).toBe("MC-ADD-ACROSS");
  });

  it("returns undefined when two misconceptions predict the same wrong value", () => {
    const matched = matchMisconception(">", "<", {
      "MC-NUMERATOR-ONLY": ">",
      "MC-BIGGER-DENOM": ">",
    });
    expect(matched).toBeUndefined();
  });

  it("returns undefined when no misconception matches or when misconception equals correct answer", () => {
    expect(
      matchMisconception(rational(3n, 4n), rational(3n, 4n), {
        "MC-EQUIV-ADDITIVE": rational(3n, 4n),
      }),
    ).toBeUndefined();
    expect(
      matchMisconception(rational(9n, 10n), rational(5n, 6n), {
        "MC-ADD-ACROSS": rational(2n, 5n),
      }),
    ).toBeUndefined();
  });

  it("supports comparison and integer/bigint misconception values", () => {
    expect(
      matchMisconception("<", ">", {
        "MC-BIGGER-DENOM": "<",
      }),
    ).toBe("MC-BIGGER-DENOM");

    expect(
      matchMisconception(rational(5n, 1n), rational(4n, 1n), {
        "MC-EQUIV-ADDITIVE": 5n,
      }),
    ).toBe("MC-EQUIV-ADDITIVE");
  });
});
