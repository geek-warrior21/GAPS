import { pathToFileURL } from "node:url";
import { closeSqlClients, getDb, type DbClient } from "./client";
import { syncContent } from "./content-sync";
import { hashPassword, hashPin } from "./crypto";
import { loadRootEnv } from "./env";
import {
  attempts,
  cohorts,
  conceptBeliefs,
  consentRecords,
  events,
  featureFlags,
  itemInstances,
  learningSessions,
  organizations,
  quests,
  reviewSchedule,
  sparksLedger,
  studentState,
  teacherCohorts,
  users,
} from "./schema";

export interface SeedResult {
  readonly orgId: string;
  readonly cohortId: string;
  readonly meeraId: string;
  readonly kabirId: string;
  readonly aaravId: string;
  readonly teacherId: string;
  readonly adminId: string;
}

export async function seedDatabase(db: DbClient = getDb()): Promise<SeedResult> {
  // 1. Sync Content
  await syncContent(db);

  // 2. Organization
  const orgId = "org_01J00000000000000000000001";
  await db
    .insert(organizations)
    .values({
      id: orgId,
      name: "Delhi Public Model School",
      region: "delhi",
      processorAgreementRef: "AGR-2026-DELHI-001",
    })
    .onConflictDoUpdate({
      target: organizations.id,
      set: {
        name: "Delhi Public Model School",
        region: "delhi",
        processorAgreementRef: "AGR-2026-DELHI-001",
      },
    });

  // 3. Cohort (7A)
  const cohortId = "coh_01J00000000000000000000001";
  await db
    .insert(cohorts)
    .values({
      id: cohortId,
      orgId,
      name: "7A",
      grade: 7,
      joinCode: "DEMO7A",
      aiEnabled: false,
      solveEnabled: true,
    })
    .onConflictDoUpdate({
      target: cohorts.id,
      set: {
        name: "7A",
        grade: 7,
        joinCode: "DEMO7A",
        aiEnabled: false,
        solveEnabled: true,
      },
    });

  // 4. Users
  const meeraId = "stu_01J00000000000000000000001";
  const kabirId = "stu_01J00000000000000000000002";
  const aaravId = "stu_01J00000000000000000000003";
  const teacherId = "usr_01J00000000000000000000001";
  const adminId = "usr_01J00000000000000000000002";

  // Teacher
  await db
    .insert(users)
    .values({
      id: teacherId,
      role: "teacher",
      orgId,
      displayName: "Ananya Sharma",
      email: "teacher@demo.gaps",
      passwordHash: hashPassword("TeacherDemo2026!"),
      status: "active",
      avatar: { color: "teal", icon: "book" },
      settings: {},
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        displayName: "Ananya Sharma",
        email: "teacher@demo.gaps",
        status: "active",
      },
    });

  // Teacher Cohort Link
  await db
    .insert(teacherCohorts)
    .values({
      teacherId,
      cohortId,
    })
    .onConflictDoNothing();

  // Staff Admin
  await db
    .insert(users)
    .values({
      id: adminId,
      role: "staff_admin",
      displayName: "Staff Admin",
      email: "admin@demo.gaps",
      passwordHash: hashPassword("AdminDemo2026!"),
      totpSecretEnc: "JBSWY3DPEHPK3PXP",
      status: "active",
      avatar: { color: "purple", icon: "shield" },
      settings: {},
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        displayName: "Staff Admin",
        email: "admin@demo.gaps",
        status: "active",
      },
    });

  // Meera
  await db
    .insert(users)
    .values({
      id: meeraId,
      role: "student",
      orgId,
      cohortId,
      displayName: "Meera",
      username: "meera",
      pinHash: hashPin("333333"),
      status: "active",
      avatar: { color: "saffron", icon: "spark" },
      settings: {},
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        displayName: "Meera",
        username: "meera",
        pinHash: hashPin("333333"),
        status: "active",
      },
    });

  // Kabir (pending consent)
  await db
    .insert(users)
    .values({
      id: kabirId,
      role: "student",
      orgId,
      cohortId,
      displayName: "Kabir",
      username: "kabir",
      pinHash: hashPin("444444"),
      status: "pending_consent",
      avatar: { color: "blue", icon: "star" },
      settings: {},
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        displayName: "Kabir",
        username: "kabir",
        pinHash: hashPin("444444"),
        status: "pending_consent",
      },
    });

  // Aarav
  await db
    .insert(users)
    .values({
      id: aaravId,
      role: "student",
      orgId,
      cohortId,
      displayName: "Aarav",
      username: "aarav",
      pinHash: hashPin("121212"),
      status: "active",
      avatar: { color: "green", icon: "leaf" },
      settings: {},
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        displayName: "Aarav",
        username: "aarav",
        pinHash: hashPin("121212"),
        status: "active",
      },
    });

  // 5. Consent Records
  const consentMeeraId = "con_01J00000000000000000000001";
  await db
    .insert(consentRecords)
    .values({
      id: consentMeeraId,
      studentId: meeraId,
      scope: "core_learning",
      method: "school_paper",
      evidenceRef: "CONSENT-PAPER-MEERA-2026",
      recordedBy: teacherId,
      grantedAt: new Date("2026-10-01T09:00:00.000Z"),
    })
    .onConflictDoNothing();

  const consentAaravId = "con_01J00000000000000000000002";
  await db
    .insert(consentRecords)
    .values({
      id: consentAaravId,
      studentId: aaravId,
      scope: "core_learning",
      method: "school_paper",
      evidenceRef: "CONSENT-PAPER-AARAV-2026",
      recordedBy: teacherId,
      grantedAt: new Date("2026-10-01T09:00:00.000Z"),
    })
    .onConflictDoNothing();

  // 6. Student State
  await db
    .insert(studentState)
    .values({
      studentId: meeraId,
      stateVersion: 3,
      focusConceptId: "MATH-FRAC-EQUIV",
      startConceptId: "MATH-FRAC-PART",
      quickCheckDoneAt: new Date("2026-11-06T09:30:00.000Z"),
      sparksTotal: 40,
    })
    .onConflictDoUpdate({
      target: studentState.studentId,
      set: {
        focusConceptId: "MATH-FRAC-EQUIV",
        startConceptId: "MATH-FRAC-PART",
        quickCheckDoneAt: new Date("2026-11-06T09:30:00.000Z"),
        sparksTotal: 40,
      },
    });

  await db
    .insert(studentState)
    .values({
      studentId: aaravId,
      stateVersion: 1,
      focusConceptId: "MATH-FRAC-PART",
      startConceptId: "MATH-FRAC-PART",
      quickCheckDoneAt: new Date("2026-11-13T09:30:00.000Z"),
      sparksTotal: 10,
    })
    .onConflictDoUpdate({
      target: studentState.studentId,
      set: {
        focusConceptId: "MATH-FRAC-PART",
        startConceptId: "MATH-FRAC-PART",
        sparksTotal: 10,
      },
    });

  await db
    .insert(studentState)
    .values({
      studentId: kabirId,
      stateVersion: 0,
      sparksTotal: 0,
    })
    .onConflictDoNothing();

  // 7. Seeded Session, Item Instances, Attempts, Events for Meera
  // Meera demonstrated MATH-FRAC-EQUIV 8 days ago
  const demonstratedDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const sessionId = "ses_01J00000000000000000000001";
  await db
    .insert(learningSessions)
    .values({
      id: sessionId,
      studentId: meeraId,
      mode: "learn",
      focusConceptId: "MATH-FRAC-EQUIV",
      status: "completed",
      stepSeq: 3,
      counters: { completedSteps: 3 },
      startedAt: demonstratedDate,
      endedAt: new Date(demonstratedDate.getTime() + 15 * 60 * 1000),
    })
    .onConflictDoNothing();

  const item1Id = "itm_01J00000000000000000000001";
  const item2Id = "itm_01J00000000000000000000002";
  const item3Id = "itm_01J00000000000000000000003";

  await db
    .insert(itemInstances)
    .values([
      {
        id: item1Id,
        templateId: "MATH-FRAC-EQUIV/missing-numerator",
        templateVersion: 1,
        seed: 1001,
        conceptId: "MATH-FRAC-EQUIV",
        prompt: [{ t: "text", v: "1/2 = ☐/6" }],
        answer: { kind: "integer", value: "3" },
        hints: [[{ t: "text", v: "Hint 1" }]],
        workedExample: { steps: [], result: [{ t: "text", v: "Ex" }] },
      },
      {
        id: item2Id,
        templateId: "MATH-FRAC-EQUIV/missing-denominator",
        templateVersion: 1,
        seed: 1002,
        conceptId: "MATH-FRAC-EQUIV",
        prompt: [{ t: "text", v: "2/3 = 4/☐" }],
        answer: { kind: "integer", value: "6" },
        hints: [[{ t: "text", v: "Hint 1" }]],
        workedExample: { steps: [], result: [{ t: "text", v: "Ex" }] },
      },
      {
        id: item3Id,
        templateId: "MATH-FRAC-EQUIV/missing-denominator",
        templateVersion: 1,
        seed: 1003,
        conceptId: "MATH-FRAC-EQUIV",
        prompt: [{ t: "text", v: "3/4 = 9/☐" }],
        answer: { kind: "integer", value: "12" },
        hints: [[{ t: "text", v: "Hint 1" }]],
        workedExample: { steps: [], result: [{ t: "text", v: "Ex" }] },
      },
    ])
    .onConflictDoNothing();

  const att1Id = "att_01J00000000000000000000001";
  const att2Id = "att_01J00000000000000000000002";
  const att3Id = "att_01J00000000000000000000003";

  await db
    .insert(attempts)
    .values([
      {
        id: att1Id,
        sessionId,
        studentId: meeraId,
        clientAttemptId: "11111111-1111-4111-8111-000000000001",
        stepSeq: 1,
        itemInstanceId: item1Id,
        conceptId: "MATH-FRAC-EQUIV",
        rawAnswer: "3",
        parsed: { kind: "integer", value: "3" },
        outcome: "correct",
        assistanceLevel: 0,
        tryNo: 1,
        isReview: false,
        mode: "learn",
        verifierVersion: "verify-1.0",
        createdAt: new Date(demonstratedDate.getTime() + 2 * 60 * 1000),
      },
      {
        id: att2Id,
        sessionId,
        studentId: meeraId,
        clientAttemptId: "11111111-1111-4111-8111-000000000002",
        stepSeq: 2,
        itemInstanceId: item2Id,
        conceptId: "MATH-FRAC-EQUIV",
        rawAnswer: "6",
        parsed: { kind: "integer", value: "6" },
        outcome: "correct",
        assistanceLevel: 0,
        tryNo: 1,
        isReview: false,
        mode: "learn",
        verifierVersion: "verify-1.0",
        createdAt: new Date(demonstratedDate.getTime() + 5 * 60 * 1000),
      },
      {
        id: att3Id,
        sessionId,
        studentId: meeraId,
        clientAttemptId: "11111111-1111-4111-8111-000000000003",
        stepSeq: 3,
        itemInstanceId: item3Id,
        conceptId: "MATH-FRAC-EQUIV",
        rawAnswer: "12",
        parsed: { kind: "integer", value: "12" },
        outcome: "correct",
        assistanceLevel: 0,
        tryNo: 1,
        isReview: false,
        mode: "learn",
        verifierVersion: "verify-1.0",
        createdAt: new Date(demonstratedDate.getTime() + 8 * 60 * 1000),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(events)
    .values([
      {
        id: "evt_01J00000000000000000000001",
        studentId: meeraId,
        sessionId,
        type: "belief_changed",
        payload: {
          conceptId: "MATH-FRAC-EQUIV",
          from: "not_assessed",
          to: "demonstrated",
        },
        createdAt: new Date(demonstratedDate.getTime() + 8 * 60 * 1000),
      },
      {
        id: "evt_01J00000000000000000000002",
        studentId: meeraId,
        sessionId,
        type: "sparks_awarded",
        payload: {
          sourceId: "att_01J00000000000000000000003",
          kind: "demonstrated",
          amount: 20,
        },
        createdAt: new Date(demonstratedDate.getTime() + 8 * 60 * 1000),
      },
    ])
    .onConflictDoNothing();

  // Sparks ledger entry
  await db
    .insert(sparksLedger)
    .values({
      id: "spk_01J00000000000000000000001",
      studentId: meeraId,
      sourceId: "att_01J00000000000000000000003",
      kind: "demonstrated",
      amount: 20,
    })
    .onConflictDoNothing();

  // 8. Concept Beliefs (Stored projection for Meera)
  await db
    .insert(conceptBeliefs)
    .values({
      studentId: meeraId,
      conceptId: "MATH-FRAC-EQUIV",
      status: "demonstrated",
      estimate: "0.8500",
      reliability: "supported",
      independentN: 3,
      independentCorrectN: 3,
      demonstratedAt: new Date(demonstratedDate.getTime() + 8 * 60 * 1000),
      lastEvidenceAt: new Date(demonstratedDate.getTime() + 8 * 60 * 1000),
      activeMisconceptionIds: [],
      policyVersion: "rules-1.0",
      version: 3,
    })
    .onConflictDoUpdate({
      target: [conceptBeliefs.studentId, conceptBeliefs.conceptId],
      set: {
        status: "demonstrated",
        estimate: "0.8500",
        reliability: "supported",
        independentN: 3,
        independentCorrectN: 3,
        demonstratedAt: new Date(demonstratedDate.getTime() + 8 * 60 * 1000),
      },
    });

  // 9. Review Schedule for Meera: Retention review due (+7 days from demonstration = 1 day ago)
  const retentionDueDate = new Date(demonstratedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db
    .insert(reviewSchedule)
    .values({
      id: "rev_01J00000000000000000000001",
      studentId: meeraId,
      conceptId: "MATH-FRAC-EQUIV",
      kind: "retention",
      dueAt: retentionDueDate,
      status: "due",
    })
    .onConflictDoNothing();

  // 10. Daily Quest for Today
  const todayStr = new Date().toISOString().slice(0, 10);
  await db
    .insert(quests)
    .values({
      id: "qst_01J00000000000000000000001",
      studentId: meeraId,
      questDate: todayStr,
      slots: [
        { slotId: "slot_1", kind: "review", conceptId: "MATH-FRAC-EQUIV", completed: false },
        { slotId: "slot_2", kind: "practice", conceptId: "MATH-FRAC-EQUIV", completed: false },
        { slotId: "slot_3", kind: "practice", conceptId: "MATH-FRAC-SIMPLIFY", completed: false },
      ],
      status: "in_progress",
    })
    .onConflictDoNothing();

  // 11. Feature Flags
  await db
    .insert(featureFlags)
    .values([
      {
        key: "llm_kill_switch",
        value: { enabled: false },
        updatedBy: adminId,
      },
      {
        key: "solve_enabled_global",
        value: { enabled: true },
        updatedBy: adminId,
      },
    ])
    .onConflictDoNothing();

  return {
    orgId,
    cohortId,
    meeraId,
    kabirId,
    aaravId,
    teacherId,
    adminId,
  };
}

const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  loadRootEnv();
  seedDatabase()
    .then(async (_res) => {
      process.stdout.write(`✓ Database seeded successfully.\n`);
      process.stdout.write(`  - Demo Cohort: 7A (join code DEMO7A)\n`);
      process.stdout.write(
        `  - Students: Meera (PIN 333333), Kabir (PIN 444444), Aarav (PIN 121212)\n`,
      );
      process.stdout.write(`  - Teacher: teacher@demo.gaps (password TeacherDemo2026!)\n`);
      process.stdout.write(`  - Admin: admin@demo.gaps (password AdminDemo2026!)\n`);
      await closeSqlClients();
      process.exitCode = 0;
    })
    .catch(async (err: unknown) => {
      process.stderr.write(`✗ Seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
      await closeSqlClients();
      process.exitCode = 1;
    });
}
