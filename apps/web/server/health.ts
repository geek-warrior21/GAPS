import { getLlmHealthStatus, type LlmHealthStatus } from "@gaps/ai";
import { HealthResponseSchema, type HealthResponse } from "@gaps/contracts";
import { checkDatabaseHealth, loadRootEnv, type DatabaseHealthResult } from "@gaps/db";
import { APP_VERSION } from "./env";
import { log } from "./log";

export interface HealthDependencies {
  readonly checkDb?: () => Promise<DatabaseHealthResult>;
  readonly checkLlm?: () => LlmHealthStatus;
  readonly version?: string;
}

export async function getHealthSnapshot(
  deps: HealthDependencies = {},
): Promise<{ httpStatus: 200 | 503; body: HealthResponse }> {
  loadRootEnv();
  const checkDb = deps.checkDb ?? (() => checkDatabaseHealth());
  const checkLlm = deps.checkLlm ?? (() => getLlmHealthStatus());
  const version = deps.version ?? APP_VERSION;

  const dbResult = await checkDb();
  const llm = checkLlm();

  const body = HealthResponseSchema.parse({
    status: dbResult.ok ? "ok" : "degraded",
    db: dbResult.ok ? "ok" : "error",
    llm,
    version,
  });

  if (!dbResult.ok) {
    log.warn("health.check_degraded", {
      db: body.db,
      llm: body.llm,
      latencyMs: dbResult.latencyMs,
    });
  }

  return {
    httpStatus: dbResult.ok ? 200 : 503,
    body,
  };
}
