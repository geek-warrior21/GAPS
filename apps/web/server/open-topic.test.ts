import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getDb,
  users,
  cohorts,
  consentRecords,
  featureFlags,
  attempts,
  conceptBeliefs,
  sparksLedger,
  events,
  learningSessions,
  llmCalls,
  hashPin,
  createStudentRepo,
  seedDatabase,
  syncContent,
  and,
  eq,
} from "@gaps/db";
import {
  MockProvider,
  type GenerateRequest,
  type GenerateResult,
  type MockFaultMode,
} from "@gaps/ai";
import type { LessonActivity, LessonRespondResponse } from "@gaps/contracts";
import { format } from "@gaps/domain";
import { startOrResumeLessonSession, submitLessonActivityResponse } from "./lesson/service";
import { checkStudentAiPermission, countModelCallsToday, createModelCaller } from "./ai/gateway";
import { createAuthSession } from "./auth/session";
import {
  ArithmeticError,
  evaluateArithmetic,
  numericAnswersEqual,
  parseNumericAnswer,
} from "./open-topic/arithmetic";
import { OpenTopicEngine, type TextGenerator } from "./open-topic/engine";
import { type OpenTopicDeps, createOpenLesson } from "./open-topic/session";
import { MAX_OPEN_TOPIC_STEPS, type OpenTopicState } from "./open-topic/machine";
import {
  allowedSimulations,
  findAuthoredLesson,
  findSources,
  sanitizeTopic,
} from "./open-topic/topics";
import { validateGeneratedStep } from "./open-topic/validation";
import { POST as openLessonsHandler } from "@/app/api/v1/open-lessons/route";
import * as devOpenTopic from "@/app/api/v1/dev/open-topic/route";
import * as devStart from "@/app/api/v1/dev/open-topic/[lessonId]/start/route";
import * as devRespond from "@/app/api/v1/dev/open-topic/[lessonId]/respond/route";
import * as devAutoplay from "@/app/api/v1/dev/open-topic/[lessonId]/autoplay/route";
import * as devTrace from "@/app/api/v1/dev/open-topic/[lessonId]/trace/route";
import { SYNTHETIC_LEARNER_ID, getProviderReadiness } from "./open-topic/dev-preview";

// ---------------------------------------------------------------------------
// Scripted generators. These are test doubles: nothing here demonstrates that a
// real model can teach. Live generation is verified separately (see the handoff).
// ---------------------------------------------------------------------------

type Handler = (req: GenerateRequest<unknown>) => unknown | { fail: "timeout" | "error" };

class ScriptedGenerator implements TextGenerator {
  readonly providerName = "scripted-test-double";
  readonly model = "none";
  readonly calls: GenerateRequest<unknown>[] = [];
  private readonly fallback = new MockProvider();

  constructor(private handler?: Handler) {}

  setHandler(handler: Handler | undefined) {
    this.handler = handler;
  }

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    this.calls.push(req as GenerateRequest<unknown>);
    const scripted = this.handler?.(req as GenerateRequest<unknown>);
    if (scripted === undefined) return this.fallback.generate(req);
    if (typeof scripted === "object" && scripted !== null && "fail" in scripted) {
      return { ok: false, reason: (scripted as { fail: "timeout" | "error" }).fail };
    }
    const parsed = req.schema.safeParse(scripted);
    return parsed.success
      ? { ok: true, value: parsed.data, usage: { inTok: 1, outTok: 1 } }
      : { ok: false, reason: "invalid_output" };
  }
}

const depsFor = (generator: TextGenerator): OpenTopicDeps => ({
  resolveEngine: async () => ({ engine: new OpenTopicEngine(generator, 1000) }),
});

const intro = (action = "explain", body = "Plants make their own food using light.") => ({
  action,
  activity: {
    id: "x",
    type: "intro",
    title: "How plants make food",
    instructions: "Read this card.",
    config: { type: "intro", headline: "Food from light", body },
  },
  rationale: "Start with the core idea.",
});

const choiceCheck = (prompt: string, extra: Record<string, unknown> = {}) => ({
  action: "independent_check",
  activity: {
    id: "x",
    type: "independent_check",
    title: "Check",
    instructions: "Choose one answer.",
    config: {
      type: "independent_check",
      prompt,
      questionType: "choice",
      choices: [
        { id: "a", text: "Sunlight, water and carbon dioxide" },
        { id: "b", text: "Soil only" },
        { id: "c", text: "Oxygen and sugar" },
      ],
      correctAnswer: "a",
      explanation: "Plants use sunlight, water and carbon dioxide to make food.",
    },
  },
  suspectedMisconceptions: { b: "Thinks plants eat soil" },
  rationale: "See what the learner already knows.",
  ...extra,
});

const numberCheck = (prompt: string, correctAnswer: string, expression?: string) => ({
  action: "independent_check",
  activity: {
    id: "x",
    type: "independent_check",
    title: "Work it out",
    instructions: "Type a number.",
    config: {
      type: "independent_check",
      prompt,
      questionType: "number",
      correctAnswer,
      explanation: `The answer is ${correctAnswer}.`,
    },
  },
  ...(expression ? { answerCheck: { expression } } : {}),
  rationale: "Numeric practice.",
});

const baseCtx = {
  eligibleActions: ["independent_check", "guided_practice", "explore"] as const,
  allowedSimulations: [] as string[],
  suppliedSourceIds: [] as string[],
};

describe("Exact arithmetic for generated answer keys", () => {
  it("evaluates signed integer, decimal and bracketed expressions exactly", () => {
    const cases: Array<[string, string]> = [
      ["-3 + 5", "2"],
      ["(2 - 7) * 3", "-15"],
      ["-4 - -6", "2"],
      ["7 ÷ 2", "7/2"],
      ["0.1 + 0.2", "3/10"],
      ["−8 × −2", "16"],
      ["-(3 + 4) / 14", "-1/2"],
    ];
    for (const [expression, expected] of cases) {
      expect(format(evaluateArithmetic(expression)), expression).toBe(expected);
    }
  });

  it("refuses anything that is not plain arithmetic", () => {
    for (const bad of [
      "",
      "2 +",
      "1/0",
      "2 ** 3",
      "process.exit()",
      "x + 1",
      "(1 + 2",
      "1e9",
      "a".repeat(100),
    ]) {
      expect(() => evaluateArithmetic(bad), bad).toThrow(ArithmeticError);
    }
  });

  it("compares learner answers as exact numbers, not strings", () => {
    expect(numericAnswersEqual("-3", "−3")).toBe(true);
    expect(numericAnswersEqual("0.5", "1/2")).toBe(true);
    expect(numericAnswersEqual("+4", "4")).toBe(true);
    expect(numericAnswersEqual("3", "-3")).toBe(false);
    expect(parseNumericAnswer("three")).toBeNull();
    expect(parseNumericAnswer("2+2")).toBeNull();
  });
});

