import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { DomainError } from "@/domain/appointment-rules";
import { env } from "@/lib/env";
import { isMissingBucket } from "@/server/storage";

export const BRANDING_BUCKET = "company-branding";
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_FORMATS = new Set(["png", "jpeg", "webp", "svg", "gif", "avif"]);
const LOGO_HEIGHT = 224;

export interface BrandingStorage {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<string>;
}

export type BrandAssets = {
  logo: { bytes: Uint8Array; width: number; height: number };
  icons: { file: string; bytes: Uint8Array }[];
};

async function square(logo: Buffer, size: number, fill: number, background: string): Promise<Uint8Array> {
  const inner = Math.round(size * fill);
  const resized = await sharp(logo)
    .resize({ width: inner, height: inner, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  return new Uint8Array(
    await sharp({ create: { width: size, height: size, channels: 4, background } })
      .composite([{ input: resized, gravity: "center" }])
      .png()
      .toBuffer(),
  );
}

export async function brandAssetsFromLogo(bytes: Uint8Array, background: string): Promise<BrandAssets> {
  if (bytes.byteLength === 0) throw new DomainError("invalid_logo", "Elige una imagen para el logo");
  if (bytes.byteLength > MAX_LOGO_BYTES) throw new DomainError("invalid_logo", "El logo no puede pesar más de 5 MB");
  let format: string | undefined;
  try {
    format = (await sharp(bytes).metadata()).format;
  } catch {
    format = undefined;
  }
  if (!format || !LOGO_FORMATS.has(format)) {
    throw new DomainError("invalid_logo", "El logo debe ser una imagen PNG, JPG, WebP o SVG");
  }
  const { data, info } = await sharp(bytes, { density: 300 })
    .resize({ height: LOGO_HEIGHT, withoutEnlargement: format !== "svg" })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true });
  const source = await sharp(bytes, { density: 300 }).png().toBuffer();
  return {
    logo: { bytes: new Uint8Array(data), width: info.width, height: info.height },
    icons: [
      { file: "icon-192.png", bytes: await square(source, 192, 0.8, background) },
      { file: "icon-512.png", bytes: await square(source, 512, 0.8, background) },
      { file: "icon-maskable-512.png", bytes: await square(source, 512, 0.6, background) },
      { file: "apple-icon.png", bytes: await square(source, 180, 0.8, background) },
    ],
  };
}

export function createSupabaseBrandingStorage(
  client: SupabaseClient,
  bucket: string = BRANDING_BUCKET,
): BrandingStorage {
  const files = () => client.storage.from(bucket);
  const upload = (path: string, bytes: Uint8Array, contentType: string) =>
    files().upload(path, bytes, { contentType, upsert: true, cacheControl: "31536000" });
  return {
    async put(path, bytes, contentType) {
      let { error } = await upload(path, bytes, contentType);
      if (error && isMissingBucket(error.message)) {
        const created = await client.storage.createBucket(bucket, { public: true, fileSizeLimit: MAX_LOGO_BYTES });
        if (!created.error) ({ error } = await upload(path, bytes, contentType));
      }
      if (error) {
        console.error(`Supabase Storage rechazó ${path}: ${error.message}`);
        throw new DomainError("storage_error", `No se pudo guardar el logo en Supabase Storage: ${error.message}`);
      }
      return files().getPublicUrl(path).data.publicUrl;
    },
  };
}

let cached: BrandingStorage | undefined;

export function getBrandingStorage(): BrandingStorage {
  if (!cached) {
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para guardar logos");
    const client = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cached = createSupabaseBrandingStorage(client);
  }
  return cached;
}
