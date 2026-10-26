"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { Icon } from "@/components/icons";
import { uploadErrorMessage } from "@/domain/photo-resize";
import { INSPECTION_ANGLES, type InspectionAngle } from "@/domain/vehicle-care";
import { preparePhoto } from "@/lib/image-resize";

export type SlotPhoto = { id: string; url: string; label: string | null };

export function InspectionPhotos({
  appointmentId,
  itemId,
  photos,
  editable,
}: {
  appointmentId: string;
  itemId: string;
  photos: SlotPhoto[];
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<InspectionAngle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const byAngle = new Map(photos.filter((photo) => photo.label).map((photo) => [photo.label as string, photo]));

  async function onPick(angle: InspectionAngle, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(angle);
    try {
      const blob = await preparePhoto(file);
      const body = new FormData();
      body.set("file", blob, "foto");
      body.set("itemId", itemId);
      body.set("label", angle);
      let response: Response;
      try {
        response = await fetch(`/api/appointments/${appointmentId}/photos`, { method: "POST", body });
      } catch {
        throw new Error("Sin conexión. Inténtalo de nuevo.");
      }
      if (!response.ok) {
        throw new Error(uploadErrorMessage(response.status, await response.json().catch(() => null)));
      }
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "No se pudo subir la foto.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {(Object.entries(INSPECTION_ANGLES) as [InspectionAngle, string][]).map(([angle, label]) => {
          const photo = byAngle.get(angle);
          const loading = busy === angle;
          return (
            <li key={angle}>
              <label
                className={`relative flex aspect-[4/3] flex-col overflow-hidden rounded-md border ${
                  photo ? "border-hair" : "border-dashed border-hair bg-canvas/60"
                } ${editable && !busy ? "cursor-pointer" : "cursor-default"}`}
              >
                {photo ? (
                  <Image
                    src={photo.url}
                    alt={label}
                    fill
                    unoptimized
                    sizes="(min-width: 640px) 33vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex flex-1 flex-col items-center justify-center gap-1 text-muted">
                    <Icon name="camera" size={22} />
                    <span className="text-xs font-medium">{editable ? "Tomar foto" : "Sin foto"}</span>
                  </span>
                )}
                <span
                  className={`relative mt-auto flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-semibold ${
                    photo ? "bg-ink/70 text-white" : "text-soft"
                  }`}
                >
                  {label}
                  {photo && editable && <span className="font-normal opacity-80">Cambiar</span>}
                </span>
                {loading && (
                  <span className="absolute inset-0 flex items-center justify-center bg-paper/80 text-sm font-semibold text-brand-ink">
                    Subiendo…
                  </span>
                )}
                {editable && (
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={busy !== null}
                    onChange={(event) => onPick(angle, event)}
                    className="sr-only"
                    aria-label={`Foto: ${label}`}
                  />
                )}
              </label>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-sm font-medium text-attention">
          {error}
        </p>
      )}
    </div>
  );
}
