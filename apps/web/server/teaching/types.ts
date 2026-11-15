import type {
  LessonTeachingAction,
  TeachingAssessedResponse,
  DeliveredActivityRecord,
  TeachingDecisionEvidence,
  TeachingDecisionInput,
  TeachingDecisionOutput,
  TeachingDecisionTraceEntry,
  TeachingEngineTraceResponse,
  LessonActivity,
} from "@gaps/contracts";

export type TeachingAction = LessonTeachingAction;

export type {
  LessonTeachingAction,
  TeachingAssessedResponse,
  DeliveredActivityRecord,
  TeachingDecisionEvidence,
  TeachingDecisionInput,
  TeachingDecisionOutput,
  TeachingDecisionTraceEntry,
  TeachingEngineTraceResponse,
  LessonActivity,
};

export interface TeachingDecisionEngine {
  decideNextStep(input: TeachingDecisionInput): Promise<TeachingDecisionOutput>;
}
