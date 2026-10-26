ALTER TABLE "appointment_items" ADD COLUMN IF NOT EXISTS "checklist" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_items" ADD COLUMN IF NOT EXISTS "inspection" jsonb;--> statement-breakpoint
ALTER TABLE "appointment_photos" ADD COLUMN IF NOT EXISTS "label" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "checklist" jsonb DEFAULT '[]'::jsonb NOT NULL;