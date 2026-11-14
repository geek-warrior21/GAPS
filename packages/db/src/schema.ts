import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// Organizations
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  processorAgreementRef: text("processor_agreement_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Cohorts
export const cohorts = pgTable("cohorts", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  grade: smallint("grade").notNull(),
  joinCode: text("join_code").notNull().unique(),
  aiEnabled: boolean("ai_enabled").default(false).notNull(),
  solveEnabled: boolean("solve_enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Users
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    role: text("role").notNull(), // student | teacher | staff_admin
    orgId: text("org_id").references(() => organizations.id),
    cohortId: text("cohort_id").references(() => cohorts.id),
    displayName: text("display_name").notNull(),
    username: text("username"),
    email: text("email"),
    passwordHash: text("password_hash"),
    pinHash: text("pin_hash"),
    totpSecretEnc: text("totp_secret_enc"),
    status: text("status").notNull(), // pending_consent | active | locked | deleted
    failedLogins: integer("failed_logins").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    avatar: jsonb("avatar").default({}).notNull(),
    settings: jsonb("settings").default({}).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_cohort_username_idx").on(t.cohortId, t.username),
    uniqueIndex("users_lower_email_idx").on(t.email),
  ],
);

// Teacher Cohorts
export const teacherCohorts = pgTable(
  "teacher_cohorts",
  {
    teacherId: text("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cohortId: text("cohort_id")
      .notNull()
      .references(() => cohorts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.teacherId, t.cohortId] })],
);

// Consent Records
export const consentRecords = pgTable(
  "consent_records",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(), // core_learning | ai_free_text | research_use
    method: text("method").notNull(), // school_paper | school_digital
    evidenceRef: text("evidence_ref").notNull(),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: text("revoked_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("consent_active_scope_idx")
      .on(t.studentId, t.scope)
      .where(sql`revoked_at IS NULL`),
  ],
);

// Auth Sessions
export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(), // sha-256 of token
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  deviceKind: text("device_kind").default("personal").notNull(), // shared | personal
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Feature Flags
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Chapters
export const chapters = pgTable("chapters", {
  id: text("id").primaryKey(),
  strand: text("strand").notNull(),
  title: text("title").notNull(),
  ord: integer("ord").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Concepts
export const concepts = pgTable("concepts", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id),
  title: text("title").notNull(),
  studentTitle: text("student_title").notNull(),
  description: text("description").notNull(),
  gradeMin: integer("grade_min").notNull(),
  gradeMax: integer("grade_max").notNull(),
  topoOrder: integer("topo_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Concept Edges
export const conceptEdges = pgTable(
  "concept_edges",
  {
    prereqId: text("prereq_id")
      .notNull()
      .references(() => concepts.id),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.prereqId, t.conceptId] })],
);

// Misconceptions
export const misconceptions = pgTable("misconceptions", {
  id: text("id").primaryKey(),
  conceptIds: text("concept_ids").array().notNull(),
  title: text("title").notNull(),
  studentFeedback: text("student_feedback").notNull(),
  teacherNote: text("teacher_note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Templates
export const templates = pgTable(
  "templates",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id),
    difficulty: smallint("difficulty").notNull(),
    answerKind: text("answer_kind").notNull(),
    reviewStatus: text("review_status").notNull(), // draft | reviewed | retired
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.version] })],
);

// Item Instances
export const itemInstances = pgTable(
  "item_instances",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull(),
    templateVersion: integer("template_version").notNull(),
    seed: integer("seed").notNull(),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id),
    prompt: jsonb("prompt").notNull(),
    answer: jsonb("answer").notNull(),
    misconceptionAnswers: jsonb("misconception_answers").default({}).notNull(),
    hints: jsonb("hints").notNull(),
    workedExample: jsonb("worked_example").notNull(),
    visual: jsonb("visual"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("item_instances_unique_idx").on(t.templateId, t.templateVersion, t.seed)],
);

// Learning Sessions
export const learningSessions = pgTable("learning_sessions", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(), // learn | review | quest | boss | quick_check | solve_followup
  focusConceptId: text("focus_concept_id").references(() => concepts.id),
  status: text("status").default("active").notNull(), // active | completed | abandoned
  budgetS: integer("budget_s").default(900).notNull(),
  stepSeq: integer("step_seq").default(0).notNull(),
  currentStep: jsonb("current_step"),
  counters: jsonb("counters").default({}).notNull(),
  plan: jsonb("plan").default({}).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Attempts (Append-only)
export const attempts = pgTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => learningSessions.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientAttemptId: text("client_attempt_id").notNull(),
    stepSeq: integer("step_seq").notNull(),
    itemInstanceId: text("item_instance_id")
      .notNull()
      .references(() => itemInstances.id),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id),
    rawAnswer: varchar("raw_answer", { length: 64 }).notNull(),
    parsed: jsonb("parsed"),
    outcome: text("outcome").notNull(), // correct | incorrect | unparseable | not_simplified
    misconceptionId: text("misconception_id"),
    assistanceLevel: smallint("assistance_level").default(0).notNull(),
    tryNo: smallint("try_no").default(1).notNull(),
    isReview: boolean("is_review").default(false).notNull(),
    mode: text("mode").notNull(),
    verifierVersion: text("verifier_version").default("verify-1.0").notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    response: jsonb("response").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("attempts_session_client_idx").on(t.sessionId, t.clientAttemptId)],
);

