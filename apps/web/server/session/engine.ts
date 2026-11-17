import {
  CONCEPTS,
  CONCEPTS_BY_ID,
  CHAPTERS,
  EDGES,
  EXPLANATIONS,
  TEMPLATES,
  generateItem,
  type Template,
} from "@gaps/content";
import {
  type AnswerSpec,
  type Belief,
  type CheckedAttempt,
  type ConceptId,
  type DiagnosticState,
  type MisconceptionId,
  type MisconceptionMap,
  type MisconceptionValue,
  type RationalAcceptKind,
  type RationalForm,
  type TeachingAction,
  MISCONCEPTION_CATALOG,
  POLICY_VERSION,
  buildComebackCard,
  createDiagnostic,
  createRng,
  detectMisconception,
  makeId,
  projectDiagnosticBeliefs,
  rational,
  reconcileActiveMisconceptions,
  replayTransitions,
  selectAdaptiveActivity,
  stepDiagnostic,
  toIstDateString,
  toPublicBelief,
  verify,
  type IdEntity,
} from "@gaps/domain";
import {
  createStudentRepo,
  findOrCreateItemInstance,
  getDb,
  getItemInstance,
  type DbClient,
  attempts,
  cohorts,
  learningSessions,
  users,
} from "@gaps/db";
import { and, eq } from "drizzle-orm";
import type {
  BossBattleInfoDto,
  ComebackCardDto,
  ConceptItemDto,
  ConceptsResponse,
  DueReviewItem,
  GapMapConceptNode,
  GapMapResponse,
  HomeDashboardResponse,
  ItemViewDto,
  LearningSessionDto,
  QuestDto,
  QuestSlot,
  RequestHelpRequest,
  RequestHelpResponse,
  RichTextDto,
  SolveInitRequest,
  SolveInitResponse,
  StartSessionRequest,
  StartSessionResponse,
  StepDto,
  SubmitAttemptRequest,
  SubmitAttemptResponse,
  VisualSpecDto,
} from "@gaps/contracts";
import { renderComebackMessage } from "../comeback";
import { areDraftsServable } from "../runtime-policy";

export class EngineError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = "ENGINE_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function generateDomainId(entity: IdEntity): string {
  const rng = createRng(Math.floor(Math.random() * 2147483647));
  return makeId(entity, Date.now(), rng);
}

export function serializeForDb(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeForDb);
  if (typeof obj === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = serializeForDb(v);
    }
    return res;
  }
  return obj;
}

export function deserializeAnswerSpec(raw: unknown): AnswerSpec {
  if (!raw || typeof raw !== "object") return raw as AnswerSpec;
  const spec = raw as Record<string, unknown>;
  if (spec.kind === "rational") {
    const val = spec.value as { n: string | number; d: string | number };
    return {
      kind: "rational",
      value: rational(BigInt(val.n), BigInt(val.d)),
      accept: spec.accept as readonly RationalAcceptKind[] | undefined,
      form: (spec.form as RationalForm) ?? "any",
    };
  }
  if (spec.kind === "integer") {
    return {
      kind: "integer",
      value: BigInt(spec.value as string | number),
    };
  }
  if (spec.kind === "decimal") {
    const val = spec.value as { n: string | number; d: string | number };
    return {
      kind: "decimal",
      value: rational(BigInt(val.n), BigInt(val.d)),
    };
  }
  return spec as unknown as AnswerSpec;
}

export function deserializeMisconceptions(raw: unknown): MisconceptionMap {
  if (!raw || typeof raw !== "object") return {};
  const map: MisconceptionMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === "object" && "n" in v && "d" in v) {
      const ratObj = v as { n: string | number; d: string | number };
      map[k as MisconceptionId] = rational(BigInt(ratObj.n), BigInt(ratObj.d));
    } else {
      map[k as MisconceptionId] = v as MisconceptionValue;
    }
  }
  return map;
}

async function getStudentGrade(db: DbClient, studentId: string): Promise<number> {
  const user = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
  if (user[0]?.cohortId) {
    const cohort = await db.select().from(cohorts).where(eq(cohorts.id, user[0].cohortId)).limit(1);
    if (cohort[0]?.grade) return cohort[0].grade;
  }
  return 6;
}

/** Non-negotiable 10: outside the draft-serving configurations only reviewed templates are used. */
function isTemplateServable(template: Template<unknown>): boolean {
  const { status, by, at } = template.review;
  if (status === "retired") return false;
  if (status === "reviewed" && Boolean(by) && Boolean(at)) return true;
  return areDraftsServable();
}

function findTemplatesForConcept(conceptId: string): readonly Template<unknown>[] {
  const all = TEMPLATES.filter((t) => t.conceptId === conceptId);
  if (all.length === 0) {
    throw new EngineError(`No question templates available for concept ${conceptId}`, 500);
  }
  const matching = all.filter(isTemplateServable);
  if (matching.length === 0) {
    throw new EngineError("Practice for this topic is not available yet.", 404);
  }
  return matching;
}

export async function createStepFromItem(
  db: DbClient,
  conceptId: ConceptId,
  stepSeq: number,
  preferredTemplateId?: string,
  context: "learn" | "review" | "quest" | "boss" | "quick_check" | "diagnostic" = "learn",
  targetDiff?: 1 | 2 | 3,
): Promise<{ itemInstanceId: string; step: StepDto }> {
  const templates = findTemplatesForConcept(conceptId);
  let template: Template<unknown>;
  if (preferredTemplateId) {
    const found = templates.find((t) => t.id === preferredTemplateId);
    template = found ?? templates[Math.floor(Math.random() * templates.length)]!;
  } else if (targetDiff !== undefined) {
    const matchingDiff = templates.filter((t) => t.difficulty === targetDiff);
    template =
      matchingDiff.length > 0
        ? matchingDiff[Math.floor(Math.random() * matchingDiff.length)]!
        : templates[Math.floor(Math.random() * templates.length)]!;
  } else {
    template = templates[Math.floor(Math.random() * templates.length)]!;
  }

  const seed = Math.floor(Math.random() * 100000) + 1;
  const gen = generateItem(template, seed);
  const itemId = generateDomainId("itemInstance");

  const createdItem = await findOrCreateItemInstance(db, {
    id: itemId,
    templateId: template.id,
    templateVersion: template.version,
    seed,
    conceptId,
    prompt: serializeForDb(gen.prompt),
    answer: serializeForDb(gen.answer),
    misconceptionAnswers: serializeForDb(gen.misconceptions) as Record<string, unknown>,
    hints: serializeForDb(gen.hints),
    workedExample: serializeForDb(gen.workedExample),
    visual: serializeForDb(gen.visual) ?? null,
  });

  const step: StepDto = {
    kind: "item",
    stepSeq,
    context,
    item: {
      id: createdItem.id,
      conceptId,
      prompt: createdItem.prompt as RichTextDto,
      input: serializeForDb(gen.input) as ItemViewDto["input"],
      visual: (createdItem.visual as VisualSpecDto) ?? undefined,
    },
    help: context === "boss" ? [] : ["hint", "explain", "worked_example"],
  };

  return { itemInstanceId: createdItem.id, step };
}

export interface ChapterBossConfig {
  chapterId: "A" | "B" | "C";
  name: string;
  title: string;
  conceptIds: ConceptId[];
  requiredCount: number;
  unlockRuleText: string;
}

export const CHAPTER_BOSSES: Record<string, ChapterBossConfig> = {
  A: {
    chapterId: "A",
    name: "The Equal Splitter",
    title: "Chapter A Boss: The Equal Splitter",
    conceptIds: [
      "MATH-FRAC-PART",
      "MATH-FRAC-NUMLINE",
      "MATH-NUM-HCF",
      "MATH-FRAC-EQUIV",
      "MATH-FRAC-SIMPLIFY",
      "MATH-FRAC-COMPARE",
      "MATH-FRAC-MIXED",
    ],
    requiredCount: 4,
    unlockRuleText: "Demonstrate or develop at least 4 of 7 Chapter A concepts",
  },
  B: {
    chapterId: "B",
    name: "The Cross Multiplier",
    title: "Chapter B Boss: The Cross Multiplier",
    conceptIds: [
      "MATH-NUM-LCM",
      "MATH-FRAC-ADDLIKE",
      "MATH-FRAC-ADDUNLIKE",
      "MATH-FRAC-MULT",
      "MATH-FRAC-DIV",
    ],
    requiredCount: 3,
    unlockRuleText: "Demonstrate or develop at least 3 of 5 Chapter B concepts",
  },
  C: {
    chapterId: "C",
    name: "The Real-World Riddle",
    title: "Chapter C Boss: The Real-World Riddle",
    conceptIds: ["MATH-FRAC-DEC", "MATH-FRAC-WORD"],
    requiredCount: 1,
    unlockRuleText: "Demonstrate or develop at least 1 of 2 Chapter C concepts",
  },
};

