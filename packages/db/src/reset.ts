import { pathToFileURL } from "node:url";
import { closeSqlClients, getDb, getSqlClient, type DbClient } from "./client";
import { loadRootEnv } from "./env";
import { runMigrations } from "./migrate";
import { seedDatabase } from "./seed";

export async function resetDatabase(db: DbClient = getDb()): Promise<void> {
  loadRootEnv();
  const sql = getSqlClient();
  await sql.unsafe(
    "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;",
  );
  await runMigrations();
  await seedDatabase(db);
}

const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  loadRootEnv();
  resetDatabase()
    .then(async () => {
      process.stdout.write("✓ Database reset, migrated, and seeded successfully.\n");
      await closeSqlClients();
      process.exitCode = 0;
    })
    .catch(async (err: unknown) => {
      process.stderr.write(`✗ Reset failed: ${err instanceof Error ? err.message : String(err)}\n`);
      await closeSqlClients();
      process.exitCode = 1;
    });
}
