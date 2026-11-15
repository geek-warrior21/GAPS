import { z } from "zod";
import type {
  LessonTeachingAction as TeachingAction,
  TeachingDecisionInput,
  TeachingDecisionOutput,
} from "@gaps/contracts";
import {
  LessonActivitySchema,
  LessonTeachingActionSchema as TeachingActionSchema,
} from "@gaps/contracts";
import { getLlmProvider, isAiRuntimeEnabled, scrubPii } from "@gaps/ai";
import type { TeachingDecisionEngine } from "./types";
import { TeachingPolicyEngine } from "./policy";
import { AuthoredTeachingDecisionEngine } from "./authored-engine";
import { OBJECTIVE_SOURCE_PACKS } from "../lesson/planner-source-pack";
import { validateActivityFactualRules } from "../lesson/planner-validator";
import { log } from "../log";

const LlmTeachingDecisionSchema = z.object({
  chosenAction: TeachingActionSchema,
  rationale: z.string(),
  assessmentTarget: z.string(),
  activity: LessonActivitySchema,
});
type LlmTeachingDecisionPayload = z.infer<typeof LlmTeachingDecisionSchema>;

export class LlmTeachingDecisionEngine implements TeachingDecisionEngine {
  private authoredEngine = new AuthoredTeachingDecisionEngine();

