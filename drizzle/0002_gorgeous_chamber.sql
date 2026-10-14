CREATE TABLE "route_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"mode" text NOT NULL,
	"group_key" text NOT NULL,
	"stop_ids" jsonb NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "route_drafts" ADD CONSTRAINT "route_drafts_created_by_id_profiles_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "route_drafts_date_mode_group_idx" ON "route_drafts" USING btree ("date","mode","group_key");