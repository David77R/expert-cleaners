ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'technician';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "technician_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_technician_idx" ON "profiles" USING btree ("technician_id");
