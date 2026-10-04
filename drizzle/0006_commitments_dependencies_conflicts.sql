CREATE TYPE "public"."commitment_status" AS ENUM('open', 'overdue', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."conflict_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "commitment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"owner_user_id" text NOT NULL,
	"owner_unit_id" uuid NOT NULL,
	"beneficiary_unit_ids" uuid[] NOT NULL,
	"source" text NOT NULL,
	"made_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"impact_ils" numeric DEFAULT 0 NOT NULL,
	"compliance" double precision DEFAULT 0 NOT NULL,
	"effects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"insight_id" uuid,
	"completed_at" timestamp with time zone,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rationale" text,
	"visible_unit_ids" uuid[] NOT NULL,
	"status" "commitment_status" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflict" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"commitment_a_id" uuid NOT NULL,
	"commitment_b_id" uuid NOT NULL,
	"rule" text NOT NULL,
	"resource" text NOT NULL,
	"overlap_start" date NOT NULL,
	"overlap_end" date NOT NULL,
	"insight_id" uuid,
	"status" "conflict_status" NOT NULL,
	"resolved_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dependency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"commitment_id" uuid NOT NULL,
	"downstream_unit_id" uuid NOT NULL,
	"downstream_commitment_id" uuid,
	"need_by" timestamp with time zone NOT NULL,
	"impact_ils" numeric DEFAULT 0 NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_owner_unit_id_org_unit_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_insight_id_insight_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insight"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_commitment_a_id_commitment_id_fk" FOREIGN KEY ("commitment_a_id") REFERENCES "public"."commitment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_commitment_b_id_commitment_id_fk" FOREIGN KEY ("commitment_b_id") REFERENCES "public"."commitment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_insight_id_insight_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insight"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency" ADD CONSTRAINT "dependency_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency" ADD CONSTRAINT "dependency_commitment_id_commitment_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "public"."commitment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency" ADD CONSTRAINT "dependency_downstream_unit_id_org_unit_id_fk" FOREIGN KEY ("downstream_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency" ADD CONSTRAINT "dependency_downstream_commitment_id_commitment_id_fk" FOREIGN KEY ("downstream_commitment_id") REFERENCES "public"."commitment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commitment_visible_idx" ON "commitment" USING gin ("visible_unit_ids");--> statement-breakpoint
CREATE UNIQUE INDEX "conflict_pair_uq" ON "conflict" USING btree ("org_id","commitment_a_id","commitment_b_id","resource");