describe("Topic resolution without per-topic code", () => {
  it("routes to an authored lesson only when the request is exactly that topic", () => {
    expect(findAuthoredLesson("fractions")?.lessonId).toBe("lesson-maths-frac-part-adaptive");
    expect(findAuthoredLesson("I want to learn parts of a whole fractions")?.lessonId).toBe(
      "lesson-maths-frac-part-adaptive",
    );
    expect(findAuthoredLesson("simple electric circuits")?.lessonId).toBe(
      "lesson-sci-circuits-adaptive",
    );
    // A neighbouring topic is never silently substituted.
    for (const other of [
      "equivalent fractions",
      "adding fractions",
      "series and parallel circuits",
      "photosynthesis",
      "states of matter",
      "negative numbers",
      "current affairs",
    ]) {
      expect(findAuthoredLesson(other), other).toBeUndefined();
    }
  });

  it("finds approved sources only when they cover the topic, and reports them as unreviewed", () => {
    const conductors = findSources("conductors and insulators");
    expect(conductors.references).toEqual([
      expect.objectContaining({ id: "source-pack:SCI-ELEC-CONDUCTORS", reviewStatus: "draft" }),
    ]);
    for (const topic of ["photosynthesis", "states of matter", "negative numbers"]) {
      expect(findSources(topic).references, topic).toEqual([]);
      expect(allowedSimulations(topic), topic).toEqual([]);
    }
    expect(allowedSimulations("equivalent fractions")).toEqual(["fraction_strip"]);
  });

  it("removes contact details from the topic text", () => {
    const cleaned = sanitizeTopic("photosynthesis  my email is kid@example.com call 9876543210");
    expect(cleaned).not.toContain("kid@example.com");
    expect(cleaned).not.toContain("9876543210");
    expect(cleaned).toContain("photosynthesis");
  });
});

describe("Validation of generated activities", () => {
  it("accepts supported components and labels how the answer key was checked", () => {
    const choice = validateGeneratedStep(choiceCheck("What do plants need to make food?"), baseCtx);
    expect(choice.ok && choice.step.verification).toBe("model_key");

    const verified = validateGeneratedStep(numberCheck("What is -3 + 5?", "2", "-3 + 5"), baseCtx);
    expect(verified.ok && verified.step.verification).toBe("deterministic_answer_key");

    const unverified = validateGeneratedStep(
      numberCheck("How many states of matter?", "3"),
      baseCtx,
    );
    expect(unverified.ok && unverified.step.verification).toBe("model_key");
  });

  const rejects = (
    raw: unknown,
    code: string,
    ctx: Parameters<typeof validateGeneratedStep>[1] = baseCtx,
  ) => {
    const result = validateGeneratedStep(raw, ctx);
    expect(result.ok, code).toBe(false);
    if (!result.ok) expect(result.issues.join(" | ")).toContain(code);
  };

  it("rejects a wrong answer key that the server can recompute", () => {
    rejects(numberCheck("What is -3 + 5?", "8", "-3 + 5"), "ANSWER_KEY_MISMATCH");
    rejects(numberCheck("What is 2 to the power 3?", "8", "2 ** 3"), "ANSWER_CHECK_INVALID");
    rejects(numberCheck("Name the gas plants take in", "carbon dioxide"), "ANSWER_KEY_NOT_NUMERIC");
  });

  it("rejects actions outside the server envelope and actions only the server may take", () => {
    rejects(intro("explain"), "ACTION_OUTSIDE_ENVELOPE");
    for (const action of ["advance", "pause", "revisit_prerequisite"]) {
      rejects({ ...intro(action) }, "ACTION_NOT_GENERATABLE", {
        ...baseCtx,
        eligibleActions: [action as "advance"],
      });
    }
  });

  it("rejects simulations the topic has no tested component for, and guided tasks without one", () => {
    const circuitLab = {
      action: "explore",
      activity: {
        id: "x",
        type: "interactive_manipulation",
        title: "Leaf lab",
        instructions: "Try it.",
        config: {
          type: "interactive_manipulation",
          simulation: { simulationKind: "circuit_loop", instruction: "Flip the switch." },
        },
      },
      rationale: "Hands-on.",
    };
    rejects(circuitLab, "SIMULATION_NOT_AVAILABLE_FOR_TOPIC");
    expect(
      validateGeneratedStep(circuitLab, { ...baseCtx, allowedSimulations: ["circuit_loop"] }).ok,
    ).toBe(true);

    rejects(
      {
        action: "guided_practice",
        activity: {
          id: "x",
          type: "guided_practice",
          title: "Sort the states",
          instructions: "Do it.",
          config: {
            type: "guided_practice",
            prompt: "Sort these into solid, liquid and gas.",
            targetCriteria: { property: "sorted", expectedValue: "yes" },
            successFeedback: "Done.",
            retryFeedback: "Not yet.",
          },
        },
        rationale: "Practice.",
      },
      "GUIDED_PRACTICE_REQUIRES_SUPPORTED_SIMULATION",
    );
  });

  it("rejects invented citations, links, markup, promised interactions and harsh feedback", () => {
    const ctx = { ...baseCtx, eligibleActions: ["explain"] as const };
    rejects(
      intro("explain", "According to the NCERT textbook, plants make food."),
      "CITATION_NOT_ALLOWED",
      ctx,
    );
    rejects(intro("explain", "Read more at https://example.com/leaf"), "CITATION_NOT_ALLOWED", ctx);
    rejects(intro("explain", "Plants make food (Smith et al, 2019)."), "CITATION_NOT_ALLOWED", ctx);
    rejects(
      intro("explain", "<script>alert(1)</script> Plants make food."),
      "MARKUP_NOT_ALLOWED",
      ctx,
    );
    rejects(
      intro("explain", "Drag the slider to watch the animation of a leaf."),
      "CLAIMS_UNAVAILABLE_CAPABILITY",
      ctx,
    );

    const harsh = choiceCheck("What do plants need?");
    harsh.activity.config.explanation = "That is wrong. Plants need light.";
    rejects(harsh, "COPY_TONE");
  });

  it("rejects malformed questions and source ids the server did not supply", () => {
    const badKey = choiceCheck("What do plants need?");
    badKey.activity.config.correctAnswer = "z";
    rejects(badKey, "ANSWER_KEY_NOT_A_CHOICE");

    const duplicate = choiceCheck("What do plants need?");
    duplicate.activity.config.choices[1]!.id = "a";
    rejects(duplicate, "CHOICES_INVALID");

    rejects(
      choiceCheck("What do plants need?", { usedSourceIds: ["https://made-up.example"] }),
      "UNKNOWN_SOURCE_ID",
    );
    rejects({ action: "independent_check", activity: { type: "quiz" } }, "SCHEMA");
  });

  it("never accepts curriculum identifiers from a model", () => {
    const raw = choiceCheck("What do plants need?");
    Object.assign(raw.activity.config, {
      conceptId: "MATH-FRAC-PART",
      templateId: "tpl_adp_frac_part_name",
      itemInstanceId: "itm_adp_frac_part_name_1",
    });
    const result = validateGeneratedStep(raw, baseCtx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const json = JSON.stringify(result.step.activity);
      expect(json).not.toContain("MATH-FRAC-PART");
      expect(json).not.toContain("itm_adp_frac_part_name_1");
    }
  });
});

