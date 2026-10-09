"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import { formatBytes, uploadErrorMessage } from "@/domain/photo-resize";
import { MAX_PHOTOS_PER_APPOINTMENT } from "@/domain/photo-rules";
import { preparePhoto } from "@/lib/image-resize";
import type { PanelPhoto } from "@/server/photos";

type UploadItem = {
  key: number;
  name: string;
  state: "waiting" | "preparing" | "uploading" | "done" | "error";
  message?: string;
};

const STATE_LABELS: Record<Exclude<UploadItem["state"], "error">, string> = {
  waiting: "En espera",
  preparing: "Preparando…",
  uploading: "Subiendo…",
  done: "Lista",
};

const PHOTO_TIME = new Intl.DateTimeFormat("es-US", {
  timeZone: "America/New_York",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const OFFLINE_MESSAGE = "Sin conexión. Inténtalo de nuevo.";

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function PhotoGallery({
  appointmentId,
  photos,
  available,
  canUpload,
}: {
  appointmentId: string;
  photos: PanelPhoto[];
  available: boolean;
  canUpload: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const current = viewer !== null ? (photos[viewer] ?? null) : null;
  const isOpen = current !== null;
  const full = photos.length >= MAX_PHOTOS_PER_APPOINTMENT;
  const endpoint = `/api/appointments/${appointmentId}/photos`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  if (!available) {
    return (
      <p className="rounded-md bg-neutral-soft px-3 py-2.5 text-sm text-soft">
        Las fotos todavía no están disponibles: falta conectar el almacenamiento.
      </p>
    );
  }

  function patch(key: number, changes: Partial<UploadItem>) {
    setQueue((previous) => previous.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  }

  async function send(file: File, key: number) {
    patch(key, { state: "preparing" });
    const blob = await preparePhoto(file);
    patch(key, { state: "uploading" });
    const body = new FormData();
    body.set("file", blob, "foto");
    let response: Response;
    try {
      response = await fetch(endpoint, { method: "POST", body });
    } catch {
      throw new Error(OFFLINE_MESSAGE);
    }
    if (!response.ok) throw new Error(uploadErrorMessage(response.status, await readBody(response)));
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const room = Math.max(0, MAX_PHOTOS_PER_APPOINTMENT - photos.length);
    const accepted = files.slice(0, room);
    setNotice(
      files.length > accepted.length
        ? `Solo caben ${room} fotos más en esta cita; se omitieron ${files.length - accepted.length}.`
        : null,
    );
    if (accepted.length === 0) return;

    setBusy(true);
    setQueue(accepted.map((file, index) => ({ key: index, name: file.name, state: "waiting" })));
    let uploaded = 0;
    for (const [index, file] of accepted.entries()) {
      try {
        await send(file, index);
        uploaded += 1;
        patch(index, { state: "done" });
      } catch (error) {
        patch(index, {
          state: "error",
          message: error instanceof Error ? error.message : "No se pudo subir la foto.",
        });
      }
    }
    setBusy(false);
    setQueue((previous) => previous.filter((item) => item.state === "error"));
    if (uploaded > 0) router.refresh();
  }

  async function remove(photo: PanelPhoto) {
    setRemoving(true);
    setViewerError(null);
    try {
      const response = await fetch(`${endpoint}/${photo.id}`, { method: "DELETE" });
      if (!response.ok) {
        setViewerError(uploadErrorMessage(response.status, await readBody(response)));
        return;
      }
      setViewer(null);
      router.refresh();
    } catch {
      setViewerError(OFFLINE_MESSAGE);
    } finally {
      setRemoving(false);
      setConfirming(false);
    }
  }

  function step(direction: 1 | -1) {
    setViewer((index) => (index === null ? null : (index + direction + photos.length) % photos.length));
    setConfirming(false);
    setViewerError(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (photos.length < 2) return;
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  }

  const uploadDisabled = busy || full;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm tabular-nums text-soft">
          {photos.length} de {MAX_PHOTOS_PER_APPOINTMENT} fotos
        </p>
        {canUpload && (
          <label
            className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-hair bg-paper px-3.5 text-sm font-semibold transition-colors hover:bg-canvas focus-within:ring-2 focus-within:ring-brand/30 ${
              uploadDisabled ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <Icon name="camera" />
            {busy ? "Subiendo…" : "Agregar fotos"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploadDisabled}
              onChange={onPick}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {notice && (
        <p role="status" className="text-sm font-medium text-warning">
          {notice}
        </p>
      )}

      {queue.length > 0 && (
        <ul aria-live="polite" className="flex flex-col gap-1.5">
          {queue.map((item) =>
            item.state === "error" ? (
              <li
                key={item.key}
                className="flex flex-col gap-0.5 rounded-md bg-attention-soft px-3 py-2 text-attention"
              >
                <span className="truncate text-sm font-medium">{item.name}</span>
                <span className="text-xs">{item.message}</span>
              </li>
            ) : (
              <li
                key={item.key}
                className="flex items-baseline justify-between gap-3 rounded-md bg-canvas px-3 py-2 text-sm text-soft"
              >
                <span className="min-w-0 truncate font-medium">{item.name}</span>
                <span className="shrink-0 text-xs">{STATE_LABELS[item.state]}</span>
              </li>
            ),
          )}
        </ul>
      )}

      {!busy && queue.length > 0 && (
        <button
          type="button"
          onClick={() => setQueue([])}
          className="self-start text-sm font-medium text-soft underline underline-offset-2 hover:text-ink"
        >
          Descartar avisos
        </button>
      )}

      {photos.length === 0 ? (
        <p className="rounded-md border border-dashed border-hair px-3 py-4 text-sm text-soft">
          {canUpload
            ? "Todavía no hay fotos. Agrega las del estado inicial y final del servicio."
            : "Las citas canceladas no admiten fotos nuevas."}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setViewer(index)}
                aria-label={`Ver foto ${index + 1} de ${photos.length}`}
                className="block aspect-square w-full overflow-hidden rounded-md bg-canvas outline-offset-2 transition-shadow hover:ring-2 hover:ring-brand/50"
              >
                <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        aria-label="Visor de fotos"
        onClose={() => {
          setViewer(null);
          setConfirming(false);
          setViewerError(null);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setViewer(null);
        }}
        onKeyDown={onKeyDown}
        className="m-auto w-[min(94vw,52rem)] max-w-none overflow-hidden rounded-lg border-0 bg-ink p-0 text-white backdrop:bg-ink/80"
      >
        {current && viewer !== null && (
          <div className="flex flex-col">
            <div className="relative flex max-h-[68vh] min-h-48 items-center justify-center bg-black">
              <img
                src={current.url}
                alt={`Foto ${viewer + 1} de ${photos.length}`}
                className="max-h-[68vh] w-full object-contain"
              />
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-ink/70 hover:bg-ink"
                  >
                    <Icon name="left" size={20} />
                    <span className="sr-only">Foto anterior</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-ink/70 hover:bg-ink"
                  >
                    <Icon name="right" size={20} />
                    <span className="sr-only">Foto siguiente</span>
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-snug">
                  <span className="block font-medium">{current.uploadedByName ?? "Usuario eliminado"}</span>
                  <span className="block tabular-nums text-white/60">
                    {PHOTO_TIME.format(new Date(current.createdAt))} · {formatBytes(current.sizeBytes)} · {viewer + 1}{" "}
                    de {photos.length}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setViewer(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-white/10"
                >
                  <Icon name="close" />
                  <span className="sr-only">Cerrar visor</span>
                </button>
              </div>

              {current.canDelete &&
                (confirming ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">¿Eliminar esta foto?</span>
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() => remove(current)}
                      className="rounded-md bg-[#d6453a] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {removing ? "Eliminando…" : "Sí, eliminar"}
                    </button>
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() => setConfirming(false)}
                      className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="flex items-center gap-1.5 self-start text-sm font-medium text-[#ff9b8f] hover:underline"
                  >
                    <Icon name="trash" />
                    Eliminar foto
                  </button>
                ))}

              {viewerError && (
                <p role="alert" className="text-sm font-medium text-[#ff9b8f]">
                  {viewerError}
                </p>
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
