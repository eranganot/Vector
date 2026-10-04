ALTER TABLE "conflict" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conflict" ADD COLUMN "escalated_to_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_escalated_to_unit_id_org_unit_id_fk" FOREIGN KEY ("escalated_to_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;