  public async decideNextStep(input: TeachingDecisionInput): Promise<TeachingDecisionOutput> {
    const startTime = Date.now();

    // 1. Server Policy Evaluation (Authoritative Envelope)
    // Requirement 2: "The server decides which objectives and actions are eligible.
    // The LLM can select and configure an activity within those limits."
    const policyResult = TeachingPolicyEngine.evaluatePolicy(input);
    const eligibleActions = policyResult.eligibleActions;

    // 2. Fallback check: If AI runtime is disabled or provider is disabled
    if (!isAiRuntimeEnabled()) {
      const fallbackResult = await this.authoredEngine.decideNextStep(input);
      return {
        ...fallbackResult,
        audit: {
          source: "fallback",
          fallbackReason: "LLM_PROVIDER_DISABLED",
          unverifiedExplanatoryProse: false,
        },
      };
    }

    try {
      const provider = getLlmProvider();
      if (!provider || provider.name === "disabled") {
        const fallbackResult = await this.authoredEngine.decideNextStep(input);
        return {
          ...fallbackResult,
          audit: {
            source: "fallback",
            fallbackReason: "LLM_PROVIDER_DISABLED",
            unverifiedExplanatoryProse: false,
          },
        };
      }

      // 3. Prepare minimal, zero-PII prompt for model
      const sourcePack = OBJECTIVE_SOURCE_PACKS[input.objectiveId];
      const prompt = this.buildPrompt(input, eligibleActions, sourcePack);
      const safePrompt = scrubPii(prompt, []);

      // 4. Invoke LLM via type-safe structured generation
      const llmResponse = await provider.generate<LlmTeachingDecisionPayload>({
        purpose: "explain",
        system:
          "You are the Gaps adaptive mathematics and science teaching decision agent. You configure activities strictly within server-authorized policy boundaries.",
        input: safePrompt,
        schema: LlmTeachingDecisionSchema,
        maxOutputTokens: 900,
        timeoutMs: 6000,
      });

      const latencyMs = Date.now() - startTime;

      if (!llmResponse.ok) {
        log.warn("teaching.decision.provider_failure", {
          objectiveId: input.objectiveId,
          reason: llmResponse.reason,
        });

        const fallbackResult = await this.authoredEngine.decideNextStep(input);
        return {
          ...fallbackResult,
          audit: {
            source: "fallback",
            model: provider.name,
            latencyMs,
            fallbackReason: `PROVIDER_REJECTED: ${llmResponse.reason}`,
            unverifiedExplanatoryProse: false,
          },
        };
      }

      const parsed = llmResponse.value;

      // 5. Validate Decision Envelope & Activity against Server Policy and Domain Invariants
      const validation = this.validateLlmDecision(parsed, eligibleActions);

      if (!validation.isValid || !validation.chosenAction || !validation.activity) {
        log.warn("teaching.decision.validation_failed", {
          objectiveId: input.objectiveId,
          issues: validation.issues,
        });

        const fallbackResult = await this.authoredEngine.decideNextStep(input);
        return {
          ...fallbackResult,
          audit: {
            source: "fallback",
            model: provider.name,
            latencyMs,
            fallbackReason: `VALIDATION_FAILED: ${validation.issues.join("; ")}`,
            validationOutcome: {
              status: "rejected",
              schemaValid: validation.schemaValid,
              factualValid: validation.factualValid,
              pedagogicalMatch: validation.pedagogicalMatch,
              issues: validation.issues,
            },
            unverifiedExplanatoryProse: false,
          },
        };
      }

      // 6. Successful Validated LLM Decision
      // Clearly mark unverifiedExplanatoryProse: true for AI-generated prose
      return {
        action: validation.chosenAction,
        activity: validation.activity,
        evidence: {
          ...policyResult.evidence,
          rationale: `LLM-selected action [${validation.chosenAction}] within server envelope: ${parsed.rationale ?? policyResult.evidence.rationale}`,
        },
        assessmentTarget: parsed.assessmentTarget ?? policyResult.assessmentTarget,
        audit: {
          source: "llm_suggested",
          model: provider.name,
          latencyMs,
          validationOutcome: {
            status: "passed",
            schemaValid: true,
            factualValid: true,
            pedagogicalMatch: true,
            issues: [],
          },
          unverifiedExplanatoryProse: true, // Requirement 5: Clearly distinguish checked simulation/answer properties from unverified prose
        },
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      log.warn("teaching.decision.llm_exception", {
        objectiveId: input.objectiveId,
        error: err instanceof Error ? err.message : String(err),
      });

      const fallbackResult = await this.authoredEngine.decideNextStep(input);
      return {
        ...fallbackResult,
        audit: {
          source: "fallback",
          latencyMs,
          fallbackReason: `EXCEPTION: ${err instanceof Error ? err.message : "Unknown error"}`,
          unverifiedExplanatoryProse: false,
        },
      };
    }
  }

  private buildPrompt(
    input: TeachingDecisionInput,
    eligibleActions: TeachingAction[],
    sourcePack: unknown,
  ): string {
    const recent = input.recentAssessedResponses.slice(-3);
    return `You are an adaptive teaching engine for Class 6 ${input.subject}.
Objective: ${input.objectiveId}

SERVER POLICY ENVELOPE (STRICT MANDATORY CONSTRAINT):
The server learning policy has determined that ONLY the following actions are eligible for this step:
[ ${eligibleActions.join(", ")} ]
You CANNOT select any action outside this list. You cannot declare mastery or alter grading rules.

RECENT RESPONSES:
${JSON.stringify(recent, null, 2)}

PREVIOUSLY DELIVERED ACTIVITIES:
${JSON.stringify(
  input.previouslyDeliveredActivities.map((a) => a.title),
  null,
  2,
)}

SOURCE PACK & DOMAIN SPECIFICATIONS:
${JSON.stringify(sourcePack, null, 2)}

TASK:
1. Select exactly ONE action from the eligible list: [ ${eligibleActions.join(", ")} ].
2. Configure a complete, valid LessonActivity for that action.
3. State the assessmentTarget (what this step should establish).
4. State the rationale for this pedagogical choice.`;
  }

  private validateLlmDecision(
    parsed: LlmTeachingDecisionPayload,
    eligibleActions: TeachingAction[],
  ): {
    isValid: boolean;
    chosenAction?: TeachingAction;
    activity?: z.infer<typeof LessonActivitySchema>;
    schemaValid: boolean;
    factualValid: boolean;
    pedagogicalMatch: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    let schemaValid = false;
    let factualValid = false;
    let pedagogicalMatch = false;

    // 1. Check chosen action against server-authorized eligibleActions
    const chosenAction = parsed.chosenAction;
    if (!chosenAction || !eligibleActions.includes(chosenAction)) {
      issues.push(
        `Action "${chosenAction}" violates server policy envelope. Eligible actions: [${eligibleActions.join(", ")}]`,
      );
      return {
        isValid: false,
        schemaValid,
        factualValid,
        pedagogicalMatch,
        issues,
      };
    }
    pedagogicalMatch = true;

    // 2. Schema validation of activity
    const activityParse = LessonActivitySchema.safeParse(parsed.activity);
    if (!activityParse.success) {
      schemaValid = false;
      issues.push(
        `Activity schema invalid: ${activityParse.error.issues.map((i) => i.message).join(", ")}`,
      );
      return {
        isValid: false,
        schemaValid,
        factualValid,
        pedagogicalMatch,
        issues,
      };
    }
    schemaValid = true;

    // 3. Factual & Simulation Integrity Validation
    const act = activityParse.data;
    const factIssues = validateActivityFactualRules(act);
    if (factIssues.length > 0) {
      factualValid = false;
      issues.push(...factIssues);
      return {
        isValid: false,
        schemaValid,
        factualValid,
        pedagogicalMatch,
        issues,
      };
    }
    factualValid = true;

    return {
      isValid: true,
      chosenAction,
      activity: act,
      schemaValid,
      factualValid,
      pedagogicalMatch,
      issues: [],
    };
  }
}