export async function getChapterBosses(
  studentId: string,
  db: DbClient = getDb(),
): Promise<BossBattleInfoDto[]> {
  const studentRepo = createStudentRepo(studentId, db);
  const beliefs = await studentRepo.getConceptBeliefs();
  const beliefMap = new Map<ConceptId, (typeof beliefs)[0]>();
  for (const b of beliefs) {
    beliefMap.set(b.conceptId as ConceptId, b);
  }

  const result: BossBattleInfoDto[] = [];

  for (const [chId, config] of Object.entries(CHAPTER_BOSSES)) {
    let developingOrMasteredCount = 0;
    for (const cid of config.conceptIds) {
      const b = beliefMap.get(cid);
      if (
        b &&
        (b.status === "developing" || b.status === "demonstrated" || b.status === "retained")
      ) {
        developingOrMasteredCount++;
      }
    }

    const unlocked = developingOrMasteredCount >= config.requiredCount;
    const lastBattle = await studentRepo.getBossBattle(chId);

    let status: BossBattleInfoDto["status"] = "locked";
    if (lastBattle?.status === "defeated") {
      status = "defeated";
    } else if (unlocked) {
      status = "ready";
    }

    result.push({
      chapterId: chId,
      name: config.name,
      title: config.title,
      unlocked,
      unlockRule: config.unlockRuleText,
      status,
      totalConcepts: config.conceptIds.length,
      developingOrMasteredCount,
      lastResult: lastBattle
        ? {
            correctN: lastBattle.correctN,
            totalN: (lastBattle.itemIds as string[])?.length || 8,
            status: lastBattle.status as "defeated" | "retreated",
            at: lastBattle.createdAt.toISOString(),
          }
        : null,
    });
  }

  return result;
}

export async function startBossBattle(
  studentId: string,
  chapterId: string,
  db: DbClient = getDb(),
): Promise<StartSessionResponse> {
  const studentRepo = createStudentRepo(studentId, db);
  const bosses = await getChapterBosses(studentId, db);
  const boss = bosses.find((b) => b.chapterId === chapterId);
  if (!boss) {
    throw new EngineError(`Unknown chapter ${chapterId}`, 404, "CHAPTER_NOT_FOUND");
  }
  if (!boss.unlocked) {
    throw new EngineError(`Boss battle is locked: ${boss.unlockRule}`, 409, "BOSS_LOCKED");
  }

  await studentRepo.abandonActiveSessions();

  const config = CHAPTER_BOSSES[chapterId]!;
  const firstConcept = config.conceptIds[0]!;

  const { itemInstanceId, step } = await createStepFromItem(
    db,
    firstConcept,
    1,
    undefined,
    "boss",
    2,
  );

  const sessionId = generateDomainId("session");
  const bossId = generateDomainId("boss");

  const createdSession = await studentRepo.createSession({
    id: sessionId,
    mode: "boss",
    focusConceptId: firstConcept,
    status: "active",
    budgetS: 1200,
    stepSeq: 1,
    currentStep: serializeForDb(step) as Record<string, unknown>,
    counters: {
      bossId,
      chapterId,
      totalN: 0,
      correctN: 0,
      missedConceptIds: [],
      itemAssistance: {},
    },
  });

  await studentRepo.createBossBattle({
    id: bossId,
    chapterId,
    sessionId,
    itemIds: [itemInstanceId],
    correctN: 0,
    status: "active",
  });

  return {
    session: {
      id: createdSession.id,
      studentId: createdSession.studentId,
      mode: "boss",
      focusConceptId: firstConcept,
      status: "active",
      budgetS: createdSession.budgetS,
      stepSeq: createdSession.stepSeq,
      startedAt: createdSession.startedAt.toISOString(),
    },
    initialStep: step,
  };
}

export async function startDailyQuestSession(
  studentId: string,
  db: DbClient = getDb(),
): Promise<StartSessionResponse> {
  const studentRepo = createStudentRepo(studentId, db);
  await studentRepo.abandonActiveSessions();

  const quest = await getDailyQuest(studentId, db);
  const firstSlot = quest.slots.find((s) => !s.completed) ?? quest.slots[0]!;
  const conceptId = firstSlot.conceptId ?? "MATH-FRAC-PART";

  const { step } = await createStepFromItem(db, conceptId, 1, undefined, "quest");

  const sessionId = generateDomainId("session");
  const slotIndex = quest.slots.findIndex((s) => s.slotId === firstSlot.slotId);

  const createdSession = await studentRepo.createSession({
    id: sessionId,
    mode: "quest",
    focusConceptId: conceptId,
    status: "active",
    budgetS: 600,
    stepSeq: 1,
    currentStep: serializeForDb(step) as Record<string, unknown>,
    counters: {
      questId: quest.id,
      slotIndex: Math.max(slotIndex, 0),
      slots: quest.slots,
      completedSteps: 0,
      correctN: 0,
      itemAssistance: {},
    },
  });

  await studentRepo.updateQuest(quest.id, { sessionId });

  return {
    session: {
      id: createdSession.id,
      studentId: createdSession.studentId,
      mode: "quest",
      focusConceptId: conceptId,
      status: "active",
      budgetS: createdSession.budgetS,
      stepSeq: createdSession.stepSeq,
      startedAt: createdSession.startedAt.toISOString(),
    },
    initialStep: step,
  };
}

export async function startQuickCheckSession(
  studentId: string,
  db: DbClient = getDb(),
): Promise<StartSessionResponse> {
  const studentRepo = createStudentRepo(studentId, db);
  await studentRepo.abandonActiveSessions();

  const rawGrade = await getStudentGrade(db, studentId);
  const grade: 6 | 7 | 8 = rawGrade === 7 || rawGrade === 8 ? rawGrade : 6;
  const gradeEntry: Record<6 | 7 | 8, ConceptId> = {
    6: "MATH-FRAC-PART",
    7: "MATH-FRAC-EQUIV",
    8: "MATH-FRAC-ADDUNLIKE",
  };
  const startConceptId = gradeEntry[grade];

  const { step } = await createStepFromItem(db, startConceptId, 1, undefined, "quick_check", 2);

  const sessionId = generateDomainId("session");
  const createdSession = await studentRepo.createSession({
    id: sessionId,
    mode: "quick_check",
    focusConceptId: startConceptId,
    status: "active",
    budgetS: 600,
    stepSeq: 1,
    currentStep: serializeForDb(step) as Record<string, unknown>,
    counters: {
      quickCheckState: {
        grade,
        tested: [startConceptId],
        itemCount: 0,
        lowestMiss: null,
        highestHit: null,
        currentConceptId: startConceptId,
      },
      completedSteps: 0,
      correctN: 0,
      itemAssistance: {},
    },
  });

  return {
    session: {
      id: createdSession.id,
      studentId: createdSession.studentId,
      mode: "quick_check",
      focusConceptId: startConceptId,
      status: "active",
      budgetS: createdSession.budgetS,
      stepSeq: createdSession.stepSeq,
      startedAt: createdSession.startedAt.toISOString(),
    },
    initialStep: step,
  };
}

