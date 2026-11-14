import type { GenerateRequest, GenerateResult, LLMProvider, ModerationResult } from "../types";

export type MockFaultMode =
  | "timeout"
  | "error"
  | "refused"
  | "invalid_json"
  | "moderation_flagged"
  | "leaks_answer"
  | "too_long"
  | "off_topic";

export interface MockProviderOptions {
  readonly fault?: MockFaultMode;
  readonly defaultResponse?: unknown;
}

export class MockProvider implements LLMProvider {
  readonly name = "mock" as const;
  public readonly recordedCalls: GenerateRequest<unknown>[] = [];
  public readonly recordedModerations: string[] = [];

  constructor(private readonly options: MockProviderOptions = {}) {}

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    this.recordedCalls.push(req as GenerateRequest<unknown>);

    const fault = this.options.fault;
    if (fault === "timeout") {
      return { ok: false, reason: "timeout" };
    }
    if (fault === "error") {
      return { ok: false, reason: "error" };
    }
    if (fault === "refused") {
      return { ok: false, reason: "refused" };
    }
    if (fault === "invalid_json") {
      return { ok: false, reason: "invalid_output" };
    }

    if (fault === "leaks_answer") {
      const payload: unknown = {
        explanation: "The correct answer to your question is 3/4. Just write 3/4.",
        message: "The answer is 3/4.",
        exampleUsed: "roti",
        stepType: "hint",
        actionType: "hint",
      };
      const parsed = req.schema.safeParse(payload);
      if (parsed.success) {
        return { ok: true, value: parsed.data, usage: { inTok: 40, outTok: 20 } };
      }
      return { ok: true, value: payload as T, usage: { inTok: 40, outTok: 20 } };
    }

    if (fault === "too_long") {
      const longText = Array.from({ length: 150 }, (_, i) => `word${i}`).join(" ");
      const payload: unknown = {
        explanation: longText,
        message: longText,
        exampleUsed: "laddoo",
        stepType: "hint",
        actionType: "explain",
      };
      const parsed = req.schema.safeParse(payload);
      if (parsed.success) {
        return { ok: true, value: parsed.data, usage: { inTok: 50, outTok: 150 } };
      }
    }

    if (fault === "off_topic") {
      const payload: unknown = {
        explanation: "",
        message: "Let's stay focused on our maths problem.",
        exampleUsed: "",
        stepType: "redirect",
        actionType: "off_topic",
      };
      const parsed = req.schema.safeParse(payload);
      if (parsed.success) {
        return { ok: true, value: parsed.data, usage: { inTok: 30, outTok: 10 } };
      }
    }

    if (this.options.defaultResponse !== undefined) {
      const parsed = req.schema.safeParse(this.options.defaultResponse);
      if (parsed.success) {
        return { ok: true, value: parsed.data, usage: { inTok: 35, outTok: 25 } };
      }
    }

    // Default mock response based on purpose
    let candidate: unknown;
    if (req.purpose === "explain") {
      candidate = {
        explanation: "Think of a fraction as sharing a roti into equal pieces.",
        exampleUsed: "roti",
      };
    } else if (req.purpose === "solve_parse") {
      candidate = {
        isMath: true,
        inScope: true,
        problemType: "arithmetic",
        restated: "Find the sum of 1/4 and 2/4.",
        expression: "1/4 + 2/4",
        conceptGuess: "MATH-FRAC-ADDLIKE",
      };
    } else if (req.purpose === "solve_step") {
      candidate = {
        message: "Look at the denominators first. Are they the same?",
        stepType: "hint",
      };
    } else {
      // tutor
      candidate = {
        message:
          "Remember that the bottom number (denominator) tells us how many equal parts make the whole.",
        actionType: "hint",
        suggestedVisual: "fraction_bar",
      };
    }

    const parsed = req.schema.safeParse(candidate);
    if (parsed.success) {
      return { ok: true, value: parsed.data, usage: { inTok: 45, outTok: 28 } };
    }

    return { ok: false, reason: "invalid_output" };
  }

  async moderate(text: string): Promise<ModerationResult> {
    this.recordedModerations.push(text);
    if (this.options.fault === "moderation_flagged") {
      return { ok: true, flagged: true, categories: ["violence"] };
    }
    return { ok: true, flagged: false, categories: [] };
  }
}
