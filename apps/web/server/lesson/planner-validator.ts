import {
  type LessonPlan,
  LessonPlanSchema,
  type LessonPlanValidationOutcome,
  type SyntheticLearnerProfile,
  type LessonActivity,
} from "@gaps/contracts";

export interface ValidationDetails {
  outcome: LessonPlanValidationOutcome;
  validatedPlan?: LessonPlan;
}

export function validateActivityFactualRules(act: LessonActivity): string[] {
  const issues: string[] = [];

  // Validate Simulation Parameters
  if (act.type === "interactive_manipulation") {
    const cfg = act.config as { simulation?: { simulationKind: string; [key: string]: unknown } };
    if (!cfg.simulation) {
      issues.push(
        `Factual Error in activity "${act.id}": interactive_manipulation must define a valid simulation.`,
      );
    } else if (cfg.simulation.simulationKind === "fraction_strip") {
      const parts = Number(cfg.simulation.initialParts);
      const shaded = Number(cfg.simulation.initialShaded);
      const minP = Number(cfg.simulation.minParts ?? 1);
      const maxP = Number(cfg.simulation.maxParts ?? 12);

      if (parts < 1 || parts > 12) {
        issues.push(
          `Factual Error in activity "${act.id}": fraction_strip initialParts must be between 1 and 12 (got ${parts}).`,
        );
      }
      if (shaded < 0 || shaded > parts) {
        issues.push(
          `Factual Error in activity "${act.id}": fraction_strip initialShaded (${shaded}) cannot exceed parts (${parts}).`,
        );
      }
      if (parts < minP || parts > maxP) {
        issues.push(
          `Factual Error in activity "${act.id}": initialParts (${parts}) outside allowed range [${minP}, ${maxP}].`,
        );
      }
    } else if (cfg.simulation.simulationKind === "circuit_loop") {
      const sw = cfg.simulation.initialSwitchState;
      const obj = cfg.simulation.conductiveObject;
      if (sw !== "open" && sw !== "closed") {
        issues.push(
          `Factual Error in activity "${act.id}": circuit initialSwitchState must be "open" or "closed" (got "${String(sw)}").`,
        );
      }
      if (obj !== "none" && obj !== "copper_key" && obj !== "rubber_eraser") {
        issues.push(
          `Factual Error in activity "${act.id}": circuit conductiveObject must be "none", "copper_key", or "rubber_eraser" (got "${String(obj)}").`,
        );
      }
    }
  }

  // Validate Predict and Observe Configuration
  if (act.type === "predict_and_observe") {
    const cfg = act.config as {
      predictionChoices?: Array<{ id: string; text: string; isExpected?: boolean }>;
      observationReveal?: { expectedObservation: string; explanation: string };
    };

    if (!cfg.predictionChoices || cfg.predictionChoices.length < 2) {
      issues.push(
        `Factual Error in activity "${act.id}": predict_and_observe must provide at least 2 prediction choices.`,
      );
    } else {
      const expectedCount = cfg.predictionChoices.filter((c) => c.isExpected).length;
      if (expectedCount !== 1) {
        issues.push(
          `Factual Error in activity "${act.id}": predict_and_observe must have exactly 1 choice with isExpected=true (found ${expectedCount}).`,
        );
      }
    }

    if (!cfg.observationReveal?.expectedObservation || !cfg.observationReveal?.explanation) {
      issues.push(
        `Factual Error in activity "${act.id}": predict_and_observe must supply both expectedObservation and explanation.`,
      );
    }
  }

  // Validate Guided Practice Configuration
  if (act.type === "guided_practice") {
    const cfg = act.config as {
      targetCriteria?: { property: string; expectedValue: string };
      successFeedback?: string;
      retryFeedback?: string;
    };
    if (!cfg.targetCriteria?.property || !cfg.targetCriteria?.expectedValue) {
      issues.push(
        `Factual Error in activity "${act.id}": guided_practice must define valid targetCriteria property and expectedValue.`,
      );
    }
    if (!cfg.successFeedback || !cfg.retryFeedback) {
      issues.push(
        `Factual Error in activity "${act.id}": guided_practice must define both successFeedback and retryFeedback.`,
      );
    }
  }

  // Validate Independent Check Configuration
  if (act.type === "independent_check") {
    const cfg = act.config as {
      prompt?: string;
      questionType?: string;
      choices?: Array<{ id: string; text: string }>;
      correctAnswer?: string;
      explanation?: string;
    };

    if (!cfg.prompt || cfg.prompt.trim().length === 0) {
      issues.push(
        `Factual Error in activity "${act.id}": independent_check must have a non-empty prompt.`,
      );
    }

    if (cfg.questionType === "choice") {
      if (!cfg.choices || cfg.choices.length < 2) {
        issues.push(
          `Factual Error in activity "${act.id}": choice-based check must have at least 2 choices.`,
        );
      } else {
        const choiceIds = new Set(cfg.choices.map((c) => c.id));
        if (!cfg.correctAnswer || !choiceIds.has(cfg.correctAnswer)) {
          issues.push(
            `Factual Error in activity "${act.id}": correctAnswer "${cfg.correctAnswer}" does not match any choice ID in [${Array.from(choiceIds).join(", ")}].`,
          );
        }
      }
    }

    if (!cfg.explanation || cfg.explanation.trim().length < 10) {
      issues.push(
        `Factual Error in activity "${act.id}": independent_check must include a substantive explanation.`,
      );
    }
  }

  return issues;
}

