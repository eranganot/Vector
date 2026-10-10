CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"template" text NOT NULL,
	"version" integer NOT NULL,
	"scope_unit_id" uuid NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"generated_by" text NOT NULL,
	"language" text NOT NULL,
	"layout" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"visible_unit_ids" uuid[] NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_scope_unit_id_org_unit_id_fk" FOREIGN KEY ("scope_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_generated_by_user_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_org_created_idx" ON "report" USING btree ("org_id","created_at");