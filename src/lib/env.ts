import { z } from "zod";
import { cleanEnvValue, cleanSupabaseUrl } from "./clean-env";

const text = z.preprocess((value) => (typeof value === "string" ? cleanEnvValue(value) : value), z.string().min(1));
const optionalText = z.preprocess(
  (value) => (typeof value === "string" ? cleanEnvValue(value) || undefined : value),
  z.string().min(1).optional(),
);

const schema = z.object({
  DATABASE_URL: text,
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    (value) => (typeof value === "string" ? cleanSupabaseUrl(value) : value),
    z.url(),
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: text,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  ORS_API_KEY: optionalText,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Variables de entorno inválidas o faltantes: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}
