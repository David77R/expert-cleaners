import { DomainError } from "@/domain/appointment-rules";
import { MAX_PHOTO_BYTES } from "@/domain/photo-rules";

const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export async function readPhotoUpload(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PHOTO_BYTES + MULTIPART_OVERHEAD_BYTES) {
    throw new DomainError("photo_too_large", `La foto supera el máximo de ${MAX_PHOTO_BYTES / (1024 * 1024)} MB`);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new DomainError("file_required", "Envía la foto como multipart/form-data en el campo «file»");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new DomainError("file_required", "Falta el campo «file» con la foto");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new DomainError("photo_too_large", `La foto supera el máximo de ${MAX_PHOTO_BYTES / (1024 * 1024)} MB`);
  }
  return new Uint8Array(await file.arrayBuffer());
}
