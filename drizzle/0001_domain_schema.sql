CREATE TYPE "public"."action_status" AS ENUM('proposed', 'pending_approval', 'rejected', 'ready', 'executing', 'executed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('requested', 'granted', 'denied', 'expired', 'withdrawn', 'lapsed');--> statement-breakpoint
CREATE TYPE "public"."decision_origin" AS ENUM('vector_recommended', 'human_authored');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('recommended', 'decided', 'declined', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."insight_status" AS ENUM('open', 'acknowledged', 'dismissed', 'resolved', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."org_unit_type" AS ENUM('group', 'region', 'branch', 'department');--> statement-breakpoint
CREATE TYPE "public"."outcome_status" AS ENUM('observing', 'evaluated', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."outcome_verdict" AS ENUM('worked', 'partially_worked', 'did_not_work', 'inconclusive');--> statement-breakpoint
CREATE TYPE "public"."role_name" AS ENUM('admin', 'executive', 'department_manager', 'regional_manager', 'viewer');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"insight_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"proposed_by" text NOT NULL,
	"target_unit_ids" uuid[] NOT NULL,
	"visible_unit_ids" uuid[] NOT NULL,
	"due_at" timestamp with time zone,
	"estimated_cost" numeric DEFAULT 0 NOT NULL,
	"executor" text NOT NULL,
	"params" jsonb NOT NULL,
	"approval_requirement" jsonb,
	"idempotency_key" text NOT NULL,
	"status" "action_status" NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"result" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "action_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"action_revision" integer NOT NULL,
	"requirement" jsonb NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"approver_user_id" text,
	"rationale" text,
	"decided_at" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"status" "approval_status" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint NOT NULL,
	"org_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"session_id" text,
	"via_demo_switcher" boolean DEFAULT false NOT NULL,
	"operation" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"from_state" text,
	"to_state" text,
	"reason" text,
	"changes" jsonb NOT NULL,
	"policy" jsonb,
	"evidence_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"ai_generation_id" uuid,
	"request_id" text NOT NULL,
	"prev_hash" "bytea" NOT NULL,
	"hash" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"insight_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"rationale" text,
	"origin" "decision_origin" NOT NULL,
	"status" "decision_status" NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"auto_rule" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_clock" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"now" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"source_ref" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"what_happened" text NOT NULL,
	"why_it_matters" text NOT NULL,
	"primary_unit_id" uuid NOT NULL,
	"affected_unit_ids" uuid[] NOT NULL,
	"visible_unit_ids" uuid[] NOT NULL,
	"signal_ids" uuid[] NOT NULL,
	"evidence_ids" uuid[] NOT NULL,
	"confidence" double precision NOT NULL,
	"priority_score" double precision NOT NULL,
	"priority_band" text NOT NULL,
	"priority_breakdown" jsonb NOT NULL,
	"priority_model_version" text NOT NULL,
	"generated_by" text NOT NULL,
	"status" "insight_status" NOT NULL,
	"rationale" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"higher_is_better" boolean NOT NULL,
	"strategic_weight" double precision NOT NULL,
	"owner_department_id" uuid
);
--> statement-breakpoint
CREATE TABLE "kpi_observation" (
	"org_id" uuid NOT NULL,
	"kpi_id" uuid NOT NULL,
	"org_unit_id" uuid NOT NULL,
	"day" date NOT NULL,
	"value" double precision NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "kpi_observation_kpi_id_org_unit_id_day_pk" PRIMARY KEY("kpi_id","org_unit_id","day")
);
--> statement-breakpoint
CREATE TABLE "org_unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" "org_unit_type" NOT NULL,
	"parent_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"lat" double precision,
	"lon" double precision,
	"size_class" text,
	"path_ids" uuid[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"seed_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"audience" text NOT NULL,
	"recipients" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"simulated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"insight_id" uuid NOT NULL,
	"kpi_id" uuid NOT NULL,
	"unit_ids" uuid[] NOT NULL,
	"expected_direction" text NOT NULL,
	"expected_threshold" double precision NOT NULL,
	"baseline" jsonb NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"observed" jsonb,
	"evidence_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"verdict" "outcome_verdict",
	"verdict_by" text,
	"lesson" text,
	"status" "outcome_status" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "role_name" NOT NULL,
	"org_unit_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"detector" text NOT NULL,
	"detector_version" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"primary_unit_id" uuid NOT NULL,
	"measurements" jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"assignee_user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"simulated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid,
	"title" text,
	"is_seeded" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_decision_id_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_insight_id_insight_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insight"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_action_id_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_approver_user_id_user_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_insight_id_insight_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insight"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_clock" ADD CONSTRAINT "demo_clock_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_primary_unit_id_org_unit_id_fk" FOREIGN KEY ("primary_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi" ADD CONSTRAINT "kpi_owner_department_id_org_unit_id_fk" FOREIGN KEY ("owner_department_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_observation" ADD CONSTRAINT "kpi_observation_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_observation" ADD CONSTRAINT "kpi_observation_kpi_id_kpi_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_observation" ADD CONSTRAINT "kpi_observation_org_unit_id_org_unit_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_unit" ADD CONSTRAINT "org_unit_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_message" ADD CONSTRAINT "outbox_message_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_message" ADD CONSTRAINT "outbox_message_action_id_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome" ADD CONSTRAINT "outcome_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome" ADD CONSTRAINT "outcome_action_id_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome" ADD CONSTRAINT "outcome_insight_id_insight_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insight"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome" ADD CONSTRAINT "outcome_kpi_id_kpi_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_org_unit_id_org_unit_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_primary_unit_id_org_unit_id_fk" FOREIGN KEY ("primary_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_action_id_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_event_seq_uq" ON "audit_event" USING btree ("org_id","seq");--> statement-breakpoint
CREATE INDEX "audit_event_entity_idx" ON "audit_event" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "insight_visible_idx" ON "insight" USING gin ("visible_unit_ids");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_code_uq" ON "kpi" USING btree ("org_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "org_unit_code_uq" ON "org_unit" USING btree ("org_id","code");--> statement-breakpoint
CREATE INDEX "org_unit_parent_idx" ON "org_unit" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignment_uq" ON "role_assignment" USING btree ("user_id","role","org_unit_id");--> statement-breakpoint
CREATE INDEX "signal_dedupe_idx" ON "signal" USING btree ("org_id","dedupe_key");