// Events (Append-only)
export const events = pgTable("events", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => learningSessions.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: jsonb("payload").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Concept Beliefs (Projection, rebuilt by replay)
export const conceptBeliefs = pgTable(
  "concept_beliefs",
  {
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id),
    status: text("status").default("not_assessed").notNull(),
    estimate: numeric("estimate", { precision: 5, scale: 4 }),
    reliability: text("reliability").default("missing").notNull(),
    independentN: integer("independent_n").default(0).notNull(),
    independentCorrectN: integer("independent_correct_n").default(0).notNull(),
    demonstratedAt: timestamp("demonstrated_at", { withTimezone: true }),
    retainedAt: timestamp("retained_at", { withTimezone: true }),
    firstNeedsSupportAt: timestamp("first_needs_support_at", { withTimezone: true }),
    lastEvidenceAt: timestamp("last_evidence_at", { withTimezone: true }),
    activeMisconceptionIds: text("active_misconception_ids").array().default([]).notNull(),
    policyVersion: text("policy_version").default("rules-1.0").notNull(),
    version: integer("version").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.conceptId] })],
);

// Student State
export const studentState = pgTable("student_state", {
  studentId: text("student_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  stateVersion: integer("state_version").default(0).notNull(),
  focusConceptId: text("focus_concept_id").references(() => concepts.id),
  startConceptId: text("start_concept_id").references(() => concepts.id),
  quickCheckDoneAt: timestamp("quick_check_done_at", { withTimezone: true }),
  sparksTotal: integer("sparks_total").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Decision Traces
export const decisionTraces = pgTable("decision_traces", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id")
    .notNull()
    .references(() => learningSessions.id, { onDelete: "cascade" }),
  triggerEventId: text("trigger_event_id"),
  context: jsonb("context").notNull(),
  result: jsonb("result").notNull(),
  policyVersion: text("policy_version").default("rules-1.0").notNull(),
  provider: text("provider").default("rules").notNull(),
  fallbackUsed: boolean("fallback_used").default(false).notNull(),
  latencyMs: integer("latency_ms").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Review Schedule
export const reviewSchedule = pgTable(
  "review_schedule",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id),
    kind: text("kind").notNull(), // warmup | retention | retry
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: text("status").default("due").notNull(), // due | done | cancelled
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("review_schedule_due_idx")
      .on(t.studentId, t.conceptId, t.kind)
      .where(sql`status = 'due'`),
  ],
);

// Quests
export const quests = pgTable(
  "quests",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questDate: date("quest_date").notNull(),
    slots: jsonb("slots").default([]).notNull(),
    status: text("status").default("in_progress").notNull(),
    sessionId: text("session_id").references(() => learningSessions.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("quests_student_date_idx").on(t.studentId, t.questDate)],
);

// Boss Battles
export const bossBattles = pgTable("boss_battles", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id),
  sessionId: text("session_id")
    .notNull()
    .references(() => learningSessions.id),
  itemIds: text("item_ids").array().default([]).notNull(),
  correctN: integer("correct_n").default(0).notNull(),
  status: text("status").default("active").notNull(), // active | defeated | retreated
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Sparks Ledger
export const sparksLedger = pgTable(
  "sparks_ledger",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    kind: text("kind").notNull(),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("sparks_source_kind_idx").on(t.sourceId, t.kind)],
);

// Comeback Cards
export const comebackCards = pgTable(
  "comeback_cards",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id),
    transitionEventId: text("transition_event_id").notNull(),
    pastAttemptIds: text("past_attempt_ids").array().default([]).notNull(),
    presentAttemptIds: text("present_attempt_ids").array().default([]).notNull(),
    message: jsonb("message").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("comeback_transition_idx").on(t.studentId, t.transitionEventId)],
);

// Solve Threads
export const solveThreads = pgTable("solve_threads", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default("active").notNull(),
  restated: text("restated").notNull(),
  problemType: text("problem_type").notNull(),
  conceptGuess: text("concept_guess").references(() => concepts.id),
  verifiedAnswer: jsonb("verified_answer"),
  studentTries: integer("student_tries").default(0).notNull(),
  tutorTurns: integer("tutor_turns").default(0).notNull(),
  purgeAfter: timestamp("purge_after", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Solve Messages
export const solveMessages = pgTable("solve_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id")
    .notNull()
    .references(() => solveThreads.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // student | assistant | system
  text: text("text").notNull(),
  guard: jsonb("guard"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Flags
export const flags = pgTable("flags", {
  id: text("id").primaryKey(),
  cohortId: text("cohort_id")
    .notNull()
    .references(() => cohorts.id, { onDelete: "cascade" }),
  studentId: text("student_id").references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // needs_teacher | safety | content_error
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  summary: text("summary").notNull(),
  status: text("status").default("open").notNull(), // open | resolved
  resolvedBy: text("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// LLM Calls
export const llmCalls = pgTable("llm_calls", {
  id: text("id").primaryKey(),
  purpose: text("purpose").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  costMicroInr: numeric("cost_micro_inr").default("0").notNull(),
  latencyMs: integer("latency_ms").default(0).notNull(),
  outcome: text("outcome").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Audit Log
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Deletion Requests
export const deletionRequests = pgTable("deletion_requests", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull(),
  requestedBy: text("requested_by").notNull(),
  status: text("status").default("pending").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