export async function initSolveWithMe(
  _studentId: string,
  req: SolveInitRequest,
): Promise<SolveInitResponse> {
  const threadId = `slv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let conceptId: ConceptId = req.conceptId ?? "MATH-FRAC-ADDUNLIKE";

  if (req.text) {
    const textLower = req.text.toLowerCase();
    if (textLower.includes("part") || textLower.includes("whole") || textLower.includes("shade")) {
      conceptId = "MATH-FRAC-PART";
    } else if (textLower.includes("line")) {
      conceptId = "MATH-FRAC-NUMLINE";
    } else if (textLower.includes("equiv") || textLower.includes("equal")) {
      conceptId = "MATH-FRAC-EQUIV";
    } else if (textLower.includes("simplify") || textLower.includes("lowest")) {
      conceptId = "MATH-FRAC-SIMPLIFY";
    } else if (
      textLower.includes("compare") ||
      textLower.includes("greater") ||
      textLower.includes("smaller")
    ) {
      conceptId = "MATH-FRAC-COMPARE";
    } else if (textLower.includes("mixed") || textLower.includes("improper")) {
      conceptId = "MATH-FRAC-MIXED";
    } else if (
      textLower.includes("multiply") ||
      textLower.includes("times") ||
      textLower.includes("product") ||
      textLower.includes("×") ||
      textLower.includes("*")
    ) {
      conceptId = "MATH-FRAC-MULT";
    } else if (
      textLower.includes("divide") ||
      textLower.includes("division") ||
      textLower.includes("÷") ||
      textLower.includes("divided by")
    ) {
      conceptId = "MATH-FRAC-DIV";
    } else if (
      textLower.includes("add") ||
      textLower.includes("plus") ||
      textLower.includes("+") ||
      textLower.includes("sum")
    ) {
      conceptId = "MATH-FRAC-ADDUNLIKE";
    } else if (
      textLower.includes("word") ||
      textLower.includes("problem") ||
      textLower.includes("share") ||
      textLower.includes("roti")
    ) {
      conceptId = "MATH-FRAC-WORD";
    } else if (textLower.includes("decimal")) {
      conceptId = "MATH-FRAC-DEC";
    }
  }

  const conceptMeta = CONCEPTS_BY_ID[conceptId] ?? CONCEPTS[0]!;
  const explanation = EXPLANATIONS[conceptId] ?? EXPLANATIONS["MATH-FRAC-PART"];

  const initialStep: StepDto = {
    kind: "explanation",
    stepSeq: 1,
    route: "picture",
    body: [...explanation.picture] as RichTextDto,
    visual: undefined,
    source: "authored",
    then: "continue",
  };

  return {
    threadId,
    conceptId,
    conceptTitle: conceptMeta.studentTitle,
    restated: req.text
      ? `Let's work through: "${req.text}"`
      : `Let's understand: ${conceptMeta.studentTitle}`,
    problemType: req.problemType ?? "arithmetic",
    initialStep,
  };
}

export async function getConceptsOverview(
  studentId: string,
  db: DbClient = getDb(),
): Promise<ConceptsResponse> {
  const studentRepo = createStudentRepo(studentId, db);
  const beliefs = await studentRepo.getConceptBeliefs();
  const beliefMap = new Map<ConceptId, (typeof beliefs)[0]>();
  for (const b of beliefs) {
    beliefMap.set(b.conceptId as ConceptId, b);
  }

  const chaptersWithConcepts = CHAPTERS.map((ch) => {
    const chConcepts = CONCEPTS.filter((c) => c.chapterId === ch.id).map((c) => {
      const b = beliefMap.get(c.id as ConceptId);
      return {
        id: c.id as ConceptId,
        chapterId: ch.id,
        title: c.title,
        studentTitle: c.studentTitle,
        description: c.description,
        topoOrder: c.topoOrder,
        status: (b?.status as ConceptItemDto["status"]) ?? "not_assessed",
      };
    });

    return {
      id: ch.id,
      strand: ch.strand,
      title: ch.title,
      ord: ch.ord,
      concepts: chConcepts,
    };
  });

  return { chapters: chaptersWithConcepts };
}

export async function startLearningSession(
  studentId: string,
  options: StartSessionRequest,
  db: DbClient = getDb(),
): Promise<StartSessionResponse> {
  if (options.mode === "quest") {
    return startDailyQuestSession(studentId, db);
  }
  if (options.mode === "boss") {
    const chapterId =
      (options.focusConceptId && CONCEPTS_BY_ID[options.focusConceptId]?.chapterId) || "A";
    return startBossBattle(studentId, chapterId, db);
  }
  if (options.mode === "quick_check") {
    return startQuickCheckSession(studentId, db);
  }

  const studentRepo = createStudentRepo(studentId, db);

  // Abandon any previous active learning session (invariant: only 1 active session)
  await studentRepo.abandonActiveSessions();

  if (options.mode === "diagnostic") {
    const rawGrade = await getStudentGrade(db, studentId);
    const grade: 6 | 7 | 8 = rawGrade === 7 || rawGrade === 8 ? rawGrade : 6;
    const existingBeliefsList = await studentRepo.getConceptBeliefs();
    const existingBeliefs: Partial<Record<ConceptId, Belief["status"]>> = {};
    for (const b of existingBeliefsList) {
      existingBeliefs[b.conceptId as ConceptId] = b.status as Belief["status"];
    }

    const diag = createDiagnostic({ grade, existingBeliefs });
    const focusConceptId: ConceptId = diag.currentConceptId ?? "MATH-FRAC-PART";

    const { step } = await createStepFromItem(db, focusConceptId, 1, undefined, "diagnostic");
    const sessionId = generateDomainId("session");
    const createdSession = await studentRepo.createSession({
      id: sessionId,
      mode: "diagnostic",
      focusConceptId,
      status: "active",
      budgetS: options.budgetS ?? 900,
      stepSeq: 1,
      currentStep: serializeForDb(step) as Record<string, unknown>,
      counters: {
        diagnosticState: diag,
        completedSteps: 0,
        correctN: 0,
      },
    });

    const sessionDto: LearningSessionDto = {
      id: createdSession.id,
      studentId: createdSession.studentId,
      mode: "diagnostic",
      focusConceptId,
      status: "active",
      budgetS: createdSession.budgetS,
      stepSeq: createdSession.stepSeq,
      startedAt: createdSession.startedAt.toISOString(),
    };

    return {
      session: sessionDto,
      initialStep: step,
    };
  }

  // Determine focus concept
  let focusConceptId = options.focusConceptId;
  if (!focusConceptId) {
    const state = await studentRepo.ensureStudentState();
    focusConceptId = (state.focusConceptId as ConceptId) || "MATH-FRAC-PART";
  }

  // Generate initial step
  const context = options.mode === "review" ? "review" : "learn";
  const { step } = await createStepFromItem(db, focusConceptId, 1, undefined, context);

  const sessionId = generateDomainId("session");
  const createdSession = await studentRepo.createSession({
    id: sessionId,
    mode: options.mode,
    focusConceptId,
    status: "active",
    budgetS: options.budgetS,
    stepSeq: 1,
    currentStep: serializeForDb(step) as Record<string, unknown>,
    counters: {
      completedSteps: 0,
      correctN: 0,
      consecutiveIndependentCorrect: 0,
      consecutiveIncorrect: 0,
      remediationCount: 0,
      recentTemplateIds: [],
      prereqRouteTaken: false,
    },
  });

  const sessionDto: LearningSessionDto = {
    id: createdSession.id,
    studentId: createdSession.studentId,
    mode: createdSession.mode as LearningSessionDto["mode"],
    focusConceptId: (createdSession.focusConceptId as ConceptId) ?? null,
    status: "active",
    budgetS: createdSession.budgetS,
    stepSeq: createdSession.stepSeq,
    startedAt: createdSession.startedAt.toISOString(),
  };

  return {
    session: sessionDto,
    initialStep: step,
  };
}

