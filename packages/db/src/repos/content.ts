import { and, asc, eq } from "drizzle-orm";
import type { DbClient } from "../client";
import {
  chapters,
  conceptEdges,
  concepts,
  itemInstances,
  misconceptions,
  templates,
} from "../schema";

export async function listChapters(db: DbClient) {
  return db.select().from(chapters).orderBy(asc(chapters.ord));
}

export async function listConcepts(db: DbClient) {
  return db.select().from(concepts).orderBy(asc(concepts.topoOrder));
}

export async function listConceptEdges(db: DbClient) {
  return db.select().from(conceptEdges);
}

export async function listMisconceptions(db: DbClient) {
  return db.select().from(misconceptions);
}

export async function getTemplate(db: DbClient, templateId: string, version: number) {
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.version, version)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTemplatesForConcept(db: DbClient, conceptId: string) {
  return db
    .select()
    .from(templates)
    .where(eq(templates.conceptId, conceptId))
    .orderBy(asc(templates.difficulty), asc(templates.id));
}

export async function getReviewedTemplatesForConcept(db: DbClient, conceptId: string) {
  return db
    .select()
    .from(templates)
    .where(and(eq(templates.conceptId, conceptId), eq(templates.reviewStatus, "reviewed")))
    .orderBy(asc(templates.difficulty), asc(templates.id));
}

export interface FindOrCreateItemParams {
  id: string;
  templateId: string;
  templateVersion: number;
  seed: number;
  conceptId: string;
  prompt: unknown;
  answer: unknown;
  misconceptionAnswers?: Record<string, unknown>;
  hints: unknown;
  workedExample: unknown;
  visual?: unknown;
}

export async function findOrCreateItemInstance(
  db: DbClient,
  params: FindOrCreateItemParams,
): Promise<typeof itemInstances.$inferSelect> {
  // Check if item instance already exists
  const existing = await db
    .select()
    .from(itemInstances)
    .where(
      and(
        eq(itemInstances.templateId, params.templateId),
        eq(itemInstances.templateVersion, params.templateVersion),
        eq(itemInstances.seed, params.seed),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  // Insert new
  const [created] = await db
    .insert(itemInstances)
    .values({
      id: params.id,
      templateId: params.templateId,
      templateVersion: params.templateVersion,
      seed: params.seed,
      conceptId: params.conceptId,
      prompt: params.prompt,
      answer: params.answer,
      misconceptionAnswers: params.misconceptionAnswers ?? {},
      hints: params.hints,
      workedExample: params.workedExample,
      visual: params.visual ?? null,
    })
    .returning();

  if (!created) {
    throw new Error(`Failed to create item instance ${params.id}`);
  }
  return created;
}

export async function getItemInstance(db: DbClient, itemInstanceId: string) {
  const rows = await db
    .select()
    .from(itemInstances)
    .where(eq(itemInstances.id, itemInstanceId))
    .limit(1);
  return rows[0] ?? null;
}
