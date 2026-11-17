import { z } from "zod";
import type { LessonTeachingAction, SourceReference, SubjectId } from "@gaps/contracts";
import { SubjectIdSchema } from "@gaps/contracts";
import type { GenerateFailureReason, GenerateRequest, GenerateResult } from "@gaps/ai";
import type { ObjectiveSourcePack } from "../lesson/planner-source-pack";
import type { OpenPolicyDecision, OpenTopicState } from "./machine";
import {
  type AcceptedStep,
  GeneratedStepSchema,
  type ValidationContext,
  validateGeneratedStep,
} from "./validation";

/**
 * The model side of open-topic teaching.
 *
 * The model is given the learning goal, the learner's level, what the learner
 * has done in this lesson, any approved sources, and the catalogue of tested
 * activity components. It answers with configuration for those components. The
 * server validates every answer; one corrected retry is allowed, after which
 * the step fails and the learner is offered a retry.
 *
 * Nothing sent to the model identifies a learner: no name, username, school,
 * class or account id. The topic text has contact details removed beforehand.
 */

export interface TextGenerator {
  readonly providerName: string;
  readonly model: string;
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
  /** Provider moderation of the learner's topic text, when the provider has it. */
  isFlagged?(text: string): Promise<boolean>;
}

export type GenerationFailure =
  { kind: "provider"; reason: GenerateFailureReason } | { kind: "rejected"; issues: string[] };

const OPENING_ELIGIBLE: readonly LessonTeachingAction[] = ["explore", "demonstrate", "explain"];
const FOLLOW_ON_ELIGIBLE: readonly LessonTeachingAction[] = [
  "independent_check",
  "guided_practice",
  "explore",
];

const OpeningSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("clarify"),
    question: z.string().min(5).max(200),
    options: z.array(z.string().min(1).max(80)).min(2).max(4),
  }),
  z.object({ kind: z.literal("out_of_scope"), reason: z.string().max(200) }),
  z.object({
    kind: z.literal("plan"),
    title: z.string().min(2).max(80),
    subject: SubjectIdSchema,
    learningGoal: z.string().min(10).max(240),
    proposedPrerequisites: z.array(z.string().max(120)).max(5).default([]),
    suspectedMisconceptions: z.array(z.string().max(160)).max(5).default([]),
    opening: z.array(z.unknown()).min(1).max(3),
  }),
]);

export type OpeningResult =
  | { kind: "clarify"; question: string; options: string[] }
  | { kind: "out_of_scope"; reason: string }
  | {
      kind: "plan";
      title: string;
      subject: SubjectId;
      learningGoal: string;
      proposedPrerequisites: string[];
      suspectedMisconceptions: string[];
      opening: AcceptedStep[];
    }
  | { kind: "failed"; failure: GenerationFailure };

export interface OpeningRequest {
  topic: string;
  level: number;
  /** Present when the learner has already answered a clarification question. */
  clarification?: string;
  sources: { references: SourceReference[]; packs: ObjectiveSourcePack[] };
  allowedSimulations: string[];
  /** Verified belief statuses for related curriculum concepts, when any exist. */
  learnerEvidence: string[];
}

