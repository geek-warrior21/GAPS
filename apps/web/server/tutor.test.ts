import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeSqlClients, createStudentRepo, getDb, seedDatabase, syncContent } from "@gaps/db";
import { processSessionAttempt, startLearningSession } from "./session/engine";
import { createAuthSession } from "./auth/session";
import { buildTutorContext } from "./tutor/context";
import { getTutorHistory, handleTutorTurn } from "./tutor/service";
import {
  GET as tutorGetHandler,
  POST as tutorPostHandler,
} from "@/app/api/v1/sessions/[sessionId]/tutor/route";

describe("Phase 8: Context-Aware AI Maths Tutor", () => {
  const db = getDb();
  const ananyaId = "stu_01J00000000000000000000004"; // Ananya
  const otherStudentId = "stu_01J00000000000000000000001"; // Meera

  beforeAll(async () => {
    await syncContent(db);
    await seedDatabase(db);
  });

  afterAll(async () => {
    await closeSqlClients();
  });

  it("builds minimal, accurate tutor context for an active session", async () => {
    const { session } = await startLearningSession(ananyaId, { mode: "learn", budgetS: 900 }, db);

    const context = await buildTutorContext(ananyaId, session.id, db);

    expect(context.studentId).toBe(ananyaId);
    expect(context.sessionId).toBe(session.id);
    expect(context.conceptId).toBeDefined();
    expect(context.conceptTitle).toBeDefined();
    expect(context.chapter).toBeDefined();
    expect(Array.isArray(context.prerequisites)).toBe(true);
    expect(Array.isArray(context.weakPrerequisites)).toBe(true);
    expect(context.explanations.picture).toBeDefined();
    expect(context.explanations.everyday).toBeDefined();

    if (context.currentQuestion) {
      // Answer metadata is extracted for leak checking, but not solved for student
      expect(Array.isArray(context.currentQuestion.forbiddenAnswerStrings)).toBe(true);
      expect(context.currentQuestion.promptText.length).toBeGreaterThan(0);
    }
  });

  it("enforces student isolation: rejects context building for another student's session", async () => {
    const { session } = await startLearningSession(ananyaId, { mode: "learn", budgetS: 900 }, db);

    await expect(buildTutorContext(otherStudentId, session.id, db)).rejects.toThrow(
      "Session not found or unauthorized",
    );
  });

  it("discloses hints progressively without premature answer disclosure", async () => {
    const { session } = await startLearningSession(ananyaId, { mode: "learn", budgetS: 900 }, db);

    // Turn 1: Request first hint
    const turn1 = await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Can I have a hint?",
        intent: "hint",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    expect(turn1.reply.role).toBe("assistant");
    expect(turn1.reply.actionType).toBe("hint");
    expect(turn1.reply.text.length).toBeGreaterThan(0);
    expect(turn1.remainingTurns).toBe(9);

    // Turn 2: Request second hint
    const turn2 = await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Give me another hint",
        intent: "hint",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    expect(turn2.reply.role).toBe("assistant");
    expect(turn2.remainingTurns).toBe(8);
    expect(turn2.conversation.length).toBe(4); // 2 student + 2 assistant

    const history = await getTutorHistory(ananyaId, session.id, db);
    expect(history.remainingTurns).toBe(8);
    expect(history.conversation.length).toBe(4);
  });

  it("triggers misconception-aware assistance after an incorrect attempt", async () => {
    const { session, initialStep } = await startLearningSession(
      ananyaId,
      { mode: "learn", budgetS: 900 },
      db,
    );

    const itemStep = initialStep as { item: { id: string } };

    // Submit an intentionally incorrect attempt with a common error
    await processSessionAttempt(
      ananyaId,
      session.id,
      {
        clientAttemptId: crypto.randomUUID(),
        itemInstanceId: itemStep.item.id,
        rawAnswer: "999/1",
        tryNo: 1,
        assistanceLevel: 0,
        latencyMs: 1200,
      },
      db,
    );

    // Ask the tutor why it was incorrect
    const tutorReply = await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Why is my answer incorrect?",
        intent: "why_incorrect",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    expect(tutorReply.reply.role).toBe("assistant");
    expect(tutorReply.reply.actionType).toBe("clarification");
    expect(tutorReply.reply.text).toMatch(
      /shaded parts|parts together|not quite yet|equal parts|denominator|simplify/i,
    );
  });

  it("can present an existing visual model in tutor responses", async () => {
    const { session } = await startLearningSession(ananyaId, { mode: "learn", budgetS: 900 }, db);

    const res = await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Show me a visual model",
        intent: "visual",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    expect(res.reply.actionType).toBe("visual");
    expect(res.reply.visual).toBeDefined();
    expect(["fraction_bar", "area_model", "number_line"]).toContain(res.reply.visual?.type);
  });

  it("answers conceptual free-text questions such as explaining denominator", async () => {
    const { session } = await startLearningSession(ananyaId, { mode: "learn", budgetS: 900 }, db);

    const res = await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "What is the denominator?",
        intent: "free_text",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    expect(res.reply.role).toBe("assistant");
    expect(res.reply.text).toMatch(/denominator.*bottom|equal parts/i);
  });

  it("redirects off-topic queries kindly", async () => {
    const { session } = await startLearningSession(ananyaId, { mode: "learn", budgetS: 900 }, db);

    const res = await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "What is the cricket score today?",
        intent: "free_text",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    expect(res.reply.actionType).toBe("off_topic");
    expect(res.reply.text).toMatch(/focus.*maths/i);
  });

  it("is idempotent: duplicate requests with same clientMessageId do not duplicate turns", async () => {
    const { session } = await startLearningSession(ananyaId, { mode: "learn", budgetS: 900 }, db);

    const clientMessageId = crypto.randomUUID();

    const turnA = await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Explain this differently",
        intent: "explain",
        clientMessageId,
      },
      db,
    );

    const turnB = await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Explain this differently",
        intent: "explain",
        clientMessageId,
      },
      db,
    );

    expect(turnA.conversation.length).toBe(turnB.conversation.length);
    expect(turnA.remainingTurns).toBe(turnB.remainingTurns);
  });

  it("INVARIANT §3: Tutor interactions NEVER mutate concept beliefs or award sparks", async () => {
    const studentRepo = createStudentRepo(ananyaId, db);
    const { session } = await startLearningSession(ananyaId, { mode: "learn", budgetS: 900 }, db);

    const conceptId = session.focusConceptId ?? "MATH-FRAC-PART";
    const beliefBefore = await studentRepo.getConceptBelief(conceptId);
    const sparksBefore = await studentRepo.getSparksTotal();

    // Perform multiple tutor interactions
    await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Give me a hint",
        intent: "hint",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    await handleTutorTurn(
      ananyaId,
      session.id,
      {
        message: "Show me a visual model",
        intent: "visual",
        clientMessageId: crypto.randomUUID(),
      },
      db,
    );

    const beliefAfter = await studentRepo.getConceptBelief(conceptId);
    const sparksAfter = await studentRepo.getSparksTotal();

    // Beliefs must be completely unchanged
    expect(beliefAfter?.status).toBe(beliefBefore?.status);
    expect(beliefAfter?.estimate).toBe(beliefBefore?.estimate);

    // Sparks must be completely unchanged
    expect(sparksAfter).toBe(sparksBefore);
  });

  it("handles GET and POST requests through HTTP API routes", async () => {
    const { session } = await startLearningSession(ananyaId, { mode: "learn", budgetS: 900 }, db);

    const auth = await createAuthSession(ananyaId);

    const headers = {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    };

    // POST turn
    const postReq = new Request(`http://localhost/api/v1/sessions/${session.id}/tutor`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: "Can you explain this with an example?",
        intent: "example",
        clientMessageId: crypto.randomUUID(),
      }),
    });

    const postRes = await tutorPostHandler(postReq, {
      params: Promise.resolve({ sessionId: session.id }),
    });

    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.reply).toBeDefined();
    expect(postData.reply.actionType).toBe("example");

    // GET history
    const getReq = new Request(`http://localhost/api/v1/sessions/${session.id}/tutor`, {
      method: "GET",
      headers,
    });

    const getRes = await tutorGetHandler(getReq, {
      params: Promise.resolve({ sessionId: session.id }),
    });

    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.conversation.length).toBeGreaterThan(0);
    expect(getData.maxTurns).toBe(10);
  });
});
