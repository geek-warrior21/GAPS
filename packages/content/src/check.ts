import { pathToFileURL } from "node:url";
import { type AnswerSpec, type ConceptId, type Rational, type RichText, eq } from "@gaps/domain";
import { CHAPTERS } from "./chapters";
import { CONCEPTS, CONCEPTS_BY_ID } from "./concepts";
import { EDGES } from "./edges";
import { EXPLANATIONS } from "./explanations";
import { generateItem } from "./index";
import { MISCONCEPTIONS, MISCONCEPTIONS_BY_ID } from "./misconceptions";
import { TEMPLATES, TEMPLATES_BY_CONCEPT } from "./templates";
import type { Template } from "./types";

export interface CheckFailure {
  readonly templateId?: string;
  readonly conceptId?: string;
  readonly check: string;
  readonly message: string;
}

export interface ContentCheckResult {
  readonly ok: boolean;
  readonly templatesChecked: number;
  readonly seedsTestedPerTemplate: number;
  readonly failures: readonly CheckFailure[];
}

export function richTextToString(rt: RichText): string {
  return rt
    .map((seg) => {
      switch (seg.t) {
        case "text":
        case "math":
          return seg.v;
        case "frac":
          return `${seg.n}/${seg.d}`;
        case "mixed":
          return `${seg.w} ${seg.n}/${seg.d}`;
        case "blank":
          return "___";
      }
    })
    .join(" ");
}

export function extractNumbers(text: string): Set<string> {
  const matches = text.match(/\b\d+(?:\.\d+)?\b/g);
  return new Set(matches ?? []);
}

export function extractAnswerNumbers(ans: AnswerSpec): string[] {
  switch (ans.kind) {
    case "rational": {
      const numbers: string[] = [];
      numbers.push(ans.value.n.toString());
      if (ans.value.d !== 1n) {
        numbers.push(ans.value.d.toString());
      }
      return numbers;
    }
    case "integer":
      return [ans.value.toString()];
    case "decimal": {
      const whole = ans.value.n / ans.value.d;
      const rem = ans.value.n % ans.value.d;
      return [whole.toString(), `${whole}.${rem.toString()}`];
    }
    case "comparison":
    case "choice":
    case "order":
      return [];
  }
}

export function checkGraphAcyclicity(): CheckFailure[] {
  const failures: CheckFailure[] = [];

  // Chapters check
  if (CHAPTERS.length !== 3) {
    failures.push({
      check: "chapter-count",
      message: `Expected 3 chapters, found ${CHAPTERS.length}`,
    });
  }

  // Explanations check
  for (const c of CONCEPTS) {
    const exp = EXPLANATIONS[c.id];
    if (!exp || exp.picture.length === 0 || exp.everyday.length === 0 || exp.steps.length === 0) {
      failures.push({
        conceptId: c.id,
        check: "explanation-routes",
        message: `Concept ${c.id} missing 3-route explanations`,
      });
    }

    const tList = TEMPLATES_BY_CONCEPT[c.id] ?? [];
    if (tList.length < 2) {
      failures.push({
        conceptId: c.id,
        check: "template-count",
        message: `Concept ${c.id} has only ${tList.length} templates (minimum 2 required)`,
      });
    }
  }

  // 1. Concept count
  if (CONCEPTS.length !== 14) {
    failures.push({
      check: "concept-count",
      message: `Expected exactly 14 concepts, found ${CONCEPTS.length}`,
    });
  }

  // 2. Check all edge endpoints exist
  for (const edge of EDGES) {
    if (!CONCEPTS_BY_ID[edge.prereqId]) {
      failures.push({
        check: "edge-validity",
        message: `Edge prerequisite ${edge.prereqId} not found in concepts`,
      });
    }
    if (!CONCEPTS_BY_ID[edge.conceptId]) {
      failures.push({
        check: "edge-validity",
        message: `Edge target ${edge.conceptId} not found in concepts`,
      });
    }
  }

  // 3. Topological order respecting every edge
  for (const edge of EDGES) {
    const prereq = CONCEPTS_BY_ID[edge.prereqId];
    const concept = CONCEPTS_BY_ID[edge.conceptId];
    if (prereq && concept) {
      if (prereq.topoOrder >= concept.topoOrder) {
        failures.push({
          check: "topo-order",
          message: `Prerequisite ${edge.prereqId} (topoOrder ${prereq.topoOrder}) must precede ${edge.conceptId} (topoOrder ${concept.topoOrder})`,
        });
      }
    }
  }

  // 4. Cycle detection (Kahn's algorithm)
  const inDegree = new Map<ConceptId, number>();
  const adj = new Map<ConceptId, ConceptId[]>();
  for (const c of CONCEPTS) {
    inDegree.set(c.id, 0);
    adj.set(c.id, []);
  }
  for (const e of EDGES) {
    inDegree.set(e.conceptId, (inDegree.get(e.conceptId) ?? 0) + 1);
    adj.get(e.prereqId)?.push(e.conceptId);
  }

  const queue: ConceptId[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    visited++;
    for (const neighbor of adj.get(curr) ?? []) {
      const nextDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, nextDeg);
      if (nextDeg === 0) queue.push(neighbor);
    }
  }

  if (visited !== CONCEPTS.length) {
    failures.push({
      check: "graph-acyclicity",
      message: `Cycle detected in prerequisite graph! Visited ${visited} of ${CONCEPTS.length} concepts`,
    });
  }

  return failures;
}

