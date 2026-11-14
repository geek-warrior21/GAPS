import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  CONCEPTS,
  EDGES,
  MISCONCEPTIONS,
  EXPLANATIONS,
  TEMPLATES,
  TEMPLATES_BY_CONCEPT,
} from "./index";

describe("@gaps/content curriculum & templates", () => {
  it("defines all 3 chapters", () => {
    expect(CHAPTERS).toHaveLength(3);
    expect(CHAPTERS.map((c) => c.id)).toEqual(["A", "B", "C"]);
  });

  it("defines all 14 concepts", () => {
    expect(CONCEPTS).toHaveLength(14);
  });

  it("defines all 18 prerequisite edges", () => {
    expect(EDGES).toHaveLength(18);
  });

  it("defines all 15 catalogued misconceptions", () => {
    expect(MISCONCEPTIONS).toHaveLength(15);
  });

  it("defines explanations for all 14 concepts with 3 routes each", () => {
    const list = Object.values(EXPLANATIONS);
    expect(list).toHaveLength(14);
    for (const exp of list) {
      expect(exp.picture.length).toBeGreaterThan(0);
      expect(exp.everyday.length).toBeGreaterThan(0);
      expect(exp.steps.length).toBeGreaterThan(0);
    }
  });

  it("defines 42 templates with exactly 3 per concept", () => {
    expect(TEMPLATES).toHaveLength(42);
    for (const concept of CONCEPTS) {
      const templates = TEMPLATES_BY_CONCEPT[concept.id];
      expect(templates, `Expected templates for ${concept.id}`).toBeDefined();
      expect(templates).toHaveLength(3);
    }
  });
});
