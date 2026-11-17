/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { MockProvider, getLlmProvider, readAiEnv, type LLMProvider } from "@gaps/ai";
import { findWorkspaceRoot, loadRootEnv } from "@gaps/db";
import { OpenTopicEngine, type TextGenerator } from "../server/open-topic/engine";
import {
  type SyntheticProfile,
  type SyntheticRun,
  describeStep,
  runSyntheticLesson,
} from "../server/open-topic/simulate";

/**
 * Open-topic teaching demonstration with a REAL provider and SYNTHETIC learners.
 *
 *   pnpm demo:open-topic                 live run; needs LLM_PROVIDER=openai and OPENAI_API_KEY
 *   pnpm demo:open-topic --dry-run-mock  wiring check with the mock provider (NOT a demonstration)
 *
 * No student exists in this run and nothing personal is sent: the learners are
 * scripted. The topics below are plain strings; none has any code of its own.
 */

const TOPICS: ReadonlyArray<{ topic: string; level: number }> = [
  { topic: "photosynthesis", level: 7 },
  { topic: "states of matter", level: 6 },
  { topic: "negative numbers", level: 6 },
];
const PROFILES: readonly SyntheticProfile[] = ["succeeding", "struggling"];

function asGenerator(provider: LLMProvider, model: string): TextGenerator {
  return {
    providerName: provider.name,
    model,
    generate: (req) => provider.generate(req),
  };
}

function actionsOf(run: SyntheticRun): string[] {
  return (run.state?.steps ?? []).map((s) =>
    s.role === "diagnostic" ? "diagnostic_probe" : s.role === "closing" ? "close" : s.action,
  );
}

function renderRun(run: SyntheticRun): string {
  const lines = [
    `### ${run.topic} (Class ${run.level}) — ${run.profile} learner`,
    "",
    `- Outcome: **${run.outcome}** — ${run.detail}`,
  ];
  if (run.state) {
    const s = run.state;
    lines.push(
      `- Lesson title: ${s.title}; subject: ${s.subject}`,
      `- Learning goal: ${s.learningGoal}`,
      `- Content basis: ${s.contentStatus.basis} (generated preview, practice only); sources supplied: ${
        s.contentStatus.sources.map((src) => src.title).join("; ") || "none"
      }`,
      `- Proposed by the model, not verified: prerequisites: ${s.modelProposed.prerequisites.join("; ") || "none"}; suspected misconceptions: ${s.modelProposed.misconceptions.join("; ") || "none"}`,
      `- Sequence: ${actionsOf(run).join(" → ")}`,
      "",
      "```text",
      ...s.steps.map(describeStep),
      "```",
    );
  }
  return lines.join("\n");
}

