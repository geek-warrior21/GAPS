import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeSqlClients, getDb } from "./client";
import { syncContent } from "./content-sync";
import { createStudentRepo } from "./repos/student";
import { seedDatabase } from "./seed";
import { verifyStudentReplay } from "./replay";
import { users } from "./schema";
import { eq } from "drizzle-orm";

describe("Phase 3 Schema & Migrations & Repositories", () => {
  const db = getDb();

  beforeAll(async () => {
    // Ensure seeded database
    await syncContent(db);
    await seedDatabase(db);
  });

  afterAll(async () => {
    await closeSqlClients();
  });

  it("seeds idempotently when run multiple times", async () => {
    // Running seed a second time must succeed without throwing unique constraint violations
    await expect(seedDatabase(db)).resolves.not.toThrow();
  });

  it("verifies replayed student beliefs match stored projections", async () => {
    // Meera is seeded with historical attempts demonstrating MATH-FRAC-EQUIV
    const meeraId = "stu_01J00000000000000000000001";
    const result = await verifyStudentReplay(meeraId, db);
    expect(result.ok).toBe(true);
    expect(result.conceptsChecked).toBe(14);
    expect(result.mismatches).toHaveLength(0);
  });

  it("enforces attempt idempotency via unique (session_id, client_attempt_id)", async () => {
    const testStudentId = `stu_test_idemp_${Date.now()}`;
    await db.insert(users).values({
      id: testStudentId,
      role: "student",
      displayName: "Idemp Test Student",
      status: "active",
      cohortId: "coh_01J00000000000000000000001",
    });
    const studentRepo = createStudentRepo(testStudentId, db);
    const session = await studentRepo.createSession({
      id: `ses_test_idempotency_${Date.now()}`,
      mode: "learn",
      focusConceptId: "MATH-FRAC-PART",
    });

    const attemptData = {
      id: `att_test_idemp_${Date.now()}`,
      sessionId: session.id,
      clientAttemptId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      stepSeq: 1,
      itemInstanceId: "itm_01J00000000000000000000001",
      conceptId: "MATH-FRAC-PART",
      rawAnswer: "1/2",
      outcome: "correct" as const,
      assistanceLevel: 0 as const,
      tryNo: 1 as const,
      isReview: false,
      mode: "learn",
      response: { score: 1 },
    };

    // First insertion
    const first = await studentRepo.recordAttempt(attemptData);
    expect(first.id).toBe(attemptData.id);

    // Second insertion with identical clientAttemptId returns existing record without error
    const duplicate = await studentRepo.recordAttempt({
      ...attemptData,
      id: `att_test_idemp_2_${Date.now()}`,
      rawAnswer: "999", // Different payload should not overwrite
    });
    expect(duplicate.id).toBe(first.id);
    expect(duplicate.rawAnswer).toBe("1/2");
  });

  it("cascades student deletion to all student-owned records", async () => {
    // Create a temporary student
    const tempStudentId = `stu_temp_cascade_${Date.now()}`;
    await db.insert(users).values({
      id: tempStudentId,
      role: "student",
      displayName: "Temp Student",
      status: "active",
      cohortId: "coh_01J00000000000000000000001",
    });

    const repo = createStudentRepo(tempStudentId, db);
    await repo.ensureStudentState();
    const session = await repo.createSession({
      id: `ses_temp_cascade_${Date.now()}`,
      mode: "learn",
    });
    await repo.recordAttempt({
      id: `att_temp_cascade_${Date.now()}`,
      sessionId: session.id,
      clientAttemptId: "c38b29c1-419b-4b11-b0e2-63b7b6e41b21",
      stepSeq: 1,
      itemInstanceId: "itm_01J00000000000000000000001",
      conceptId: "MATH-FRAC-PART",
      rawAnswer: "1/2",
      outcome: "correct",
      assistanceLevel: 0,
      tryNo: 1,
      isReview: false,
      mode: "learn",
    });

    // Verify session and attempt exist
    expect(await repo.getSession(session.id)).not.toBeNull();
    const attemptsBefore = await repo.getAllAttempts();
    expect(attemptsBefore).toHaveLength(1);

    // Hard delete the student user
    await db.delete(users).where(eq(users.id, tempStudentId));

    // Verify student records are deleted via foreign key cascade
    const sessionsAfter = await repo.getActiveSession();
    expect(sessionsAfter).toBeNull();
    const attemptsRemaining = await repo.getAllAttempts();
    expect(attemptsRemaining).toHaveLength(0);
  });
});
