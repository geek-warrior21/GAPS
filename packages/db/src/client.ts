import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { loadRootEnv } from "./env";
import * as schema from "./schema";

const sqlClients = new Map<string, Sql>();
const dbClients = new Map<string, PostgresJsDatabase<typeof schema>>();

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
  const existing = sqlClients.get(resolvedUrl);
  if (existing) {
    return existing;
  }
  const sql = postgres(resolvedUrl, {
    max: 5,
    connect_timeout: 2,
    idle_timeout: 20,
  });
  sqlClients.set(resolvedUrl, sql);
  return sql;
}

/**
 * Returns a typed Drizzle ORM client instance backed by postgres.js.
 */
export function getDb(databaseUrl?: string): PostgresJsDatabase<typeof schema> {
  const sql = getSqlClient(databaseUrl);
  const resolvedUrl = databaseUrl ?? process.env.DATABASE_URL!;
  const existing = dbClients.get(resolvedUrl);
  if (existing) {
    return existing;
  }
  const db = drizzle(sql, { schema });
  dbClients.set(resolvedUrl, db);
  return db;
}

export type DbClient = PostgresJsDatabase<typeof schema>;

/** Closes all cached SQL connection pools cleanly. */
export async function closeSqlClients(): Promise<void> {
  const pending = Array.from(sqlClients.values()).map((sql) => sql.end({ timeout: 2 }));
  sqlClients.clear();
  dbClients.clear();
  await Promise.allSettled(pending);
}
