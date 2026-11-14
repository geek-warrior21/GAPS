import { CONCEPTS, EDGES, EXPLANATIONS } from "@gaps/content";
import { type ConceptId, type MisconceptionId } from "@gaps/domain";
import { createStudentRepo, getItemInstance, type DbClient, getDb, attempts } from "@gaps/db";
import { eq, and, desc } from "drizzle-orm";
import type { RichTextDto, VisualSpecDto } from "@gaps/contracts";
import { EngineError } from "../session/engine";

export interface TutorContext {
  readonly studentId: string;
  readonly sessionId: string;
  readonly conceptId: ConceptId;
  readonly conceptTitle: string;
  readonly conceptDescription: string;
  readonly chapter: string;
  readonly prerequisites: readonly ConceptId[];
  readonly weakPrerequisites: readonly ConceptId[];
  readonly activeObjective: string;
  readonly currentQuestion?: {
    readonly itemInstanceId: string;
    readonly promptText: string;
    readonly visual?: VisualSpecDto;
    readonly hints: readonly unknown[];
    readonly workedExample: unknown;
    readonly forbiddenAnswerStrings: readonly string[];
  };
  readonly recentAttempts: ReadonlyArray<{
    readonly rawAnswer: string;
    readonly outcome: string;
    readonly misconceptionId?: string | null;
  }>;
  readonly activeMisconceptions: readonly MisconceptionId[];
  readonly explanations: {
    readonly picture: string;
    readonly everyday: string;
    readonly steps: string;
  };
  readonly activeRoute: "picture" | "everyday" | "steps";
  readonly currentBelief: {
    readonly status: string;
    readonly pKnown: number;
  };
  readonly revealedHintsCount: number;
  readonly conversationHistory: ReadonlyArray<{
    readonly id: string;
    readonly role: "student" | "assistant";
    readonly text: string;
    readonly actionType?: string;
    readonly createdAt: string;
  }>;
}

export function richTextToPlainText(richText: unknown): string {
  if (!Array.isArray(richText)) {
    return typeof richText === "string" ? richText : "";
  }
  return (richText as RichTextDto)
    .map((seg) => {
      if (seg.t === "text") return seg.v;
      if (seg.t === "frac") return `${seg.n}/${seg.d}`;
      if (seg.t === "mixed") return `${seg.w} ${seg.n}/${seg.d}`;
      if (seg.t === "blank") return "___";
      if (seg.t === "math") return seg.v;
      return "";
    })
    .join("")
    .trim();
}

function extractForbiddenAnswerStrings(answer: unknown): string[] {
  const result: string[] = [];
  if (!answer || typeof answer !== "object") return result;

  const ans = answer as Record<string, unknown>;
  if (ans.kind === "rational" && ans.value && typeof ans.value === "object") {
    const val = ans.value as { n: string | number; d: string | number };
    const n = Number(val.n);
    const d = Number(val.d);
    result.push(`${n}/${d}`);
    if (d !== 0) {
      const dec = (n / d).toString();
      result.push(dec);
    }
  } else if (ans.kind === "integer" && ans.value !== undefined) {
    result.push(String(ans.value));
  } else if (ans.kind === "choice" && ans.choiceId !== undefined) {
    result.push(String(ans.choiceId));
  }
  return result;
}

