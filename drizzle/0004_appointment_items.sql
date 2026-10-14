CREATE TABLE IF NOT EXISTS "appointment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"specs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_cents" integer NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_items_appt_idx" ON "appointment_items" USING btree ("appointment_id","position");
--> statement-breakpoint
ALTER TABLE "appointment_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO "appointment_items" ("appointment_id", "service_id", "specs", "price_cents", "position")
SELECT a."id", a."service_id", a."specs", a."price_cents", 0
FROM "appointments" a
WHERE NOT EXISTS (SELECT 1 FROM "appointment_items" i WHERE i."appointment_id" = a."id");
