CREATE TABLE "initiative_reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"initiative_id" uuid NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_id" uuid,
	"to_unit_id" uuid NOT NULL,
	"from_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "barrier" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "milestone" ADD COLUMN "history" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "initiative_reminder" ADD CONSTRAINT "initiative_reminder_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_reminder" ADD CONSTRAINT "initiative_reminder_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_reminder" ADD CONSTRAINT "initiative_reminder_to_unit_id_org_unit_id_fk" FOREIGN KEY ("to_unit_id") REFERENCES "public"."org_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_reminder" ADD CONSTRAINT "initiative_reminder_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "initiative_reminder_initiative_idx" ON "initiative_reminder" USING btree ("initiative_id");