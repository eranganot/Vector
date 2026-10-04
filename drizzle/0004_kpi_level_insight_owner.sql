ALTER TABLE "insight" ADD COLUMN "owner_department_id" uuid;--> statement-breakpoint
ALTER TABLE "kpi" ADD COLUMN "level" text DEFAULT 'branch' NOT NULL;--> statement-breakpoint
ALTER TABLE "kpi" ADD COLUMN "target" double precision;--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_owner_department_id_org_unit_id_fk" FOREIGN KEY ("owner_department_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;