const ACTIVITY_CATALOGUE = `ACTIVITY CATALOGUE. These are the ONLY components that exist. You fill in their
configuration as JSON. You cannot add components, simulations, images, video, markup or code.

Every step is: { "action", "activity": { "id": "x", "type", "title", "instructions", "config" }, "rationale",
  optional "answerCheck", optional "suspectedMisconceptions", optional "idealInteraction", optional "usedSourceIds" }

1. type "intro" (actions: explain, demonstrate). A short explanation card.
   config: { "type": "intro", "headline": string, "body": string (max 900 chars, plain text), "hookQuestion"?: string }

2. type "predict_and_observe" (actions: explore, demonstrate). The learner picks a prediction, then reads what
   actually happens and why. Works for any topic. No simulation is needed.
   config: { "type": "predict_and_observe", "prompt": string,
     "predictionChoices": [ { "id": "p1", "text": string, "isExpected"?: true } ]  (2 to 4, exactly one isExpected),
     "observationReveal": { "expectedObservation": string, "explanation": string } }

3. type "independent_check" (action: independent_check). One question, graded by the server.
   Multiple choice:
   config: { "type": "independent_check", "prompt": string, "questionType": "choice",
     "choices": [ { "id": "a", "text": string } ]  (2 to 5, unique), "correctAnswer": "<a choice id>", "explanation": string }
   Numeric (the learner types a number such as -3, 2.5 or 3/4):
   config: { "type": "independent_check", "prompt": string, "questionType": "number",
     "correctAnswer": "<the number>", "explanation": string }
   For a numeric question whose answer comes from a calculation, ALSO give
   "answerCheck": { "expression": "<plain arithmetic, e.g. -3 + 5 or (2 - 7) * 3>" } so the server can
   recompute the answer exactly. If it does not match "correctAnswer" the step is rejected.
   For multiple choice you MAY give "suspectedMisconceptions": { "<wrong choice id>": "<what a learner who picks it may believe>" }.

4. type "interactive_manipulation" (action: explore) and type "guided_practice" (action: guided_practice).
   These need a tested simulation. AVAILABLE SIMULATIONS FOR THIS TOPIC: {{SIMULATIONS}}.
   If that list is "none", do not use these two types at all.

RULES
- If the ideal interaction is not in this catalogue (for example a number line, a particle animation or a lab),
  use a supported alternative and name what you would have used in "idealInteraction". Never describe or
  promise an interaction, animation, video or picture that the component does not have.
- Plain text only. Never cite or name books, websites, pages, studies or authors, and never write a URL.
  If sources are supplied below, base the content on them and list the ids you used in "usedSourceIds".
- Explanations must be factually correct school-level maths or science for the given class.
- Feedback and explanations say "not yet", never "wrong" or "failed". No ranking, timers or streaks.
- Do not say the learner has mastered anything. You cannot change grading or progress.
- Keep each step short. One idea per step.`;

function describeSources(sources: OpeningRequest["sources"]): string {
  if (sources.packs.length === 0) {
    return "APPROVED SOURCES: none are available for this topic. Teach from your own knowledge. Do not invent sources.";
  }
  const blocks = sources.packs.map((pack, i) => {
    const id = sources.references[i]?.id ?? `source-pack:${pack.objectiveId}`;
    return `SOURCE id="${id}" title="${pack.title}"
Core ideas: ${pack.coreConcepts.join(" | ")}
Prerequisites: ${pack.prerequisites.join(" | ")}
Known misconceptions: ${pack.cataloguedMisconceptions.map((m) => `${m.name}: ${m.description}`).join(" | ")}
Grounded examples: ${pack.groundedMetaphors.join(" | ")}`;
  });
  return `APPROVED SOURCES (use these; list the ids you used in "usedSourceIds"):\n${blocks.join("\n\n")}`;
}

function catalogueFor(allowedSimulations: readonly string[]): string {
  return ACTIVITY_CATALOGUE.replace(
    "{{SIMULATIONS}}",
    allowedSimulations.length > 0 ? allowedSimulations.join(", ") : "none",
  );
}

const SYSTEM_PROMPT =
  "You plan short, adaptive lessons for Indian school students in Classes 6 to 8, in maths and science only. " +
  "You answer with a single JSON object and nothing else. You only configure the activity components you are given.";