describe("Open-topic lessons as persisted sessions", () => {
  const db = getDb();
  const orgId = "org_01J00000000000000000000001";
  const demoCohortId = "coh_01J00000000000000000000001";
  const teacherId = "usr_01J00000000000000000000001";
  let n = 0;

  beforeAll(async () => {
    await syncContent(db);
    await seedDatabase(db);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await db
      .update(featureFlags)
      .set({ value: { enabled: false } })
      .where(eq(featureFlags.key, "llm_kill_switch"));
  });

  const createStudent = async (label: string, cohortId = demoCohortId) => {
    n += 1;
    const id = `stu_open_${label}_${Date.now()}_${n}`;
    await db.insert(users).values({
      id,
      role: "student",
      orgId,
      cohortId,
      displayName: `Zzyzx Learner ${label}`,
      username: `open_${label}_${Date.now()}_${n}`,
      pinHash: hashPin("999999"),
      status: "active",
      avatar: { color: "teal", icon: "spark" },
      settings: {},
    });
    return id;
  };

  const lessonState = async (lessonId: string): Promise<OpenTopicState> => {
    const [row] = await db
      .select()
      .from(learningSessions)
      .where(eq(learningSessions.id, lessonId.slice("open-".length)));
    return (row!.counters as { openTopicState: OpenTopicState }).openTopicState;
  };

  const expectNoEvidence = async (studentId: string) => {
    expect(await db.select().from(attempts).where(eq(attempts.studentId, studentId))).toHaveLength(
      0,
    );
    expect(
      await db.select().from(conceptBeliefs).where(eq(conceptBeliefs.studentId, studentId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(sparksLedger).where(eq(sparksLedger.studentId, studentId)),
    ).toHaveLength(0);
  };

  const expectNoAnswerLeak = (payload: unknown) => {
    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/"correctAnswer":"[^"]+"/);
    expect(json).not.toContain("suspectedMisconception");
    expect(json).not.toContain("rationale");
    expect(json).not.toContain("openTopicState");
  };

  /** Drives a lesson with the given answer policy until it stops, and returns the actions taken. */
  const play = async (
    studentId: string,
    lessonId: string,
    deps: OpenTopicDeps,
    pick: (activity: LessonActivity, checkNumber: number) => string,
    maxSteps = 20,
  ) => {
    const { respondToOpenLesson, startOrResumeOpenLesson } = await import("./open-topic/session");
    let session = await startOrResumeOpenLesson(studentId, lessonId, db, deps);
    let active = session.activeActivity;
    let last: LessonRespondResponse | undefined;
    let checks = 0;
    for (let i = 0; i < maxSteps && active; i++) {
      let response: unknown = { acknowledged: true };
      if (active.type === "independent_check") {
        checks += 1;
        response = { answer: pick(active, checks) };
      } else if (active.type === "predict_and_observe") {
        response = { choiceId: "p1" };
      }
      last = await respondToOpenLesson(studentId, lessonId, active.id, response, db, deps);
      expectNoAnswerLeak(last);
      active = last.activeActivity;
    }
    session = await startOrResumeOpenLesson(studentId, lessonId, db, deps).catch(() => session);
    return { last, checks, state: await lessonState(lessonId) };
  };

  const ready = (result: Awaited<ReturnType<typeof createOpenLesson>>) => {
    if (result.status !== "ready") throw new Error(`expected ready, got ${JSON.stringify(result)}`);
    return result;
  };

  for (const [topic, level] of [
    ["photosynthesis", 7],
    ["states of matter", 6],
    ["negative numbers", 6],
  ] as const) {
    it(`"${topic}" starts with no topic-specific code and stays practice-only to the end`, async () => {
      const studentId = await createStudent("any");
      const generator = new ScriptedGenerator();
      const deps = depsFor(generator);

      const created = ready(await createOpenLesson(studentId, { topic, level }, db, deps));
      expect(created.lessonId).toMatch(/^open-ses_/);
      expect(created.contentStatus).toEqual({
        basis: "model_knowledge",
        generatedPreview: true,
        practiceOnly: true,
        sources: [],
      });
      expect(generator.calls).toHaveLength(1); // the whole opening came from one call

      const session = await startOrResumeLessonSession(studentId, created.lessonId, db);
      expectNoAnswerLeak(session);
      expect(session.contentStatus?.basis).toBe("model_knowledge");
      expect(session.lesson.level).toBe(level);
      expect(session.adaptive?.stepNumber).toBe(1);
      expect(session.activeActivity?.type).toBe("intro");

      const { last, checks, state } = await play(studentId, created.lessonId, deps, () => "a");
      // Three unassisted correct practice answers close the round.
      expect(checks).toBe(3);
      expect(last?.isCompleted).toBe(true);
      expect(last?.sparksAwarded).toBe(0);
      expect(state.steps.at(-1)?.role).toBe("closing");
      expect(state.steps.at(-1)?.decision.origin).toBe("server");
      expect(state.steps.every((s) => s.outcome?.countedAsEvidence === false)).toBe(true);

      // Nothing reached the evidence path or the belief reducer.
      await expectNoEvidence(studentId);
      const stepEvents = await db
        .select()
        .from(events)
        .where(and(eq(events.studentId, studentId), eq(events.type, "open_topic_step")));
      expect(stepEvents.length).toBe(state.steps.length);
      expect(
        stepEvents.every((e) => (e.payload as { provisional: boolean }).provisional === true),
      ).toBe(true);

      // Developer trace: the model's proposals are stored as proposals.
      const traces = await createStudentRepo(studentId, db).listDecisionTraces(
        created.lessonId.slice("open-".length),
      );
      // The opening plan and the first step are written in one transaction, so
      // they share a timestamp: find the plan by kind, not by position.
      const results = traces.map((t) => t.result as Record<string, unknown>);
      const plan = results.find((r) => r.kind === "opening_plan")!;
      expect(plan.modelProposedPrerequisites).toEqual(["Mock proposed prerequisite"]);
      expect(plan.contentBasis).toBe("model_knowledge");
      const stepResults = results.filter((r) => r.kind !== "opening_plan");
      expect(stepResults).toHaveLength(traces.length - 1);
      expect(stepResults.every((r) => r.provisional === true)).toBe(true);
      expect(JSON.stringify(traces)).not.toContain("Zzyzx");
    });
  }

  it("a lesson changes direction after a missed answer instead of following the opening plan", async () => {
    const generator = new ScriptedGenerator();
    const deps = depsFor(generator);
    const run = async (pick: (a: LessonActivity, k: number) => string) => {
      const studentId = await createStudent("direction");
      const created = ready(
        await createOpenLesson(studentId, { topic: "photosynthesis", level: 7 }, db, deps),
      );
      const result = await play(studentId, created.lessonId, deps, pick);
      await expectNoEvidence(studentId);
      return result.state.steps.map((s) => `${s.action}:${s.role}`);
    };

    const succeeding = await run(() => "a");
    // Misses the first question, the probe and both supported checks, then recovers.
    const struggling = await run((_, k) => (k <= 4 ? "b" : "a"));

    // Same opening for both learners up to the first question.
    expect(struggling.slice(0, 3)).toEqual(succeeding.slice(0, 3));
    expect(succeeding).toEqual([
      "explain:teach",
      "explore:teach",
      "independent_check:assessment",
      "independent_check:assessment",
      "independent_check:assessment",
      "pause:closing",
    ]);
    // After the miss: a diagnostic probe, then teaching, then a supported check,
    // and after continued difficulty a bounded pause written by the server.
    expect(struggling.slice(3, 5)).toEqual(["independent_check:diagnostic", "explore:teach"]);
    expect(struggling.slice(0, 10)).toEqual([
      "explain:teach",
      "explore:teach",
      "independent_check:assessment",
      "independent_check:diagnostic",
      "explore:teach",
      "independent_check:assessment",
      "explain:teach",
      "independent_check:assessment",
      "pause:pause",
      // The learner chose to continue: a fresh walkthrough, not a repeat.
      "demonstrate:teach",
    ]);
    expect(struggling.at(-1)).toBe("pause:closing");
    expect(struggling).not.toEqual(succeeding);
  });

  it("numeric questions are graded exactly, and a recomputed key is labelled as verified", async () => {
    const studentId = await createStudent("numeric");
    const generator = new ScriptedGenerator((req) =>
      req.purpose === "lesson_open"
        ? {
            kind: "plan",
            title: "Negative numbers",
            subject: "maths",
            learningGoal: "Add a positive number to a negative number.",
            opening: [
              intro("explain", "Numbers below zero are negative."),
              numberCheck("What is -3 + 5?", "2", "-3 + 5"),
            ],
          }
        : numberCheck(
            `What is -${req.input.length % 7} - 4?`,
            String(-(req.input.length % 7) - 4),
            `-${req.input.length % 7} - 4`,
          ),
    );
    const deps = depsFor(generator);
    const created = ready(
      await createOpenLesson(studentId, { topic: "negative numbers", level: 6 }, db, deps),
    );
    const { respondToOpenLesson, startOrResumeOpenLesson } = await import("./open-topic/session");
    const s1 = await startOrResumeOpenLesson(studentId, created.lessonId, db, deps);
    const r1 = await respondToOpenLesson(
      studentId,
      created.lessonId,
      s1.activeActivity!.id,
      {},
      db,
      deps,
    );
    const check = r1.activeActivity!;
    expect(check.config).toMatchObject({
      questionType: "number",
      correctAnswer: "",
      serverGraded: true,
    });

    for (const bad of [{ answer: "two" }, { answer: "" }, { answer: "2; drop table" }]) {
      await expect(
        respondToOpenLesson(studentId, created.lessonId, check.id, bad, db, deps),
      ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_RESPONSE" });
    }
    const r2 = await respondToOpenLesson(
      studentId,
      created.lessonId,
      check.id,
      { answer: " +2.0 " },
      db,
      deps,
    );
    expect(r2.isCorrect).toBe(true);

    const state = await lessonState(created.lessonId);
    expect(state.steps[1]?.verification).toBe("deterministic_answer_key");
    // Even a recomputed key is practice only: no attempt, no belief.
    await expectNoEvidence(studentId);
  });

  it("refresh and retry reuse the stored step without another model call; responses are idempotent", async () => {
    const studentId = await createStudent("refresh");
    const generator = new ScriptedGenerator();
    const deps = depsFor(generator);
    const { respondToOpenLesson, startOrResumeOpenLesson } = await import("./open-topic/session");
    const created = ready(
      await createOpenLesson(studentId, { topic: "states of matter", level: 6 }, db, deps),
    );

    const first = await startOrResumeOpenLesson(studentId, created.lessonId, db, deps);
    const again = await startOrResumeOpenLesson(studentId, created.lessonId, db, deps);
    expect(again).toEqual(first);
    expect(generator.calls).toHaveLength(1);

    const r1 = await respondToOpenLesson(
      studentId,
      created.lessonId,
      first.activeActivity!.id,
      {},
      db,
      deps,
    );
    const r2 = await respondToOpenLesson(
      studentId,
      created.lessonId,
      r1.activeActivity!.id,
      { choiceId: "p1" },
      db,
      deps,
    );
    const check = r2.activeActivity!;
    // The opening queue supplied these steps: still only the one call.
    expect(generator.calls).toHaveLength(1);

    const [a, b] = await Promise.all([
      respondToOpenLesson(studentId, created.lessonId, check.id, { answer: "a" }, db, deps),
      respondToOpenLesson(studentId, created.lessonId, check.id, { answer: "a" }, db, deps),
    ]);
    expect(a.isCorrect).toBe(true);
    expect(b.activeActivity).toEqual(a.activeActivity);
    const retry = await respondToOpenLesson(
      studentId,
      created.lessonId,
      check.id,
      { answer: "b" },
      db,
      deps,
    );
    expect(retry.isCorrect).toBe(true); // the stored result, not a regrade

    const state = await lessonState(created.lessonId);
    expect(state.steps.filter((s) => s.activity.id === check.id)).toHaveLength(1);
    expect(state.steps).toHaveLength(4);
    const stepEvents = await db
      .select()
      .from(events)
      .where(and(eq(events.studentId, studentId), eq(events.type, "open_topic_step")));
    expect(stepEvents).toHaveLength(3);

    await expect(
      respondToOpenLesson(studentId, created.lessonId, "act_never", {}, db, deps),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("a provider failure mid-lesson keeps the answer and offers a retry; it never swaps in another topic", async () => {
    const studentId = await createStudent("outage");
    const generator = new ScriptedGenerator();
    const deps = depsFor(generator);
    const { respondToOpenLesson, startOrResumeOpenLesson } = await import("./open-topic/session");
    const created = ready(
      await createOpenLesson(studentId, { topic: "photosynthesis", level: 7 }, db, deps),
    );
    const s = await startOrResumeOpenLesson(studentId, created.lessonId, db, deps);
    const r1 = await respondToOpenLesson(
      studentId,
      created.lessonId,
      s.activeActivity!.id,
      {},
      db,
      deps,
    );
    const r2 = await respondToOpenLesson(
      studentId,
      created.lessonId,
      r1.activeActivity!.id,
      { choiceId: "p1" },
      db,
      deps,
    );

    // The provider goes down exactly when the next step is needed.
    generator.setHandler(() => ({ fail: "timeout" }));
    const answered = await respondToOpenLesson(
      studentId,
      created.lessonId,
      r2.activeActivity!.id,
      { answer: "a" },
      db,
      deps,
    );
    expect(answered.accepted).toBe(true);
    expect(answered.isCorrect).toBe(true);
    expect(answered.activeActivity).toBeUndefined();
    expect(answered.adaptive?.awaitingNextStep).toBe(true);
    expect(answered.isCompleted).toBe(false);

    // Still down: the lesson waits, with the answer saved and nothing substituted.
    const waiting = await startOrResumeOpenLesson(studentId, created.lessonId, db, deps);
    expect(waiting.adaptive?.awaitingNextStep).toBe(true);
    expect(waiting.activeActivity).toBeUndefined();
    expect(waiting.completedActivities).toHaveLength(3);
    expect(waiting.lesson.title).toBe("Photosynthesis");

    // Provider back: the retry delivers the next step of the same lesson.
    generator.setHandler(undefined);
    const resumed = await startOrResumeOpenLesson(studentId, created.lessonId, db, deps);
    expect(resumed.adaptive?.awaitingNextStep).toBe(false);
    expect(resumed.activeActivity?.type).toBe("independent_check");
    expect(resumed.adaptive?.stepNumber).toBe(4);
    expect(resumed.lesson.title).toBe("Photosynthesis");
  });

  it("a model answer the server rejects gets one corrected retry, then fails cleanly", async () => {
    const studentId = await createStudent("retry");
    let openingCalls = 0;
    const generator = new ScriptedGenerator((req) => {
      if (req.purpose !== "lesson_open") return undefined;
      openingCalls += 1;
      const badFirst = openingCalls === 1;
      return {
        kind: "plan",
        title: "Photosynthesis",
        subject: "science",
        learningGoal: "Explain what a plant needs to make food.",
        opening: [
          intro(
            "explain",
            badFirst
              ? "See https://example.com for the full chapter."
              : "Plants make food from light.",
          ),
          choiceCheck("What do plants need to make food?"),
        ],
      };
    });
    const created = await createOpenLesson(
      studentId,
      { topic: "photosynthesis", level: 7 },
      db,
      depsFor(generator),
    );
    expect(created.status).toBe("ready");
    expect(openingCalls).toBe(2);
    // The second prompt told the model exactly what was rejected.
    expect(generator.calls[1]!.input).toContain("CITATION_NOT_ALLOWED");

    const alwaysBad = new ScriptedGenerator(() => ({
      kind: "plan",
      title: "Photosynthesis",
      subject: "science",
      learningGoal: "Explain what a plant needs to make food.",
      opening: [intro("explain", "Watch the video of the leaf.")],
    }));
    const other = await createStudent("retry2");
    const failed = await createOpenLesson(
      other,
      { topic: "photosynthesis", level: 7 },
      db,
      depsFor(alwaysBad),
    );
    expect(failed).toMatchObject({
      status: "unavailable",
      reason: "generation_failed",
      retryable: true,
    });
    expect(alwaysBad.calls).toHaveLength(2);
    expect(
      await db.select().from(learningSessions).where(eq(learningSessions.studentId, other)),
    ).toHaveLength(0);
  });

  it("asks one clarification only for an ambiguous request, and refuses non-school topics", async () => {
    const studentId = await createStudent("clarify");
    const generator = new ScriptedGenerator();
    const deps = depsFor(generator);

    const ambiguous = await createOpenLesson(studentId, { topic: "cells", level: 8 }, db, deps);
    expect(ambiguous).toMatchObject({ status: "needs_clarification" });
    if (ambiguous.status !== "needs_clarification") throw new Error("unreachable");
    expect(ambiguous.options.length).toBeGreaterThanOrEqual(2);
    expect(
      await db.select().from(learningSessions).where(eq(learningSessions.studentId, studentId)),
    ).toHaveLength(0);

    const clarified = await createOpenLesson(
      studentId,
      { topic: "cells", level: 8, clarification: ambiguous.options[0]! },
      db,
      deps,
    );
    expect(clarified.status).toBe("ready");
    expect(generator.calls[1]!.input).toContain("Do not ask another question");

    // A clear topic is not questioned.
    expect(
      (await createOpenLesson(studentId, { topic: "photosynthesis", level: 7 }, db, deps)).status,
    ).toBe("ready");

    const offTopic = await createOpenLesson(
      studentId,
      { topic: "cricket scores", level: 6 },
      db,
      deps,
    );
    expect(offTopic).toMatchObject({
      status: "unavailable",
      reason: "out_of_scope",
      retryable: false,
    });
  });

  it("supplied sources are recorded and labelled as grounding, not review", async () => {
    const studentId = await createStudent("sources");
    const generator = new ScriptedGenerator();
    const created = ready(
      await createOpenLesson(
        studentId,
        { topic: "conductors and insulators", level: 6 },
        db,
        depsFor(generator),
      ),
    );
    expect(created.contentStatus.basis).toBe("source_grounded");
    expect(created.contentStatus.generatedPreview).toBe(true);
    expect(created.contentStatus.sources).toEqual([
      { id: "source-pack:SCI-ELEC-CONDUCTORS", title: expect.any(String), reviewStatus: "draft" },
    ]);
    // The source text was given to the model, and the circuit simulation was allowed.
    expect(generator.calls[0]!.input).toContain('SOURCE id="source-pack:SCI-ELEC-CONDUCTORS"');
    expect(generator.calls[0]!.input).toContain(
      "AVAILABLE SIMULATIONS FOR THIS TOPIC: circuit_loop",
    );

    const noSources = new ScriptedGenerator();
    await createOpenLesson(
      studentId,
      { topic: "photosynthesis", level: 7 },
      db,
      depsFor(noSources),
    );
    expect(noSources.calls[0]!.input).toContain("APPROVED SOURCES: none are available");
    expect(noSources.calls[0]!.input).toContain("AVAILABLE SIMULATIONS FOR THIS TOPIC: none");
  });

  it("nothing that identifies the learner is sent to the model", async () => {
    const studentId = await createStudent("privacy");
    const generator = new ScriptedGenerator();
    const deps = depsFor(generator);
    const created = ready(
      await createOpenLesson(
        studentId,
        { topic: "photosynthesis, mail me at kid@example.com or 9876543210", level: 7 },
        db,
        deps,
      ),
    );
    await play(studentId, created.lessonId, deps, (_, k) => (k === 1 ? "b" : "a"));
    expect(generator.calls.length).toBeGreaterThan(2);
    const sent = generator.calls.map((c) => `${c.system}\n${c.input}`).join("\n");
    for (const secret of [
      studentId,
      "Zzyzx",
      "open_privacy",
      "kid@example.com",
      "9876543210",
      "DEMO7A",
    ]) {
      expect(sent).not.toContain(secret);
    }
  });

  it("the step cap bounds a lesson even if the learner never settles", async () => {
    const studentId = await createStudent("cap");
    const generator = new ScriptedGenerator();
    const deps = depsFor(generator);
    const { respondToOpenLesson, startOrResumeOpenLesson } = await import("./open-topic/session");
    const created = ready(
      await createOpenLesson(studentId, { topic: "states of matter", level: 6 }, db, deps),
    );
    let active = (await startOrResumeOpenLesson(studentId, created.lessonId, db, deps))
      .activeActivity;
    let checks = 0;
    let completed = false;
    for (let i = 0; i < 60 && active && !completed; i++) {
      let response: unknown = { acknowledged: true };
      if (active.type === "independent_check") {
        checks += 1;
        response = { answer: checks % 2 === 0 ? "a" : "b" }; // alternate, never three in a row
      } else if (active.type === "predict_and_observe") response = { choiceId: "p1" };
      const res = await respondToOpenLesson(
        studentId,
        created.lessonId,
        active.id,
        response,
        db,
        deps,
      );
      active = res.activeActivity;
      completed = res.isCompleted;
    }
    const state = await lessonState(created.lessonId);
    expect(completed).toBe(true);
    expect(state.steps.length).toBeLessThanOrEqual(MAX_OPEN_TOPIC_STEPS + 2);
    expect(generator.calls.length).toBeLessThanOrEqual(MAX_OPEN_TOPIC_STEPS + 2);
  });

  it("open lessons are scoped to their student", async () => {
    const owner = await createStudent("owner");
    const other = await createStudent("other");
    const deps = depsFor(new ScriptedGenerator());
    const created = ready(
      await createOpenLesson(owner, { topic: "photosynthesis", level: 7 }, db, deps),
    );
    await expect(startOrResumeLessonSession(other, created.lessonId, db)).rejects.toMatchObject({
      statusCode: 404,
      code: "LESSON_NOT_FOUND",
    });
    await expect(
      submitLessonActivityResponse(other, created.lessonId, "act_o1_intro", {}, db),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  describe("consent, class and environment controls", () => {
    const enableAiRuntime = () => {
      vi.stubEnv("LLM_PROVIDER", "mock");
      vi.stubEnv("AI_ZDR_CONFIRMED", "true");
    };

    const createAiCohort = async (aiEnabled: boolean) => {
      n += 1;
      const id = `coh_open_${Date.now()}_${n}`;
      await db.insert(cohorts).values({
        id,
        orgId,
        name: `Open topic test ${n}`,
        grade: 7,
        joinCode: `T${(Date.now() + n).toString(36).slice(-5).toUpperCase()}`,
        aiEnabled,
      });
      return id;
    };

    const grantAiConsent = async (studentId: string) => {
      await db.insert(consentRecords).values({
        id: `con_open_${studentId}`,
        studentId,
        scope: "ai_free_text",
        method: "school_paper",
        evidenceRef: "TEST-FIXTURE",
        recordedBy: teacherId,
        grantedAt: new Date(),
      });
    };

    it("a model call needs the runtime, the kill switch off, the class flag, consent and budget, all at once", async () => {
      const cohortOn = await createAiCohort(true);
      const cohortOff = await createAiCohort(false);
      const full = await createStudent("full", cohortOn);
      await grantAiConsent(full);
      const noConsent = await createStudent("noconsent", cohortOn);
      const classOff = await createStudent("classoff", cohortOff);
      await grantAiConsent(classOff);

      // Runtime off (the project default): nobody.
      expect(await checkStudentAiPermission(full, db)).toEqual({
        allowed: false,
        reason: "runtime_disabled",
      });

      enableAiRuntime();
      expect(await checkStudentAiPermission(full, db)).toEqual({ allowed: true });
      expect(await checkStudentAiPermission(noConsent, db)).toEqual({
        allowed: false,
        reason: "no_consent",
      });
      expect(await checkStudentAiPermission(classOff, db)).toEqual({
        allowed: false,
        reason: "class_not_enabled",
      });
      expect(await checkStudentAiPermission(teacherId, db)).toEqual({
        allowed: false,
        reason: "class_not_enabled",
      });

      // Revoked consent takes effect immediately.
      await db
        .update(consentRecords)
        .set({ revokedAt: new Date(), revokedBy: teacherId })
        .where(eq(consentRecords.id, `con_open_${classOff}`));
      const revoked = await createStudent("revoked", cohortOn);
      await grantAiConsent(revoked);
      await db
        .update(consentRecords)
        .set({ revokedAt: new Date(), revokedBy: teacherId })
        .where(eq(consentRecords.id, `con_open_${revoked}`));
      expect(await checkStudentAiPermission(revoked, db)).toEqual({
        allowed: false,
        reason: "no_consent",
      });

      // Daily budget.
      vi.stubEnv("LLM_DAILY_CALLS_PER_STUDENT", "2");
      const caller = createModelCaller({ db, studentId: full, provider: new MockProvider() });
      const engine = new OpenTopicEngine(caller, 1000);
      await engine.planOpening({
        topic: "photosynthesis",
        level: 7,
        sources: { references: [], packs: [] },
        allowedSimulations: [],
        learnerEvidence: [],
      });
      expect(await countModelCallsToday(full, db)).toBe(1);
      expect(await checkStudentAiPermission(full, db)).toEqual({ allowed: true });
      await caller.generate({
        purpose: "lesson_step",
        system: "s",
        input: "ELIGIBLE_ACTIONS: explain\nRECOMMENDED_ACTION: explain",
        schema: (await import("./open-topic/validation")).GeneratedStepSchema,
        maxOutputTokens: 10,
        timeoutMs: 100,
      });
      expect(await checkStudentAiPermission(full, db)).toEqual({
        allowed: false,
        reason: "daily_limit",
      });
      vi.stubEnv("LLM_DAILY_CALLS_PER_STUDENT", "40");

      // Kill switch.
      await db
        .update(featureFlags)
        .set({ value: { enabled: true } })
        .where(eq(featureFlags.key, "llm_kill_switch"));
      expect(await checkStudentAiPermission(full, db)).toEqual({
        allowed: false,
        reason: "kill_switch",
      });
    });

    it("call accounting stores metadata only, never the prompt or the output", async () => {
      const studentId = await createStudent("accounting");
      const before = await db.select().from(llmCalls);
      const caller = createModelCaller({ db, studentId, provider: new MockProvider() });
      await new OpenTopicEngine(caller, 1000).planOpening({
        topic: "unmistakable-topic-marker",
        level: 7,
        sources: { references: [], packs: [] },
        allowedSimulations: [],
        learnerEvidence: [],
      });
      const after = await db.select().from(llmCalls);
      const added = after.filter((row) => !before.some((b) => b.id === row.id));
      expect(added.some((row) => row.purpose === "lesson_open" && row.outcome === "ok")).toBe(true);
      const callEvents = await db
        .select()
        .from(events)
        .where(and(eq(events.studentId, studentId), eq(events.type, "ai_model_call")));
      expect(callEvents).toHaveLength(1);
      expect(JSON.stringify([added, callEvents])).not.toContain("unmistakable-topic-marker");
    });

    it("without permission a new topic is refused with no model call and no session; an authored topic still opens", async () => {
      const studentId = await createStudent("noai");
      // Default gateway, runtime disabled.
      const refused = await createOpenLesson(studentId, { topic: "photosynthesis", level: 7 }, db);
      expect(refused).toMatchObject({
        status: "unavailable",
        reason: "ai_not_enabled",
        retryable: false,
      });
      expect(
        await db.select().from(learningSessions).where(eq(learningSessions.studentId, studentId)),
      ).toHaveLength(0);

      const authored = ready(
        await createOpenLesson(studentId, { topic: "fractions", level: 6 }, db),
      );
      expect(authored.lessonId).toBe("lesson-maths-frac-part-adaptive");
      expect(authored.contentStatus).toMatchObject({
        basis: "authored_draft",
        generatedPreview: false,
        practiceOnly: false,
      });
      const session = await startOrResumeLessonSession(studentId, authored.lessonId, db);
      expect(session.contentStatus?.basis).toBe("authored_draft");

      // Runtime on but this student has no AI consent: still refused.
      enableAiRuntime();
      expect(
        await createOpenLesson(studentId, { topic: "photosynthesis", level: 7 }, db),
      ).toMatchObject({
        status: "unavailable",
        reason: "ai_not_enabled",
      });
    });

    it("with every control satisfied the gateway path runs end to end and counts each call", async () => {
      enableAiRuntime();
      const studentId = await createStudent("gateway", await createAiCohort(true));
      await grantAiConsent(studentId);
      const created = ready(
        await createOpenLesson(studentId, { topic: "states of matter", level: 6 }, db),
      );
      const { last } = await play(studentId, created.lessonId, {}, () => "a");
      expect(last?.isCompleted).toBe(true);
      expect(await countModelCallsToday(studentId, db)).toBeGreaterThanOrEqual(3);
      await expectNoEvidence(studentId);
    });

    it("the kill switch stops a lesson in progress from calling the model, and keeps the answer", async () => {
      enableAiRuntime();
      const studentId = await createStudent("midkill", await createAiCohort(true));
      await grantAiConsent(studentId);
      const created = ready(
        await createOpenLesson(studentId, { topic: "photosynthesis", level: 7 }, db),
      );
      const s = await startOrResumeLessonSession(studentId, created.lessonId, db);
      const r1 = await submitLessonActivityResponse(
        studentId,
        created.lessonId,
        s.activeActivity!.id,
        {},
        db,
      );
      const r2 = await submitLessonActivityResponse(
        studentId,
        created.lessonId,
        r1.activeActivity!.id,
        { choiceId: "p1" },
        db,
      );
      const callsBefore = await countModelCallsToday(studentId, db);

      await db
        .update(featureFlags)
        .set({ value: { enabled: true } })
        .where(eq(featureFlags.key, "llm_kill_switch"));
      const r3 = await submitLessonActivityResponse(
        studentId,
        created.lessonId,
        r2.activeActivity!.id,
        { answer: "a" },
        db,
      );
      expect(r3.isCorrect).toBe(true);
      expect(r3.adaptive?.awaitingNextStep).toBe(true);
      expect(await countModelCallsToday(studentId, db)).toBe(callsBefore);
    });

    it("production offers no generated previews and refuses to resume one", async () => {
      const studentId = await createStudent("prod");
      const deps = depsFor(new ScriptedGenerator());
      const created = ready(
        await createOpenLesson(studentId, { topic: "photosynthesis", level: 7 }, db, deps),
      );

      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("APP_BASE_URL", "https://gaps.example");
      vi.stubEnv("PLAYWRIGHT_TEST", "");
      vi.stubEnv("CONTENT_SERVE_DRAFTS", "true");
      const generator = new ScriptedGenerator();
      for (const topic of ["photosynthesis", "fractions"]) {
        expect(
          await createOpenLesson(studentId, { topic, level: 7 }, db, depsFor(generator)),
        ).toMatchObject({
          status: "unavailable",
          reason: "preview_not_allowed",
        });
      }
      expect(generator.calls).toHaveLength(0);
      await expect(
        startOrResumeLessonSession(studentId, created.lessonId, db),
      ).rejects.toMatchObject({
        code: "LESSON_NOT_AVAILABLE",
      });
    });
  });

  describe("POST /api/v1/open-lessons authorization", () => {
    const post = (cookie: string | undefined, body: unknown) =>
      openLessonsHandler(
        new Request("http://localhost/api/v1/open-lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
          body: JSON.stringify(body),
        }),
      );
    const cookieFor = async (userId: string) =>
      `gaps_session=${(await createAuthSession(userId, "personal", db)).token}`;
    const body = { topic: "photosynthesis", level: 7 };

    it("rejects unauthenticated callers, teachers and staff admins", async () => {
      expect((await post(undefined, body)).status).toBe(401);
      expect((await post("gaps_session=forged", body)).status).toBe(401);
      expect((await post(await cookieFor("usr_01J00000000000000000000001"), body)).status).toBe(
        403,
      );
      expect((await post(await cookieFor("usr_01J00000000000000000000002"), body)).status).toBe(
        403,
      );
    });

    it("requires core consent, validates input, and answers a consenting student", async () => {
      // Kabir has no core consent in the demo seed.
      const kabir = await post(await cookieFor("stu_01J00000000000000000000002"), body);
      expect(kabir.status).toBe(403);
      expect((await kabir.json()).error.code).toBe("CONSENT_REQUIRED");

      const meera = await cookieFor("stu_01J00000000000000000000001");
      for (const bad of [
        {},
        { topic: "x", level: 7 },
        { topic: "photosynthesis", level: 9 },
        { topic: "a".repeat(200), level: 6 },
      ]) {
        expect((await post(meera, bad)).status).toBe(400);
      }

      // Open topics are in developer preview: the student entry is off by default,
      // for new and authored topics alike, and no session is created.
      for (const request of [body, { topic: "simple circuits", level: 6 }]) {
        const closed = await post(meera, request);
        expect(closed.status).toBe(200);
        expect(await closed.json()).toMatchObject({
          status: "unavailable",
          reason: "preview_not_allowed",
        });
      }
      // The flag cannot switch it on in production.
      vi.stubEnv("OPEN_TOPIC_STUDENT_ENTRY", "true");
      vi.stubEnv("NODE_ENV", "production");
      expect(await (await post(meera, body)).json()).toMatchObject({
        reason: "preview_not_allowed",
      });
      vi.stubEnv("NODE_ENV", "test");

      // Explicitly enabled outside production. AI is still off for this student,
      // so a new topic is refused in the body, not with an error status.
      const refused = await post(meera, body);
      expect(refused.status).toBe(200);
      expect(await refused.json()).toMatchObject({
        status: "unavailable",
        reason: "ai_not_enabled",
      });

      const authored = await post(meera, { topic: "simple circuits", level: 6 });
      expect(authored.status).toBe(201);
      expect(await authored.json()).toMatchObject({
        status: "ready",
        lessonId: "lesson-sci-circuits-adaptive",
      });
    });
  });
});

describe("Developer preview: open topics with a synthetic learner", () => {
  const db = getDb();
  const ids = {
    student: "stu_01J00000000000000000000001",
    teacher: "usr_01J00000000000000000000001",
    staff_admin: "usr_01J00000000000000000000002",
  };
  const cookies: Record<string, string> = {};

  beforeAll(async () => {
    await syncContent(db);
    await seedDatabase(db);
    for (const [role, id] of Object.entries(ids)) {
      cookies[role] = `gaps_session=${(await createAuthSession(id, "personal", db)).token}`;
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const lessonParams = (lessonId: string) => ({ params: Promise.resolve({ lessonId }) });
  const json = (cookie: string | undefined, body?: unknown, method = "POST") =>
    new Request("http://localhost/api/v1/dev/open-topic", {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  /** Every developer-preview route, called for a lesson id. */
  const callAll = async (cookie: string | undefined, lessonId: string) => [
    await devOpenTopic.GET(json(cookie, undefined, "GET")),
    await devOpenTopic.POST(json(cookie, { topic: "photosynthesis", level: 7 })),
    await devStart.POST(json(cookie), lessonParams(lessonId)),
    await devRespond.POST(json(cookie, { activityId: "x", response: {} }), lessonParams(lessonId)),
    await devAutoplay.POST(json(cookie, { profile: "succeeding" }), lessonParams(lessonId)),
    await devTrace.GET(json(cookie, undefined, "GET"), lessonParams(lessonId)),
  ];

  const useMockProvider = () => {
    vi.stubEnv("DEV_TOOLS_ENABLED", "true");
    vi.stubEnv("LLM_PROVIDER", "mock");
  };

  it("every route is 404 in production and when not enabled, for every caller", async () => {
    for (const setup of [
      () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("DEV_TOOLS_ENABLED", "true");
      },
      () => vi.stubEnv("DEV_TOOLS_ENABLED", ""),
    ]) {
      setup();
      for (const cookie of [undefined, cookies.student, cookies.teacher, cookies.staff_admin]) {
        for (const res of await callAll(cookie, "open-ses_none")) {
          expect(res.status).toBe(404);
          expect(await res.text()).not.toContain("answerKey");
        }
      }
      vi.unstubAllEnvs();
    }
  });

  it("when enabled: 401 unauthenticated, 403 for students and teachers, and nothing is returned", async () => {
    useMockProvider();
    for (const res of await callAll(undefined, "open-ses_none")) expect(res.status).toBe(401);
    for (const role of ["student", "teacher"] as const) {
      for (const res of await callAll(cookies[role], "open-ses_none")) {
        expect(res.status).toBe(403);
        const text = await res.text();
        expect(text).not.toContain("answerKey");
        expect(text).not.toContain("activeActivity");
      }
    }
  });

  it("reports exactly what is missing when no provider is configured, and starts nothing", async () => {
    vi.stubEnv("DEV_TOOLS_ENABLED", "true");
    vi.stubEnv("LLM_PROVIDER", "disabled");
    expect(getProviderReadiness()).toMatchObject({ ready: false, isMock: false });
    const readiness = await (
      await devOpenTopic.GET(json(cookies.staff_admin, undefined, "GET"))
    ).json();
    expect(readiness.missing.join(" ")).toContain("LLM_PROVIDER=openai");

    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(getProviderReadiness().missing).toEqual(["OPENAI_API_KEY"]);
    const res = await devOpenTopic.POST(
      json(cookies.staff_admin, { topic: "photosynthesis", level: 7 }),
    );
    expect(await res.json()).toMatchObject({ status: "unavailable", reason: "ai_not_enabled" });

    vi.stubEnv("OPENAI_API_KEY", "sk-test-not-a-real-key");
    const ready = getProviderReadiness();
    expect(ready).toMatchObject({ ready: true, isMock: false, provider: "openai" });
    expect(JSON.stringify(ready)).not.toContain("sk-test");
  });

  it("a staff admin runs a stored lesson as the synthetic learner: refresh, manual answers, auto-play and trace", async () => {
    useMockProvider();
    expect(getProviderReadiness()).toMatchObject({ ready: true, isMock: true });

    const created = await (
      await devOpenTopic.POST(json(cookies.staff_admin, { topic: "states of matter", level: 6 }))
    ).json();
    expect(created.status).toBe("ready");
    const lessonId: string = created.lessonId;
    expect(lessonId).toMatch(/^open-ses_/);

    // The lesson belongs to the synthetic learner, which is not a real account.
    const [owner] = await db
      .select({ studentId: learningSessions.studentId })
      .from(learningSessions)
      .where(eq(learningSessions.id, lessonId.slice("open-".length)));
    expect(owner?.studentId).toBe(SYNTHETIC_LEARNER_ID);
    const [synthetic] = await db.select().from(users).where(eq(users.id, SYNTHETIC_LEARNER_ID));
    expect(synthetic).toMatchObject({ status: "locked", cohortId: null, pinHash: null });

    // Resume twice: the stored step is returned unchanged, with no answer key.
    const first = await (
      await devStart.POST(json(cookies.staff_admin), lessonParams(lessonId))
    ).json();
    const again = await (
      await devStart.POST(json(cookies.staff_admin), lessonParams(lessonId))
    ).json();
    expect(again).toEqual(first);
    expect(first.contentStatus).toMatchObject({ basis: "model_knowledge", generatedPreview: true });
    expect(JSON.stringify(first)).not.toMatch(/"correctAnswer":"[^"]+"/);

    // One manual answer through the preview endpoint, then a retry of it.
    const body = { activityId: first.activeActivity.id, response: { acknowledged: true } };
    const answered = await (
      await devRespond.POST(json(cookies.staff_admin, body), lessonParams(lessonId))
    ).json();
    const retried = await (
      await devRespond.POST(json(cookies.staff_admin, body), lessonParams(lessonId))
    ).json();
    expect(retried.activeActivity).toEqual(answered.activeActivity);

    // A struggling synthetic learner changes the lesson's direction.
    const played = await (
      await devAutoplay.POST(
        json(cookies.staff_admin, { profile: "struggling" }),
        lessonParams(lessonId),
      )
    ).json();
    expect(played.stoppedBecause).toBe("completed");
    const roles = played.trace.steps.map((s: { role: string }) => s.role);
    expect(roles.slice(0, 4)).toEqual(["teach", "teach", "assessment", "diagnostic"]);
    expect(roles.at(-1)).toBe("closing");

    // The developer trace shows keys, verification and the model's own claims, labelled.
    const trace = await (
      await devTrace.GET(json(cookies.staff_admin, undefined, "GET"), lessonParams(lessonId))
    ).json();
    expect(trace.steps[2]).toMatchObject({
      origin: "generated",
      answerKey: "a",
      answerVerification: "model_key",
      assistance: "independent",
      isCorrect: false,
    });
    expect(trace.modelProposed.prerequisites).toEqual(["Mock proposed prerequisite"]);
    expect(trace.generator).toEqual({ provider: "mock", model: "mock" });

    // Practice only, even here: nothing became evidence for the synthetic learner.
    expect(
      await db.select().from(attempts).where(eq(attempts.studentId, SYNTHETIC_LEARNER_ID)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(conceptBeliefs)
        .where(eq(conceptBeliefs.studentId, SYNTHETIC_LEARNER_ID)),
    ).toHaveLength(0);

    // A student cannot reach the synthetic learner's lesson through the student API.
    await expect(startOrResumeLessonSession(ids.student, lessonId, db)).rejects.toMatchObject({
      statusCode: 404,
    });
    // Unknown and non-open lesson ids are refused.
    expect(
      (
        await devTrace.GET(
          json(cookies.staff_admin, undefined, "GET"),
          lessonParams("open-ses_missing"),
        )
      ).status,
    ).toBe(404);
    expect(
      (await devStart.POST(json(cookies.staff_admin), lessonParams("lesson-maths-frac-part-1")))
        .status,
    ).toBe(404);
  });
});

describe("Mock provider fault modes reach the learner as a retryable failure", () => {
  const db = getDb();
  it.each<MockFaultMode>(["timeout", "error", "refused", "invalid_json"])("%s", async (fault) => {
    const id = `stu_open_fault_${fault}_${Date.now()}`;
    await db.insert(users).values({
      id,
      role: "student",
      orgId: "org_01J00000000000000000000001",
      cohortId: "coh_01J00000000000000000000001",
      displayName: "Fault Test",
      username: `fault_${fault}_${Date.now()}`,
      pinHash: hashPin("999999"),
      status: "active",
      avatar: { color: "teal", icon: "spark" },
      settings: {},
    });
    const caller = createModelCaller({ db, provider: new MockProvider({ fault }) });
    const result = await createOpenLesson(id, { topic: "photosynthesis", level: 7 }, db, {
      resolveEngine: async () => ({ engine: new OpenTopicEngine(caller, 1000) }),
    });
    expect(result).toMatchObject({
      status: "unavailable",
      reason: "generation_failed",
      retryable: true,
    });
  });
});
