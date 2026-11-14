CREATE TABLE "attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"student_id" text NOT NULL,
	"client_attempt_id" text NOT NULL,
	"step_seq" integer NOT NULL,
	"item_instance_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"raw_answer" varchar(64) NOT NULL,
	"parsed" jsonb,
	"outcome" text NOT NULL,
	"misconception_id" text,
	"assistance_level" smallint DEFAULT 0 NOT NULL,
	"try_no" smallint DEFAULT 1 NOT NULL,
	"is_review" boolean DEFAULT false NOT NULL,
	"mode" text NOT NULL,
	"verifier_version" text DEFAULT 'verify-1.0' NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_kind" text DEFAULT 'personal' NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boss_battles" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"session_id" text NOT NULL,
	"item_ids" text[] DEFAULT '{}' NOT NULL,
	"correct_n" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"strand" text NOT NULL,
	"title" text NOT NULL,
	"ord" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohorts" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"grade" smallint NOT NULL,
	"join_code" text NOT NULL,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"solve_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cohorts_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "comeback_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"transition_event_id" text NOT NULL,
	"past_attempt_ids" text[] DEFAULT '{}' NOT NULL,
	"present_attempt_ids" text[] DEFAULT '{}' NOT NULL,
	"message" jsonb NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_beliefs" (
	"student_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"status" text DEFAULT 'not_assessed' NOT NULL,
	"estimate" numeric(5, 4),
	"reliability" text DEFAULT 'missing' NOT NULL,
	"independent_n" integer DEFAULT 0 NOT NULL,
	"independent_correct_n" integer DEFAULT 0 NOT NULL,
	"demonstrated_at" timestamp with time zone,
	"retained_at" timestamp with time zone,
	"first_needs_support_at" timestamp with time zone,
	"last_evidence_at" timestamp with time zone,
	"active_misconception_ids" text[] DEFAULT '{}' NOT NULL,
	"policy_version" text DEFAULT 'rules-1.0' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concept_beliefs_student_id_concept_id_pk" PRIMARY KEY("student_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "concept_edges" (
	"prereq_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concept_edges_prereq_id_concept_id_pk" PRIMARY KEY("prereq_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" text PRIMARY KEY NOT NULL,
	"chapter_id" text NOT NULL,
	"title" text NOT NULL,
	"student_title" text NOT NULL,
	"description" text NOT NULL,
	"grade_min" integer NOT NULL,
	"grade_max" integer NOT NULL,
	"topo_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"scope" text NOT NULL,
	"method" text NOT NULL,
	"evidence_ref" text NOT NULL,
	"recorded_by" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_traces" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"session_id" text NOT NULL,
	"trigger_event_id" text,
	"context" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"policy_version" text DEFAULT 'rules-1.0' NOT NULL,
	"provider" text DEFAULT 'rules' NOT NULL,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deletion_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"session_id" text,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" text PRIMARY KEY NOT NULL,
	"cohort_id" text NOT NULL,
	"student_id" text,
	"kind" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"summary" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"template_version" integer NOT NULL,
	"seed" integer NOT NULL,
	"concept_id" text NOT NULL,
	"prompt" jsonb NOT NULL,
	"answer" jsonb NOT NULL,
	"misconception_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hints" jsonb NOT NULL,
	"worked_example" jsonb NOT NULL,
	"visual" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"mode" text NOT NULL,
	"focus_concept_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"budget_s" integer DEFAULT 900 NOT NULL,
	"step_seq" integer DEFAULT 0 NOT NULL,
	"current_step" jsonb,
	"counters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micro_inr" numeric DEFAULT '0' NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "misconceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"concept_ids" text[] NOT NULL,
	"title" text NOT NULL,
	"student_feedback" text NOT NULL,
	"teacher_note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"processor_agreement_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"quest_date" date NOT NULL,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"session_id" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"kind" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solve_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"guard" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solve_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"restated" text NOT NULL,
	"problem_type" text NOT NULL,
	"concept_guess" text,
	"verified_answer" jsonb,
	"student_tries" integer DEFAULT 0 NOT NULL,
	"tutor_turns" integer DEFAULT 0 NOT NULL,
	"purge_after" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sparks_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"source_id" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_state" (
	"student_id" text PRIMARY KEY NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"focus_concept_id" text,
	"start_concept_id" text,
	"quick_check_done_at" timestamp with time zone,
	"sparks_total" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_cohorts" (
	"teacher_id" text NOT NULL,
	"cohort_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_cohorts_teacher_id_cohort_id_pk" PRIMARY KEY("teacher_id","cohort_id")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text NOT NULL,
	"version" integer NOT NULL,
	"concept_id" text NOT NULL,
	"difficulty" smallint NOT NULL,
	"answer_kind" text NOT NULL,
	"review_status" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_id_version_pk" PRIMARY KEY("id","version")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"org_id" text,
	"cohort_id" text,
	"display_name" text NOT NULL,
	"username" text,
	"email" text,
	"password_hash" text,
	"pin_hash" text,
	"totp_secret_enc" text,
	"status" text NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"avatar" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_item_instance_id_item_instances_id_fk" FOREIGN KEY ("item_instance_id") REFERENCES "public"."item_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boss_battles" ADD CONSTRAINT "boss_battles_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boss_battles" ADD CONSTRAINT "boss_battles_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boss_battles" ADD CONSTRAINT "boss_battles_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comeback_cards" ADD CONSTRAINT "comeback_cards_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comeback_cards" ADD CONSTRAINT "comeback_cards_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_beliefs" ADD CONSTRAINT "concept_beliefs_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_beliefs" ADD CONSTRAINT "concept_beliefs_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_prereq_id_concepts_id_fk" FOREIGN KEY ("prereq_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_traces" ADD CONSTRAINT "decision_traces_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_traces" ADD CONSTRAINT "decision_traces_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_instances" ADD CONSTRAINT "item_instances_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_focus_concept_id_concepts_id_fk" FOREIGN KEY ("focus_concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_schedule" ADD CONSTRAINT "review_schedule_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_schedule" ADD CONSTRAINT "review_schedule_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solve_messages" ADD CONSTRAINT "solve_messages_thread_id_solve_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."solve_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solve_threads" ADD CONSTRAINT "solve_threads_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solve_threads" ADD CONSTRAINT "solve_threads_concept_guess_concepts_id_fk" FOREIGN KEY ("concept_guess") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sparks_ledger" ADD CONSTRAINT "sparks_ledger_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_state" ADD CONSTRAINT "student_state_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_state" ADD CONSTRAINT "student_state_focus_concept_id_concepts_id_fk" FOREIGN KEY ("focus_concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_state" ADD CONSTRAINT "student_state_start_concept_id_concepts_id_fk" FOREIGN KEY ("start_concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_cohorts" ADD CONSTRAINT "teacher_cohorts_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_cohorts" ADD CONSTRAINT "teacher_cohorts_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_session_client_idx" ON "attempts" USING btree ("session_id","client_attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comeback_transition_idx" ON "comeback_cards" USING btree ("student_id","transition_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_active_scope_idx" ON "consent_records" USING btree ("student_id","scope") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "item_instances_unique_idx" ON "item_instances" USING btree ("template_id","template_version","seed");--> statement-breakpoint
CREATE UNIQUE INDEX "quests_student_date_idx" ON "quests" USING btree ("student_id","quest_date");--> statement-breakpoint
CREATE UNIQUE INDEX "review_schedule_due_idx" ON "review_schedule" USING btree ("student_id","concept_id","kind") WHERE status = 'due';--> statement-breakpoint
CREATE UNIQUE INDEX "sparks_source_kind_idx" ON "sparks_ledger" USING btree ("source_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "users_cohort_username_idx" ON "users" USING btree ("cohort_id","username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_lower_email_idx" ON "users" USING btree ("email");