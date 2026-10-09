import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "./photo-rules";

export type ImageSize = { width: number; height: number };
export type EncodingAttempt = { maxEdge: number; quality: number };

export const TARGET_PHOTO_BYTES = 3.5 * 1024 * 1024;
export const KEEP_ORIGINAL_MAX_BYTES = 1.5 * 1024 * 1024;
export const RESIZE_EDGES = [2048, 1600, 1280] as const;
export const JPEG_QUALITIES = [0.86, 0.76, 0.66, 0.52] as const;

export function scaleToFit(size: ImageSize, maxEdge: number): ImageSize {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxEdge) return { width: size.width, height: size.height };
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(size.height * ratio)),
  };
}

export function canKeepOriginal(file: { type: string; size: number }, size: ImageSize): boolean {
  return (
    file.type in PHOTO_TYPES &&
    file.size <= KEEP_ORIGINAL_MAX_BYTES &&
    Math.max(size.width, size.height) <= RESIZE_EDGES[0]
  );
}

export function encodingAttempts(): EncodingAttempt[] {
  return RESIZE_EDGES.flatMap((maxEdge) => JPEG_QUALITIES.map((quality) => ({ maxEdge, quality })));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = new Intl.NumberFormat("es-US", { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024));
  return `${megabytes} MB`;
}

export function uploadErrorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  if (status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (status === 403) return "No tienes permiso para hacer esto.";
  if (status === 413) return `La foto supera el máximo de ${MAX_PHOTO_BYTES / (1024 * 1024)} MB.`;
  if (status === 422) return "La foto no es válida.";
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
