import postgres, { type Sql } from "postgres";
import { loadRootEnv } from "./env";

const clients = new Map<string, Sql>();

/**
 * Returns a pooled postgres.js client for the given connection URL.
 * Loads root `.env.local`/`.env` when `DATABASE_URL` is not already set.
 * Throws if no URL is configured; never embeds secrets in error messages.
 */
export function getSqlClient(databaseUrl?: string): Sql {
  if (databaseUrl === undefined) {
    loadRootEnv();
  }
  const resolvedUrl = databaseUrl ?? process.env.DATABASE_URL;
  if (!resolvedUrl || resolvedUrl.trim() === "") {
    throw new Error("DATABASE_URL is not configured");
  }
  const existing = clients.get(resolvedUrl);
  if (existing) {
    return existing;
  }
  const sql = postgres(resolvedUrl, {
    max: 5,
    connect_timeout: 2,
    idle_timeout: 20,
  });
  clients.set(resolvedUrl, sql);
  return sql;
}

/** Closes all cached SQL connection pools cleanly. */
export async function closeSqlClients(): Promise<void> {
  const pending = Array.from(clients.values()).map((sql) => sql.end({ timeout: 2 }));
  clients.clear();
  await Promise.allSettled(pending);
}
