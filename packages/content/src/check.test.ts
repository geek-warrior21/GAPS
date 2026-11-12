import { describe, expect, it } from "vitest";
import { CONTENT_SCAFFOLD_PHASE } from "./index";

describe("@gaps/content phase 0 scaffold", () => {
  it("exports the Phase 0 scaffold marker", () => {
    expect(CONTENT_SCAFFOLD_PHASE).toBe(0);
  });
});