export function validateLessonPlan(
  rawInput: unknown,
  expectedObjectiveId?: string,
  learnerProfile?: SyntheticLearnerProfile,
): ValidationDetails {
  const issues: string[] = [];
  let schemaValid = false;
  let factualValid = false;
  let pedagogicalMatch = true;

  // 1. Stage 1: Structural Schema Validation (Zod)
  const parseResult = LessonPlanSchema.safeParse(rawInput);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      issues.push(`Schema Error [${issue.path.join(".")}]: ${issue.message}`);
    }
    return {
      outcome: {
        schemaValid: false,
        factualValid: false,
        pedagogicalMatch: false,
        issues,
        status: "rejected",
      },
    };
  }

  schemaValid = true;
  const plan = parseResult.data;

  // 2. Stage 2: Factual, Semantic & Simulation Parameter Validation
  // (Schema validation alone is not factual validation)
  const activityIds = new Set<string>();

  if (plan.activities.length < 2) {
    issues.push(
      "Factual Error: Lesson must contain at least 2 distinct activities for learning progression.",
    );
  }

  for (let i = 0; i < plan.activities.length; i++) {
    const act = plan.activities[i]!;

    // Check unique activity IDs
    if (activityIds.has(act.id)) {
      issues.push(`Factual Error: Duplicate activity ID "${act.id}" found in lesson activities.`);
    }
    activityIds.add(act.id);

    const actIssues = validateActivityFactualRules(act);
    issues.push(...actIssues);
  }

  // Objective Match Check
  if (expectedObjectiveId && plan.topicId) {
    const normExpected = expectedObjectiveId.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normActual = plan.topicId.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!normActual.includes(normExpected) && !normExpected.includes(normActual)) {
      // Allow related topic mapping (e.g. sci-elec-circuits vs SCI-ELEC-CIRCUITS)
      issues.push(
        `Objective Mismatch: Lesson topic "${plan.topicId}" does not match requested objective "${expectedObjectiveId}".`,
      );
    }
  }

  // 3. Stage 3: Pedagogical Alignment Check
  if (learnerProfile) {
    if (learnerProfile.profileType === "struggling") {
      // Must contain targeted remediation or scaffolded guided practice
      const hasRemediation = plan.activities.some(
        (a) =>
          Boolean(a.remediation) || a.type === "guided_practice" || a.type === "stopping_point",
      );
      if (!hasRemediation) {
        pedagogicalMatch = false;
        issues.push(
          "Pedagogical Alignment Warning: Learner profile is struggling, but lesson lacks an adaptive remediation branch or guided scaffolding.",
        );
      }
    } else if (learnerProfile.profileType === "ready_for_challenge") {
      // Should feature challenge practice or multiple check evaluations without basic remediation
      const checkCount = plan.activities.filter(
        (a) => a.type === "independent_check" || a.type === "guided_practice",
      ).length;
      if (checkCount < 2) {
        pedagogicalMatch = false;
        issues.push(
          "Pedagogical Alignment Warning: Learner profile is ready for a challenge, but lesson does not provide multiple challenge/check opportunities.",
        );
      }
    } else if (learnerProfile.profileType === "new_learner") {
      // Must start with conceptual intro before jumping to evaluative checks
      const firstIsIntro =
        plan.activities[0]?.type === "intro" ||
        plan.activities[0]?.type === "interactive_manipulation";
      if (!firstIsIntro) {
        pedagogicalMatch = false;
        issues.push(
          "Pedagogical Alignment Warning: New learner profile requires conceptual introduction/exploration before evaluation.",
        );
      }
    }
  }

  // Determine Overall Status
  factualValid =
    issues.filter((i) => i.startsWith("Factual Error") || i.startsWith("Objective Mismatch"))
      .length === 0;
  const status = schemaValid && factualValid ? "passed" : "rejected";

  return {
    outcome: {
      schemaValid,
      factualValid,
      pedagogicalMatch,
      issues,
      status,
    },
    validatedPlan: status === "passed" ? plan : undefined,
  };
}
