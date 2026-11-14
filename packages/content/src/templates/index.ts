import type { Template } from "../types";
import { addlikeTemplates } from "./addlike";
import { addunlikeTemplates } from "./addunlike";
import { compareTemplates } from "./compare";
import { decTemplates } from "./dec";
import { divTemplates } from "./div";
import { equivTemplates } from "./equiv";
import { hcfTemplates } from "./hcf";
import { lcmTemplates } from "./lcm";
import { mixedTemplates } from "./mixed";
import { multTemplates } from "./mult";
import { numlineTemplates } from "./numline";
import { partTemplates } from "./part";
import { simplifyTemplates } from "./simplify";
import { wordTemplates } from "./word";

export const TEMPLATES: readonly Template[] = [
  ...partTemplates,
  ...numlineTemplates,
  ...hcfTemplates,
  ...equivTemplates,
  ...simplifyTemplates,
  ...compareTemplates,
  ...mixedTemplates,
  ...lcmTemplates,
  ...addlikeTemplates,
  ...addunlikeTemplates,
  ...multTemplates,
  ...divTemplates,
  ...decTemplates,
  ...wordTemplates,
] as const;

export const TEMPLATES_BY_ID: Readonly<Record<string, Template>> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
);

export const TEMPLATES_BY_CONCEPT: Readonly<Record<string, readonly Template[]>> = TEMPLATES.reduce<
  Record<string, Template[]>
>((acc, t) => {
  const list = acc[t.conceptId] ?? [];
  list.push(t);
  acc[t.conceptId] = list;
  return acc;
}, {});
