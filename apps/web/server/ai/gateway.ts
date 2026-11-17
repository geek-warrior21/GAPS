import {
  type DbClient,
  cohorts,
  consentRecords,
  events,
  featureFlags,
  llmCalls,
  users,
  and,
  eq,
  gte,
  isNull,
  sql,
} from "@gaps/db";
import {
  type GenerateRequest,
  type GenerateResult,
  type LLMProvider,
  getLlmProvider,
  isAiRuntimeEnabled,
  readAiEnv,
} from "@gaps/ai";
import { generateDomainId } from "../session/engine";
import { log } from "../log";

/**
 * Permission and accounting for model calls made on behalf of a student
 * (SPEC §21, Non-negotiable 6). A call is allowed only when ALL of these hold:
 * the AI runtime is on (provider configured, AI_ZDR_CONFIRMED), the global kill
 * switch is off, the student's class has AI enabled, the student has the
 * ai_free_text consent scope, and the student's daily call budget is not spent.
 */

export type AiDenialReason =
  "runtime_disabled" | "kill_switch" | "class_not_enabled" | "no_consent" | "daily_limit";

export type AiPermission = { allowed: true } | { allowed: false; reason: AiDenialReason };

const MODEL_CALL_EVENT = "ai_model_call";

/** Start of today in Asia/Kolkata, as a UTC instant. */
function startOfTodayIst(now: Date): Date {
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + offsetMs);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - offsetMs);
}

export async function countModelCallsToday(
  studentId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.studentId, studentId),
        eq(events.type, MODEL_CALL_EVENT),
        gte(events.createdAt, startOfTodayIst(now)),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Reads the controls fresh from the database on every check, so a revoked
 * consent, a class switched off or the kill switch takes effect immediately,
 * including in the middle of a lesson.
 */
export async function checkStudentAiPermission(
  studentId: string,
  db: DbClient,
  env: Record<string, string | undefined> = process.env,
): Promise<AiPermission> {
  if (!isAiRuntimeEnabled(env)) return { allowed: false, reason: "runtime_disabled" };

  const [killSwitch] = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.key, "llm_kill_switch"))
    .limit(1);
  if ((killSwitch?.value as { enabled?: unknown } | undefined)?.enabled === true) {
    return { allowed: false, reason: "kill_switch" };
  }

  const [student] = await db
    .select({ role: users.role, cohortId: users.cohortId })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  if (!student || student.role !== "student" || !student.cohortId) {
    return { allowed: false, reason: "class_not_enabled" };
  }
  const [cohort] = await db
    .select({ aiEnabled: cohorts.aiEnabled })
    .from(cohorts)
    .where(eq(cohorts.id, student.cohortId))
    .limit(1);
  if (!cohort?.aiEnabled) return { allowed: false, reason: "class_not_enabled" };

  const [consent] = await db
    .select({ id: consentRecords.id })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.studentId, studentId),
        eq(consentRecords.scope, "ai_free_text"),
        isNull(consentRecords.revokedAt),
      ),
    )
    .limit(1);
  if (!consent) return { allowed: false, reason: "no_consent" };

  const used = await countModelCallsToday(studentId, db);
  if (used >= readAiEnv(env).dailyCallsPerStudent) return { allowed: false, reason: "daily_limit" };

  return { allowed: true };
}

export interface ModelCaller {
  readonly providerName: string;
  readonly model: string;
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
  /** True when the provider's moderation flags the text. False if it cannot tell. */
  isFlagged(text: string): Promise<boolean>;
}

/**
 * Wraps a provider so every call is logged as metadata only (never the prompt
 * or the output) and, for a student, counted against the daily budget.
 */
export function createModelCaller(options: {
  db: DbClient;
  /** Absent for synthetic-learner runs, which have no student to account to. */
  studentId?: string;
  sessionId?: string;
  provider?: LLMProvider;
  env?: Record<string, string | undefined>;
}): ModelCaller {
  const env = options.env ?? process.env;
  const provider = options.provider ?? getLlmProvider(env);
  const model =
    env.LLM_MODEL_TUTOR?.trim() || (provider.name === "openai" ? "gpt-4o-mini" : provider.name);

  return {
    providerName: provider.name,
    model,
    async isFlagged(text: string): Promise<boolean> {
      const result = await provider.moderate(text);
      return result.ok && result.flagged === true;
    },
    async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
      const started = Date.now();
      const result = await provider.generate(req);
      const outcome = result.ok ? "ok" : result.reason;
      try {
        await options.db.insert(llmCalls).values({
          id: `llm_${generateDomainId("decision")}`,
          purpose: req.purpose,
          provider: provider.name,
          model,
          inputTokens: result.ok ? result.usage.inTok : 0,
          outputTokens: result.ok ? result.usage.outTok : 0,
          costMicroInr: "0",
          latencyMs: Date.now() - started,
          outcome,
        });
        if (options.studentId) {
          await options.db.insert(events).values({
            id: generateDomainId("event"),
            studentId: options.studentId,
            sessionId: options.sessionId ?? null,
            type: MODEL_CALL_EVENT,
            payload: { purpose: req.purpose, outcome },
          });
        }
      } catch (err) {
        log.warn("ai.gateway.accounting_failed", {
          error: err instanceof Error ? err.name : "unknown",
        });
      }
      return result;
    },
  };
}
