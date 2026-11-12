import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadRootEnv, parseEnvContent } from "./env";

const tempDirs: string[] = [];

function createTempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaps-env-test-"));
  tempDirs.push(dir);
  fs.writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\n");
  fs.mkdirSync(path.join(dir, "apps", "web"), { recursive: true });
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("root env loader", () => {
  it("parses quoted, exported, and commented lines", () => {
    const parsed = parseEnvContent(`
# comment
export DATABASE_URL="postgres://u:p@localhost:5432/db"
LLM_PROVIDER=disabled # inline comment
SINGLE='value # preserved'
`);
    expect(parsed).toEqual({
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      LLM_PROVIDER: "disabled",
      SINGLE: "value # preserved",
    });
  });

  it("loads root .env.local from a nested workspace package with precedence shell > .env.local > .env", () => {
    const root = createTempWorkspace();
    fs.writeFileSync(
      path.join(root, ".env"),
      "DATABASE_URL=from_dotenv\nLLM_PROVIDER=disabled\nONLY_DOTENV=yes\n",
    );
    fs.writeFileSync(
      path.join(root, ".env.local"),
      "DATABASE_URL=from_dotenv_local\nOVERRIDE_ME=from_local\n",
    );

    const targetEnv: Record<string, string | undefined> = {
      OVERRIDE_ME: "from_shell",
    };

    const loaded = loadRootEnv({
      startDir: path.join(root, "apps", "web"),
      targetEnv,
    });

    expect(loaded).toHaveLength(2);
    expect(targetEnv.DATABASE_URL).toBe("from_dotenv_local");
    expect(targetEnv.ONLY_DOTENV).toBe("yes");
    expect(targetEnv.LLM_PROVIDER).toBe("disabled");
    expect(targetEnv.OVERRIDE_ME).toBe("from_shell");
  });
});
