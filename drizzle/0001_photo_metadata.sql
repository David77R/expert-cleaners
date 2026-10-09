ALTER TABLE "appointment_photos" ADD COLUMN "content_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_photos" ADD COLUMN "size_bytes" integer NOT NULL;