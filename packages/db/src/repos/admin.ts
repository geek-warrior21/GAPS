import { and, desc, eq } from "drizzle-orm";
import type { DbClient } from "../client";
import {
  auditLog,
  cohorts,
  deletionRequests,
  featureFlags,
  organizations,
  teacherCohorts,
  users,
} from "../schema";

export interface AdminRepo {
  readonly adminId: string;
  listAllOrganizations(): Promise<(typeof organizations.$inferSelect)[]>;
  listAllCohorts(): Promise<(typeof cohorts.$inferSelect)[]>;
  listAllUsers(): Promise<(typeof users.$inferSelect)[]>;
  createCohort(data: typeof cohorts.$inferInsert): Promise<typeof cohorts.$inferSelect>;
  assignTeacherToCohort(
    teacherId: string,
    cohortId: string,
  ): Promise<typeof teacherCohorts.$inferSelect>;
  getFeatureFlag(key: string): Promise<unknown | null>;
  setFeatureFlag(key: string, value: unknown): Promise<typeof featureFlags.$inferSelect>;
  listFeatureFlags(): Promise<(typeof featureFlags.$inferSelect)[]>;
  recordAuditLog(entry: {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }): Promise<typeof auditLog.$inferSelect>;
  listAuditLogs(limit?: number): Promise<(typeof auditLog.$inferSelect)[]>;
  requestStudentDeletion(studentId: string): Promise<typeof deletionRequests.$inferSelect>;
  deleteStudentHard(studentId: string): Promise<boolean>;
}

export function createAdminRepo(adminId: string, db: DbClient): AdminRepo {
  return {
    adminId,

    async listAllOrganizations() {
      return db.select().from(organizations);
    },

    async listAllCohorts() {
      return db.select().from(cohorts);
    },

    async listAllUsers() {
      return db.select().from(users);
    },

    async createCohort(data) {
      const [created] = await db.insert(cohorts).values(data).returning();
      if (!created) {
        throw new Error(`Failed to create cohort ${data.name}`);
      }
      return created;
    },

    async assignTeacherToCohort(teacherId: string, cohortId: string) {
      const [assigned] = await db
        .insert(teacherCohorts)
        .values({ teacherId, cohortId })
        .returning();
      if (!assigned) {
        throw new Error(`Failed to assign teacher ${teacherId} to cohort ${cohortId}`);
      }
      return assigned;
    },

    async getFeatureFlag(key: string) {
      const rows = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
      return rows[0]?.value ?? null;
    },

    async setFeatureFlag(key: string, value: unknown) {
      const [flag] = await db
        .insert(featureFlags)
        .values({
          key,
          value,
          updatedBy: adminId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: featureFlags.key,
          set: {
            value,
            updatedBy: adminId,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!flag) {
        throw new Error(`Failed to set feature flag ${key}`);
      }
      return flag;
    },

    async listFeatureFlags() {
      return db.select().from(featureFlags);
    },

    async recordAuditLog(entry) {
      const [log] = await db
        .insert(auditLog)
        .values({
          id: entry.id,
          actorId: adminId,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: entry.metadata ?? {},
        })
        .returning();
      if (!log) {
        throw new Error(`Failed to record audit log ${entry.id}`);
      }
      return log;
    },

    async listAuditLogs(limit = 100) {
      return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
    },

    async requestStudentDeletion(studentId: string) {
      const requestId = `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const [request] = await db
        .insert(deletionRequests)
        .values({
          id: requestId,
          studentId,
          requestedBy: adminId,
          status: "completed",
          completedAt: new Date(),
        })
        .returning();

      if (!request) {
        throw new Error(`Failed to record deletion request for ${studentId}`);
      }

      // Cascade delete student user record
      await this.deleteStudentHard(studentId);

      return request;
    },

    async deleteStudentHard(studentId: string) {
      const [deleted] = await db
        .delete(users)
        .where(and(eq(users.id, studentId), eq(users.role, "student")))
        .returning();
      return Boolean(deleted);
    },
  };
}