export async function processSessionAttempt(
  studentId: string,
  sessionId: string,
  payload: SubmitAttemptRequest,
  db: DbClient = getDb(),
): Promise<SubmitAttemptResponse> {
  const studentRepo = createStudentRepo(studentId, db);
  const session = await studentRepo.getSession(sessionId);

  if (!session) {
    throw new EngineError("Learning session not found", 404, "SESSION_NOT_FOUND");
  }
  if (session.status !== "active") {
    throw new EngineError("Learning session is no longer active", 400, "SESSION_INACTIVE");
  }

  // 1. Idempotency check: if clientAttemptId was already submitted, return cached response
  const existingAttempt = await db
    .select()
    .from(attempts)
    .where(
      and(eq(attempts.sessionId, sessionId), eq(attempts.clientAttemptId, payload.clientAttemptId)),
    )
    .limit(1);

  if (existingAttempt[0]?.response && Object.keys(existingAttempt[0].response).length > 0) {
    return existingAttempt[0].response as SubmitAttemptResponse;
  }

  // 2. Fetch Item Instance
  const item = await getItemInstance(db, payload.itemInstanceId);
  if (!item) {
    throw new EngineError("Item instance not found", 404, "ITEM_NOT_FOUND");
  }

  const conceptId = item.conceptId as ConceptId;
  const answerSpec = deserializeAnswerSpec(item.answer);
  const misconceptions = deserializeMisconceptions(item.misconceptionAnswers);

  // 3. Exact Verification (BigInt Rational) & Misconception Detection
  const verifyResult = verify(answerSpec, payload.rawAnswer, misconceptions);
  const outcome = verifyResult.outcome;

  const allStudentAttempts = await studentRepo.getAllAttempts();
  const conceptAttempts = allStudentAttempts.filter((a) => a.conceptId === conceptId);

  let candidateVal: MisconceptionValue = payload.rawAnswer;
  if (verifyResult.parsed) {
    const val = verifyResult.parsed.value;
    if (typeof val === "string") {
      candidateVal = val;
    } else if (val && typeof val === "object" && "n" in val && "d" in val) {
      candidateVal = val as MisconceptionValue;
    }
  }

  let correctVal: MisconceptionValue = rational(1n, 1n);
  if (answerSpec.kind === "order") {
    correctVal = answerSpec.value[0] ?? payload.rawAnswer;
  } else {
    correctVal = answerSpec.value;
  }

  const detection = detectMisconception(
    conceptId,
    candidateVal,
    correctVal,
    misconceptions,
    conceptAttempts.map((a) => ({
      outcome: a.outcome as "correct" | "incorrect" | "unparseable" | "not_simplified",
      misconceptionId: a.misconceptionId ? (a.misconceptionId as MisconceptionId) : undefined,
    })),
    payload.rawAnswer,
  );

  const misconceptionId = detection.primaryMisconceptionId ?? verifyResult.misconceptionId ?? null;

  const isDiagnostic = session.mode === "diagnostic";
  const isBoss = session.mode === "boss";
  const isQuickCheck = session.mode === "quick_check";
  const isQuest = session.mode === "quest";

  const isResolved =
    isDiagnostic ||
    isBoss ||
    isQuickCheck ||
    outcome === "correct" ||
    payload.tryNo >= 2 ||
    outcome === "unparseable";
  const tryAgain = !isResolved && payload.tryNo === 1;

  // 4. Server-derived assistance level (never trust client-supplied assistanceLevel alone)
  const sessionCounters = (session.counters as Record<string, unknown>) ?? {};
  const itemAssistanceMap = (sessionCounters.itemAssistance as Record<string, number>) ?? {};
  const serverItemAssistance = itemAssistanceMap[item.id] ?? 0;
  const effectiveAssistance = Math.max(serverItemAssistance, payload.assistanceLevel ?? 0) as
    0 | 1 | 2 | 3;

  const attemptId = generateDomainId("attempt");
  await studentRepo.recordAttempt({
    id: attemptId,
    sessionId,
    clientAttemptId: payload.clientAttemptId,
    stepSeq: session.stepSeq,
    itemInstanceId: item.id,
    conceptId,
    rawAnswer: payload.rawAnswer,
    parsed: (serializeForDb(verifyResult.parsed) as Record<string, unknown>) ?? null,
    outcome,
    misconceptionId,
    assistanceLevel: effectiveAssistance,
    tryNo: payload.tryNo,
    isReview: session.mode === "review",
    mode: session.mode,
    verifierVersion: verifyResult.verifierVersion,
    latencyMs: payload.latencyMs,
  });

  // 5. Update Belief State (only on resolved attempts per SPEC §19)
  let updatedBelief: ReturnType<typeof toPublicBelief> | undefined;
  let comebackCardDto: ComebackCardDto | null = null;
  let sparksAwarded = 0;
  let reconciledMisconceptions: readonly MisconceptionId[] = [];

  if (isResolved && !isDiagnostic && !isBoss) {
    // Replay authoritative transitions for this concept over all stored attempts
    const updatedAttempts: CheckedAttempt[] = [
      ...conceptAttempts.map((a) => ({
        attemptId: a.id,
        studentId: a.studentId,
        sessionId: a.sessionId,
        clientAttemptId: a.clientAttemptId,
        itemInstanceId: a.itemInstanceId,
        templateId: item.templateId,
        conceptId: a.conceptId as ConceptId,
        mode: a.mode as CheckedAttempt["mode"],
        outcome: a.outcome as CheckedAttempt["outcome"],
        misconceptionId: a.misconceptionId ? (a.misconceptionId as MisconceptionId) : undefined,
        assistance: (a.assistanceLevel as CheckedAttempt["assistance"]) ?? 0,
        tryNo: (a.tryNo as CheckedAttempt["tryNo"]) ?? 1,
        isReview: a.isReview,
        verifierVersion: (a.verifierVersion as "verify-1.0") || "verify-1.0",
        at: a.createdAt.toISOString(),
      })),
      {
        attemptId,
        studentId,
        sessionId,
        clientAttemptId: payload.clientAttemptId,
        itemInstanceId: item.id,
        templateId: item.templateId,
        conceptId,
        mode: session.mode as CheckedAttempt["mode"],
        outcome: outcome as CheckedAttempt["outcome"],
        misconceptionId: misconceptionId ? (misconceptionId as MisconceptionId) : undefined,
        assistance: effectiveAssistance as CheckedAttempt["assistance"],
        tryNo: (payload.tryNo as CheckedAttempt["tryNo"]) ?? 1,
        isReview: session.mode === "review",
        verifierVersion: (verifyResult.verifierVersion as "verify-1.0") || "verify-1.0",
        at: new Date().toISOString(),
      },
    ];

    const transitionHistory = replayTransitions(conceptId, updatedAttempts, {
      templatesForConcept: 3,
    });
    const newState = transitionHistory.state;
    updatedBelief = toPublicBelief(newState);

    // Persist updated belief
    const existingBelief = await studentRepo.getConceptBelief(conceptId);
    reconciledMisconceptions = reconcileActiveMisconceptions(
      (existingBelief?.activeMisconceptionIds as MisconceptionId[]) ?? [],
      detection,
      outcome === "correct",
      effectiveAssistance === 0,
    );

    await studentRepo.upsertConceptBelief({
      studentId,
      conceptId,
      status: newState.status,
      estimate: newState.estimate ? String(newState.estimate) : null,
      reliability: newState.reliability,
      demonstratedAt: newState.demonstratedAt ? new Date(newState.demonstratedAt) : null,
      retainedAt: newState.retainedAt ? new Date(newState.retainedAt) : null,
      firstNeedsSupportAt: newState.firstNeedsSupportAt
        ? new Date(newState.firstNeedsSupportAt)
        : null,
      lastEvidenceAt: new Date(),
      activeMisconceptionIds: [...reconciledMisconceptions],
      independentN: updatedAttempts.filter((a) => a.assistance === 0).length,
      independentCorrectN: updatedAttempts.filter(
        (a) => a.assistance === 0 && a.outcome === "correct",
      ).length,
    });

    // Check Sparks
    // +2 for first try correct
    if (outcome === "correct" && payload.tryNo === 1 && effectiveAssistance === 0) {
      const spk = await studentRepo.awardSparks(attemptId, "first_try_correct", 2);
      if (spk.awarded) sparksAwarded += 2;
    }

    // +20 for newly demonstrated mastery
    if (
      newState.status === "demonstrated" &&
      existingBelief?.status !== "demonstrated" &&
      existingBelief?.status !== "retained"
    ) {
      const spk = await studentRepo.awardSparks(attemptId, "mastery_demonstrated", 20);
      if (spk.awarded) sparksAwarded += 20;

      // Schedule reviews (+2d warmup, +7d retention)
      const now = new Date();
      await studentRepo.scheduleReview({
        id: `rev_warmup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        conceptId,
        kind: "warmup",
        dueAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      });
      await studentRepo.scheduleReview({
        id: `rev_retention_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        conceptId,
        kind: "retention",
        dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      });

      // Check Comeback Card trigger
      const conceptMeta = CONCEPTS.find((c) => c.id === conceptId);
      const comebackData = buildComebackCard({
        conceptId,
        studentTitle: conceptMeta?.studentTitle ?? conceptId,
        status: newState.status,
        firstNeedsSupportAt: newState.firstNeedsSupportAt,
        achievedAt: new Date().toISOString(),
        demonstratedAt: newState.demonstratedAt,
        history: updatedAttempts,
      });

      if (comebackData) {
        const cardMessage = renderComebackMessage(comebackData);
        const cardId = `cmk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const insertedCard = await studentRepo.createComebackCard({
          id: cardId,
          conceptId,
          transitionEventId: attemptId,
          pastAttemptIds: [...comebackData.pastAttemptIds],
          presentAttemptIds: [...comebackData.presentAttemptIds],
          message: {
            headline: "Your hard work paid off!",
            story: cardMessage,
            pastPrompt: `Initial practice on ${comebackData.pastDate}`,
            presentPrompt: `Demonstrated today!`,
          },
        });

        comebackCardDto = {
          id: insertedCard.id,
          conceptId,
          message: insertedCard.message as ComebackCardDto["message"],
          pastAttemptIds: insertedCard.pastAttemptIds,
          presentAttemptIds: insertedCard.presentAttemptIds,
          createdAt: insertedCard.createdAt.toISOString(),
        };
      }
    }
  }

  // 6. Teaching Action & Next Step
  let teachingAction: TeachingAction = "INDEPENDENT_PRACTICE";
  let nextStep: StepDto | null = null;
  let sessionCompleted = false;

  const currentCounters = (session.counters as Record<string, unknown> | null) ?? {};
  const completedSteps = isResolved
    ? ((currentCounters.completedSteps as number) ?? 0) + 1
    : ((currentCounters.completedSteps as number) ?? 0);
  const correctN =
    outcome === "correct"
      ? ((currentCounters.correctN as number) ?? 0) + 1
      : ((currentCounters.correctN as number) ?? 0);

  const consecutiveIndependentCorrect =
    outcome === "correct" && payload.assistanceLevel === 0
      ? ((currentCounters.consecutiveIndependentCorrect as number) ?? 0) + 1
      : outcome === "incorrect"
        ? 0
        : ((currentCounters.consecutiveIndependentCorrect as number) ?? 0);

  const consecutiveIncorrect =
    outcome === "incorrect"
      ? ((currentCounters.consecutiveIncorrect as number) ?? 0) + 1
      : outcome === "correct"
        ? 0
        : ((currentCounters.consecutiveIncorrect as number) ?? 0);

  let remediationCount = (currentCounters.remediationCount as number) ?? 0;
  const recentTemplateIds = [...((currentCounters.recentTemplateIds as string[]) ?? [])];
  if (item.templateId && !recentTemplateIds.includes(item.templateId)) {
    recentTemplateIds.push(item.templateId);
    if (recentTemplateIds.length > 3) recentTemplateIds.shift();
  }
  const prereqRouteTaken = (currentCounters.prereqRouteTaken as boolean) ?? false;

  // Feedback student copy (never "wrong" or "failed", says "not yet!")
  let feedback = "Spot on! That's correct.";
  if (outcome === "not_simplified") {
    feedback = "Not yet! That fraction is equivalent, but can be simplified further.";
  } else if (outcome === "unparseable") {
    feedback = "Not quite clear! Check your answer format and try again.";
  } else if (outcome === "incorrect") {
    if (tryAgain) {
      feedback = "Not yet! Take another look and give it another try.";
    } else if (misconceptionId && MISCONCEPTION_CATALOG[misconceptionId]) {
      feedback = `Not yet! Tip: ${MISCONCEPTION_CATALOG[misconceptionId].pattern}. Let's keep going.`;
    } else {
      feedback = "Not yet! Let's see how this one works and move forward.";
    }
  }

  if (tryAgain) {
    teachingAction = "GIVE_HINT";
    const currentStepObj = session.currentStep as { item?: ItemViewDto } | null;
    const currentItem = currentStepObj?.item ?? (session.currentStep as unknown as ItemViewDto);
    nextStep = {
      kind: "feedback_then_retry",
      stepSeq: session.stepSeq,
      message: [{ t: "text", v: feedback }],
      item: currentItem,
    };
  } else if (isDiagnostic) {
    const rawDiag = currentCounters.diagnosticState as DiagnosticState;
    const nextDiagState = stepDiagnostic(rawDiag, {
      correct: outcome === "correct",
      misconceptionId: misconceptionId ?? undefined,
    });

    if (nextDiagState.done) {
      teachingAction = "ADVANCE";
      sessionCompleted = true;
      nextStep = null;

      // Project beliefs and save
      const projections = projectDiagnosticBeliefs(nextDiagState);
      for (const [projConceptId, proj] of Object.entries(projections) as [
        ConceptId,
        { status: Belief["status"]; reliability: Belief["reliability"] },
      ][]) {
        await studentRepo.upsertConceptBelief({
          studentId,
          conceptId: projConceptId,
          status: proj.status,
          reliability: proj.reliability,
          estimate: null,
          activeMisconceptionIds: [],
          lastEvidenceAt: new Date(),
        });
      }

      const recStart: ConceptId = nextDiagState.recommendedStartConceptId ?? "MATH-FRAC-PART";
      await studentRepo.updateStudentState({
        focusConceptId: recStart,
        startConceptId: recStart,
      });

      await studentRepo.updateSession(sessionId, {
        status: "completed",
        endedAt: new Date(),
        counters: {
          ...currentCounters,
          diagnosticState: nextDiagState,
          completedSteps,
          correctN,
        },
      });
    } else {
      const nextSeq = session.stepSeq + 1;
      const nextConcept: ConceptId = nextDiagState.currentConceptId ?? "MATH-FRAC-PART";
      const { step } = await createStepFromItem(db, nextConcept, nextSeq, undefined, "diagnostic");
      nextStep = step;
      teachingAction = outcome === "correct" ? "ADVANCE" : "REVIEW_PREREQUISITE";

      await studentRepo.updateSession(sessionId, {
        stepSeq: nextSeq,
        currentStep: serializeForDb(step) as Record<string, unknown>,
        counters: {
          ...currentCounters,
          diagnosticState: nextDiagState,
          completedSteps,
          correctN,
        },
      });
    }
  } else if (isBoss) {
    teachingAction = outcome === "correct" ? "ADVANCE" : "GIVE_HINT";
    const bossId = currentCounters.bossId as string;
    const chapterId = (currentCounters.chapterId as string) || "A";
    const config = CHAPTER_BOSSES[chapterId]!;
    const correctCount =
      ((currentCounters.correctN as number) ?? 0) + (outcome === "correct" ? 1 : 0);
    const totalCount = ((currentCounters.totalN as number) ?? 0) + 1;
    const missedConceptIds = [...((currentCounters.missedConceptIds as string[]) ?? [])];
    if (outcome !== "correct") {
      missedConceptIds.push(item.conceptId);
    }

    if (totalCount >= 8) {
      sessionCompleted = true;
      const isDefeated = correctCount >= 6;
      const finishSpk = await studentRepo.awardSparks(bossId, "boss_finish", 10);
      if (finishSpk.awarded) sparksAwarded += 10;
      if (isDefeated) {
        const winSpk = await studentRepo.awardSparks(bossId, "boss_win", 40);
        if (winSpk.awarded) sparksAwarded += 40;
      }

      await studentRepo.updateBossBattle(bossId, {
        status: isDefeated ? "defeated" : "retreated",
        correctN: correctCount,
      });

      const uniqueMissed = Array.from(new Set(missedConceptIds)) as ConceptId[];
      const suggestions = uniqueMissed.map((c) => CONCEPTS_BY_ID[c]?.studentTitle ?? c);
      const note = isDefeated
        ? `Victory! You defeated ${config.name} with ${correctCount}/8 correct!`
        : `Good effort! You answered ${correctCount}/8 correctly. Practise ${suggestions.join(", ")} before challenging again.`;

      nextStep = {
        kind: "summary",
        stepSeq: session.stepSeq + 1,
        summary: {
          itemsAttempted: 8,
          sparksEarned: sparksAwarded,
          conceptsUpdated: uniqueMissed.length > 0 ? uniqueMissed : [conceptId],
          comebackUnlocked: false,
          note,
        },
      };

      await studentRepo.updateSession(sessionId, {
        status: "completed",
        endedAt: new Date(),
        counters: {
          ...currentCounters,
          totalN: totalCount,
          correctN: correctCount,
          missedConceptIds,
        },
      });
    } else {
      const nextSeq = session.stepSeq + 1;
      const nextConcept = config.conceptIds[totalCount % config.conceptIds.length]!;
      const { itemInstanceId, step } = await createStepFromItem(
        db,
        nextConcept,
        nextSeq,
        undefined,
        "boss",
        2,
      );
      nextStep = step;

      const currentBoss = await studentRepo.getBossBattle(chapterId);
      if (currentBoss) {
        await studentRepo.updateBossBattle(bossId, {
          itemIds: [...(currentBoss.itemIds ?? []), itemInstanceId],
        });
      }

      await studentRepo.updateSession(sessionId, {
        stepSeq: nextSeq,
        currentStep: serializeForDb(step) as Record<string, unknown>,
        counters: {
          ...currentCounters,
          totalN: totalCount,
          correctN: correctCount,
          missedConceptIds,
        },
      });
    }
  } else if (isQuest) {
    teachingAction = outcome === "correct" ? "ADVANCE" : "GIVE_HINT";
    const questId = currentCounters.questId as string;
    const slotIndex = (currentCounters.slotIndex as number) ?? 0;
    const questSlots = [...((currentCounters.slots as QuestSlot[]) ?? [])];

    if (questSlots[slotIndex]) {
      questSlots[slotIndex] = { ...questSlots[slotIndex]!, completed: true };
      await studentRepo.updateQuest(questId, {
        slots: questSlots as unknown as Record<string, unknown>[],
      });
    }

    const nextSlotIndex = slotIndex + 1;
    if (nextSlotIndex >= questSlots.length) {
      sessionCompleted = true;
      await studentRepo.updateQuest(questId, {
        status: "completed",
        completedAt: new Date(),
      });

      const qSpk = await studentRepo.awardSparks(questId, "quest", 20);
      if (qSpk.awarded) sparksAwarded += 20;

      nextStep = {
        kind: "summary",
        stepSeq: session.stepSeq + 1,
        summary: {
          itemsAttempted: questSlots.length,
          sparksEarned: sparksAwarded,
          conceptsUpdated: [conceptId],
          comebackUnlocked: false,
          note: "Brilliant! You completed today's Daily Quest and earned +20 Sparks!",
        },
      };

      await studentRepo.updateSession(sessionId, {
        status: "completed",
        endedAt: new Date(),
        counters: {
          ...currentCounters,
          slotIndex: nextSlotIndex,
          slots: questSlots,
        },
      });
    } else {
      const nextSeq = session.stepSeq + 1;
      const nextSlot = questSlots[nextSlotIndex]!;
      const nextConcept = nextSlot.conceptId ?? conceptId;
      const { step } = await createStepFromItem(db, nextConcept, nextSeq, undefined, "quest");
      nextStep = step;

      await studentRepo.updateSession(sessionId, {
        stepSeq: nextSeq,
        currentStep: serializeForDb(step) as Record<string, unknown>,
        counters: {
          ...currentCounters,
          slotIndex: nextSlotIndex,
          slots: questSlots,
        },
      });
    }
  } else if (isQuickCheck) {
    teachingAction = outcome === "correct" ? "ADVANCE" : "REVIEW_PREREQUISITE";
    const qcState = (currentCounters.quickCheckState as {
      grade: 6 | 7 | 8;
      tested: ConceptId[];
      itemCount: number;
      lowestMiss: ConceptId | null;
      highestHit: ConceptId | null;
      currentConceptId: ConceptId;
    }) ?? {
      grade: 6,
      tested: [conceptId],
      itemCount: 0,
      lowestMiss: null,
      highestHit: null,
      currentConceptId: conceptId,
    };

    const isHit = outcome === "correct";
    const currentConceptMeta = CONCEPTS_BY_ID[conceptId];
    const currentTopo = currentConceptMeta?.topoOrder ?? 1;

    let lowestMiss = qcState.lowestMiss;
    let highestHit = qcState.highestHit;

    if (isHit) {
      if (!highestHit || (CONCEPTS_BY_ID[highestHit]?.topoOrder ?? 0) < currentTopo) {
        highestHit = conceptId;
      }
    } else {
      if (!lowestMiss || (CONCEPTS_BY_ID[lowestMiss]?.topoOrder ?? 999) > currentTopo) {
        lowestMiss = conceptId;
      }
    }

    const itemCount = qcState.itemCount + 1;
    const tested = [...qcState.tested, conceptId];

    let nextConceptId: ConceptId | null = null;
    if (itemCount < 5) {
      if (isHit) {
        const candidate = CONCEPTS.find(
          (c) => c.topoOrder === currentTopo + 2 && !tested.includes(c.id as ConceptId),
        );
        nextConceptId = candidate ? (candidate.id as ConceptId) : null;
      } else {
        const prereqEdge = EDGES.find(
          (e) => e.conceptId === conceptId && !tested.includes(e.prereqId as ConceptId),
        );
        nextConceptId = prereqEdge ? (prereqEdge.prereqId as ConceptId) : null;
      }
    }

    if (nextConceptId && itemCount < 5) {
      const nextSeq = session.stepSeq + 1;
      const { step } = await createStepFromItem(
        db,
        nextConceptId,
        nextSeq,
        undefined,
        "quick_check",
        2,
      );
      nextStep = step;

      await studentRepo.updateSession(sessionId, {
        stepSeq: nextSeq,
        currentStep: serializeForDb(step) as Record<string, unknown>,
        counters: {
          ...currentCounters,
          quickCheckState: {
            grade: qcState.grade,
            tested,
            itemCount,
            lowestMiss,
            highestHit,
            currentConceptId: nextConceptId,
          },
        },
      });
    } else {
      sessionCompleted = true;
      const gradeEntry: Record<6 | 7 | 8, ConceptId> = {
        6: "MATH-FRAC-PART",
        7: "MATH-FRAC-EQUIV",
        8: "MATH-FRAC-ADDUNLIKE",
      };
      const recStart: ConceptId =
        lowestMiss ?? highestHit ?? gradeEntry[qcState.grade] ?? "MATH-FRAC-PART";

      await studentRepo.updateStudentState({
        focusConceptId: recStart,
        startConceptId: recStart,
      });

      nextStep = {
        kind: "summary",
        stepSeq: session.stepSeq + 1,
        summary: {
          itemsAttempted: itemCount,
          sparksEarned: sparksAwarded,
          conceptsUpdated: [recStart],
          comebackUnlocked: false,
          note: `Quick Check complete! We found your starting point: ${CONCEPTS_BY_ID[recStart]?.studentTitle ?? recStart}.`,
        },
      };

      await studentRepo.updateSession(sessionId, {
        status: "completed",
        endedAt: new Date(),
        counters: {
          ...currentCounters,
          quickCheckState: {
            ...qcState,
            itemCount,
            lowestMiss,
            highestHit,
          },
        },
      });
    }
  } else {
    // Adaptive Question Selection (Workstream C & D)
    const existingBeliefs = await studentRepo.getConceptBeliefs();
    const beliefMap = new Map<ConceptId, (typeof existingBeliefs)[0]>();
    for (const b of existingBeliefs) {
      beliefMap.set(b.conceptId as ConceptId, b);
    }

    const prereqEdges = EDGES.filter((e) => e.conceptId === conceptId);
    const prerequisiteBeliefs: Belief[] = prereqEdges.map((e) => {
      const b = beliefMap.get(e.prereqId as ConceptId);
      return {
        conceptId: e.prereqId as ConceptId,
        status: (b?.status as Belief["status"]) ?? "not_assessed",
        estimate: b?.estimate ? Number(b.estimate) : null,
        reliability: (b?.reliability as Belief["reliability"]) ?? "unsupported",
        demonstratedAt: b?.demonstratedAt ? b.demonstratedAt.toISOString() : null,
        retainedAt: b?.retainedAt ? b.retainedAt.toISOString() : null,
        firstNeedsSupportAt: b?.firstNeedsSupportAt ? b.firstNeedsSupportAt.toISOString() : null,
        activeMisconceptionIds: (b?.activeMisconceptionIds as MisconceptionId[]) ?? [],
        policyVersion: POLICY_VERSION,
        version: 1,
      };
    });

    const currentBeliefObj: Belief = {
      conceptId,
      status:
        updatedBelief?.status ??
        (beliefMap.get(conceptId)?.status as Belief["status"]) ??
        "not_assessed",
      estimate: updatedBelief
        ? 0.5
        : beliefMap.get(conceptId)?.estimate
          ? Number(beliefMap.get(conceptId)!.estimate)
          : null,
      reliability:
        updatedBelief?.reliability ??
        (beliefMap.get(conceptId)?.reliability as Belief["reliability"]) ??
        "unsupported",
      demonstratedAt:
        updatedBelief?.demonstratedAt ??
        (beliefMap.get(conceptId)?.demonstratedAt
          ? beliefMap.get(conceptId)!.demonstratedAt!.toISOString()
          : null),
      retainedAt:
        updatedBelief?.retainedAt ??
        (beliefMap.get(conceptId)?.retainedAt
          ? beliefMap.get(conceptId)!.retainedAt!.toISOString()
          : null),
      firstNeedsSupportAt:
        updatedBelief?.firstNeedsSupportAt ??
        (beliefMap.get(conceptId)?.firstNeedsSupportAt
          ? beliefMap.get(conceptId)!.firstNeedsSupportAt!.toISOString()
          : null),
      activeMisconceptionIds: [...reconciledMisconceptions],
      policyVersion: POLICY_VERSION,
      version: 1,
    };

    const rng = createRng(Date.now() ^ 0xa5a5a5a5);
    const candidateTemplates = findTemplatesForConcept(conceptId).map((t) => ({
      id: t.id,
      difficulty: t.difficulty,
      reviewed: t.review.status === "reviewed",
    }));

    const adaptiveDecision = selectAdaptiveActivity(
      {
        focusConceptId: conceptId,
        belief: currentBeliefObj,
        prerequisiteBeliefs,
        recentAttempts: conceptAttempts.map((a) => ({
          conceptId: a.conceptId as ConceptId,
          outcome: a.outcome as "correct" | "incorrect" | "unparseable" | "not_simplified",
          assistance: a.assistanceLevel ?? 0,
          tryNo: a.tryNo ?? 1,
          misconceptionId: a.misconceptionId ?? undefined,
        })),
        consecutiveIndependentCorrect,
        consecutiveIncorrect,
        activeMisconceptions: reconciledMisconceptions,
        recentTemplateIds,
        remediationCount,
        sessionMode: session.mode as "learn" | "review",
        prereqRouteTaken,
      },
      candidateTemplates,
      rng,
    );

    if (adaptiveDecision.sessionCompleted || completedSteps >= 5) {
      teachingAction = "ADVANCE";
      sessionCompleted = true;
      nextStep = null;
      await studentRepo.updateSession(sessionId, {
        status: "completed",
        endedAt: new Date(),
        counters: {
          completedSteps,
          correctN,
          consecutiveIndependentCorrect,
          consecutiveIncorrect,
          remediationCount,
          recentTemplateIds,
          prereqRouteTaken,
        },
      });
    } else if (adaptiveDecision.action === "EXPLAIN") {
      teachingAction = "EXPLAIN";
      remediationCount += 1;
      const route = adaptiveDecision.explanationRoute ?? "picture";
      const exp = EXPLANATIONS[conceptId] ?? EXPLANATIONS["MATH-FRAC-PART"];
      const nextSeq = session.stepSeq + 1;
      nextStep = {
        kind: "explanation",
        stepSeq: nextSeq,
        route,
        body: [...exp[route]] as RichTextDto,
        visual: (item.visual as VisualSpecDto) ?? undefined,
        source: "authored",
        then: "continue",
      };

      await studentRepo.updateSession(sessionId, {
        stepSeq: nextSeq,
        currentStep: serializeForDb(nextStep) as Record<string, unknown>,
        counters: {
          completedSteps,
          correctN,
          consecutiveIndependentCorrect,
          consecutiveIncorrect,
          remediationCount,
          recentTemplateIds,
          prereqRouteTaken,
        },
      });
    } else if (adaptiveDecision.action === "WORKED_EXAMPLE") {
      teachingAction = "WORKED_EXAMPLE";
      remediationCount += 1;
      const nextSeq = session.stepSeq + 1;
      const stepsArr =
        (item.workedExample as { steps?: RichTextDto[]; result?: RichTextDto })?.steps ?? [];
      const resultObj = (item.workedExample as { steps?: RichTextDto[]; result?: RichTextDto })
        ?.result ?? [{ t: "text", v: "Complete the steps." }];

      nextStep = {
        kind: "worked_example",
        stepSeq: nextSeq,
        steps: stepsArr,
        result: resultObj,
      };

      await studentRepo.updateSession(sessionId, {
        stepSeq: nextSeq,
        currentStep: serializeForDb(nextStep) as Record<string, unknown>,
        counters: {
          completedSteps,
          correctN,
          consecutiveIndependentCorrect,
          consecutiveIncorrect,
          remediationCount,
          recentTemplateIds,
          prereqRouteTaken,
        },
      });
    } else if (adaptiveDecision.action === "REVIEW_PREREQUISITE") {
      teachingAction = "REVIEW_PREREQUISITE";
      const nextSeq = session.stepSeq + 1;
      const targetConceptId = adaptiveDecision.targetConceptId;
      const { step } = await createStepFromItem(
        db,
        targetConceptId,
        nextSeq,
        adaptiveDecision.preferredTemplateId,
        "learn",
        adaptiveDecision.targetDifficulty,
      );
      nextStep = step;

      await studentRepo.updateSession(sessionId, {
        stepSeq: nextSeq,
        currentStep: serializeForDb(step) as Record<string, unknown>,
        counters: {
          completedSteps,
          correctN,
          consecutiveIndependentCorrect,
          consecutiveIncorrect,
          remediationCount,
          recentTemplateIds,
          prereqRouteTaken: true,
        },
      });
    } else {
      // INDEPENDENT_PRACTICE
      teachingAction = "INDEPENDENT_PRACTICE";
      const nextSeq = session.stepSeq + 1;
      const { step } = await createStepFromItem(
        db,
        conceptId,
        nextSeq,
        adaptiveDecision.preferredTemplateId,
        "learn",
        adaptiveDecision.targetDifficulty,
      );
      nextStep = step;

      await studentRepo.updateSession(sessionId, {
        stepSeq: nextSeq,
        currentStep: serializeForDb(step) as Record<string, unknown>,
        counters: {
          completedSteps,
          correctN,
          consecutiveIndependentCorrect,
          consecutiveIncorrect,
          remediationCount,
          recentTemplateIds,
          prereqRouteTaken,
        },
      });
    }
  }

  const sparksTotal = await studentRepo.getSparksTotal();

  const response: SubmitAttemptResponse = {
    attemptId,
    outcome,
    misconceptionId,
    feedback,
    tryAgain,
    teachingAction,
    nextStep,
    belief: updatedBelief
      ? {
          ...updatedBelief,
          activeMisconceptionIds: [...updatedBelief.activeMisconceptionIds],
        }
      : undefined,
    sparksAwarded,
    totalSparks: sparksTotal,
    comebackCard: comebackCardDto,
    sessionCompleted,
  };

  // Cache response on attempt record for idempotency
  await db
    .update(attempts)
    .set({ response: serializeForDb(response) as Record<string, unknown> })
    .where(eq(attempts.id, attemptId));

  return response;
}

export async function requestSessionHelp(
  studentId: string,
  sessionId: string,
  req: RequestHelpRequest,
  db: DbClient = getDb(),
): Promise<RequestHelpResponse> {
  const studentRepo = createStudentRepo(studentId, db);
  const session = await studentRepo.getSession(sessionId);

  if (!session || session.status !== "active") {
    throw new EngineError("Active session not found", 404);
  }

  const currentStep = session.currentStep as { item?: { id: string } } | null;
  if (!currentStep?.item?.id) {
    throw new EngineError("No active item in current step", 400);
  }

  const item = await getItemInstance(db, currentStep.item.id);
  if (!item) {
    throw new EngineError("Item not found", 404);
  }

  let computedAssistanceLevel = 1;
  let responsePayload: RequestHelpResponse;

  if (req.kind === "hint") {
    const hints = (item.hints as unknown[]) ?? [];
    const rungIndex = Math.min(Math.max((req.rung ?? 1) - 1, 0), hints.length - 1);
    const hintContent = hints[rungIndex] ?? [{ t: "text", v: "Read the prompt carefully." }];
    computedAssistanceLevel = rungIndex + 1;
    responsePayload = {
      kind: "hint",
      content: hintContent,
      assistanceLevel: computedAssistanceLevel,
    };
  } else if (req.kind === "worked_example") {
    computedAssistanceLevel = 3;
    responsePayload = {
      kind: "worked_example",
      content: item.workedExample,
      assistanceLevel: 3,
    };
  } else if (req.kind === "explanation") {
    const conceptId = item.conceptId as ConceptId;
    const explanation = EXPLANATIONS[conceptId] ?? EXPLANATIONS["MATH-FRAC-PART"];
    const route = req.route ?? "picture";
    const content = explanation[route];
    computedAssistanceLevel = 2;
    responsePayload = {
      kind: "explanation",
      content,
      assistanceLevel: 2,
    };
  } else {
    throw new EngineError("Unsupported help kind", 400);
  }

  // Authoritatively record assistance on current item in session counters
  const counters = (session.counters as Record<string, unknown>) ?? {};
  const itemAssistance = (counters.itemAssistance as Record<string, number>) ?? {};
  const currentAssistance = itemAssistance[item.id] ?? 0;
  const updatedItemAssistance = {
    ...itemAssistance,
    [item.id]: Math.max(currentAssistance, computedAssistanceLevel),
  };

  await db
    .update(learningSessions)
    .set({
      counters: serializeForDb({
        ...counters,
        itemAssistance: updatedItemAssistance,
      }) as Record<string, unknown>,
    })
    .where(eq(learningSessions.id, sessionId));

  return responsePayload;
}

export async function getDailyQuest(studentId: string, db: DbClient = getDb()): Promise<QuestDto> {
  const studentRepo = createStudentRepo(studentId, db);
  const today = toIstDateString(new Date().toISOString());

  const existingQuest = await studentRepo.getQuest(today);
  if (existingQuest) {
    return {
      id: existingQuest.id,
      questDate: existingQuest.questDate,
      status: existingQuest.status as QuestDto["status"],
      slots: existingQuest.slots as QuestSlot[],
      completedAt: existingQuest.completedAt?.toISOString() ?? null,
    };
  }

  // Create today's quest
  const questId = generateDomainId("quest");
  const defaultSlots: QuestSlot[] = [
    {
      slotId: "slot_1_warmup",
      title: "Warmup: Review Previous Skills",
      kind: "review",
      conceptId: "MATH-FRAC-PART",
      completed: false,
    },
    {
      slotId: "slot_2_focus",
      title: "Today's Target: Master Fractions",
      kind: "learn",
      conceptId: "MATH-FRAC-EQUIV",
      completed: false,
    },
    {
      slotId: "slot_3_challenge",
      title: "Daily Practice Sprint",
      kind: "challenge",
      completed: false,
    },
  ];

  const created = await studentRepo.createQuest({
    id: questId,
    questDate: today,
    status: "in_progress",
    slots: defaultSlots as unknown as Record<string, unknown>[],
  });

  return {
    id: created.id,
    questDate: created.questDate,
    status: "in_progress",
    slots: defaultSlots,
  };
}

export async function getHomeDashboard(
  studentId: string,
  db: DbClient = getDb(),
): Promise<HomeDashboardResponse> {
  const studentRepo = createStudentRepo(studentId, db);
  const profile = await studentRepo.getProfile();
  if (!profile) {
    throw new EngineError("Student profile not found", 404);
  }

  const state = await studentRepo.ensureStudentState();
  const focusConceptId = (state.focusConceptId as ConceptId) || "MATH-FRAC-PART";
  const conceptMeta = CONCEPTS.find((c) => c.id === focusConceptId) ?? CONCEPTS[0]!;

  const belief = await studentRepo.getConceptBelief(focusConceptId);
  const dailyQuest = await getDailyQuest(studentId, db);
  const dueReviews = await studentRepo.getDueReviews();

  const dueReviewItems: DueReviewItem[] = dueReviews.map((r) => {
    const meta = CONCEPTS.find((c) => c.id === r.conceptId);
    return {
      id: r.id,
      conceptId: r.conceptId as ConceptId,
      conceptTitle: meta?.studentTitle ?? r.conceptId,
      kind: r.kind as DueReviewItem["kind"],
      dueAt: r.dueAt.toISOString(),
    };
  });

  // Most recent comeback card
  const cards = await studentRepo.getComebackCards();
  const recentCard = cards[0]
    ? {
        id: cards[0].id,
        conceptId: cards[0].conceptId as ConceptId,
        message: cards[0].message as ComebackCardDto["message"],
        pastAttemptIds: cards[0].pastAttemptIds,
        presentAttemptIds: cards[0].presentAttemptIds,
        seenAt: cards[0].seenAt?.toISOString() ?? null,
        createdAt: cards[0].createdAt.toISOString(),
      }
    : null;

  const activeSessionRow = await studentRepo.getActiveSession();
  const activeSession = activeSessionRow
    ? {
        id: activeSessionRow.id,
        mode: activeSessionRow.mode,
        focusConceptId: (activeSessionRow.focusConceptId as ConceptId) ?? null,
        stepSeq: activeSessionRow.stepSeq,
      }
    : null;

  return {
    student: {
      id: profile.id,
      displayName: profile.displayName,
      sparksTotal: state.sparksTotal,
    },
    focusConcept: {
      id: focusConceptId,
      title: conceptMeta.title,
      studentTitle: conceptMeta.studentTitle,
      status: belief?.status ?? "not_assessed",
    },
    dailyQuest,
    dueReviews: dueReviewItems,
    recentComebackCard: recentCard,
    activeSession,
  };
}

export async function getGapMapData(
  studentId: string,
  db: DbClient = getDb(),
): Promise<GapMapResponse> {
  const studentRepo = createStudentRepo(studentId, db);
  const storedBeliefs = await studentRepo.getConceptBeliefs();
  const beliefMap = new Map(storedBeliefs.map((b) => [b.conceptId, b]));

  // Prerequisite map
  const prereqMap = new Map<ConceptId, ConceptId[]>();
  for (const edge of EDGES) {
    if (!prereqMap.has(edge.conceptId)) {
      prereqMap.set(edge.conceptId, []);
    }
    prereqMap.get(edge.conceptId)!.push(edge.prereqId);
  }

  let demonstratedCount = 0;
  let retainedCount = 0;
  let needsSupportCount = 0;
  let developingCount = 0;
  let notAssessedCount = 0;

  const concepts: GapMapConceptNode[] = CONCEPTS.map((c) => {
    const b = beliefMap.get(c.id);
    const status = (b?.status as GapMapConceptNode["status"]) ?? "not_assessed";

    if (status === "demonstrated") demonstratedCount++;
    else if (status === "retained") retainedCount++;
    else if (status === "needs_support") needsSupportCount++;
    else if (status === "developing") developingCount++;
    else notAssessedCount++;

    return {
      id: c.id,
      chapterId: c.chapterId,
      title: c.title,
      studentTitle: c.studentTitle,
      description: c.description,
      topoOrder: c.topoOrder,
      status,
      reliability: (b?.reliability as GapMapConceptNode["reliability"]) ?? "missing",
      independentN: b?.independentN ?? 0,
      independentCorrectN: b?.independentCorrectN ?? 0,
      prereqIds: prereqMap.get(c.id) ?? [],
    };
  });

  return {
    chapters: CHAPTERS.map((ch) => ({
      id: ch.id,
      strand: ch.strand,
      title: ch.title,
      ord: ch.ord,
    })),
    concepts,
    summary: {
      totalConcepts: CONCEPTS.length,
      demonstratedCount,
      retainedCount,
      needsSupportCount,
      developingCount,
      notAssessedCount,
    },
  };
}

export async function advanceLearningSessionStep(
  studentId: string,
  sessionId: string,
  db: DbClient = getDb(),
): Promise<{ step: StepDto }> {
  const studentRepo = createStudentRepo(studentId, db);
  const session = await studentRepo.getSession(sessionId);
  if (!session || session.status !== "active") {
    throw new EngineError("Active session not found", 404);
  }

  const conceptId = (session.focusConceptId as ConceptId) || "MATH-FRAC-PART";
  const nextSeq = session.stepSeq + 1;
  const { step } = await createStepFromItem(
    db,
    conceptId,
    nextSeq,
    undefined,
    session.mode as "learn",
  );

  await studentRepo.updateSession(sessionId, {
    stepSeq: nextSeq,
    currentStep: serializeForDb(step) as Record<string, unknown>,
  });

  return { step };
}
