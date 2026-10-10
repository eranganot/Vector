CREATE TABLE "inbox_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"from_name" text NOT NULL,
	"from_owner" boolean NOT NULL,
	"to_owner" boolean NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"body" text NOT NULL,
	"outbound_message_id" uuid
);
--> statement-breakpoint
CREATE TABLE "inbox_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"owner_user_id" text NOT NULL,
	"channel" text NOT NULL,
	"subject" text NOT NULL,
	"counterpart_name" text NOT NULL,
	"counterpart_role" text NOT NULL,
	"counterpart_user_id" text,
	"asks" boolean NOT NULL,
	"decision_tag" boolean NOT NULL,
	"urgent" boolean NOT NULL,
	"link_type" text,
	"link_id" uuid,
	"impact_ils" double precision,
	"cost_ils" double precision,
	"deadline" timestamp with time zone,
	"benefit" text,
	"recommendation" text,
	"suggested_reply" text,
	"follow_ups" text[] NOT NULL,
	"template_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_message" ALTER COLUMN "insight_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "outbound_message" ALTER COLUMN "decision_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "outbound_message" ADD COLUMN "inbox_thread_id" uuid;--> statement-breakpoint
ALTER TABLE "outbound_message" ADD COLUMN "to_external" text;--> statement-breakpoint
ALTER TABLE "inbox_message" ADD CONSTRAINT "inbox_message_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_message" ADD CONSTRAINT "inbox_message_thread_id_inbox_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."inbox_thread"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_thread" ADD CONSTRAINT "inbox_thread_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_thread" ADD CONSTRAINT "inbox_thread_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_thread" ADD CONSTRAINT "inbox_thread_counterpart_user_id_user_id_fk" FOREIGN KEY ("counterpart_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbox_message_thread_idx" ON "inbox_message" USING btree ("thread_id","at");--> statement-breakpoint
CREATE INDEX "inbox_thread_owner_idx" ON "inbox_thread" USING btree ("org_id","owner_user_id");--> statement-breakpoint
ALTER TABLE "outbound_message" ADD CONSTRAINT "outbound_message_inbox_thread_id_inbox_thread_id_fk" FOREIGN KEY ("inbox_thread_id") REFERENCES "public"."inbox_thread"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_message" ADD CONSTRAINT "outbound_message_origin_ck" CHECK ("insight_id" IS NOT NULL OR "inbox_thread_id" IS NOT NULL);
