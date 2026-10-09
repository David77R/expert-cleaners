import { DomainError } from "./appointment-rules";

export const PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PhotoContentType = keyof typeof PHOTO_TYPES;

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_PHOTOS_PER_APPOINTMENT = 20;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function detectPhotoType(bytes: Uint8Array): PhotoContentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

export function validatePhoto(bytes: Uint8Array): { contentType: PhotoContentType; sizeBytes: number } {
  if (bytes.byteLength === 0) throw new DomainError("photo_empty", "El archivo está vacío");
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new DomainError("photo_too_large", `La foto supera el máximo de ${MAX_PHOTO_BYTES / (1024 * 1024)} MB`);
  }
  const contentType = detectPhotoType(bytes);
  if (!contentType) {
    throw new DomainError("photo_unsupported_type", "Solo se aceptan fotos JPG, PNG o WebP");
  }
  return { contentType, sizeBytes: bytes.byteLength };
}

export function photoStoragePath(appointmentId: string, photoId: string, contentType: PhotoContentType): string {
  return `appointments/${appointmentId}/${photoId}.${PHOTO_TYPES[contentType]}`;
}
