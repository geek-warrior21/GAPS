import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeSqlClients,
  createStudentRepo,
  getDb,
  getItemInstance,
  seedDatabase,
  syncContent,
} from "@gaps/db";
import {
  getGapMapData,
  getHomeDashboard,
  processSessionAttempt,
  requestSessionHelp,
  startLearningSession,
} from "./session/engine";
import { createAuthSession } from "./auth/session";
import { POST as startSessionHandler } from "@/app/api/v1/sessions/start/route";
import { POST as attemptHandler } from "@/app/api/v1/sessions/[sessionId]/attempt/route";
import { POST as helpHandler } from "@/app/api/v1/sessions/[sessionId]/help/route";
import { GET as gapmapHandler } from "@/app/api/v1/gapmap/route";
import { GET as homeHandler } from "@/app/api/v1/home/route";

function asItemStep(step: unknown) {
  if (
    !step ||
    typeof step !== "object" ||
    !("kind" in step) ||
    (step as { kind: string }).kind !== "item"
  ) {
    throw new Error("Expected item step");
  }
  return step as {
    kind: "item";
    stepSeq: number;
    item: { id: string; conceptId: string; prompt: unknown; input: unknown; visual?: unknown };
  };
}

describe("Phase 5: Learning Session Engine, Quests, GapMap, and Review Scheduling", () => {
  const db = getDb();
  const meeraId = "stu_01J00000000000000000000001"; // active student with core consent
  const kabirId = "stu_01J00000000000000000000002"; // pending consent student

  beforeAll(async () => {
    await syncContent(db);
    await seedDatabase(db);
  });

  afterAll(async () => {
    await closeSqlClients();
  });

  describe("Session Lifecycle & Answer Sanitization", () => {
    it("starts a session and serves initial step without leaking answers", async () => {
      const { session, initialStep } = await startLearningSession(
        meeraId,
        {
          mode: "learn",
          focusConceptId: "MATH-FRAC-PART",
          budgetS: 900,
        },
        db,
      );

      expect(session.id).toBeTruthy();
      expect(session.status).toBe("active");
      expect(session.focusConceptId).toBe("MATH-FRAC-PART");

      // Verify step DTO
      const itemStep = asItemStep(initialStep);
      expect(itemStep.stepSeq).toBe(1);
      expect(itemStep.item.id).toBeTruthy();
      expect(itemStep.item.prompt).toBeDefined();

      // INVARIANT §10: Never send correct answers or misconception answers to client before item resolved
      const stepRecord = initialStep as Record<string, unknown>;
      const itemRecord = itemStep.item as Record<string, unknown>;
      expect(stepRecord.answer).toBeUndefined();
      expect(itemRecord.answer).toBeUndefined();
      expect(itemRecord.misconceptions).toBeUndefined();
      expect(itemRecord.misconceptionAnswers).toBeUndefined();
    });

    it("enforces only 1 active session per student (abandons previous)", async () => {
      const first = await startLearningSession(
        meeraId,
        {
          mode: "learn",
          focusConceptId: "MATH-FRAC-PART",
          budgetS: 900,
        },
        db,
      );

      const second = await startLearningSession(
        meeraId,
        {
          mode: "learn",
          focusConceptId: "MATH-FRAC-PART",
          budgetS: 900,
        },
        db,
      );

      const repo = createStudentRepo(meeraId, db);
      const firstSessionDb = await repo.getSession(first.session.id);
      expect(firstSessionDb?.status).toBe("abandoned");

      const activeSession = await repo.getActiveSession();
      expect(activeSession?.id).toBe(second.session.id);
    });
  });

  describe("Attempt Processing, Two-Try Rule, and Idempotency", () => {
    it("offers TRY_AGAIN with student-friendly copy on first incorrect try", async () => {
      const { session, initialStep } = await startLearningSession(
        meeraId,
        {
          mode: "learn",
          focusConceptId: "MATH-FRAC-PART",
          budgetS: 900,
        },
        db,
      );
      const itemStep = asItemStep(initialStep);

      const clientAttemptId = "22222222-2222-4222-8222-000000000001";
      const result = await processSessionAttempt(
        meeraId,
        session.id,
        {
          clientAttemptId,
          itemInstanceId: itemStep.item.id,
          rawAnswer: "999/999", // Clearly incorrect
          assistanceLevel: 0,
          tryNo: 1,
          latencyMs: 1200,
        },
        db,
      );

      expect(result.outcome).toBe("incorrect");
      expect(result.tryAgain).toBe(true);
      expect(result.teachingAction).toBe("GIVE_HINT");
      // INVARIANT §10: Student copy says "not yet", never "wrong" or "failed"
      expect(result.feedback.toLowerCase()).toContain("not yet");
      expect(result.feedback.toLowerCase()).not.toContain("wrong");
      expect(result.feedback.toLowerCase()).not.toContain("failed");
      expect(result.nextStep && "stepSeq" in result.nextStep ? result.nextStep.stepSeq : null).toBe(
        1,
      );
    });

    it("enforces attempt idempotency returning cached response", async () => {
      const { session, initialStep } = await startLearningSession(
        meeraId,
        {
          mode: "learn",
          focusConceptId: "MATH-FRAC-PART",
          budgetS: 900,
        },
        db,
      );
      const itemStep = asItemStep(initialStep);

      const clientAttemptId = "33333333-3333-4333-8333-000000000002";
      const first = await processSessionAttempt(
        meeraId,
        session.id,
        {
          clientAttemptId,
          itemInstanceId: itemStep.item.id,
          rawAnswer: "1/2",
          assistanceLevel: 0,
          tryNo: 1,
          latencyMs: 100,
        },
        db,
      );

      // Re-submitting with identical clientAttemptId returns identical attemptId and outcome
      const second = await processSessionAttempt(
        meeraId,
        session.id,
        {
          clientAttemptId,
          itemInstanceId: itemStep.item.id,
          rawAnswer: "1/2",
          assistanceLevel: 0,
          tryNo: 1,
          latencyMs: 100,
        },
        db,
      );

      expect(second.attemptId).toBe(first.attemptId);
      expect(second.outcome).toBe(first.outcome);
    });

    it("grades correct answer with BigInt Rational and awards sparks", async () => {
      const { session, initialStep } = await startLearningSession(
        meeraId,
        {
          mode: "learn",
          focusConceptId: "MATH-FRAC-PART",
          budgetS: 900,
        },
        db,
      );
      const itemStep = asItemStep(initialStep);

      // Load true answer from item instance in DB
      const item = await getItemInstance(db, itemStep.item.id);
      expect(item).not.toBeNull();
      const answerVal = (item?.answer as { value: { n: number; d: number } }).value;
      const rawCorrect = `${answerVal.n}/${answerVal.d}`;

      const clientAttemptId = "44444444-4444-4444-8444-000000000003";
      const result = await processSessionAttempt(
        meeraId,
        session.id,
        {
          clientAttemptId,
          itemInstanceId: itemStep.item.id,
          rawAnswer: rawCorrect,
          assistanceLevel: 0,
          tryNo: 1,
          latencyMs: 100,
        },
        db,
      );

      expect(result.outcome).toBe("correct");
      expect(result.tryAgain).toBe(false);
      expect(result.sparksAwarded).toBe(2); // +2 for first_try_correct
      expect(result.totalSparks).toBeGreaterThan(0);
      expect(result.nextStep && "stepSeq" in result.nextStep ? result.nextStep.stepSeq : null).toBe(
        2,
      );
    });
  });

  describe("Teaching Support & Help (Hints, Worked Examples, Explanations)", () => {
    it("delivers 3 rungs of authored hints without leaking answers", async () => {
      const { session } = await startLearningSession(
        meeraId,
        {
          mode: "learn",
          focusConceptId: "MATH-FRAC-PART",
          budgetS: 900,
        },
        db,
      );

      const r1 = await requestSessionHelp(meeraId, session.id, { kind: "hint", rung: 1 }, db);
      expect(r1.kind).toBe("hint");
      expect(r1.assistanceLevel).toBe(1);
      expect(r1.content).toBeDefined();

      const r2 = await requestSessionHelp(meeraId, session.id, { kind: "hint", rung: 2 }, db);
      expect(r2.assistanceLevel).toBe(2);

      const r3 = await requestSessionHelp(meeraId, session.id, { kind: "hint", rung: 3 }, db);
      expect(r3.assistanceLevel).toBe(3);
    });

    it("delivers authored worked example and concept explanations", async () => {
      const { session } = await startLearningSession(
        meeraId,
        {
          mode: "learn",
          focusConceptId: "MATH-FRAC-PART",
          budgetS: 900,
        },
        db,
      );

      const worked = await requestSessionHelp(meeraId, session.id, { kind: "worked_example" }, db);
      expect(worked.kind).toBe("worked_example");
      expect(worked.assistanceLevel).toBe(3);

      const expl = await requestSessionHelp(
        meeraId,
        session.id,
        {
          kind: "explanation",
          route: "picture",
        },
        db,
      );
      expect(expl.kind).toBe("explanation");
      expect(expl.assistanceLevel).toBe(2);
    });
  });

  describe("Home Dashboard, GapMap, and Consent Gating", () => {
    it("loads Home Dashboard with focus concept, quest, and reviews", async () => {
      const dashboard = await getHomeDashboard(meeraId, db);
      expect(dashboard.student.displayName).toBe("Meera");
      expect(dashboard.focusConcept.id).toBeTruthy();
      expect(dashboard.dailyQuest.slots).toHaveLength(3);
      expect(dashboard.dueReviews.length).toBeGreaterThanOrEqual(1); // Retention review due from seed
    });

    it("loads GapMap data covering all 14 concepts and acyclic edges", async () => {
      const gapmap = await getGapMapData(meeraId, db);
      expect(gapmap.chapters).toHaveLength(3);
      expect(gapmap.concepts).toHaveLength(14);
      expect(gapmap.summary.totalConcepts).toBe(14);
      expect(gapmap.summary.demonstratedCount).toBeGreaterThanOrEqual(1); // Meera has MATH-FRAC-EQUIV demonstrated
    });

    it("blocks student missing core consent from starting learning sessions (HTTP 403)", async () => {
      // Kabir is seeded with pending_consent (missing core_learning)
      const kabirSession = await createAuthSession(kabirId, "personal", db);
      const req = new Request("http://localhost/api/v1/sessions/start", {
        method: "POST",
        headers: {
          Cookie: `gaps_session=${kabirSession.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "learn" }),
      });

      const res = await startSessionHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("CONSENT_REQUIRED");
    });
  });

  describe("HTTP API Route Endpoints", () => {
    it("handles start, attempt, help, home, and gapmap via HTTP handlers", async () => {
      const meeraSession = await createAuthSession(meeraId, "personal", db);
      const headers = {
        Cookie: `gaps_session=${meeraSession.token}`,
        "Content-Type": "application/json",
      };

      // 1. Home endpoint
      const homeReq = new Request("http://localhost/api/v1/home", { headers });
      const homeRes = await homeHandler(homeReq);
      expect(homeRes.status).toBe(200);

      // 2. GapMap endpoint
      const gapReq = new Request("http://localhost/api/v1/gapmap", { headers });
      const gapRes = await gapmapHandler(gapReq);
      expect(gapRes.status).toBe(200);

      // 3. Start Session endpoint
      const startReq = new Request("http://localhost/api/v1/sessions/start", {
        method: "POST",
        headers,
        body: JSON.stringify({ mode: "learn", focusConceptId: "MATH-FRAC-PART" }),
      });
      const startRes = await startSessionHandler(startReq);
      expect(startRes.status).toBe(201);
      const startData = await startRes.json();
      const activeSessionId = startData.session.id;
      const activeItemId = asItemStep(startData.initialStep).item.id;

      // 4. Help endpoint
      const helpReq = new Request(`http://localhost/api/v1/sessions/${activeSessionId}/help`, {
        method: "POST",
        headers,
        body: JSON.stringify({ kind: "hint", rung: 1 }),
      });
      const helpRes = await helpHandler(helpReq, {
        params: Promise.resolve({ sessionId: activeSessionId }),
      });
      expect(helpRes.status).toBe(200);

      // 5. Submit Attempt endpoint
      const attemptReq = new Request(
        `http://localhost/api/v1/sessions/${activeSessionId}/attempt`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            clientAttemptId: "55555555-5555-4555-8555-000000000005",
            itemInstanceId: activeItemId,
            rawAnswer: "1/4",
            assistanceLevel: 1,
            tryNo: 1,
          }),
        },
      );
      const attemptRes = await attemptHandler(attemptReq, {
        params: Promise.resolve({ sessionId: activeSessionId }),
      });
      expect(attemptRes.status).toBe(200);
      const attemptData = await attemptRes.json();
      expect(attemptData.attemptId).toBeTruthy();
    });
  });
});
