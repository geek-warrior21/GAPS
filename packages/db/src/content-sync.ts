import { createHash } from "node:crypto";
import { CHAPTERS, CONCEPTS, EDGES, MISCONCEPTIONS, TEMPLATES } from "@gaps/content";
import { getDb, type DbClient } from "./client";
import { chapters, conceptEdges, concepts, misconceptions, templates } from "./schema";

export function computeContentHash(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 16);
}

export async function syncContent(db: DbClient = getDb()): Promise<{
  chaptersCount: number;
  conceptsCount: number;
  edgesCount: number;
  misconceptionsCount: number;
  templatesCount: number;
}> {
  // 1. Chapters
  for (const c of CHAPTERS) {
    await db
      .insert(chapters)
      .values({
        id: c.id,
        strand: c.strand,
        title: c.title,
        ord: c.ord,
      })
      .onConflictDoUpdate({
        target: chapters.id,
        set: {
          strand: c.strand,
          title: c.title,
          ord: c.ord,
        },
      });
  }

  // 2. Concepts
  for (const c of CONCEPTS) {
    await db
      .insert(concepts)
      .values({
        id: c.id,
        chapterId: c.chapterId,
        title: c.title,
        studentTitle: c.studentTitle,
        description: c.description,
        gradeMin: c.gradeMin,
        gradeMax: c.gradeMax,
        topoOrder: c.topoOrder,
      })
      .onConflictDoUpdate({
        target: concepts.id,
        set: {
          chapterId: c.chapterId,
          title: c.title,
          studentTitle: c.studentTitle,
          description: c.description,
          gradeMin: c.gradeMin,
          gradeMax: c.gradeMax,
          topoOrder: c.topoOrder,
        },
      });
  }

  // 3. Edges
  for (const e of EDGES) {
    await db
      .insert(conceptEdges)
      .values({
        prereqId: e.prereqId,
        conceptId: e.conceptId,
      })
      .onConflictDoNothing();
  }

  // 4. Misconceptions
  for (const m of MISCONCEPTIONS) {
    await db
      .insert(misconceptions)
      .values({
        id: m.id,
        conceptIds: [...m.conceptIds],
        title: m.title,
        studentFeedback: m.studentFeedback,
        teacherNote: m.teacherNote,
      })
      .onConflictDoUpdate({
        target: misconceptions.id,
        set: {
          conceptIds: [...m.conceptIds],
          title: m.title,
          studentFeedback: m.studentFeedback,
          teacherNote: m.teacherNote,
        },
      });
  }

  // 5. Templates
  for (const t of TEMPLATES) {
    // Determine answerKind
    const hash = computeContentHash({
      id: t.id,
      version: t.version,
      difficulty: t.difficulty,
    });

    await db
      .insert(templates)
      .values({
        id: t.id,
        version: t.version,
        conceptId: t.conceptId,
        difficulty: t.difficulty,
        answerKind: "rational",
        reviewStatus: t.review.status,
        reviewedBy: t.review.by,
        reviewedAt: t.review.at ? new Date(t.review.at) : undefined,
        contentHash: hash,
      })
      .onConflictDoUpdate({
        target: [templates.id, templates.version],
        set: {
          conceptId: t.conceptId,
          difficulty: t.difficulty,
          answerKind: "rational",
          reviewStatus: t.review.status,
          reviewedBy: t.review.by,
          reviewedAt: t.review.at ? new Date(t.review.at) : undefined,
          contentHash: hash,
        },
      });
  }

  return {
    chaptersCount: CHAPTERS.length,
    conceptsCount: CONCEPTS.length,
    edgesCount: EDGES.length,
    misconceptionsCount: MISCONCEPTIONS.length,
    templatesCount: TEMPLATES.length,
  };
}
