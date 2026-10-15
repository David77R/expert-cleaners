import { describe, expect, it } from "vitest";
import {
  JPEG_QUALITIES,
  KEEP_ORIGINAL_MAX_BYTES,
  RESIZE_EDGES,
  TARGET_PHOTO_BYTES,
  canKeepOriginal,
  encodingAttempts,
  formatBytes,
  scaleToFit,
  uploadErrorMessage,
} from "@/domain/photo-resize";
import { MAX_PHOTO_BYTES } from "@/domain/photo-rules";

describe("escala de imágenes", () => {
  it("no toca una imagen que ya cabe", () => {
    expect(scaleToFit({ width: 1200, height: 800 }, 2048)).toEqual({ width: 1200, height: 800 });
    expect(scaleToFit({ width: 2048, height: 1024 }, 2048)).toEqual({ width: 2048, height: 1024 });
  });

  it("reduce el lado largo y conserva la proporción", () => {
    expect(scaleToFit({ width: 4000, height: 3000 }, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(scaleToFit({ width: 3000, height: 4000 }, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it("nunca produce un lado de cero píxeles", () => {
    expect(scaleToFit({ width: 20000, height: 4 }, 1280)).toEqual({ width: 1280, height: 1 });
  });
});

describe("cuándo conservar el original", () => {
  const small = { width: 1600, height: 1200 };

  it("conserva fotos livianas de un formato aceptado", () => {
    expect(canKeepOriginal({ type: "image/jpeg", size: 400_000 }, small)).toBe(true);
    expect(canKeepOriginal({ type: "image/png", size: KEEP_ORIGINAL_MAX_BYTES }, small)).toBe(true);
    expect(canKeepOriginal({ type: "image/webp", size: 10_000 }, small)).toBe(true);
  });

  it("reprocesa las pesadas, las enormes y los formatos no aceptados", () => {
    expect(canKeepOriginal({ type: "image/jpeg", size: KEEP_ORIGINAL_MAX_BYTES + 1 }, small)).toBe(false);
    expect(canKeepOriginal({ type: "image/jpeg", size: 400_000 }, { width: 4032, height: 3024 })).toBe(false);
    expect(canKeepOriginal({ type: "image/heic", size: 400_000 }, small)).toBe(false);
    expect(canKeepOriginal({ type: "", size: 400_000 }, small)).toBe(false);
  });
});

describe("intentos de codificación", () => {
  it("baja primero la calidad y luego el tamaño, de mayor a menor", () => {
    const attempts = encodingAttempts();
    expect(attempts).toHaveLength(RESIZE_EDGES.length * JPEG_QUALITIES.length);
    expect(attempts[0]).toEqual({ maxEdge: RESIZE_EDGES[0], quality: JPEG_QUALITIES[0] });
    expect(attempts[1]).toEqual({ maxEdge: RESIZE_EDGES[0], quality: JPEG_QUALITIES[1] });
    expect(attempts.at(-1)).toEqual({
      maxEdge: RESIZE_EDGES[RESIZE_EDGES.length - 1],
      quality: JPEG_QUALITIES[JPEG_QUALITIES.length - 1],
    });
  });

  it("deja margen respecto al máximo que acepta el servidor", () => {
    expect(TARGET_PHOTO_BYTES).toBeLessThan(MAX_PHOTO_BYTES);
    expect(KEEP_ORIGINAL_MAX_BYTES).toBeLessThanOrEqual(TARGET_PHOTO_BYTES);
  });
});

describe("textos de la galería", () => {
  it("formatea tamaños en KB y MB", () => {
    expect(formatBytes(300)).toBe("1 KB");
    expect(formatBytes(340 * 1024)).toBe("340 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3 MB");
  });

  it("usa el mensaje del servidor cuando existe", () => {
    expect(uploadErrorMessage(409, { error: "photo_limit", message: "Cada cita admite hasta 20 fotos" })).toBe(
      "Cada cita admite hasta 20 fotos",
    );
  });

  it("explica los errores que no traen mensaje", () => {
    expect(uploadErrorMessage(401, null)).toMatch(/sesión/);
    expect(uploadErrorMessage(403, {})).toMatch(/permiso/);
    expect(uploadErrorMessage(413, null)).toMatch(/4 MB/);
    expect(uploadErrorMessage(500, "<html>")).toMatch(/error 500/);
    expect(uploadErrorMessage(409, null)).toMatch(/error 409/);
  });
});
