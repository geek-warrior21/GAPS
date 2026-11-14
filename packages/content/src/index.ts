export * from "./types";
export * from "./chapters";
export * from "./concepts";
export * from "./edges";
export * from "./misconceptions";
export * from "./explanations";
export * from "./templates";

import { createRng } from "@gaps/domain";
import type { Template } from "./types";

export interface GeneratedItem<P = unknown> {
  readonly templateId: string;
  readonly conceptId: string;
  readonly difficulty: 1 | 2 | 3;
  readonly seed: number;
  readonly params: P;
  readonly prompt: ReturnType<Template<P>["prompt"]>;
  readonly input: ReturnType<Template<P>["input"]>;
  readonly answer: ReturnType<Template<P>["answer"]>;
  readonly misconceptions: ReturnType<NonNullable<Template<P>["misconceptions"]>>;
  readonly hints: ReturnType<Template<P>["hints"]>;
  readonly workedExample: ReturnType<Template<P>["workedExample"]>;
  readonly visual?: ReturnType<NonNullable<Template<P>["visual"]>>;
}

export function generateItem<P>(
  template: Template<P>,
  seed: number,
  maxAttempts = 50,
): GeneratedItem<P> {
  const rng = createRng(seed);
  let p: P | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    p = template.generate(rng);
    if (p !== null) break;
  }
  if (p === null) {
    throw new Error(
      `Template ${template.id} failed to generate valid params after ${maxAttempts} attempts with seed ${seed}`,
    );
  }

  const exampleRng = createRng(seed ^ 0x9e3779b9);

  return {
    templateId: template.id,
    conceptId: template.conceptId,
    difficulty: template.difficulty,
    seed,
    params: p,
    prompt: template.prompt(p),
    input: template.input(p),
    answer: template.answer(p),
    misconceptions: template.misconceptions ? template.misconceptions(p) : {},
    hints: template.hints(p),
    workedExample: template.workedExample(exampleRng, p),
    visual: template.visual ? template.visual(p) : undefined,
  };
}
