import type {
  ObjectiveBeliefStatus,
  SubjectId,
  TeachingEngineTraceResponse,
} from "@gaps/contracts";
import { type CheckedAttempt, type ConceptId, replayTransitions } from "@gaps/domain";
import type { TeachingDecisionEngine } from "./types";
import { getBankItem, hasItemBank, type BankItem } from "./item-bank";
import {
  type AdaptiveLessonState,
  type DeliveredStep,
  appendStep,
  createAdaptiveLessonState,
  decideNextStep,
  gradeStepResponse,
  resolveCurrentStep,
  toTraceEntry,
} from "./sequencer";

/**
 * Runs two synthetic learners through the SAME starting objective:
 * 1. Struggling learner (misconception, ambiguous error, scaffolded interventions, pause).
 * 2. Succeeding learner (accurate unassisted responses until the objective is demonstrated).
 *
 * Requirement 6: "Run two synthetic learners through the SAME starting objective:
 * one struggling, one succeeding independently. Show different activity sequences
 * and the evidence behind each decision in a developer trace, outside the student interface."
 *
 * The learners are driven through the same sequencer that persisted student
 * sessions use, and their objective status comes from the real belief reducer
 * replayed over their synthetic attempts. Nothing is written to the database.
 */

export class UnsupportedObjectiveError extends Error {
  constructor(objectiveId: string) {
    super(`No authored item bank exists for objective ${objectiveId}.`);
    this.name = "UnsupportedObjectiveError";
  }
}

type AnswerScript = (step: DeliveredStep, item: BankItem, checkNumber: number) => string;

const MAX_STEPS = 30;

function firstChoice(item: BankItem, predicate: (c: BankItem["choices"][number]) => boolean) {
  return item.choices.find(predicate)?.id;
}

function anyWrongChoice(item: BankItem): string {
  return firstChoice(item, (c) => c.id !== item.correctChoiceId) ?? item.correctChoiceId;
}

/** First check: the named misconception. Second: an unclassified error. Then: any error. */
function strugglingScript(namedMisconception: string): AnswerScript {
  return (step, item, checkNumber) => {
    if (step.role === "diagnostic") return anyWrongChoice(item);
    if (checkNumber === 1) {
      return (
        firstChoice(item, (c) => c.misconception === namedMisconception) ?? anyWrongChoice(item)
      );
    }
    if (checkNumber === 2) {
      return (
        firstChoice(item, (c) => c.id !== item.correctChoiceId && !c.misconception) ??
        anyWrongChoice(item)
      );
    }
    return anyWrongChoice(item);
  };
}

const succeedingScript: AnswerScript = (_step, item) => item.correctChoiceId;

function teachingResponse(step: DeliveredStep): unknown {
  const config = step.activity.config;
  if (config.type === "guided_practice") return { value: config.targetCriteria.expectedValue };
  if (config.type === "predict_and_observe") {
    return { choiceId: config.predictionChoices.find((c) => c.isExpected)?.id ?? "" };
  }
  return { acknowledged: true };
}

async function runSyntheticLearner(
  objectiveId: string,
  subject: SubjectId,
  script: AnswerScript,
  engine?: TeachingDecisionEngine,
): Promise<{ state: AdaptiveLessonState; status: ObjectiveBeliefStatus }> {
  let state = createAdaptiveLessonState({ objectiveId, subject, level: 6 });
  const attempts: CheckedAttempt[] = [];
  let status: ObjectiveBeliefStatus = "not_assessed";
  let checkNumber = 0;
  // Synthetic attempts are spaced one minute apart so replay order is exact.
  const clock = Date.parse("2026-01-05T04:30:00.000Z");

  while (state.steps.length < MAX_STEPS) {
    const step = await decideNextStep(state, status, engine);
    state = appendStep(state, step);
    if (step.role === "pause" || step.role === "advance") break;

    let response: unknown = teachingResponse(step);
    if (step.role === "assessment" || step.role === "diagnostic") {
      const item = step.itemId ? getBankItem(step.itemId) : undefined;
      if (!item) throw new UnsupportedObjectiveError(objectiveId);
      if (step.role === "assessment") checkNumber += 1;
      response = { answer: script(step, item, checkNumber) };
    }

    const outcome = gradeStepResponse(step, response);
    state = resolveCurrentStep(state, response, outcome);

    if (step.role === "assessment" && step.itemId) {
      const item = getBankItem(step.itemId)!;
      attempts.push({
        attemptId: `att_synthetic_${String(attempts.length + 1).padStart(3, "0")}`,
        studentId: "stu_synthetic",
        sessionId: "ses_synthetic",
        clientAttemptId: `synthetic_${step.seq}`,
        itemInstanceId: item.itemId,
        templateId: item.templateId,
        conceptId: objectiveId as ConceptId,
        // Stored lesson attempts carry mode "lesson"; mirrored here for the replay.
        mode: "lesson" as CheckedAttempt["mode"],
        outcome: outcome.isCorrect ? "correct" : "incorrect",
        assistance: step.assistanceLevel,
        tryNo: 1,
        isReview: false,
        verifierVersion: "verify-1.0",
        at: new Date(clock + attempts.length * 60_000).toISOString(),
      });
      // Same reducer and context as recordLessonAssessment uses for real attempts.
      status = replayTransitions(objectiveId as ConceptId, attempts, { templatesForConcept: 2 })
        .state.status;
    }
  }

  return { state, status };
}

function finalStatusOf(state: AdaptiveLessonState): string {
  const last = state.steps[state.steps.length - 1];
  if (last?.role === "advance") return "mastery_demonstrated_advanced";
  if (last?.role === "pause") {
    return last.decision.lessonStage === "consolidating"
      ? "lesson_closed_without_advancing"
      : "paused_at_stopping_point";
  }
  return "in_progress";
}

export async function runTeachingDecisionComparison(
  subject: SubjectId,
  objectiveId: string,
  engine?: TeachingDecisionEngine,
): Promise<TeachingEngineTraceResponse> {
  if (!hasItemBank(objectiveId)) {
    throw new UnsupportedObjectiveError(objectiveId);
  }

  const namedMisconception = subject === "maths" ? "REVERSAL" : "AIR_GAP";
  const struggling = await runSyntheticLearner(
    objectiveId,
    subject,
    strugglingScript(namedMisconception),
    engine,
  );
  const succeeding = await runSyntheticLearner(objectiveId, subject, succeedingScript, engine);

  const isDemonstrated = (status: ObjectiveBeliefStatus) =>
    status === "demonstrated" || status === "retained";

  return {
    objectiveId,
    subject,
    traces: {
      struggling: {
        learnerProfile: {
          profileType: "struggling",
          priorMastery: "not_started",
          namedMisconception,
          notes: `Final belief status from the belief reducer: ${struggling.status}.`,
        },
        decisions: struggling.state.steps.map(toTraceEntry),
        finalStatus: finalStatusOf(struggling.state),
        masteryDemonstrated: isDemonstrated(struggling.status),
      },
      succeeding: {
        learnerProfile: {
          profileType: "ready_for_challenge",
          priorMastery: "not_started",
          notes: `Final belief status from the belief reducer: ${succeeding.status}.`,
        },
        decisions: succeeding.state.steps.map(toTraceEntry),
        finalStatus: finalStatusOf(succeeding.state),
        masteryDemonstrated: isDemonstrated(succeeding.status),
      },
    },
  };
}
