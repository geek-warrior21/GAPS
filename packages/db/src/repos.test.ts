import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeSqlClients, getDb } from "./client";
import {
  createAdminRepo,
  createStudentRepo,
  createTeacherRepo,
  findOrCreateItemInstance,
  listChapters,
  listConcepts,
  listMisconceptions,
} from "./repos/index";
import { seedDatabase } from "./seed";
import { syncContent } from "./content-sync";

describe("Principal-Scoped Repositories", () => {
  const db = getDb();

  beforeAll(async () => {
    await syncContent(db);
    await seedDatabase(db);
  });

  afterAll(async () => {
    await closeSqlClients();
  });

  describe("Content Repository", () => {
    it("lists all chapters, concepts, and misconceptions", async () => {
      const chapters = await listChapters(db);
      expect(chapters.length).toBeGreaterThanOrEqual(3);

      const concepts = await listConcepts(db);
      expect(concepts.length).toBe(14);

      const misconceptions = await listMisconceptions(db);
      expect(misconceptions.length).toBeGreaterThanOrEqual(15);
    });

    it("creates and retrieves item instances deterministically", async () => {
      const item = await findOrCreateItemInstance(db, {
        id: "itm_test_item_inst_1",
        templateId: "tpl_frac_part_ident_v1",
        templateVersion: 1,
        seed: 42,
        conceptId: "MATH-FRAC-PART",
        prompt: { text: "What fraction is shaded?" },
        answer: { kind: "fraction", num: "1", den: "3" },
        hints: ["Count parts", "Count shaded", "Write fraction"],
        workedExample: { steps: ["Total is 3", "Shaded is 1", "Answer is 1/3"] },
      });

      expect(item).toBeDefined();
      expect(item!.id).toBe("itm_test_item_inst_1");

      // Calling again with same template, version and seed returns the existing item
      const duplicate = await findOrCreateItemInstance(db, {
        id: "itm_test_item_inst_2",
        templateId: "tpl_frac_part_ident_v1",
        templateVersion: 1,
        seed: 42,
        conceptId: "MATH-FRAC-PART",
        prompt: { text: "Different text" },
        answer: { kind: "fraction", num: "1", den: "3" },
        hints: [],
        workedExample: {},
      });

      expect(duplicate).toBeDefined();
      expect(duplicate!.id).toBe("itm_test_item_inst_1");
    });
  });

  describe("Student Repository Scoping", () => {
    const meeraId = "stu_01J00000000000000000000001";
    const kabirId = "stu_01J00000000000000000000002";

    it("restricts data access to the scoped student", async () => {
      const meeraRepo = createStudentRepo(meeraId, db);
      const kabirRepo = createStudentRepo(kabirId, db);

      // Meera has demonstrated MATH-FRAC-EQUIV
      const meeraBelief = await meeraRepo.getConceptBelief("MATH-FRAC-EQUIV");
      expect(meeraBelief?.status).toBe("demonstrated");

      // Kabir has not assessed MATH-FRAC-EQUIV
      const kabirBelief = await kabirRepo.getConceptBelief("MATH-FRAC-EQUIV");
      expect(kabirBelief?.status ?? "not_assessed").toBe("not_assessed");

      // Meera cannot see Kabir's session
      const kabirSession = await kabirRepo.createSession({
        id: `ses_kabir_private_${Date.now()}`,
        mode: "learn",
      });

      const meeraViewOfKabirSession = await meeraRepo.getSession(kabirSession.id);
      expect(meeraViewOfKabirSession).toBeNull();
    });

    it("awards sparks idempotently", async () => {
      const repo = createStudentRepo(meeraId, db);
      const initialTotal = await repo.getSparksTotal();

      const sourceId = `test_spark_source_${Date.now()}`;
      const award1 = await repo.awardSparks(sourceId, "mastery_demonstrated", 10);
      expect(award1.awarded).toBe(true);
      expect(award1.total).toBe(initialTotal + 10);

      // Duplicate award with same sourceId and kind is ignored
      const award2 = await repo.awardSparks(sourceId, "mastery_demonstrated", 10);
      expect(award2.awarded).toBe(false);
      expect(award2.total).toBe(initialTotal + 10);
    });
  });

  describe("Teacher Repository Scoping", () => {
    const teacherId = "usr_01J00000000000000000000001"; // Teacher of Cohort 7A
    const studentIn7A = "stu_01J00000000000000000000001"; // Meera in 7A

    it("allows teacher to view assigned cohort roster and student progress", async () => {
      const teacherRepo = createTeacherRepo(teacherId, db);
      const cohorts = await teacherRepo.getAssignedCohorts();
      expect(cohorts.length).toBeGreaterThan(0);
      const cohort7A = cohorts[0]!;

      const roster = await teacherRepo.getCohortRoster(cohort7A.id);
      expect(roster.length).toBeGreaterThanOrEqual(3);

      const progress = await teacherRepo.getStudentProgress(studentIn7A);
      expect(progress).not.toBeNull();
      expect(progress?.student.id).toBe(studentIn7A);
      expect(progress?.beliefs.length).toBeGreaterThanOrEqual(1);
      expect(progress?.beliefs.find((b) => b.conceptId === "MATH-FRAC-EQUIV")?.status).toBe(
        "demonstrated",
      );
    });

    it("blocks access to cohorts the teacher is not assigned to", async () => {
      const teacherRepo = createTeacherRepo(teacherId, db);
      const unassignedCohortId = "coh_unassigned_cohort_99";

      await expect(teacherRepo.getCohortRoster(unassignedCohortId)).rejects.toThrow(/not assigned/);

      const unassignedStudentId = "stu_unassigned_student_99";
      const progress = await teacherRepo.getStudentProgress(unassignedStudentId);
      expect(progress).toBeNull();
    });
  });

  describe("Admin Repository", () => {
    const adminId = "usr_01J00000000000000000000020";

    it("reads and updates feature flags", async () => {
      const adminRepo = createAdminRepo(adminId, db);
      await adminRepo.setFeatureFlag("flag_test_ai_toggle", { enabled: false });

      const flag = await adminRepo.getFeatureFlag("flag_test_ai_toggle");
      expect(flag).toEqual({ enabled: false });
    });

    it("records and queries audit logs", async () => {
      const adminRepo = createAdminRepo(adminId, db);
      const logId = `aud_${Date.now()}`;
      await adminRepo.recordAuditLog({
        id: logId,
        action: "test.admin_action",
        targetType: "system",
        targetId: "sys_01",
        metadata: { info: "testing" },
      });

      const logs = await adminRepo.listAuditLogs(10);
      const found = logs.find((l) => l.id === logId);
      expect(found).toBeDefined();
      expect(found?.action).toBe("test.admin_action");
    });
  });
});
