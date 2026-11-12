import { getSqlClient } from "./client";
import { loadRootEnv } from "./env";

export interface DatabaseHealthResult {
  readonly ok: boolean;
  readonly latencyMs: number;
}

export interface DatabaseHealthOptions {
  readonly databaseUrl?: string;
  readonly ping?: () => Promise<void>;
}

/**
 * Probes PostgreSQL reachability with `SELECT 1`.
 * Catches connection and query failures without exposing credentials or stack traces.
 */
export async function checkDatabaseHealth(
  options: DatabaseHealthOptions = {},
): Promise<DatabaseHealthResult> {
  const started = Date.now();
  try {
    if (options.ping) {
      await options.ping();
    } else {
      if (options.databaseUrl === undefined) {
        loadRootEnv();
      }
      const url = options.databaseUrl ?? process.env.DATABASE_URL;
      if (!url || url.trim() === "") {
        return { ok: false, latencyMs: 0 };
      }
      const sql = getSqlClient(url);
      await sql`SELECT 1`;
    }
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}
