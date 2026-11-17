import { z } from "zod";
import {
  LessonActivitySchema,
  LessonTeachingActionSchema,
  type LessonActivity,
  type LessonActivityType,
  type LessonTeachingAction,
} from "@gaps/contracts";
import { eq } from "@gaps/domain";
import { validateActivityFactualRules } from "../lesson/planner-validator";
import { ArithmeticError, evaluateArithmetic, parseNumericAnswer } from "./arithmetic";

/**
 * What a model may hand back for one step, and the server-side checks it must
 * pass before a learner sees it. The model composes existing, tested activity
 * components by filling in their configuration. It cannot add a component,
 * a simulation, markup or code.
 */

/** Actions a model may choose. Pausing and closing are always built by the server. */
export const GENERATABLE_ACTIONS = [
  "explain",
  "demonstrate",
  "explore",
  "guided_practice",
  "independent_check",
] as const satisfies readonly LessonTeachingAction[];

const ALLOWED_TYPES: Readonly<Record<string, readonly LessonActivityType[]>> = {
  explain: ["intro"],
  demonstrate: ["intro", "predict_and_observe"],
  explore: ["interactive_manipulation", "predict_and_observe"],
  guided_practice: ["guided_practice"],
  independent_check: ["independent_check"],
};

export const GeneratedStepSchema = z.object({
  action: LessonTeachingActionSchema,
  activity: LessonActivitySchema,
  /** Arithmetic that produces the answer to a numeric question, e.g. "-3 + 5". */
  answerCheck: z.object({ expression: z.string().min(1).max(80) }).optional(),
  /** Choice id -> the misconception the model suspects behind that choice. */
  suspectedMisconceptions: z.record(z.string(), z.string().max(160)).optional(),
  /** The interaction the model would have used had it been available. */
  idealInteraction: z.string().max(160).optional(),
  usedSourceIds: z.array(z.string()).max(8).optional(),
  rationale: z.string().max(400),
});
export type GeneratedStep = z.infer<typeof GeneratedStepSchema>;

export type AnswerVerification =
  /** The answer key was recomputed by the server with exact arithmetic. */
  | "deterministic_answer_key"
  /** The answer key is the model's own and has not been independently checked. */
  | "model_key";

export interface AcceptedStep {
  readonly action: LessonTeachingAction;
  /** Normalised activity. The caller assigns the final id. */
  readonly activity: LessonActivity;
  readonly verification?: AnswerVerification;
  readonly suspectedMisconceptions: Readonly<Record<string, string>>;
  readonly idealInteraction: string | null;
  readonly usedSourceIds: readonly string[];
  readonly rationale: string;
}

export interface ValidationContext {
  readonly eligibleActions: readonly LessonTeachingAction[];
  /** Simulation kinds relevant to this topic. Usually empty. */
  readonly allowedSimulations: readonly string[];
  /** Ids of the sources that were actually supplied to the model. */
  readonly suppliedSourceIds: readonly string[];
}

const LIMITS = { title: 90, instructions: 240, body: 900, prompt: 400, choice: 200, feedback: 500 };

/** Invented references: the model has no sources unless the server supplied them. */
const CITATION_PATTERN =
  /(https?:\/\/|www\.|\bdoi\b|\bisbn\b|\[\d+\]|\bet al\b|\bsource\s*:|\breference\s*:|according to (the )?(ncert|textbook|book|study|studies|research|scientists at)|\bpage\s+\d+|\bchapter\s+\d+\b|\(\s*(19|20)\d{2}\s*\))/i;

/** Claims of an interaction the player does not have. */
const CAPABILITY_PATTERN =
  /\b(drag|slider|simulation|simulator|animation|video|watch the|click on the|tap the|microscope view|interactive diagram|3d model)\b/i;

/** Student copy says "not yet", never "wrong" or "failed" (Non-negotiable 9). */
const HARSH_COPY_PATTERN = /\b(wrong|failed|stupid|dumb)\b/i;

