import { pathToFileURL } from "node:url";
import { CONCEPTS } from "@gaps/content";
import { type CheckedAttempt, type ConceptId, replayBeliefs, toPublicBelief } from "@gaps/domain";
import { asc, eq } from "drizzle-orm";
import { closeSqlClients, getDb, type DbClient } from "./client";
import { loadRootEnv } from "./env";
import { attempts, conceptBeliefs, itemInstances } from "./schema";

export interface ReplayVerificationResult {
  readonly studentId: string;
  readonly ok: boolean;
  readonly conceptsChecked: number;
  readonly mismatches: readonly string[];
}

export async function verifyStudentReplay(
  studentId: string,
  db: DbClient = getDb(),
): Promise<ReplayVerificationResult> {
  const mismatches: string[] = [];

  // 1. Fetch all stored attempts for this student with their templateIds
  const storedAttempts = await db
    .select({
      attemptId: attempts.id,
      studentId: attempts.studentId,
      sessionId: attempts.sessionId,
      clientAttemptId: attempts.clientAttemptId,
      itemInstanceId: attempts.itemInstanceId,
      templateId: itemInstances.templateId,
      conceptId: attempts.conceptId,
      mode: attempts.mode,
      outcome: attempts.outcome,
      misconceptionId: attempts.misconceptionId,
      assistance: attempts.assistanceLevel,
      tryNo: attempts.tryNo,
      isReview: attempts.isReview,
      verifierVersion: attempts.verifierVersion,
      at: attempts.createdAt,
    })
    .from(attempts)
    .innerJoin(itemInstances, eq(attempts.itemInstanceId, itemInstances.id))
    .where(eq(attempts.studentId, studentId))
    .orderBy(asc(attempts.createdAt), asc(attempts.id));

  // Map to CheckedAttempt
  const checkedAttempts: CheckedAttempt[] = storedAttempts.map((row) => ({
    attemptId: row.attemptId,
    studentId: row.studentId,
    sessionId: row.sessionId,
    clientAttemptId: row.clientAttemptId,
    itemInstanceId: row.itemInstanceId,
    templateId: row.templateId,
    conceptId: row.conceptId as ConceptId,
    mode: row.mode as CheckedAttempt["mode"],
    outcome: row.outcome as CheckedAttempt["outcome"],
    misconceptionId: row.misconceptionId
      ? (row.misconceptionId as CheckedAttempt["misconceptionId"])
      : undefined,
    assistance: (row.assistance >= 0 && row.assistance <= 3 ? row.assistance : 0) as 0 | 1 | 2 | 3,
    tryNo: (row.tryNo === 1 || row.tryNo === 2 ? row.tryNo : 1) as 1 | 2,
    isReview: row.isReview,
    verifierVersion: "verify-1.0",
    at: row.at.toISOString(),
  }));

  // 2. Fetch all stored concept beliefs for this student
  const storedBeliefs = await db
    .select()
    .from(conceptBeliefs)
    .where(eq(conceptBeliefs.studentId, studentId));

  const storedBeliefMap = new Map(storedBeliefs.map((b) => [b.conceptId, b]));

  // 3. For every concept, replay and compare
  for (const c of CONCEPTS) {
    const conceptId = c.id;
    const finalState = replayBeliefs(conceptId, checkedAttempts, { templatesForConcept: 3 });
    const publicBelief = toPublicBelief(finalState);
    const stored = storedBeliefMap.get(conceptId);

    if (!stored) {
      // If not stored, only ok if status is not_assessed with 0 attempts
      if (publicBelief.status !== "not_assessed") {
        mismatches.push(
          `Concept ${conceptId} not found in concept_beliefs table, but replay calculated status "${publicBelief.status}"`,
        );
      }
      continue;
    }

    if (stored.status !== publicBelief.status) {
      mismatches.push(
        `Concept ${conceptId} status mismatch: stored="${stored.status}", replayed="${publicBelief.status}"`,
      );
    }

    const replayedIndCount = finalState.history.filter((a) => a.assistance === 0).length;
    if (stored.independentN !== replayedIndCount) {
      mismatches.push(
        `Concept ${conceptId} independentN mismatch: stored=${stored.independentN}, replayed=${replayedIndCount}`,
      );
    }
  }

  return {
    studentId,
    ok: mismatches.length === 0,
    conceptsChecked: CONCEPTS.length,
    mismatches,
  };
}

const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  loadRootEnv();
  const studentId = process.argv[2] ?? "stu_01J00000000000000000000001";
  verifyStudentReplay(studentId)
    .then(async (res) => {
      if (res.ok) {
        process.stdout.write(
          `✓ Replay verification passed for student ${studentId}: all ${res.conceptsChecked} concept beliefs match stored projections.\n`,
        );
        await closeSqlClients();
        process.exitCode = 0;
      } else {
        process.stderr.write(
          `✗ Replay verification failed for student ${studentId} with ${res.mismatches.length} mismatches:\n`,
        );
        for (const m of res.mismatches) {
          process.stderr.write(`  - ${m}\n`);
        }
        await closeSqlClients();
        process.exitCode = 1;
      }
    })
    .catch(async (err: unknown) => {
      process.stderr.write(
        `✗ Replay check error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      await closeSqlClients();
      process.exitCode = 1;
    });
}
