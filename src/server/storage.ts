import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const PHOTOS_BUCKET = "appointment-photos";
export const SIGNED_URL_SECONDS = 3600;

export interface PhotoStorage {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(path: string): Promise<void>;
  signedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}

export function createSupabasePhotoStorage(client: SupabaseClient, bucket: string = PHOTOS_BUCKET): PhotoStorage {
  const files = () => client.storage.from(bucket);
  return {
    async put(path, bytes, contentType) {
      const { error } = await files().upload(path, bytes, { contentType, upsert: false });
      if (error) throw new Error(`No se pudo guardar la foto: ${error.message}`);
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
