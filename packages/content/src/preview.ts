import { pathToFileURL } from "node:url";
import { richTextToString } from "./check";
import { generateItem } from "./index";
import { TEMPLATES, TEMPLATES_BY_CONCEPT, TEMPLATES_BY_ID } from "./templates";

export function previewTemplate(templateId: string, count = 3): void {
  const template = TEMPLATES_BY_ID[templateId];
  if (!template) {
    const byConcept = TEMPLATES_BY_CONCEPT[templateId];
    if (byConcept && byConcept.length > 0) {
      process.stdout.write(`Found ${byConcept.length} templates for concept ${templateId}:\n\n`);
      for (const t of byConcept) {
        previewTemplate(t.id, 1);
      }
      return;
    }

    process.stderr.write(`Unknown template or concept ID: "${templateId}"\n`);
    process.stderr.write(`Available templates:\n`);
    for (const t of TEMPLATES) {
      process.stderr.write(`  - ${t.id} (${t.conceptId})\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`=================================================================\n`);
  process.stdout.write(
    `TEMPLATE: ${template.id} [Concept: ${template.conceptId}, Diff: ${template.difficulty}]\n`,
  );
  process.stdout.write(`Review status: ${template.review.status}\n`);
  process.stdout.write(`=================================================================\n\n`);

  for (let i = 1; i <= count; i++) {
    const seed = i * 1337;
    const item = generateItem(template, seed);
    process.stdout.write(`--- Sample #${i} (seed: ${seed}) ---\n`);
    process.stdout.write(`Prompt: ${richTextToString(item.prompt)}\n`);
    process.stdout.write(`Input kind: ${item.input.kind}\n`);
    process.stdout.write(
      `Answer: ${item.answer.kind} -> ${
        item.answer.kind === "rational"
          ? `${item.answer.value.n}/${item.answer.value.d} (${item.answer.form})`
          : item.answer.kind === "integer"
            ? item.answer.value.toString()
            : JSON.stringify(item.answer)
      }\n`,
    );

    if (item.misconceptions && Object.keys(item.misconceptions).length > 0) {
      process.stdout.write(`Misconceptions:\n`);
      for (const [mcId, mcVal] of Object.entries(item.misconceptions)) {
        const valStr =
          typeof mcVal === "object" && mcVal !== null && "n" in mcVal
            ? `${mcVal.n}/${mcVal.d}`
            : String(mcVal);
        process.stdout.write(`  * ${mcId} => ${valStr}\n`);
      }
    }

    process.stdout.write(`Hints:\n`);
    for (let h = 0; h < item.hints.length; h++) {
      const hint = item.hints[h];
      if (hint) {
        process.stdout.write(`  ${h + 1}. ${richTextToString(hint)}\n`);
      }
    }

    if (item.workedExample.result) {
      process.stdout.write(
        `Worked example result: ${richTextToString(item.workedExample.result)}\n`,
      );
    }
    if (item.visual) {
      process.stdout.write(`Visual spec: ${item.visual.type}\n`);
    }
    process.stdout.write("\n");
  }
}

const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const args = process.argv.slice(2);
  const templateId = args[0] ?? "MATH-FRAC-PART/identify-shape";
  const count = args[1] ? Number.parseInt(args[1], 10) : 3;
  previewTemplate(templateId, count);
}
