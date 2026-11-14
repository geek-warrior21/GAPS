import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import {
  attempts,
  comebackCards,
  conceptBeliefs,
  consentRecords,
  events,
  learningSessions,
  quests,
  reviewSchedule,
  sparksLedger,
  studentState,
  users,
} from "../schema";

export interface StudentRepo {
  readonly studentId: string;
  getProfile(): Promise<typeof users.$inferSelect | null>;
  getStudentState(): Promise<typeof studentState.$inferSelect | null>;
  ensureStudentState(
    defaults?: Partial<typeof studentState.$inferInsert>,
  ): Promise<typeof studentState.$inferSelect>;
  updateStudentState(
    updates: Partial<typeof studentState.$inferInsert>,
  ): Promise<typeof studentState.$inferSelect>;
  getConceptBeliefs(): Promise<(typeof conceptBeliefs.$inferSelect)[]>;
  getConceptBelief(conceptId: string): Promise<typeof conceptBeliefs.$inferSelect | null>;
  upsertConceptBelief(
    belief: typeof conceptBeliefs.$inferInsert,
  ): Promise<typeof conceptBeliefs.$inferSelect>;
  getActiveSession(): Promise<typeof learningSessions.$inferSelect | null>;
  getSession(sessionId: string): Promise<typeof learningSessions.$inferSelect | null>;
  createSession(
    data: Omit<typeof learningSessions.$inferInsert, "studentId">,
  ): Promise<typeof learningSessions.$inferSelect>;
  updateSession(
    sessionId: string,
    updates: Partial<typeof learningSessions.$inferInsert>,
  ): Promise<typeof learningSessions.$inferSelect | null>;
  abandonActiveSessions(): Promise<number>;
  recordAttempt(
    data: Omit<typeof attempts.$inferInsert, "studentId">,
  ): Promise<typeof attempts.$inferSelect>;
  recordEvent(
    data: Omit<typeof events.$inferInsert, "studentId">,
  ): Promise<typeof events.$inferSelect>;
  getAttemptsForSession(sessionId: string): Promise<(typeof attempts.$inferSelect)[]>;
  getAllAttempts(): Promise<(typeof attempts.$inferSelect)[]>;
  getDueReviews(now?: Date): Promise<(typeof reviewSchedule.$inferSelect)[]>;
  scheduleReview(
    data: Omit<typeof reviewSchedule.$inferInsert, "studentId">,
  ): Promise<typeof reviewSchedule.$inferSelect>;
  markReviewDone(reviewId: string): Promise<boolean>;
  getQuest(questDate: string): Promise<typeof quests.$inferSelect | null>;
  createQuest(
    data: Omit<typeof quests.$inferInsert, "studentId">,
  ): Promise<typeof quests.$inferSelect>;
  updateQuest(
    questId: string,
    updates: Partial<typeof quests.$inferInsert>,
  ): Promise<typeof quests.$inferSelect | null>;
  getSparksTotal(): Promise<number>;
  awardSparks(
    sourceId: string,
    kind: string,
    amount: number,
  ): Promise<{ awarded: boolean; total: number }>;
  getComebackCards(): Promise<(typeof comebackCards.$inferSelect)[]>;
  createComebackCard(
    data: Omit<typeof comebackCards.$inferInsert, "studentId">,
  ): Promise<typeof comebackCards.$inferSelect>;
  markComebackCardSeen(cardId: string): Promise<boolean>;
  getActiveConsents(): Promise<(typeof consentRecords.$inferSelect)[]>;
  hasConsent(scope: string): Promise<boolean>;
}

