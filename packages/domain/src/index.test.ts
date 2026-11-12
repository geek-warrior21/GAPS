import { describe, expect, it } from "vitest";
import {
  DOMAIN_PHASE,
  POLICY_VERSION,
  VERIFIER_VERSION,
  beliefReducer,
  buildComebackCard,
  composeDailyQuest,
  decideNextAction,
  focusConcept,
  rational,
  verify,
} from "./index";

describe("@gaps/domain exports", () => {
  it("exports frozen spec version identifiers and core domain entrypoints", () => {
    expect(POLICY_VERSION).toBe("rules-1.0");
    expect(VERIFIER_VERSION).toBe("verify-1.0");
    expect(DOMAIN_PHASE).toBe(1);
    expect(typeof rational).toBe("function");
    expect(typeof verify).toBe("function");
    expect(typeof beliefReducer).toBe("function");
    expect(typeof focusConcept).toBe("function");
    expect(typeof composeDailyQuest).toBe("function");
    expect(typeof decideNextAction).toBe("function");
    expect(typeof buildComebackCard).toBe("function");
  });
});