function openingPrompt(req: OpeningRequest, correction?: string[]): string {
  return `A learner in Class ${req.level} wants to learn about: "${req.topic}"${
    req.clarification
      ? `\nThe learner has clarified: "${req.clarification}". Do not ask another question.`
      : ""
  }

Decide ONE of:
(a) { "kind": "clarify", "question": string, "options": [2 to 4 short choices] }
    ONLY if the request could mean clearly different topics and you cannot pick one sensibly for Class ${req.level}.
    A normal topic name such as "photosynthesis" is NOT ambiguous. Ask at most this once.
(b) { "kind": "out_of_scope", "reason": string } if this is not school maths or science, or is unsafe for a child.
(c) { "kind": "plan", "title": string, "subject": "maths" | "science", "learningGoal": string (one sentence, one goal
    small enough for 10 minutes), "proposedPrerequisites": string[] (your proposal, at most 5),
    "suspectedMisconceptions": string[] (common ones you expect, at most 5), "opening": [steps] }

For (c), "opening" is a SHORT sequence of 2 or 3 steps, not a whole lesson. Later steps are chosen one at a time
from the learner's answers, so do not plan them now.
- Step 1 action must be one of: explain, demonstrate, explore.
- A middle step, if any, must be action "explore".
- The LAST step must be action "independent_check": one question that shows what the learner already understands.

LEARNER EVIDENCE (verified by the system): ${
    req.learnerEvidence.length > 0 ? req.learnerEvidence.join("; ") : "none for this topic"
  }

${describeSources(req.sources)}

${catalogueFor(req.allowedSimulations)}${correctionBlock(correction)}`;
}

function correctionBlock(issues?: string[]): string {
  return issues && issues.length > 0
    ? `\n\nYOUR PREVIOUS ANSWER WAS REJECTED BY THE SERVER. Fix every problem and answer again:\n- ${issues.join("\n- ")}`
    : "";
}

function describeHistory(state: OpenTopicState): string {
  if (state.steps.length === 0) return "none";
  return state.steps
    .map((s) => {
      const config = s.activity.config;
      const question = config.type === "independent_check" ? ` Question: "${config.prompt}"` : "";
      let result = "";
      if (s.outcome && s.outcome.isCorrect !== undefined) {
        result = s.outcome.isCorrect
          ? ` -> answered correctly (${s.assistanceLevel === 0 ? "unassisted" : "after support"})`
          : ` -> not yet correct; learner chose "${s.outcome.submittedAnswer}"${
              s.outcome.suspectedMisconception
                ? `; you suspected: ${s.outcome.suspectedMisconception}`
                : ""
            }`;
      }
      return `${s.seq}. [${s.action}${s.role === "diagnostic" ? ", diagnostic probe" : ""}] ${s.activity.title}.${question}${result}`;
    })
    .join("\n");
}

function stepPrompt(
  state: OpenTopicState,
  decision: Extract<OpenPolicyDecision, { kind: "generate" }>,
  sources: OpeningRequest["sources"],
  allowedSimulations: readonly string[],
  correction?: string[],
): string {
  return `Lesson topic: "${state.title}" (learner's words: "${state.topicText}"), Class ${state.level}, ${state.subject}.
Learning goal: ${state.learningGoal}
Your earlier proposals (not verified): prerequisites: ${state.modelProposed.prerequisites.join("; ") || "none"}.
Suspected misconceptions: ${state.modelProposed.misconceptions.join("; ") || "none"}.

WHAT HAS HAPPENED SO FAR
${describeHistory(state)}

SERVER DECISION (you must stay inside it)
ELIGIBLE_ACTIONS: ${decision.eligibleActions.join(", ")}
RECOMMENDED_ACTION: ${decision.recommendedAction}
WHY: ${decision.policyRationale}
${
  decision.isDiagnostic
    ? "This step is a DIAGNOSTIC PROBE: one short multiple-choice question with exactly 2 choices that tells a slip apart from a real gap in the idea just tested. It is not scored as practice."
    : ""
}
Choose exactly ONE next step. Its "action" must be one of ELIGIBLE_ACTIONS. Respond to what the learner just did:
after a missed answer, teach the idea a different way rather than repeating; after a correct answer, ask a
question that is different from every earlier question and a little harder. Never repeat an earlier question.

Answer with one JSON object: the step itself (see catalogue), not a list.

${describeSources(sources)}

${catalogueFor(allowedSimulations)}${correctionBlock(correction)}`;
}

export class OpenTopicEngine {
  constructor(
    private readonly generator: TextGenerator,
    private readonly timeoutMs: number = 20000,
  ) {}

  get provider(): { provider: string; model: string } {
    return { provider: this.generator.providerName, model: this.generator.model };
  }

  async isTopicFlagged(topic: string): Promise<boolean> {
    return this.generator.isFlagged ? this.generator.isFlagged(topic) : false;
  }

