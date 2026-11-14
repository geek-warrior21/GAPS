import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeSqlClients, getDb } from "./client";
import { loadRootEnv } from "./env";

export async function runMigrations(databaseUrl?: string): Promise<void> {
  loadRootEnv();
  const db = getDb(databaseUrl);
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = resolve(currentDir, "../migrations");

  await migrate(db, { migrationsFolder });
}

const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  runMigrations()
    .then(async () => {
      process.stdout.write("✓ Drizzle migrations applied successfully.\n");
      await closeSqlClients();
      process.exitCode = 0;
    })
    .catch(async (err: unknown) => {
      process.stderr.write(
        `✗ Migration failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      await closeSqlClients();
      process.exitCode = 1;
    });
}
