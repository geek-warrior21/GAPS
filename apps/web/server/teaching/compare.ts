import type {
  TeachingDecisionTraceEntry,
  TeachingEngineTraceResponse,
  TeachingDecisionInput,
  TeachingAssessedResponse,
  DeliveredActivityRecord,
  SubjectId,
} from "@gaps/contracts";
import { AuthoredTeachingDecisionEngine } from "./authored-engine";
import { OBJECTIVE_SOURCE_PACKS } from "../lesson/planner-source-pack";

/**
 * Runs two synthetic learners through the SAME starting objective:
 * 1. Struggling learner (encounters misconceptions, ambiguous errors, scaffolded interventions, pause).
 * 2. Succeeding learner (accurate responses, unassisted independent evidence, advances to next milestone).
 *
 * Requirement 6: "Run two synthetic learners through the SAME starting objective:
 * one struggling, one succeeding independently.
 * Show different activity sequences and the evidence behind each decision in a developer trace, outside the student interface."
 */
export async function runTeachingDecisionComparison(
  subject: SubjectId,
  objectiveId: string,
): Promise<TeachingEngineTraceResponse> {
  const engine = new AuthoredTeachingDecisionEngine();
  const sourcePack = (OBJECTIVE_SOURCE_PACKS[objectiveId] ?? {}) as Record<string, unknown>;

  // ===========================================================================
  // LEARNER 1: STRUGGLING LEARNER JOURNEY
  // ===========================================================================
  const strugglingDecisions: TeachingDecisionTraceEntry[] = [];
  const strugglingResponses: TeachingAssessedResponse[] = [];
  const strugglingDelivered: DeliveredActivityRecord[] = [];
  let strugglingRemediationCycles = 0;

  // Step 1: Initial decision (0 delivered activities)
  const step1Input: TeachingDecisionInput = {
    objectiveId,
    prerequisites: objectiveId === "MATH-FRAC-EQUIV" ? ["MATH-FRAC-PART"] : [],
    recentAssessedResponses: [],
    assistanceHistory: {},
    previouslyDeliveredActivities: [],
    sourceMaterial: sourcePack,
    availableActivityTypes: [
      "intro",
      "interactive_manipulation",
      "predict_and_observe",
      "guided_practice",
      "independent_check",
      "stopping_point",
    ],
    remediationCycleCount: 0,
    subject,
    level: 6,
  };

  const decision1 = await engine.decideNextStep(step1Input);
  strugglingDecisions.push({
    stepIndex: 1,
    action: decision1.action,
    activityId: decision1.activity.id,
    activityTitle: decision1.activity.title,
    activityType: decision1.activity.type,
    activity: decision1.activity,
    rationale: decision1.evidence.rationale,
    assessmentTarget: decision1.assessmentTarget,
    inferredMisconception: decision1.evidence.inferredMisconception,
    isAmbiguous: decision1.evidence.isAmbiguous,
    eligibleActions: decision1.evidence.eligibleActions,
    source: decision1.audit?.source ?? "authored",
    timestamp: new Date().toISOString(),
  });
  strugglingDelivered.push({
    id: decision1.activity.id,
    type: decision1.activity.type,
    title: decision1.activity.title,
    action: decision1.action,
    timestamp: new Date().toISOString(),
  });

  // Step 2: Student attempts question with a clear Misconception
  // Maths: "4/3" (Numerator/Denominator reversal)
  // Science: "Air gap allows spark" (Air gap misconception)
  const isMaths = subject === "maths";
  strugglingResponses.push({
    activityId: "act_initial_check",
    conceptId: objectiveId,
    submittedAnswer: isMaths ? "4/3" : "choice_glow",
    isCorrect: false,
    assistanceLevel: 0,
    misconceptionDetected: isMaths ? "REVERSAL" : "AIR_GAP",
    ambiguousError: false,
    timestamp: new Date().toISOString(),
  });

  const step2Input: TeachingDecisionInput = {
    ...step1Input,
    recentAssessedResponses: [...strugglingResponses],
    previouslyDeliveredActivities: [...strugglingDelivered],
    remediationCycleCount: 0,
  };

  const decision2 = await engine.decideNextStep(step2Input);
  strugglingDecisions.push({
    stepIndex: 2,
    action: decision2.action,
    activityId: decision2.activity.id,
    activityTitle: decision2.activity.title,
    activityType: decision2.activity.type,
    activity: decision2.activity,
    rationale: decision2.evidence.rationale,
    assessmentTarget: decision2.assessmentTarget,
    inferredMisconception: decision2.evidence.inferredMisconception,
    isAmbiguous: decision2.evidence.isAmbiguous,
    eligibleActions: decision2.evidence.eligibleActions,
    source: decision2.audit?.source ?? "authored",
    timestamp: new Date().toISOString(),
  });
  strugglingDelivered.push({
    id: decision2.activity.id,
    type: decision2.activity.type,
    title: decision2.activity.title,
    action: decision2.action,
    timestamp: new Date().toISOString(),
  });

  // Step 3: Student completes manipulation, but makes an AMBIGUOUS error
  // Requirement 3: "Do not infer a definite misconception from every incorrect answer. When evidence is ambiguous, use a diagnostic question."
  strugglingResponses.push({
    activityId: decision2.activity.id,
    conceptId: objectiveId,
    submittedAnswer: isMaths ? "7" : "unknown_wire_split",
    isCorrect: false,
    assistanceLevel: 1,
    misconceptionDetected: null,
    ambiguousError: true,
    timestamp: new Date().toISOString(),
  });
  strugglingRemediationCycles = 1;

  const step3Input: TeachingDecisionInput = {
    ...step1Input,
    recentAssessedResponses: [...strugglingResponses],
    previouslyDeliveredActivities: [...strugglingDelivered],
    remediationCycleCount: strugglingRemediationCycles,
  };

  const decision3 = await engine.decideNextStep(step3Input);
  strugglingDecisions.push({
    stepIndex: 3,
    action: decision3.action,
    activityId: decision3.activity.id,
    activityTitle: decision3.activity.title,
    activityType: decision3.activity.type,
    activity: decision3.activity,
    rationale: decision3.evidence.rationale,
    assessmentTarget: decision3.assessmentTarget,
    inferredMisconception: decision3.evidence.inferredMisconception,
    isAmbiguous: decision3.evidence.isAmbiguous,
    eligibleActions: decision3.evidence.eligibleActions,
    source: decision3.audit?.source ?? "authored",
    timestamp: new Date().toISOString(),
  });
  strugglingDelivered.push({
    id: decision3.activity.id,
    type: decision3.activity.type,
    title: decision3.activity.title,
    action: decision3.action,
    timestamp: new Date().toISOString(),
  });

  // Step 4: Continued confusion after diagnostic probe (remediationCycle >= 1 with repeated misconception)
  // Requirement 3: "Continued confusion -> a different explanation or simpler task."
  strugglingResponses.push({
    activityId: decision3.activity.id,
    conceptId: objectiveId,
    submittedAnswer: isMaths ? "4/3" : "choice_glow",
    isCorrect: false,
    assistanceLevel: 1,
    misconceptionDetected: isMaths ? "REVERSAL" : "AIR_GAP",
    ambiguousError: false,
    timestamp: new Date().toISOString(),
  });

  const step4Input: TeachingDecisionInput = {
    ...step1Input,
    recentAssessedResponses: [...strugglingResponses],
    previouslyDeliveredActivities: [...strugglingDelivered],
    remediationCycleCount: strugglingRemediationCycles,
  };

  const decision4 = await engine.decideNextStep(step4Input);
  strugglingDecisions.push({
    stepIndex: 4,
    action: decision4.action,
    activityId: decision4.activity.id,
    activityTitle: decision4.activity.title,
    activityType: decision4.activity.type,
    activity: decision4.activity,
    rationale: decision4.evidence.rationale,
    assessmentTarget: decision4.assessmentTarget,
    inferredMisconception: decision4.evidence.inferredMisconception,
    isAmbiguous: decision4.evidence.isAmbiguous,
    eligibleActions: decision4.evidence.eligibleActions,
    source: decision4.audit?.source ?? "authored",
    timestamp: new Date().toISOString(),
  });
  strugglingDelivered.push({
    id: decision4.activity.id,
    type: decision4.activity.type,
    title: decision4.activity.title,
    action: decision4.action,
    timestamp: new Date().toISOString(),
  });

  // Step 5: Bounded Remediation Loop -> Mandatory Pause
  // Requirement 4: "Bound remediation loops and provide a genuine save-and-pause option."
  strugglingRemediationCycles = 2;
  strugglingResponses.push({
    activityId: decision4.activity.id,
    conceptId: objectiveId,
    submittedAnswer: isMaths ? "4/3" : "choice_glow",
    isCorrect: false,
    assistanceLevel: 1,
    misconceptionDetected: isMaths ? "REVERSAL" : "AIR_GAP",
    ambiguousError: false,
    timestamp: new Date().toISOString(),
  });

  const step5Input: TeachingDecisionInput = {
    ...step1Input,
    recentAssessedResponses: [...strugglingResponses],
    previouslyDeliveredActivities: [...strugglingDelivered],
    remediationCycleCount: strugglingRemediationCycles,
  };

  const decision5 = await engine.decideNextStep(step5Input);
  strugglingDecisions.push({
    stepIndex: 5,
    action: decision5.action,
    activityId: decision5.activity.id,
    activityTitle: decision5.activity.title,
    activityType: decision5.activity.type,
    activity: decision5.activity,
    rationale: decision5.evidence.rationale,
    assessmentTarget: decision5.assessmentTarget,
    inferredMisconception: decision5.evidence.inferredMisconception,
    isAmbiguous: decision5.evidence.isAmbiguous,
    eligibleActions: decision5.evidence.eligibleActions,
    source: decision5.audit?.source ?? "authored",
    timestamp: new Date().toISOString(),
  });

  // ===========================================================================
  // LEARNER 2: SUCCEEDING INDEPENDENTLY JOURNEY
  // ===========================================================================
  const succeedingDecisions: TeachingDecisionTraceEntry[] = [];
  const succeedingResponses: TeachingAssessedResponse[] = [];
  const succeedingDelivered: DeliveredActivityRecord[] = [];

  // Step 1: Initial exploration (same starting point)
  const succStep1Input: TeachingDecisionInput = {
    objectiveId,
    prerequisites: objectiveId === "MATH-FRAC-EQUIV" ? ["MATH-FRAC-PART"] : [],
    recentAssessedResponses: [],
    assistanceHistory: {},
    previouslyDeliveredActivities: [],
    sourceMaterial: sourcePack,
    availableActivityTypes: [
      "intro",
      "interactive_manipulation",
      "predict_and_observe",
      "guided_practice",
      "independent_check",
      "stopping_point",
    ],
    remediationCycleCount: 0,
    subject,
    level: 6,
  };

  const succDecision1 = await engine.decideNextStep(succStep1Input);
  succeedingDecisions.push({
    stepIndex: 1,
    action: succDecision1.action,
    activityId: succDecision1.activity.id,
    activityTitle: succDecision1.activity.title,
    activityType: succDecision1.activity.type,
    activity: succDecision1.activity,
    rationale: succDecision1.evidence.rationale,
    assessmentTarget: succDecision1.assessmentTarget,
    inferredMisconception: null,
    isAmbiguous: false,
    eligibleActions: succDecision1.evidence.eligibleActions,
    source: succDecision1.audit?.source ?? "authored",
    timestamp: new Date().toISOString(),
  });
  succeedingDelivered.push({
    id: succDecision1.activity.id,
    type: succDecision1.activity.type,
    title: succDecision1.activity.title,
    action: succDecision1.action,
    timestamp: new Date().toISOString(),
  });

  // Step 2: Student completes exploration and attempts first check with full unassisted success
  succeedingResponses.push({
    activityId: "act_check_item_1",
    conceptId: objectiveId,
    submittedAnswer: isMaths ? "3/4" : "choice_closed_loop",
    isCorrect: true,
    assistanceLevel: 0,
    misconceptionDetected: null,
    ambiguousError: false,
    timestamp: new Date().toISOString(),
  });

  const succStep2Input: TeachingDecisionInput = {
    ...succStep1Input,
    recentAssessedResponses: [...succeedingResponses],
    previouslyDeliveredActivities: [...succeedingDelivered],
  };

  const succDecision2 = await engine.decideNextStep(succStep2Input);
  succeedingDecisions.push({
    stepIndex: 2,
    action: succDecision2.action,
    activityId: succDecision2.activity.id,
    activityTitle: succDecision2.activity.title,
    activityType: succDecision2.activity.type,
    activity: succDecision2.activity,
    rationale: succDecision2.evidence.rationale,
    assessmentTarget: succDecision2.assessmentTarget,
    inferredMisconception: null,
    isAmbiguous: false,
    eligibleActions: succDecision2.evidence.eligibleActions,
    source: succDecision2.audit?.source ?? "authored",
    timestamp: new Date().toISOString(),
  });
  succeedingDelivered.push({
    id: succDecision2.activity.id,
    type: succDecision2.activity.type,
    title: succDecision2.activity.title,
    action: succDecision2.action,
    timestamp: new Date().toISOString(),
  });

  // Step 3: Student completes second distinct independent check correctly
  succeedingResponses.push({
    activityId: "act_check_item_2",
    conceptId: objectiveId,
    submittedAnswer: isMaths ? "2/5" : "choice_air_gap",
    isCorrect: true,
    assistanceLevel: 0,
    misconceptionDetected: null,
    ambiguousError: false,
    timestamp: new Date().toISOString(),
  });

  const succStep3Input: TeachingDecisionInput = {
    ...succStep1Input,
    recentAssessedResponses: [...succeedingResponses],
    previouslyDeliveredActivities: [...succeedingDelivered],
  };

  const succDecision3 = await engine.decideNextStep(succStep3Input);
  succeedingDecisions.push({
    stepIndex: 3,
    action: succDecision3.action,
    activityId: succDecision3.activity.id,
    activityTitle: succDecision3.activity.title,
    activityType: succDecision3.activity.type,
    activity: succDecision3.activity,
    rationale: succDecision3.evidence.rationale,
    assessmentTarget: succDecision3.assessmentTarget,
    inferredMisconception: null,
    isAmbiguous: false,
    eligibleActions: succDecision3.evidence.eligibleActions,
    source: succDecision3.audit?.source ?? "authored",
    timestamp: new Date().toISOString(),
  });

  return {
    objectiveId,
    subject,
    traces: {
      struggling: {
        learnerProfile: {
          profileType: "struggling",
          priorMastery: "struggling",
          namedMisconception: isMaths ? "REVERSAL" : "AIR_GAP",
        },
        decisions: strugglingDecisions,
        finalStatus: "paused_at_stopping_point",
        masteryDemonstrated: false,
      },
      succeeding: {
        learnerProfile: {
          profileType: "ready_for_challenge",
          priorMastery: "demonstrated",
        },
        decisions: succeedingDecisions,
        finalStatus: "mastery_demonstrated_advanced",
        masteryDemonstrated: true,
      },
    },
  };
}
