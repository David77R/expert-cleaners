ALTER TABLE "appointment_items" ADD COLUMN IF NOT EXISTS "details" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "appointment_photos" ADD COLUMN IF NOT EXISTS "item_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "appointment_photos" ADD CONSTRAINT "appointment_photos_item_id_appointment_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."appointment_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