const MARKUP_PATTERN = /<\s*\/?\s*[a-z][^>]*>|```|\bjavascript:|\bon\w+\s*=/i;

function collectText(
  activity: LessonActivity,
): Array<{ field: keyof typeof LIMITS; text: string }> {
  const out: Array<{ field: keyof typeof LIMITS; text: string }> = [
    { field: "title", text: activity.title },
    { field: "instructions", text: activity.instructions },
  ];
  const c = activity.config;
  if (c.type === "intro") {
    out.push({ field: "title", text: c.headline }, { field: "body", text: c.body });
    if (c.hookQuestion) out.push({ field: "prompt", text: c.hookQuestion });
  } else if (c.type === "predict_and_observe") {
    out.push({ field: "prompt", text: c.prompt });
    for (const choice of c.predictionChoices) out.push({ field: "choice", text: choice.text });
    out.push(
      { field: "feedback", text: c.observationReveal.expectedObservation },
      { field: "feedback", text: c.observationReveal.explanation },
    );
  } else if (c.type === "guided_practice") {
    out.push(
      { field: "prompt", text: c.prompt },
      { field: "feedback", text: c.successFeedback },
      { field: "feedback", text: c.retryFeedback },
    );
  } else if (c.type === "independent_check") {
    out.push({ field: "prompt", text: c.prompt }, { field: "feedback", text: c.explanation });
    for (const choice of c.choices ?? []) out.push({ field: "choice", text: choice.text });
  } else if (c.type === "interactive_manipulation") {
    out.push({ field: "instructions", text: c.simulation.instruction });
  }
  return out;
}

function simulationOf(activity: LessonActivity) {
  const c = activity.config;
  if (c.type === "interactive_manipulation") return c.simulation;
  if (c.type === "predict_and_observe" || c.type === "guided_practice") return c.simulation;
  return undefined;
}

export type StepValidation = { ok: true; step: AcceptedStep } | { ok: false; issues: string[] };

export function validateGeneratedStep(raw: unknown, ctx: ValidationContext): StepValidation {
  const parsed = GeneratedStepSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues
        .slice(0, 5)
        .map((i) => `SCHEMA: ${i.path.join(".")} ${i.message}`),
    };
  }
  const gen = parsed.data;
  const issues: string[] = [];
  const { remediation: _nested, ...activity } = gen.activity;
  void _nested;
  const config = activity.config;

  // ---- Server envelope -----------------------------------------------------
  if (!ctx.eligibleActions.includes(gen.action)) {
    issues.push(
      `ACTION_OUTSIDE_ENVELOPE: ${gen.action} (eligible: ${ctx.eligibleActions.join(", ")})`,
    );
  }
  const allowedTypes = ALLOWED_TYPES[gen.action];
  if (!allowedTypes) {
    issues.push(`ACTION_NOT_GENERATABLE: ${gen.action}`);
  } else if (!allowedTypes.includes(activity.type)) {
    issues.push(`ACTIVITY_TYPE_NOT_ALLOWED_FOR_ACTION: ${gen.action}/${activity.type}`);
  }
  if (activity.type !== config.type) issues.push("ACTIVITY_TYPE_MISMATCH");

  // ---- Supported components only -------------------------------------------
  const simulation = simulationOf(activity);
  if (simulation && !ctx.allowedSimulations.includes(simulation.simulationKind)) {
    issues.push(
      `SIMULATION_NOT_AVAILABLE_FOR_TOPIC: ${simulation.simulationKind}. Use predict_and_observe without a simulation, or an explanation.`,
    );
  }
  if (config.type === "guided_practice") {
    if (!config.simulation) {
      issues.push("GUIDED_PRACTICE_REQUIRES_SUPPORTED_SIMULATION");
    } else if (config.simulation.simulationKind === "fraction_strip") {
      const m = /^(\d+)\/(\d+)$/.exec(config.targetCriteria.expectedValue);
      const parts = m ? Number(m[2]) : NaN;
      const shaded = m ? Number(m[1]) : NaN;
      if (
        !m ||
        parts < (config.simulation.minParts ?? 1) ||
        parts > (config.simulation.maxParts ?? 12) ||
        shaded > parts
      ) {
        issues.push(
          "GUIDED_TARGET_UNREACHABLE: fraction strip target must be shaded/parts within range",
        );
      }
    } else if (!["open", "closed"].includes(config.targetCriteria.expectedValue)) {
      issues.push("GUIDED_TARGET_UNREACHABLE: circuit target must be open or closed");
    }
  }
  issues.push(...validateActivityFactualRules(activity));

  // ---- Questions and answer keys -------------------------------------------
  let verification: AnswerVerification | undefined;
  if (config.type === "predict_and_observe") {
    const ids = config.predictionChoices.map((c) => c.id);
    if (ids.length > 4 || new Set(ids).size !== ids.length) {
      issues.push("PREDICTION_CHOICES_INVALID: 2 to 4 choices with unique ids");
    }
  }
  if (config.type === "independent_check") {
    verification = "model_key";
    if (config.questionType === "choice") {
      const ids = (config.choices ?? []).map((c) => c.id);
      if (ids.length < 2 || ids.length > 5 || new Set(ids).size !== ids.length) {
        issues.push("CHOICES_INVALID: 2 to 5 choices with unique ids");
      }
      if (!ids.includes(config.correctAnswer)) issues.push("ANSWER_KEY_NOT_A_CHOICE");
      const texts = (config.choices ?? []).map((c) => c.text.trim().toLowerCase());
      if (new Set(texts).size !== texts.length) issues.push("CHOICES_DUPLICATED");
    } else {
      const key = parseNumericAnswer(config.correctAnswer);
      if (!key) {
        issues.push("ANSWER_KEY_NOT_NUMERIC: number and fraction questions need a numeric key");
      } else if (gen.answerCheck) {
        try {
          if (eq(evaluateArithmetic(gen.answerCheck.expression), key)) {
            verification = "deterministic_answer_key";
          } else {
            issues.push("ANSWER_KEY_MISMATCH: answerCheck.expression does not equal correctAnswer");
          }
        } catch (err) {
          issues.push(
            `ANSWER_CHECK_INVALID: ${err instanceof ArithmeticError ? err.message : "not arithmetic"}`,
          );
        }
      }
    }
    if (!config.explanation.trim()) issues.push("EXPLANATION_MISSING");
  }

  // ---- Text guards -----------------------------------------------------------
  for (const { field, text } of collectText(activity)) {
    if (text.length > LIMITS[field])
      issues.push(`TEXT_TOO_LONG: ${field} over ${LIMITS[field]} characters`);
    if (CITATION_PATTERN.test(text))
      issues.push("CITATION_NOT_ALLOWED: do not cite or name sources in text");
    if (MARKUP_PATTERN.test(text)) issues.push("MARKUP_NOT_ALLOWED: plain text only");
    if (field === "feedback" && HARSH_COPY_PATTERN.test(text)) {
      issues.push('COPY_TONE: feedback says "not yet", never wrong or failed');
    }
    if (!simulation && CAPABILITY_PATTERN.test(text)) {
      issues.push("CLAIMS_UNAVAILABLE_CAPABILITY: this step has no simulation, animation or video");
    }
  }
  if (!activity.title.trim() || !activity.instructions.trim())
    issues.push("TITLE_OR_INSTRUCTIONS_MISSING");

  // ---- Sources: only ones the server supplied --------------------------------
  const usedSourceIds = gen.usedSourceIds ?? [];
  if (usedSourceIds.some((id) => !ctx.suppliedSourceIds.includes(id))) {
    issues.push("UNKNOWN_SOURCE_ID: usedSourceIds may only contain supplied source ids");
  }

  if (issues.length > 0) return { ok: false, issues: [...new Set(issues)] };

  // Identifiers that tie a question to verified curriculum content are never
  // accepted from a model.
  const normalised: LessonActivity =
    config.type === "independent_check"
      ? {
          ...activity,
          config: {
            type: "independent_check",
            prompt: config.prompt,
            questionType: config.questionType,
            ...(config.choices ? { choices: config.choices } : {}),
            correctAnswer: config.correctAnswer,
            explanation: config.explanation,
          },
        }
      : activity;

  return {
    ok: true,
    step: {
      action: gen.action,
      activity: normalised,
      ...(verification ? { verification } : {}),
      suspectedMisconceptions: gen.suspectedMisconceptions ?? {},
      idealInteraction: gen.idealInteraction?.trim() || null,
      usedSourceIds,
      rationale: gen.rationale,
    },
  };
}