export function checkMisconceptionsCatalog(): CheckFailure[] {
  const failures: CheckFailure[] = [];

  for (const mc of MISCONCEPTIONS) {
    for (const cid of mc.conceptIds) {
      if (!CONCEPTS_BY_ID[cid]) {
        failures.push({
          check: "misconception-concept",
          message: `Misconception ${mc.id} references non-existent concept ${cid}`,
        });
      }
    }
  }

  return failures;
}

export function checkTemplate<P>(template: Template<P>, numSeeds = 500): CheckFailure[] {
  const failures: CheckFailure[] = [];
  const distinctPrompts = new Set<string>();
  const distinctAnswers = new Set<string>();

  for (let s = 1; s <= numSeeds; s++) {
    const seed = s * 7919;
    let item;
    try {
      item = generateItem(template, seed, 50);
    } catch (err: unknown) {
      failures.push({
        templateId: template.id,
        conceptId: template.conceptId,
        check: "seed-generation",
        message: `Failed generating item with seed ${seed}: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    const promptText = richTextToString(item.prompt);
    distinctPrompts.add(promptText);

    // Answer well-formedness
    const ans = item.answer;
    if (ans.kind === "rational") {
      if (ans.value.d === 0n) {
        failures.push({
          templateId: template.id,
          conceptId: template.conceptId,
          check: "answer-well-formed",
          message: `Zero denominator in rational answer: ${ans.value.n}/${ans.value.d}`,
        });
      }
      distinctAnswers.add(`${ans.value.n}/${ans.value.d}`);
    } else if (ans.kind === "integer") {
      distinctAnswers.add(ans.value.toString());
    } else if (ans.kind === "comparison") {
      distinctAnswers.add(ans.value);
    } else if (ans.kind === "choice") {
      distinctAnswers.add(ans.value);
    }

    // Misconceptions check
    const mcs = item.misconceptions;
    if (mcs) {
      const mcEntries = Object.entries(mcs) as [string, Rational | string][];
      const seenValues = new Map<string, string>();

      for (const [mcId, mcVal] of mcEntries) {
        // Verify misconception exists in catalog
        if (!MISCONCEPTIONS_BY_ID[mcId]) {
          failures.push({
            templateId: template.id,
            conceptId: template.conceptId,
            check: "misconception-exists",
            message: `Template references uncatalogued misconception ${mcId}`,
          });
        }

        // Check if misconception equals correct answer
        if (ans.kind === "rational" && typeof mcVal === "object" && "n" in mcVal) {
          if (eq(ans.value, mcVal)) {
            failures.push({
              templateId: template.id,
              conceptId: template.conceptId,
              check: "misconception-equals-answer",
              message: `Misconception ${mcId} produced answer value ${mcVal.n}/${mcVal.d} on seed ${seed}`,
            });
          }
        } else if (ans.kind === "integer" && typeof mcVal === "object" && "n" in mcVal) {
          if (mcVal.d === 1n && ans.value === mcVal.n) {
            failures.push({
              templateId: template.id,
              conceptId: template.conceptId,
              check: "misconception-equals-answer",
              message: `Misconception ${mcId} produced answer value ${mcVal.n} on seed ${seed}`,
            });
          }
        }

        // Check collision between misconceptions
        const valKey =
          typeof mcVal === "object" && "n" in mcVal ? `${mcVal.n}/${mcVal.d}` : String(mcVal);
        const existing = seenValues.get(valKey);
        if (existing) {
          failures.push({
            templateId: template.id,
            conceptId: template.conceptId,
            check: "misconception-collision",
            message: `Misconceptions ${existing} and ${mcId} both produced value ${valKey} on seed ${seed}`,
          });
        } else {
          seenValues.set(valKey, mcId);
        }
      }
    }

    // Hint leak check
    const promptNumbers = extractNumbers(promptText);
    const ansNumbers = extractAnswerNumbers(ans);

    // Check hint rungs
    for (let r = 0; r < item.hints.length; r++) {
      const hint = item.hints[r];
      if (!hint) continue;
      const hintText = richTextToString(hint);
      const hintNumbers = extractNumbers(hintText);
      for (const ansNum of ansNumbers) {
        // Numbers 0 and 1 are common in step language/unit fractions, but if a larger or distinct answer appears:
        if (ansNum !== "0" && ansNum !== "1") {
          if (hintNumbers.has(ansNum) && !promptNumbers.has(ansNum)) {
            failures.push({
              templateId: template.id,
              conceptId: template.conceptId,
              check: "hint-leak",
              message: `Hint rung ${r + 1} leaks answer number '${ansNum}' not present in prompt: "${hintText}"`,
            });
          }
        }
      }
    }

    // Worked example parameters check
    const exResultText = item.workedExample.result
      ? richTextToString(item.workedExample.result)
      : "";
    if (exResultText && exResultText === promptText) {
      failures.push({
        templateId: template.id,
        conceptId: template.conceptId,
        check: "worked-example-distinct",
        message: `Worked example produced identical text to item prompt on seed ${seed}`,
      });
    }
  }

  // Minimum distinct items check (>= 20 distinct)
  if (distinctPrompts.size < 20 && distinctAnswers.size < 20) {
    failures.push({
      templateId: template.id,
      conceptId: template.conceptId,
      check: "distinct-items",
      message: `Template generated only ${distinctPrompts.size} distinct prompts and ${distinctAnswers.size} distinct answers over ${numSeeds} seeds (minimum 20 required)`,
    });
  }

  return failures;
}

export function runContentCheck(options?: {
  numSeeds?: number;
  verbose?: boolean;
}): ContentCheckResult {
  const numSeeds = options?.numSeeds ?? 500;
  const verbose = options?.verbose ?? false;
  const allFailures: CheckFailure[] = [];

  if (verbose) {
    process.stdout.write("Checking prerequisite graph and concept definitions...\n");
  }

  allFailures.push(...checkGraphAcyclicity());
  allFailures.push(...checkMisconceptionsCatalog());

  if (verbose) {
    process.stdout.write(`Checking ${TEMPLATES.length} templates with ${numSeeds} seeds each...\n`);
  }

  let checkedCount = 0;
  for (const t of TEMPLATES) {
    const templateFailures = checkTemplate(t, numSeeds);
    allFailures.push(...templateFailures);
    checkedCount++;
    if (verbose && checkedCount % 10 === 0) {
      process.stdout.write(`  Checked ${checkedCount}/${TEMPLATES.length} templates...\n`);
    }
  }

  return {
    ok: allFailures.length === 0,
    templatesChecked: checkedCount,
    seedsTestedPerTemplate: numSeeds,
    failures: allFailures,
  };
}

const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  process.stdout.write("Running Gaps content:check validation...\n");
  const result = runContentCheck({ numSeeds: 500, verbose: true });
  if (result.ok) {
    process.stdout.write(
      `\n✓ content:check PASSED: ${result.templatesChecked} templates verified across ${result.seedsTestedPerTemplate} seeds each (all acyclic, distinct >= 20, zero hint leaks, well-formed answers).\n`,
    );
    process.exitCode = 0;
  } else {
    process.stderr.write(`\n✗ content:check FAILED with ${result.failures.length} errors:\n`);
    for (const f of result.failures.slice(0, 25)) {
      process.stderr.write(
        `  - [${f.check}] ${f.templateId ?? f.conceptId ?? "general"}: ${f.message}\n`,
      );
    }
    if (result.failures.length > 25) {
      process.stderr.write(`  ... and ${result.failures.length - 25} more failures\n`);
    }
    process.exitCode = 1;
  }
}