export async function buildTutorContext(
  studentId: string,
  sessionId: string,
  db: DbClient = getDb(),
): Promise<TutorContext> {
  const studentRepo = createStudentRepo(studentId, db);
  const session = await studentRepo.getSession(sessionId);

  if (!session || session.studentId !== studentId) {
    throw new EngineError("Session not found or unauthorized", 404);
  }

  if (session.status !== "active") {
    throw new EngineError("Learning session is not active", 400);
  }

  // 1. Current Step & Concept
  const currentStep = session.currentStep as {
    kind?: string;
    item?: { id: string; conceptId: string };
  } | null;

  const conceptId: ConceptId =
    (currentStep?.item?.conceptId as ConceptId) ??
    (session.focusConceptId as ConceptId) ??
    "MATH-FRAC-PART";

  const conceptMeta = CONCEPTS.find((c) => c.id === conceptId) ?? CONCEPTS[0]!;

  // 2. Prerequisites
  const incomingEdges = EDGES.filter((edge) => edge.conceptId === conceptId);
  const prerequisites = incomingEdges.map((e) => e.prereqId as ConceptId);

  // Check weak prerequisites
  const weakPrerequisites: ConceptId[] = [];
  for (const prereqId of prerequisites) {
    const belief = await studentRepo.getConceptBelief(prereqId);
    if (!belief || (belief.status !== "demonstrated" && belief.status !== "retained")) {
      weakPrerequisites.push(prereqId);
    }
  }

  // 3. Question Metadata (if active item)
  let currentQuestion: TutorContext["currentQuestion"] | undefined;
  if (currentStep?.kind === "item" && currentStep.item?.id) {
    const itemInstance = await getItemInstance(db, currentStep.item.id);
    if (itemInstance) {
      currentQuestion = {
        itemInstanceId: itemInstance.id,
        promptText: richTextToPlainText(itemInstance.prompt),
        visual: (itemInstance.visual as VisualSpecDto) ?? undefined,
        hints: (itemInstance.hints as unknown[]) ?? [],
        workedExample: itemInstance.workedExample,
        forbiddenAnswerStrings: extractForbiddenAnswerStrings(itemInstance.answer),
      };
    }
  }

  // 4. Recent Attempts on this concept in this session
  const rawAttempts = await db
    .select({
      rawAnswer: attempts.rawAnswer,
      outcome: attempts.outcome,
      misconceptionId: attempts.misconceptionId,
    })
    .from(attempts)
    .where(and(eq(attempts.sessionId, sessionId), eq(attempts.conceptId, conceptId)))
    .orderBy(desc(attempts.createdAt))
    .limit(5);

  const recentAttempts = rawAttempts.map((a) => ({
    rawAnswer: a.rawAnswer,
    outcome: a.outcome,
    misconceptionId: a.misconceptionId,
  }));

  // 5. Active Misconceptions
  const activeMisconceptions: MisconceptionId[] = [];
  for (const a of recentAttempts) {
    if (a.misconceptionId && !activeMisconceptions.includes(a.misconceptionId as MisconceptionId)) {
      activeMisconceptions.push(a.misconceptionId as MisconceptionId);
    }
  }

  // 6. Curriculum Explanations
  const expObj =
    EXPLANATIONS[conceptId as keyof typeof EXPLANATIONS] ?? EXPLANATIONS["MATH-FRAC-PART"];
  const explanations = {
    picture: richTextToPlainText(expObj.picture),
    everyday: richTextToPlainText(expObj.everyday),
    steps: richTextToPlainText(expObj.steps),
  };

  // 7. Student Belief
  const rawBelief = await studentRepo.getConceptBelief(conceptId);
  const currentBelief = {
    status: rawBelief?.status ?? "unattempted",
    pKnown: rawBelief?.estimate ? Number(rawBelief.estimate) : 0,
  };

  // 8. Session Counters / Tutor Conversation
  const counters = (session.counters as Record<string, unknown>) ?? {};
  const conversationHistory =
    (counters.tutorMessages as Array<{
      id: string;
      role: "student" | "assistant";
      text: string;
      actionType?: string;
      createdAt: string;
    }>) ?? [];

  const revealedHintsCount = (counters.hintsRevealed as number) ?? 0;

  return {
    studentId,
    sessionId,
    conceptId,
    conceptTitle: conceptMeta.studentTitle,
    conceptDescription: conceptMeta.description,
    chapter: conceptMeta.chapterId,
    prerequisites,
    weakPrerequisites,
    activeObjective: `Master ${conceptMeta.studentTitle} in Chapter ${conceptMeta.chapterId}`,
    currentQuestion,
    recentAttempts,
    activeMisconceptions,
    explanations,
    activeRoute: "picture",
    currentBelief,
    revealedHintsCount,
    conversationHistory,
  };
}
