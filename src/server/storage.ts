import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/domain/appointment-rules";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/domain/photo-rules";
import { env } from "@/lib/env";

export const PHOTOS_BUCKET = "appointment-photos";
export const SIGNED_URL_SECONDS = 3600;

export interface PhotoStorage {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(path: string): Promise<void>;
  signedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}

export function isMissingBucket(message: string): boolean {
  return /bucket not found|bucket.*does not exist/i.test(message);
}

export function storageProblem(message: string, bucket: string = PHOTOS_BUCKET): string {
  if (isMissingBucket(message)) {
    return `No existe el bucket «${bucket}» en Supabase Storage. Créalo como privado y vuelve a intentarlo.`;
  }
  if (/invalid jwt|jws|signature|invalid compact|unauthorized|invalid api key/i.test(message)) {
    return "La clave SUPABASE_SERVICE_ROLE_KEY configurada en Vercel no es válida para este proyecto de Supabase.";
  }
  if (/row-level security|row level security|policy/i.test(message)) {
    return "Supabase rechazó la foto por permisos: revisa que SUPABASE_SERVICE_ROLE_KEY sea la clave service_role y no la anon.";
  }
  if (/maximum allowed size|payload too large|too large/i.test(message)) {
    return "El bucket de fotos tiene un límite de tamaño menor que la foto. Súbelo a 5 MB o más en Supabase Storage.";
  }
  if (/mime type|not supported/i.test(message)) {
    return "El bucket de fotos no acepta este tipo de imagen. Permite JPG, PNG y WebP en Supabase Storage.";
  }
  return `No se pudo guardar la foto en Supabase Storage: ${message}`;
}

export function createSupabasePhotoStorage(client: SupabaseClient, bucket: string = PHOTOS_BUCKET): PhotoStorage {
  const files = () => client.storage.from(bucket);
  const upload = (path: string, bytes: Uint8Array, contentType: string) =>
    files().upload(path, bytes, { contentType, upsert: false });
  return {
    async put(path, bytes, contentType) {
      let { error } = await upload(path, bytes, contentType);
      if (error && isMissingBucket(error.message) && typeof client.storage.createBucket === "function") {
        const created = await client.storage.createBucket(bucket, {
          public: false,
          fileSizeLimit: MAX_PHOTO_BYTES,
          allowedMimeTypes: Object.keys(PHOTO_TYPES),
        });
        if (!created.error) ({ error } = await upload(path, bytes, contentType));
      }
      if (error) {
        console.error(`Supabase Storage rechazó ${path}: ${error.message}`);
        throw new DomainError("storage_error", storageProblem(error.message, bucket));
      }
    },
    async remove(path) {
      const { error } = await files().remove([path]);
      if (error) throw new Error(`No se pudo eliminar la foto: ${error.message}`);
    },
    async signedUrl(path, expiresInSeconds = SIGNED_URL_SECONDS) {
      const { data, error } = await files().createSignedUrl(path, expiresInSeconds);
      if (error || !data) throw new Error(`No se pudo firmar la URL de la foto: ${error?.message ?? "sin datos"}`);
      return data.signedUrl;
    },
  };
}

let cached: PhotoStorage | undefined;

export function getPhotoStorage(): PhotoStorage {
  if (!cached) {
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para usar el almacenamiento de fotos");
    }
    const client = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cached = createSupabasePhotoStorage(client);
  }
  return cached;
}