async function main(): Promise<number> {
  loadRootEnv({ startDir: import.meta.dirname });
  const env = process.env;
  const dryRun = process.argv.includes("--dry-run-mock");
  const timeoutArg = process.argv.find((a) => a.startsWith("--timeout-ms="));
  const timeoutMs = timeoutArg ? Number(timeoutArg.split("=")[1]) : 30000;

  let provider: LLMProvider;
  let model: string;
  if (dryRun) {
    provider = new MockProvider();
    model = "mock";
  } else {
    const cfg = readAiEnv(env);
    if (cfg.provider !== "openai" || !cfg.apiKeyConfigured) {
      console.error(
        [
          "BLOCKED: live generation cannot be demonstrated.",
          `  LLM_PROVIDER is "${cfg.provider}" and an API key is ${cfg.apiKeyConfigured ? "present" : "absent"}.`,
          "  Set LLM_PROVIDER=openai and OPENAI_API_KEY (optionally OPENAI_BASE_URL and LLM_MODEL_TUTOR",
          "  for another OpenAI-compatible provider) in .env, then run this command again.",
          "  Use --dry-run-mock only to check the wiring; that is not a demonstration.",
        ].join("\n"),
      );
      return 2;
    }
    provider = getLlmProvider(env);
    model = env.LLM_MODEL_TUTOR?.trim() || "gpt-4o-mini";
  }

  const engine = new OpenTopicEngine(asGenerator(provider, model), timeoutMs);
  const runs: SyntheticRun[] = [];
  for (const { topic, level } of TOPICS) {
    for (const profile of PROFILES) {
      console.log(`Running "${topic}" (Class ${level}) with a ${profile} synthetic learner...`);
      runs.push(await runSyntheticLesson(engine, { topic, level, profile }));
    }
  }

  const directionChanges = TOPICS.map(({ topic }) => {
    const ok = runs.find((r) => r.topic === topic && r.profile === "succeeding");
    const hard = runs.find((r) => r.topic === topic && r.profile === "struggling");
    const a = ok ? actionsOf(ok) : [];
    const b = hard ? actionsOf(hard) : [];
    const firstDifference = a.findIndex((action, i) => action !== b[i]);
    return `- **${topic}**: succeeding: ${a.join(" → ") || "n/a"}\n  struggling: ${b.join(" → ") || "n/a"}\n  ${
      firstDifference >= 0 && b.length > 0
        ? `The lessons diverge at step ${firstDifference + 1}, after the struggling learner's missed answer.`
        : "No divergence was observed in this run."
    }`;
  });

  const finished = runs.filter((r) => r.outcome === "completed" || r.outcome === "paused").length;

  // Pass/fail checks on what the provider actually produced.
  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
  for (const { topic } of TOPICS) {
    const ok = runs.find((r) => r.topic === topic && r.profile === "succeeding");
    const hard = runs.find((r) => r.topic === topic && r.profile === "struggling");
    const both = [ok, hard];
    const generated = (run?: SyntheticRun) =>
      (run?.state?.steps ?? []).filter((s) => s.decision.origin === "generated");
    checks.push({
      name: `${topic}: an opening plan was generated and accepted by validation`,
      pass: both.every((r) => r?.state && generated(r).length > 0),
      detail: both.map((r) => `${r?.profile}: ${r?.outcome}`).join("; "),
    });
    checks.push({
      name: `${topic}: both lessons ran to a closing or pause step without waiting on the provider`,
      pass: both.every((r) => r?.outcome === "completed" || r?.outcome === "paused"),
      detail: both.map((r) => `${r?.profile}: ${r?.outcome} (${r?.detail})`).join("; "),
    });
    const stepsAfterMiss = (hard?.state?.steps ?? []).filter(
      (s, i, all) =>
        s.decision.origin === "generated" &&
        all.slice(0, i).some((p) => p.outcome?.isCorrect === false),
    );
    const a = ok ? actionsOf(ok) : [];
    const b = hard ? actionsOf(hard) : [];
    checks.push({
      name: `${topic}: the sequence changed after a missed answer, using steps generated after that answer`,
      pass: stepsAfterMiss.length > 0 && a.join(">") !== b.join(">") && b.length > 0,
      detail: `${stepsAfterMiss.length} step(s) generated after the first miss`,
    });
    checks.push({
      name: `${topic}: no topic-specific code or authored lesson was used`,
      pass: both.every((r) => r?.outcome !== "authored_lesson_exists"),
      detail: "topic passed as a plain string",
    });
  }
  const failedChecks = checks.filter((c) => !c.pass).length;
  const report = [
    dryRun
      ? "# Open-topic wiring check — MOCK PROVIDER, NOT A DEMONSTRATION"
      : "# Open-topic teaching: live demonstration with synthetic learners",
    "",
    `- Run at: ${new Date().toISOString()}`,
    `- Provider: ${provider.name}; model: ${model}${
      !dryRun && env.OPENAI_BASE_URL ? `; endpoint host: ${new URL(env.OPENAI_BASE_URL).host}` : ""
    }`,
    "- Learners: scripted synthetic profiles. No student data was used or sent.",
    `- Runs that reached a closing or pause step: ${finished} of ${runs.length}`,
    "- Every step below passed the server's validation before it was accepted.",
    "- All content is a generated preview from model knowledge unless a source is listed. It has not been reviewed by an educator, and the explanations have not been fact-checked.",
    "",
    dryRun ? "## Wiring checks (mock provider)" : "## Live-model test results",
    "",
    ...checks.map((c) => `- ${c.pass ? "PASS" : "FAIL"} — ${c.name} (${c.detail})`),
    "",
    `**${checks.length - failedChecks} of ${checks.length} checks passed.**`,
    "",
    "## Lessons changing direction after a response",
    "",
    ...directionChanges,
    "",
    "## Transcripts",
    "",
    runs.map(renderRun).join("\n\n"),
    "",
  ].join("\n");

  if (dryRun) {
    console.log(report);
  } else {
    const outDir = path.join(findWorkspaceRoot(import.meta.dirname), "docs", "demos");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, "open-topic-live-demo.md");
    fs.writeFileSync(outFile, report);
    console.log(`Transcript written to ${outFile}`);
  }
  console.log(`${checks.length - failedChecks} of ${checks.length} checks passed.`);
  return failedChecks === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