  async planOpening(req: OpeningRequest): Promise<OpeningResult> {
    const suppliedSourceIds = req.sources.references.map((r) => r.id);
    let correction: string[] | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.generator.generate({
        purpose: "lesson_open",
        system: SYSTEM_PROMPT,
        input: openingPrompt(req, correction),
        schema: OpeningSchema,
        maxOutputTokens: 2200,
        timeoutMs: this.timeoutMs * 2,
      });
      if (!result.ok)
        return { kind: "failed", failure: { kind: "provider", reason: result.reason } };

      const value = result.value;
      if (value.kind === "clarify") {
        if (req.clarification) {
          correction = ['CLARIFICATION_ALREADY_GIVEN: answer with kind "plan" or "out_of_scope"'];
          continue;
        }
        return { kind: "clarify", question: value.question, options: value.options };
      }
      if (value.kind === "out_of_scope") return { kind: "out_of_scope", reason: value.reason };

      const issues: string[] = [];
      const opening: AcceptedStep[] = [];
      value.opening.forEach((raw, index) => {
        const checked = validateGeneratedStep(raw, {
          eligibleActions: index === 0 ? OPENING_ELIGIBLE : FOLLOW_ON_ELIGIBLE,
          allowedSimulations: req.allowedSimulations,
          suppliedSourceIds,
        });
        if (checked.ok) opening.push(checked.step);
        else issues.push(...checked.issues.map((i) => `opening[${index}]: ${i}`));
      });
      if (
        issues.length === 0 &&
        opening.at(-1)?.action !== "independent_check" &&
        opening.length > 1
      ) {
        issues.push("opening: the last step must be action independent_check");
      }
      if (issues.length === 0) {
        return {
          kind: "plan",
          title: value.title,
          subject: value.subject,
          learningGoal: value.learningGoal,
          proposedPrerequisites: value.proposedPrerequisites,
          suspectedMisconceptions: value.suspectedMisconceptions,
          opening,
        };
      }
      correction = issues;
    }
    return { kind: "failed", failure: { kind: "rejected", issues: correction ?? [] } };
  }

  async nextStep(
    state: OpenTopicState,
    decision: Extract<OpenPolicyDecision, { kind: "generate" }>,
    sources: OpeningRequest["sources"],
    allowedSimulations: readonly string[],
  ): Promise<{ ok: true; step: AcceptedStep } | { ok: false; failure: GenerationFailure }> {
    const ctx: ValidationContext = {
      eligibleActions: decision.eligibleActions,
      allowedSimulations,
      suppliedSourceIds: sources.references.map((r) => r.id),
    };
    const earlierPrompts = new Set(
      state.steps.flatMap((s) =>
        s.activity.config.type === "independent_check"
          ? [s.activity.config.prompt.trim().toLowerCase()]
          : [],
      ),
    );
    let correction: string[] | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.generator.generate({
        purpose: "lesson_step",
        system: SYSTEM_PROMPT,
        input: stepPrompt(state, decision, sources, allowedSimulations, correction),
        schema: GeneratedStepSchema,
        maxOutputTokens: 1200,
        timeoutMs: this.timeoutMs,
      });
      if (!result.ok) return { ok: false, failure: { kind: "provider", reason: result.reason } };

      const checked = validateGeneratedStep(result.value, ctx);
      if (checked.ok) {
        const config = checked.step.activity.config;
        const repeated =
          config.type === "independent_check" &&
          earlierPrompts.has(config.prompt.trim().toLowerCase());
        const probeShape =
          !decision.isDiagnostic ||
          (config.type === "independent_check" &&
            config.questionType === "choice" &&
            config.choices?.length === 2);
        if (!repeated && probeShape) return { ok: true, step: checked.step };
        correction = [
          ...(repeated
            ? ["QUESTION_REPEATED: ask a question not used earlier in this lesson"]
            : []),
          ...(probeShape
            ? []
            : ["PROBE_SHAPE: a diagnostic probe is multiple choice with exactly 2 choices"]),
        ];
      } else {
        correction = checked.issues;
      }
    }
    return { ok: false, failure: { kind: "rejected", issues: correction ?? [] } };
  }
}
