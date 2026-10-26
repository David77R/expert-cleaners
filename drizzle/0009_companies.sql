ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'owner';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"settings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO "companies" ("id", "slug", "name", "settings") VALUES
	('00000000-0000-4000-8000-00000000c001', 'expert-cleaners', 'Expert Cleaners', '{"shortName":"Expert Cleaners","initials":"EC","tagline":"Centro de operaciones","headline":"Cada técnico, cada cita, cada hora del día en un solo tablero.","logo":null,"location":{"label":"Miami, FL","city":"Miami","state":"FL","stateName":"Florida","center":{"lat":25.7617,"lng":-80.1918},"radiusKm":200,"bbox":"-81.9,24.4,-79.9,27.3"},"theme":{},"themeColor":"#12181f","backgroundTint":"13 156 142","features":{"rugPickup":true,"vehicles":false,"publicBooking":false},"booking":{"locale":"es","hours":{"0":null,"1":[480,1080],"2":[480,1080],"3":[480,1080],"4":[480,1080],"5":[480,1080],"6":[540,1020]},"slotMinutes":60,"minNoticeHours":12,"maxDaysAhead":30},"contact":{"phone":"","email":""}}'::jsonb),
	('00000000-0000-4000-8000-00000000c002', 'rva', 'RVA Mobile Carwash & Detailing', '{"shortName":"RVA Carwash","initials":"RVA","tagline":"Centro de operaciones","headline":"Cada lavado, cada ruta y cada técnico en un solo tablero.","logo":{"src":"/clients/rva/logo.webp","width":300,"height":208},"location":{"label":"Orlando, FL","city":"Orlando","state":"FL","stateName":"Florida","center":{"lat":28.5383,"lng":-81.3792},"radiusKm":160,"bbox":"-82.9,27.3,-80.2,29.7"},"theme":{"--brand":"#c9490a","--brand-soft":"#fdeee4","--brand-ink":"#9a3a07","--canvas":"#f1f1f2","--hair":"#dcdce0","--rail":"#131316","--rail-raised":"#1e1e23","--rail-line":"#2c2c33","--rail-text":"#a5a6ad"},"themeColor":"#131316","backgroundTint":"242 106 27","features":{"rugPickup":false,"vehicles":true,"publicBooking":true},"booking":{"locale":"en","hours":{"0":null,"1":[480,1080],"2":[480,1080],"3":[480,1080],"4":[480,1080],"5":[480,1080],"6":[540,1020]},"slotMinutes":60,"minNoticeHours":12,"maxDaysAhead":30},"contact":{"phone":"","email":""}}'::jsonb)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "company_id" uuid;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "company_id" uuid;
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "company_id" uuid;
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "company_id" uuid;
--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN IF NOT EXISTS "company_id" uuid;
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "company_id" uuid;
--> statement-breakpoint
ALTER TABLE "route_drafts" ADD COLUMN IF NOT EXISTS "company_id" uuid;
--> statement-breakpoint
UPDATE "profiles" SET "company_id" = '00000000-0000-4000-8000-00000000c001' WHERE "company_id" IS NULL AND "id" <> '00000000-0000-4000-8000-0000000b0001';
--> statement-breakpoint
UPDATE "customers" SET "company_id" = '00000000-0000-4000-8000-00000000c001' WHERE "company_id" IS NULL;
--> statement-breakpoint
UPDATE "vehicles" SET "company_id" = '00000000-0000-4000-8000-00000000c001' WHERE "company_id" IS NULL;
--> statement-breakpoint
UPDATE "services" SET "company_id" = '00000000-0000-4000-8000-00000000c001' WHERE "company_id" IS NULL;
--> statement-breakpoint
UPDATE "technicians" SET "company_id" = '00000000-0000-4000-8000-00000000c001' WHERE "company_id" IS NULL;
--> statement-breakpoint
UPDATE "appointments" SET "company_id" = '00000000-0000-4000-8000-00000000c001' WHERE "company_id" IS NULL;
--> statement-breakpoint
UPDATE "route_drafts" SET "company_id" = '00000000-0000-4000-8000-00000000c001' WHERE "company_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "company_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "company_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "company_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "technicians" ALTER COLUMN "company_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "company_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "route_drafts" ALTER COLUMN "company_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "profiles" ADD CONSTRAINT "profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "services" ADD CONSTRAINT "services_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "technicians" ADD CONSTRAINT "technicians_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "appointments" ADD CONSTRAINT "appointments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "route_drafts" ADD CONSTRAINT "route_drafts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_code_unique";
--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_code_unique";
--> statement-breakpoint
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_slug_unique";
--> statement-breakpoint
DROP INDEX IF EXISTS "route_drafts_date_mode_group_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_company_code_idx" ON "appointments" USING btree ("company_id","code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_company_date_idx" ON "appointments" USING btree ("company_id","date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_company_code_idx" ON "customers" USING btree ("company_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "route_drafts_company_date_mode_group_idx" ON "route_drafts" USING btree ("company_id","date","mode","group_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "services_company_slug_idx" ON "services" USING btree ("company_id","slug");
