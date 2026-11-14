import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "../client";
import {
  cohorts,
  conceptBeliefs,
  consentRecords,
  flags,
  studentState,
  teacherCohorts,
  users,
} from "../schema";

export interface TeacherRepo {
  readonly teacherId: string;
  getAssignedCohortIds(): Promise<string[]>;
  getAssignedCohorts(): Promise<(typeof cohorts.$inferSelect)[]>;
  isAssignedToCohort(cohortId: string): Promise<boolean>;
  isAssignedToStudent(studentId: string): Promise<boolean>;
  getCohortRoster(cohortId: string): Promise<(typeof users.$inferSelect)[]>;
  getStudentProgress(studentId: string): Promise<{
    student: typeof users.$inferSelect;
    state: typeof studentState.$inferSelect | null;
    beliefs: (typeof conceptBeliefs.$inferSelect)[];
  } | null>;
  listFlags(options?: { status?: "open" | "resolved" }): Promise<(typeof flags.$inferSelect)[]>;
  resolveFlag(flagId: string, resolutionNote?: string): Promise<typeof flags.$inferSelect | null>;
  recordConsent(params: {
    id: string;
    studentId: string;
    scope: string;
    method: string;
    evidenceRef: string;
    grantedAt: Date;
  }): Promise<typeof consentRecords.$inferSelect>;
  revokeConsent(consentId: string): Promise<typeof consentRecords.$inferSelect | null>;
}

export function createTeacherRepo(teacherId: string, db: DbClient): TeacherRepo {
  async function getCohortIds(): Promise<string[]> {
    const rows = await db
      .select({ cohortId: teacherCohorts.cohortId })
      .from(teacherCohorts)
      .where(eq(teacherCohorts.teacherId, teacherId));
    return rows.map((r) => r.cohortId);
  }

  return {
    teacherId,

    async getAssignedCohortIds() {
      return getCohortIds();
    },

    async getAssignedCohorts() {
      const cohortIds = await getCohortIds();
      if (cohortIds.length === 0) return [];
      return db.select().from(cohorts).where(inArray(cohorts.id, cohortIds));
    },

    async isAssignedToCohort(cohortId: string) {
      const rows = await db
        .select()
        .from(teacherCohorts)
        .where(and(eq(teacherCohorts.teacherId, teacherId), eq(teacherCohorts.cohortId, cohortId)))
        .limit(1);
      return rows.length > 0;
    },

    async isAssignedToStudent(studentId: string) {
      const cohortIds = await getCohortIds();
      if (cohortIds.length === 0) return false;
      const student = await db
        .select({ cohortId: users.cohortId })
        .from(users)
        .where(and(eq(users.id, studentId), eq(users.role, "student")))
        .limit(1);
      if (!student[0] || !student[0].cohortId) return false;
      return cohortIds.includes(student[0].cohortId);
    },

    async getCohortRoster(cohortId: string) {
      const isAssigned = await this.isAssignedToCohort(cohortId);
      if (!isAssigned) {
        throw new Error(`Teacher ${teacherId} is not assigned to cohort ${cohortId}`);
      }
      return db
        .select()
        .from(users)
        .where(
          and(eq(users.cohortId, cohortId), eq(users.role, "student"), isNull(users.deletedAt)),
        );
    },

    async getStudentProgress(studentId: string) {
      const isAssigned = await this.isAssignedToStudent(studentId);
      if (!isAssigned) {
        return null;
      }
      const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
      if (!student) return null;

      const [state] = await db
        .select()
        .from(studentState)
        .where(eq(studentState.studentId, studentId))
        .limit(1);

      const beliefs = await db
        .select()
        .from(conceptBeliefs)
        .where(eq(conceptBeliefs.studentId, studentId));

      return {
        student,
        state: state ?? null,
        beliefs,
      };
    },

    async listFlags(options = {}) {
      const cohortIds = await getCohortIds();
      if (cohortIds.length === 0) return [];

      let query = db
        .select()
        .from(flags)
        .where(inArray(flags.cohortId, cohortIds))
        .orderBy(desc(flags.createdAt));

      if (options.status) {
        query = db
          .select()
          .from(flags)
          .where(and(inArray(flags.cohortId, cohortIds), eq(flags.status, options.status)))
          .orderBy(desc(flags.createdAt));
      }

      return query;
    },

    async resolveFlag(flagId: string, resolutionNote?: string) {
      const cohortIds = await getCohortIds();
      if (cohortIds.length === 0) return null;

      const [updated] = await db
        .update(flags)
        .set({
          status: "resolved",
          resolvedBy: teacherId,
          resolvedAt: new Date(),
          resolutionNote: resolutionNote ?? null,
        })
        .where(and(eq(flags.id, flagId), inArray(flags.cohortId, cohortIds)))
        .returning();

      return updated ?? null;
    },

    async recordConsent(params) {
      const isAssigned = await this.isAssignedToStudent(params.studentId);
      if (!isAssigned) {
        throw new Error(`Teacher ${teacherId} is not assigned to student ${params.studentId}`);
      }

      const [record] = await db
        .insert(consentRecords)
        .values({
          id: params.id,
          studentId: params.studentId,
          scope: params.scope,
          method: params.method,
          evidenceRef: params.evidenceRef,
          recordedBy: teacherId,
          grantedAt: params.grantedAt,
        })
        .returning();

      if (!record) {
        throw new Error(`Failed to record consent for ${params.studentId}`);
      }
      return record;
    },

    async revokeConsent(consentId: string) {
      const [consent] = await db
        .select()
        .from(consentRecords)
        .where(eq(consentRecords.id, consentId))
        .limit(1);

      if (!consent) return null;

      const isAssigned = await this.isAssignedToStudent(consent.studentId);
      if (!isAssigned) {
        throw new Error(`Teacher ${teacherId} is not assigned to student ${consent.studentId}`);
      }

      const [revoked] = await db
        .update(consentRecords)
        .set({
          revokedAt: new Date(),
          revokedBy: teacherId,
        })
        .where(eq(consentRecords.id, consentId))
        .returning();

      return revoked ?? null;
    },
  };
}
