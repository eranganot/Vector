CREATE TABLE "barrier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"initiative_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"owner_unit_id" uuid NOT NULL,
	"cost_ils" numeric DEFAULT 0 NOT NULL,
	"since" date NOT NULL,
	"resolved_on" date
);
--> statement-breakpoint
CREATE TABLE "fin_account" (
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"unit" text NOT NULL,
	"higher_is_better" boolean NOT NULL,
	"owner_department_id" uuid NOT NULL,
	"level" text NOT NULL,
	CONSTRAINT "fin_account_org_id_code_pk" PRIMARY KEY("org_id","code")
);
--> statement-breakpoint
CREATE TABLE "fin_actual" (
	"org_id" uuid NOT NULL,
	"account_code" text NOT NULL,
	"org_unit_id" uuid NOT NULL,
	"day" date NOT NULL,
	"amount" double precision NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "fin_actual_org_id_account_code_org_unit_id_day_pk" PRIMARY KEY("org_id","account_code","org_unit_id","day")
);
--> statement-breakpoint
CREATE TABLE "fin_budget" (
	"org_id" uuid NOT NULL,
	"account_code" text NOT NULL,
	"org_unit_id" uuid NOT NULL,
	"month" text NOT NULL,
	"amount" double precision NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "fin_budget_org_id_account_code_org_unit_id_month_version_pk" PRIMARY KEY("org_id","account_code","org_unit_id","month","version")
);
--> statement-breakpoint
CREATE TABLE "initiative" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"sponsor_user_id" text NOT NULL,
	"owner_unit_id" uuid NOT NULL,
	"participating_unit_ids" uuid[] NOT NULL,
	"visible_unit_ids" uuid[] NOT NULL,
	"budget_ils" numeric DEFAULT 0 NOT NULL,
	"spent_ils" numeric DEFAULT 0 NOT NULL,
	"value_ils" numeric DEFAULT 0 NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"commitment_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"insight_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"initiative_id" uuid NOT NULL,
	"title" text NOT NULL,
	"owner_unit_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"due_on" date NOT NULL,
	"done_on" date,
	"progress" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action" ADD COLUMN "expected_impact_ils" numeric;--> statement-breakpoint
ALTER TABLE "action" ADD COLUMN "impact_basis" text;--> statement-breakpoint
ALTER TABLE "action" ADD COLUMN "execution_risk" double precision;--> statement-breakpoint
ALTER TABLE "action" ADD COLUMN "risk_factors" jsonb;--> statement-breakpoint
ALTER TABLE "barrier" ADD CONSTRAINT "barrier_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barrier" ADD CONSTRAINT "barrier_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barrier" ADD CONSTRAINT "barrier_owner_unit_id_org_unit_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_account" ADD CONSTRAINT "fin_account_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_account" ADD CONSTRAINT "fin_account_owner_department_id_org_unit_id_fk" FOREIGN KEY ("owner_department_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_actual" ADD CONSTRAINT "fin_actual_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_actual" ADD CONSTRAINT "fin_actual_org_unit_id_org_unit_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_budget" ADD CONSTRAINT "fin_budget_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_budget" ADD CONSTRAINT "fin_budget_org_unit_id_org_unit_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_sponsor_user_id_user_id_fk" FOREIGN KEY ("sponsor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_owner_unit_id_org_unit_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_owner_unit_id_org_unit_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;