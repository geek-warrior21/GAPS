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

/*
 * Deterministic stand-ins for open-topic lesson generation. They exist so the
 * plumbing can be tested without a provider. The text says it is mock content:
 * it is not teaching material and is never evidence that a real model works.
 */

const MOCK_NOTE = "Mock provider content for testing. Not real teaching material.";

function mockCheck(n: number, probe: boolean): unknown {
  return {
    action: "independent_check",
    activity: {
      id: "x",
      type: "independent_check",
      title: probe ? `Mock probe ${n}` : `Mock question ${n}`,
      instructions: "Choose one answer.",
      config: {
        type: "independent_check",
        prompt: `${probe ? "Mock probe" : "Mock question"} ${n}: which option is marked as the key?`,
        questionType: "choice",
        choices: probe
          ? [
              { id: "a", text: `Key option ${n}` },
              { id: "b", text: `Other option ${n}` },
            ]
          : [
              { id: "a", text: `Key option ${n}` },
              { id: "b", text: `Other option ${n}` },
              { id: "c", text: `Third option ${n}` },
            ],
        correctAnswer: "a",
        explanation: `Option a is the key for mock item ${n}. ${MOCK_NOTE}`,
      },
    },
    suspectedMisconceptions: { b: "Mock suspected misconception" },
    rationale: "Mock: next question.",
  };
}

function mockIntro(action: string, n: number, topic: string): unknown {
  return {
    action,
    activity: {
      id: "x",
      type: "intro",
      title: `Mock explanation ${n}`,
      instructions: "Read this card.",
      config: {
        type: "intro",
        headline: `About ${topic}`,
        body: `${MOCK_NOTE} Step ${n} about ${topic}.`,
      },
    },
    idealInteraction: "A hands-on model that this player does not have",
    rationale: "Mock: explanation card.",
  };
}

function mockPredict(action: string, n: number, topic: string): unknown {
  return {
    action,
    activity: {
      id: "x",
      type: "predict_and_observe",
      title: `Mock prediction ${n}`,
      instructions: "Pick what you expect, then read what happens.",
      config: {
        type: "predict_and_observe",
        prompt: `Mock prediction ${n} about ${topic}: which outcome is expected?`,
        predictionChoices: [
          { id: "p1", text: "The expected outcome", isExpected: true },
          { id: "p2", text: "A different outcome" },
        ],
        observationReveal: {
          expectedObservation: "The expected outcome happens.",
          explanation: MOCK_NOTE,
        },
      },
    },
    rationale: "Mock: prediction.",
  };
}

function mockLessonOpening(input: string): unknown {
  const topic = (/wants to learn about: "([^"]*)"/.exec(input)?.[1] ?? "topic").trim();
  const clarified = input.includes("The learner has clarified");
  const lower = topic.toLowerCase();
  // "cells" is genuinely ambiguous at school level: living cells or electric cells.
  if (lower === "cells" && !clarified) {
    return {
      kind: "clarify",
      question: "Which kind of cells do you mean?",
      options: ["Cells in living things", "Electric cells (batteries)"],
    };
  }
  if (/\b(cricket|movie|game|song)\b/.test(lower)) {
    return { kind: "out_of_scope", reason: "Not a school maths or science topic." };
  }
  const title = topic.charAt(0).toUpperCase() + topic.slice(1);
  return {
    kind: "plan",
    title,
    subject: /number|integer|fraction|algebra|geometry|\d/.test(lower) ? "maths" : "science",
    learningGoal: `Understand the main idea of ${topic} (mock learning goal).`,
    proposedPrerequisites: ["Mock proposed prerequisite"],
    suspectedMisconceptions: ["Mock suspected misconception"],
    opening: [
      mockIntro("explain", 1, topic),
      mockPredict("explore", 2, topic),
      mockCheck(3, false),
    ],
  };
}

function mockLessonStep(input: string): unknown {
  const topic = (/Lesson topic: "([^"]*)"/.exec(input)?.[1] ?? "topic").trim();
  const eligible = (/ELIGIBLE_ACTIONS: (.*)/.exec(input)?.[1] ?? "")
    .split(",")
    .map((a) => a.trim());
  const recommended = (/RECOMMENDED_ACTION: (\S+)/.exec(input)?.[1] ?? "").trim();
  const n = (input.match(/^\d+\. \[/gm) ?? []).length + 1;
  const probe = input.includes("DIAGNOSTIC PROBE");
  // Guided practice needs a simulation the mock never has: use a supported alternative.
  const action =
    recommended === "guided_practice"
      ? eligible.includes("independent_check")
        ? "independent_check"
        : (eligible[0] ?? "explain")
      : recommended;
  if (action === "independent_check") return mockCheck(n, probe);
  if (action === "explore") return mockPredict("explore", n, topic);
  return mockIntro(action, n, topic);
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
    if (req.purpose === "lesson_open") {
      candidate = mockLessonOpening(req.input);
    } else if (req.purpose === "lesson_step") {
      candidate = mockLessonStep(req.input);
    } else if (req.purpose === "explain") {
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
