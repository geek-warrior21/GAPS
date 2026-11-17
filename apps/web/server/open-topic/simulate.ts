import type { LessonActivity } from "@gaps/contracts";
import { advanceOpenLesson, initialOpenState } from "./advance";
import type { OpenTopicEngine } from "./engine";
import {
  type OpenStep,
  type OpenTopicState,
  currentOpenStep,
  gradeOpenStep,
  resolveOpenStep,
} from "./machine";
import { allowedSimulations, findAuthoredLesson, findSources, sanitizeTopic } from "./topics";

/**
 * Runs a synthetic learner through an open-topic lesson, in memory. It uses
 * the same engine, validation, policy and grading as a student session, but no
 * database and no student: nothing personal exists to send to a provider.
 */

export type SyntheticProfile = "succeeding" | "struggling";

export interface SyntheticRun {
  topic: string;
  level: number;
  profile: SyntheticProfile;
  outcome:
    | "completed"
    | "paused"
    | "waiting_for_provider"
    | "clarification_requested"
    | "out_of_scope"
    | "opening_failed"
    | "authored_lesson_exists"
    | "step_limit";
  detail: string;
  state: OpenTopicState | null;
}

function wrongAnswer(activity: LessonActivity): string {
  const config = activity.config;
  if (config.type !== "independent_check") return "";
  if (config.questionType === "choice") {
    return (config.choices ?? []).find((c) => c.id !== config.correctAnswer)?.id ?? "";
  }
  // A numeric answer that cannot equal the key.
  return `${config.correctAnswer.trim().startsWith("-") ? "" : "-"}987654`;
}

/** The scripted learner's response to a step. Shared with the developer preview. */
export function syntheticAnswer(
  step: OpenStep,
  profile: SyntheticProfile,
  missesSoFar: number,
): unknown {
  const config = step.activity.config;
  if (config.type === "predict_and_observe") {
    return { choiceId: config.predictionChoices.find((c) => c.isExpected)?.id ?? "" };
  }
  if (config.type === "guided_practice") return { value: config.targetCriteria.expectedValue };
  if (config.type !== "independent_check") return { acknowledged: true };
  // The struggling learner misses the first two graded questions, then answers correctly.
  const miss = profile === "struggling" && missesSoFar < 2;
  return { answer: miss ? wrongAnswer(step.activity) : config.correctAnswer };
}

export async function runSyntheticLesson(
  engine: OpenTopicEngine,
  params: { topic: string; level: number; profile: SyntheticProfile },
): Promise<SyntheticRun> {
  const topic = sanitizeTopic(params.topic);
  const base = { topic, level: params.level, profile: params.profile };

  const authored = findAuthoredLesson(topic);
  if (authored) {
    return {
      ...base,
      outcome: "authored_lesson_exists",
      detail: `An authored lesson covers this topic (${authored.lessonId}); no generation is used.`,
      state: null,
    };
  }

  const sources = findSources(topic);
  const opening = await engine.planOpening({
    topic,
    level: params.level,
    sources,
    allowedSimulations: allowedSimulations(topic),
    learnerEvidence: [],
  });
  if (opening.kind === "clarify") {
    return {
      ...base,
      outcome: "clarification_requested",
      detail: `${opening.question} [${opening.options.join(" | ")}]`,
      state: null,
    };
  }
  if (opening.kind === "out_of_scope") {
    return { ...base, outcome: "out_of_scope", detail: opening.reason, state: null };
  }
  if (opening.kind === "failed") {
    const f = opening.failure;
    return {
      ...base,
      outcome: "opening_failed",
      detail: f.kind === "provider" ? `provider: ${f.reason}` : `rejected: ${f.issues.join("; ")}`,
      state: null,
    };
  }

  let state = initialOpenState({
    topic,
    level: params.level,
    plan: opening,
    sources: sources.references,
    generator: engine.provider,
  });
  let misses = 0;

  for (let i = 0; i < 40; i++) {
    const advanced = await advanceOpenLesson(state, async () => engine);
    state = advanced.state;
    if (advanced.waiting) {
      return { ...base, outcome: "waiting_for_provider", detail: advanced.reason, state };
    }
    const step = currentOpenStep(state);
    if (!step) break;
    if (step.role === "closing") {
      return { ...base, outcome: "completed", detail: step.decision.rationale, state };
    }
    if (step.role === "pause") {
      return { ...base, outcome: "paused", detail: step.decision.rationale, state };
    }
    const response = syntheticAnswer(step, params.profile, misses);
    const outcome = gradeOpenStep(step, response);
    if (outcome.isCorrect === false) misses += 1;
    state = resolveOpenStep(state, response, outcome);
  }
  return {
    ...base,
    outcome: "step_limit",
    detail: "Run stopped by the simulation loop cap.",
    state,
  };
}

/** One line per step, for a transcript. Includes the answer key: developer output only. */
export function describeStep(step: OpenStep): string {
  const config = step.activity.config;
  const parts = [
    `${step.seq}. [${step.action} / ${step.role} / ${step.decision.origin}] ${step.activity.title}`,
  ];
  if (config.type === "intro") parts.push(`   Explanation: ${config.body}`);
  if (config.type === "predict_and_observe") {
    parts.push(`   Prediction: ${config.prompt}`);
    parts.push(`   Reveal: ${config.observationReveal.explanation}`);
  }
  if (config.type === "independent_check") {
    const choices = (config.choices ?? []).map((c) => `${c.id}) ${c.text}`).join("  ");
    parts.push(`   Question: ${config.prompt}${choices ? `  ${choices}` : ""}`);
    parts.push(
      `   Key: ${config.correctAnswer} (${step.verification ?? "n/a"}); recorded as ${
        step.role === "diagnostic"
          ? "diagnostic probe"
          : step.assistanceLevel === 0
            ? "unassisted practice"
            : "assisted practice"
      }`,
    );
  }
  if (config.type === "stopping_point") parts.push(`   ${config.headline}: ${config.body}`);
  if (step.decision.idealInteraction) {
    parts.push(`   Ideal interaction not available: ${step.decision.idealInteraction}`);
  }
  if (step.decision.origin === "generated")
    parts.push(`   Model rationale: ${step.decision.rationale}`);
  if (step.outcome && step.outcome.isCorrect !== undefined) {
    parts.push(
      `   Synthetic learner answered "${step.outcome.submittedAnswer}": ${
        step.outcome.isCorrect ? "correct" : "not yet"
      } (practice feedback, not evidence)`,
    );
  }
  return parts.join("\n");
}
