ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "ready_date" date;
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "stages" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "delivery_date" date;
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "delivery_start_min" integer;
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "delivery_duration_min" integer;
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "delivery_technician_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "appointments" ADD CONSTRAINT "appointments_delivery_technician_id_technicians_id_fk" FOREIGN KEY ("delivery_technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_delivery_date_idx" ON "appointments" USING btree ("delivery_date");
