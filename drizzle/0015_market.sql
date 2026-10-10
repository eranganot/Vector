CREATE TABLE "competitor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"listed" boolean NOT NULL,
	"ticker" text,
	CONSTRAINT "competitor_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "competitor_figure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"period" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"url" text NOT NULL,
	"as_of" date NOT NULL,
	"method" text
);
--> statement-breakpoint
CREATE TABLE "market_point" (
	"series_id" uuid NOT NULL,
	"period" text NOT NULL,
	"value" double precision NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text NOT NULL,
	"raw_hash" text,
	CONSTRAINT "market_point_series_id_period_pk" PRIMARY KEY("series_id","period")
);
--> statement-breakpoint
CREATE TABLE "market_price_file" (
	"chain" text NOT NULL,
	"store_id" text NOT NULL,
	"day" date NOT NULL,
	"store_name" text NOT NULL,
	"city" text NOT NULL,
	"region" text NOT NULL,
	"url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"sha256" text NOT NULL,
	"items" integer NOT NULL,
	CONSTRAINT "market_price_file_chain_store_id_day_pk" PRIMARY KEY("chain","store_id","day")
);
--> statement-breakpoint
CREATE TABLE "market_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"frequency" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitor_figure" ADD CONSTRAINT "competitor_figure_competitor_id_competitor_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_point" ADD CONSTRAINT "market_point_series_id_market_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."market_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competitor_figure_uq" ON "competitor_figure" USING btree ("competitor_id","metric","period","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "market_series_source_code_uq" ON "market_series" USING btree ("source","code");