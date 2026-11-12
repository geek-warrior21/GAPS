import { describe, expect, it } from "vitest";
import { DOMAIN_SCAFFOLD_PHASE, POLICY_VERSION, VERIFIER_VERSION } from "./index";

describe("@gaps/domain phase 0 scaffold", () => {
  it("exports frozen spec version identifiers", () => {
    expect(POLICY_VERSION).toBe("rules-1.0");
    expect(VERIFIER_VERSION).toBe("verify-1.0");
    expect(DOMAIN_SCAFFOLD_PHASE).toBe(0);
  });
});
