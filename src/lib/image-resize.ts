import { canKeepOriginal, encodingAttempts, scaleToFit, TARGET_PHOTO_BYTES } from "@/domain/photo-resize";

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`No se pudo leer «${file.name}». Usa una foto JPG, PNG o WebP.`);
  }
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await decode(file);
  try {
    const original = { width: bitmap.width, height: bitmap.height };
    if (canKeepOriginal(file, original)) return file;

    for (const attempt of encodingAttempts()) {
      const target = scaleToFit(original, attempt.maxEdge);
      const canvas = document.createElement("canvas");
      canvas.width = target.width;
      canvas.height = target.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Tu navegador no permite preparar la foto.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, target.width, target.height);
      context.drawImage(bitmap, 0, 0, target.width, target.height);
      const blob = await encode(canvas, attempt.quality);
      if (blob && blob.size <= TARGET_PHOTO_BYTES) return blob;
    }
    throw new Error(`«${file.name}» sigue siendo demasiado pesada. Prueba con otra foto.`);
  } finally {
    bitmap.close();
  }
}
