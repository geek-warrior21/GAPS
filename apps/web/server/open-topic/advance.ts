import type { LessonContentStatus, SourceReference } from "@gaps/contracts";
import type { OpenTopicEngine, OpeningResult } from "./engine";
import {
  OPEN_TOPIC_VERSION,
  type OpenTopicState,
  appendGeneratedStep,
  appendServerStep,
  evaluateOpenPolicy,
  takeQueuedStep,
} from "./machine";
import { allowedSimulations, findSources, topicSlug } from "./topics";

export type AdvanceOutcome =
  | { state: OpenTopicState; waiting: false }
  /** No step could be prepared. `reason` is for logs, never for learners. */
  | { state: OpenTopicState; waiting: true; reason: string };

/**
 * Produces the next step of an open-topic lesson, shared by persisted student
 * sessions and synthetic-learner runs. A provider problem never throws: the
 * state comes back marked as waiting, with everything so far intact.
 *
 * `getEngine` is asked only when a model call is really needed, so permission
 * is checked at that moment and not before.
 */
export async function advanceOpenLesson(
  state: OpenTopicState,
  getEngine: () => Promise<OpenTopicEngine | { denied: string }>,
): Promise<AdvanceOutcome> {
  const decision = evaluateOpenPolicy(state);
  if (decision.kind === "pause") {
    return { state: appendServerStep(state, "pause", decision.rationale), waiting: false };
  }
  if (decision.kind === "close") {
    return { state: appendServerStep(state, "closing", decision.rationale), waiting: false };
  }

  const queued = takeQueuedStep(state, decision);
  if (queued) {
    return { state: appendGeneratedStep(queued.state, queued.accepted, decision), waiting: false };
  }

  // Off the opening plan: the rest of it is dropped and the model chooses the
  // next step from what the learner just did.
  const cleared: OpenTopicState = { ...state, queue: [] };
  const engine = await getEngine();
  if ("denied" in engine) {
    return {
      state: { ...cleared, awaitingNextStep: true },
      waiting: true,
      reason: `denied:${engine.denied}`,
    };
  }
  const result = await engine.nextStep(
    cleared,
    decision,
    findSources(cleared.topicText),
    allowedSimulations(cleared.topicText),
  );
  if (!result.ok) {
    const failure = result.failure;
    return {
      state: { ...cleared, awaitingNextStep: true },
      waiting: true,
      reason:
        failure.kind === "provider"
          ? `provider:${failure.reason}`
          : `rejected:${failure.issues.map((i) => i.split(":")[0]).join(",")}`,
    };
  }
  return { state: appendGeneratedStep(cleared, result.step, decision), waiting: false };
}

/** Content status of a generated lesson. Supplied sources mean grounded, never reviewed. */
export function generatedContentStatus(sources: readonly SourceReference[]): LessonContentStatus {
  return {
    basis: sources.length > 0 ? "source_grounded" : "model_knowledge",
    generatedPreview: true,
    practiceOnly: true,
    sources: [...sources],
  };
}

/** Lesson state straight after an accepted opening plan, before any step is delivered. */
export function initialOpenState(params: {
  topic: string;
  level: number;
  plan: Extract<OpeningResult, { kind: "plan" }>;
  sources: readonly SourceReference[];
  generator: { provider: string; model: string };
}): OpenTopicState {
  return {
    version: OPEN_TOPIC_VERSION,
    topicText: params.topic,
    level: params.level,
    title: params.plan.title,
    subject: params.plan.subject,
    learningGoal: params.plan.learningGoal,
    slug: topicSlug(params.plan.title),
    // Proposed by the model. Not verified curriculum relationships.
    modelProposed: {
      prerequisites: params.plan.proposedPrerequisites,
      misconceptions: params.plan.suspectedMisconceptions,
    },
    contentStatus: generatedContentStatus(params.sources),
    generator: params.generator,
    steps: [],
    queue: params.plan.opening,
    remediationCycles: 0,
    round: 1,
    stoppingPointSaved: false,
    awaitingNextStep: false,
  };
}
