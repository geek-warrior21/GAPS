import fs from "node:fs";
import path from "node:path";

/**
 * Parses dotenv-formatted lines without mutating process.env.
 * Supports optional `export ` prefixes, single/double quotes, and comments.
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const line = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) {
      continue;
    }
    const key = line.slice(0, eqIdx).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    let val = line.slice(eqIdx + 1).trim();
    if (val.startsWith('"')) {
      const endQuote = val.indexOf('"', 1);
      val = endQuote >= 1 ? val.slice(1, endQuote).replace(/\\n/g, "\n") : val.slice(1);
    } else if (val.startsWith("'")) {
      const endQuote = val.indexOf("'", 1);
      val = endQuote >= 1 ? val.slice(1, endQuote) : val.slice(1);
    } else {
      const hashIdx = val.indexOf(" #");
      if (hashIdx >= 0) {
        val = val.slice(0, hashIdx).trim();
      }
    }
    result[key] = val;
  }
  return result;
}

/** Finds the monorepo root by walking upward for pnpm-workspace.yaml. */
export function findWorkspaceRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(/*turbopackIgnore: true*/ startDir);
  while (true) {
    if (
      fs.existsSync(
        /*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, "pnpm-workspace.yaml"),
      )
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return path.resolve(/*turbopackIgnore: true*/ startDir);
    }
    dir = parent;
  }
}

export interface LoadRootEnvOptions {
  readonly startDir?: string;
  readonly targetEnv?: Record<string, string | undefined>;
}

/**
 * Loads `.env.local` then `.env` from the monorepo root into `targetEnv`
 * without overwriting variables already present in `targetEnv`.
 * Precedence: explicit shell env > root `.env.local` > root `.env`.
 */
export function loadRootEnv(options: LoadRootEnvOptions = {}): string[] {
  const rootDir = findWorkspaceRoot(options.startDir);
  const target = options.targetEnv ?? process.env;
  const loadedFiles: string[] = [];

  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(/*turbopackIgnore: true*/ rootDir, filename);
    if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      continue;
    }
    const parsed = parseEnvContent(fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (target[key] === undefined) {
        target[key] = value;
      }
    }
    loadedFiles.push(filePath);
  }
  return loadedFiles;
}