export function createStudentRepo(studentId: string, db: DbClient): StudentRepo {
  return {
    studentId,

    async getProfile() {
      const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, studentId), eq(users.role, "student")))
        .limit(1);
      return rows[0] ?? null;
    },

    async getStudentState() {
      const rows = await db
        .select()
        .from(studentState)
        .where(eq(studentState.studentId, studentId))
        .limit(1);
      return rows[0] ?? null;
    },

    async ensureStudentState(defaults = {}) {
      const existing = await this.getStudentState();
      if (existing) {
        return existing;
      }
      const [inserted] = await db
        .insert(studentState)
        .values({
          studentId,
          ...defaults,
        })
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        return inserted;
      }
      const retry = await this.getStudentState();
      if (!retry) {
        throw new Error(`Failed to ensure student_state for ${studentId}`);
      }
      return retry;
    },

    async updateStudentState(updates) {
      const [updated] = await db
        .update(studentState)
        .set(updates)
        .where(eq(studentState.studentId, studentId))
        .returning();
      if (!updated) {
        throw new Error(`Failed to update student_state for ${studentId}`);
      }
      return updated;
    },

    async getConceptBeliefs() {
      return db.select().from(conceptBeliefs).where(eq(conceptBeliefs.studentId, studentId));
    },

    async getConceptBelief(conceptId: string) {
      const rows = await db
        .select()
        .from(conceptBeliefs)
        .where(
          and(eq(conceptBeliefs.studentId, studentId), eq(conceptBeliefs.conceptId, conceptId)),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    async upsertConceptBelief(belief) {
      const [upserted] = await db
        .insert(conceptBeliefs)
        .values({
          ...belief,
          studentId,
        })
        .onConflictDoUpdate({
          target: [conceptBeliefs.studentId, conceptBeliefs.conceptId],
          set: {
            status: belief.status,
            estimate: belief.estimate,
            reliability: belief.reliability,
            independentN: belief.independentN,
            independentCorrectN: belief.independentCorrectN,
            demonstratedAt: belief.demonstratedAt,
            retainedAt: belief.retainedAt,
            firstNeedsSupportAt: belief.firstNeedsSupportAt,
            lastEvidenceAt: belief.lastEvidenceAt,
            activeMisconceptionIds: belief.activeMisconceptionIds,
            policyVersion: belief.policyVersion ?? "rules-1.0",
            version: sql`${conceptBeliefs.version} + 1`,
          },
        })
        .returning();
      if (!upserted) {
        throw new Error(`Failed to upsert concept_belief for ${studentId}`);
      }
      return upserted;
    },

    async getActiveSession() {
      const rows = await db
        .select()
        .from(learningSessions)
        .where(
          and(eq(learningSessions.studentId, studentId), eq(learningSessions.status, "active")),
        )
        .orderBy(desc(learningSessions.startedAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async getSession(sessionId: string) {
      const rows = await db
        .select()
        .from(learningSessions)
        .where(and(eq(learningSessions.id, sessionId), eq(learningSessions.studentId, studentId)))
        .limit(1);
      return rows[0] ?? null;
    },

    async createSession(data) {
      const [created] = await db
        .insert(learningSessions)
        .values({
          ...data,
          studentId,
        })
        .returning();
      if (!created) {
        throw new Error(`Failed to create learning_session for ${studentId}`);
      }
      return created;
    },

    async updateSession(sessionId: string, updates) {
      const [updated] = await db
        .update(learningSessions)
        .set(updates)
        .where(and(eq(learningSessions.id, sessionId), eq(learningSessions.studentId, studentId)))
        .returning();
      return updated ?? null;
    },

    async abandonActiveSessions() {
      const updated = await db
        .update(learningSessions)
        .set({ status: "abandoned", endedAt: new Date() })
        .where(
          and(eq(learningSessions.studentId, studentId), eq(learningSessions.status, "active")),
        )
        .returning();
      return updated.length;
    },

    async recordAttempt(data) {
      // Check idempotency first: (sessionId, clientAttemptId)
      const existing = await db
        .select()
        .from(attempts)
        .where(
          and(
            eq(attempts.sessionId, data.sessionId),
            eq(attempts.clientAttemptId, data.clientAttemptId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        return existing[0];
      }

      const [inserted] = await db
        .insert(attempts)
        .values({
          ...data,
          studentId,
        })
        .returning();
      if (!inserted) {
        throw new Error(`Failed to record attempt for ${studentId}`);
      }
      return inserted;
    },

    async recordEvent(data) {
      const [inserted] = await db
        .insert(events)
        .values({
          ...data,
          studentId,
        })
        .returning();
      if (!inserted) {
        throw new Error(`Failed to record event for ${studentId}`);
      }
      return inserted;
    },

    async getAttemptsForSession(sessionId: string) {
      return db
        .select()
        .from(attempts)
        .where(and(eq(attempts.sessionId, sessionId), eq(attempts.studentId, studentId)))
        .orderBy(asc(attempts.stepSeq));
    },

    async getAllAttempts() {
      return db
        .select()
        .from(attempts)
        .where(eq(attempts.studentId, studentId))
        .orderBy(asc(attempts.createdAt), asc(attempts.id));
    },

    async getDueReviews(now: Date = new Date()) {
      return db
        .select()
        .from(reviewSchedule)
        .where(
          and(
            eq(reviewSchedule.studentId, studentId),
            eq(reviewSchedule.status, "due"),
            lte(reviewSchedule.dueAt, now),
          ),
        )
        .orderBy(asc(reviewSchedule.dueAt));
    },

    async scheduleReview(data) {
      const [scheduled] = await db
        .insert(reviewSchedule)
        .values({
          ...data,
          studentId,
        })
        .onConflictDoNothing()
        .returning();
      if (scheduled) {
        return scheduled;
      }
      // If conflict, return existing due review
      const existing = await db
        .select()
        .from(reviewSchedule)
        .where(
          and(
            eq(reviewSchedule.studentId, studentId),
            eq(reviewSchedule.conceptId, data.conceptId),
            eq(reviewSchedule.kind, data.kind),
            eq(reviewSchedule.status, "due"),
          ),
        )
        .limit(1);
      return existing[0]!;
    },

    async markReviewDone(reviewId: string) {
      const [updated] = await db
        .update(reviewSchedule)
        .set({ status: "done" })
        .where(and(eq(reviewSchedule.id, reviewId), eq(reviewSchedule.studentId, studentId)))
        .returning();
      return Boolean(updated);
    },

    async getQuest(questDate: string) {
      const rows = await db
        .select()
        .from(quests)
        .where(and(eq(quests.studentId, studentId), eq(quests.questDate, questDate)))
        .limit(1);
      return rows[0] ?? null;
    },

    async createQuest(data) {
      const [created] = await db
        .insert(quests)
        .values({
          ...data,
          studentId,
        })
        .returning();
      if (!created) {
        throw new Error(`Failed to create quest for ${studentId}`);
      }
      return created;
    },

    async updateQuest(questId: string, updates) {
      const [updated] = await db
        .update(quests)
        .set(updates)
        .where(and(eq(quests.id, questId), eq(quests.studentId, studentId)))
        .returning();
      return updated ?? null;
    },

    async getSparksTotal() {
      const state = await this.getStudentState();
      return state?.sparksTotal ?? 0;
    },

    async awardSparks(sourceId: string, kind: string, amount: number) {
      const id = `spk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const [inserted] = await db
        .insert(sparksLedger)
        .values({
          id,
          studentId,
          sourceId,
          kind,
          amount,
        })
        .onConflictDoNothing()
        .returning();

      if (!inserted) {
        // Already awarded (idempotent)
        const total = await this.getSparksTotal();
        return { awarded: false, total };
      }

      // Update student_state total
      const [updatedState] = await db
        .update(studentState)
        .set({
          sparksTotal: sql`${studentState.sparksTotal} + ${amount}`,
        })
        .where(eq(studentState.studentId, studentId))
        .returning();

      return { awarded: true, total: updatedState?.sparksTotal ?? amount };
    },

    async getComebackCards() {
      return db
        .select()
        .from(comebackCards)
        .where(eq(comebackCards.studentId, studentId))
        .orderBy(desc(comebackCards.createdAt));
    },

    async createComebackCard(data) {
      const [created] = await db
        .insert(comebackCards)
        .values({
          ...data,
          studentId,
        })
        .returning();
      if (!created) {
        throw new Error(`Failed to create comeback card for ${studentId}`);
      }
      return created;
    },

    async markComebackCardSeen(cardId: string) {
      const [updated] = await db
        .update(comebackCards)
        .set({ seenAt: new Date() })
        .where(and(eq(comebackCards.id, cardId), eq(comebackCards.studentId, studentId)))
        .returning();
      return Boolean(updated);
    },

    async getActiveConsents() {
      return db
        .select()
        .from(consentRecords)
        .where(and(eq(consentRecords.studentId, studentId), isNull(consentRecords.revokedAt)));
    },

    async hasConsent(scope: string) {
      const rows = await db
        .select()
        .from(consentRecords)
        .where(
          and(
            eq(consentRecords.studentId, studentId),
            eq(consentRecords.scope, scope),
            isNull(consentRecords.revokedAt),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },
  };
}
