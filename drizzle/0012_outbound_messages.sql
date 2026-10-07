CREATE TABLE "outbound_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"insight_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_ids" text[] NOT NULL,
	"cc_user_ids" text[] NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"language" text NOT NULL,
	"template_id" text NOT NULL,
	"edited" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"adapter" text,
	"simulated" boolean DEFAULT true NOT NULL,
	"visible_unit_ids" uuid[] NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_message" ADD CONSTRAINT "outbound_message_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_message" ADD CONSTRAINT "outbound_message_insight_id_insight_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insight"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_message" ADD CONSTRAINT "outbound_message_decision_id_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_message" ADD CONSTRAINT "outbound_message_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbound_message_insight_idx" ON "outbound_message" USING btree ("insight_id");