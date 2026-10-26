"use client";

import { useRef, type ChangeEvent } from "react";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import { COLOR_SWATCHES, SIZE_OPTIONS, type DetailKey, type ItemDetails } from "@/domain/appointment-items";

export type TicketPhoto = { key: number; file: File; url: string };

export const MAX_PHOTOS_PER_ITEM = 5;

const FIELD = `${INPUT} py-2`;
const LABEL = "flex flex-col gap-1 text-xs font-medium text-soft";

export function swatchFor(color: string | undefined): string | null {
  if (!color) return null;
  return COLOR_SWATCHES.find((swatch) => swatch.name.toLowerCase() === color.trim().toLowerCase())?.hex ?? null;
}

export function TicketPhotoStrip({
  photos,
  onRemove,
  size = "sm",
}: {
  photos: readonly TicketPhoto[];
  onRemove?: (key: number) => void;
  size?: "sm" | "md";
}) {
  if (photos.length === 0) return null;
  const box = size === "md" ? "h-16 w-16" : "h-10 w-10";
  return (
    <ul className="flex flex-wrap gap-1.5">
      {photos.map((photo) => (
        <li key={photo.key} className={`group relative ${box} overflow-hidden rounded-md border border-hair bg-canvas`}>
          <img src={photo.url} alt="" className="h-full w-full object-cover" />
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(photo.key)}
              aria-label="Quitar foto"
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            >
              <Icon name="close" size={11} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TicketLineExtras({
  fabricDetails = true,
  details,
  photos,
  photoRoom,
  onDetail,
  onAddPhotos,
  onRemovePhoto,
}: {
  fabricDetails?: boolean;
  details: ItemDetails;
  photos: readonly TicketPhoto[];
  photoRoom: number;
  onDetail: (key: DetailKey, value: string) => void;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (key: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const room = Math.min(MAX_PHOTOS_PER_ITEM - photos.length, photoRoom);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (files.length > 0) onAddPhotos(files.slice(0, Math.max(0, room)));
  }

  return (
    <div className="flex flex-col gap-2.5">
      {fabricDetails && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-soft">Color</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Color">
              {COLOR_SWATCHES.map((swatch) => {
                const selected = details.color?.toLowerCase() === swatch.name.toLowerCase();
                return (
                  <button
                    key={swatch.name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={swatch.name}
                    aria-label={swatch.name}
                    onClick={() => onDetail("color", selected ? "" : swatch.name)}
                    className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                      selected ? "ring-2 ring-brand ring-offset-2" : "border-ink/20"
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                );
              })}
            </div>
            <input
              value={details.color ?? ""}
              onChange={(event) => onDetail("color", event.target.value)}
              placeholder="O escribe el color: gris claro, estampado…"
              maxLength={40}
              className={FIELD}
              aria-label="Color"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className={LABEL}>
              Tamaño
              <input
                list="ticket-sizes"
                value={details.size ?? ""}
                onChange={(event) => onDetail("size", event.target.value)}
                placeholder="Mediano"
                maxLength={40}
                className={FIELD}
              />
              <datalist id="ticket-sizes">
                {SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
            <label className={LABEL}>
              Dimensiones
              <input
                value={details.dimensions ?? ""}
                onChange={(event) => onDetail("dimensions", event.target.value)}
                placeholder={'84" x 36"'}
                maxLength={80}
                className={FIELD}
              />
            </label>
          </div>
        </>
      )}
      <label className={LABEL}>
        Notas del artículo
        <textarea
          value={details.notes ?? ""}
          onChange={(event) => onDetail("notes", event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Manchas, material, daños previos…"
          className={`${FIELD} resize-y`}
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-xs font-medium text-soft">
          Fotos
          <span className="font-normal text-muted">
            {photos.length}/{MAX_PHOTOS_PER_ITEM}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <TicketPhotoStrip photos={photos} onRemove={onRemovePhoto} size="md" />
          {room > 0 && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hair text-[10px] font-semibold text-brand-ink hover:bg-brand-soft/40"
            >
              <Icon name="camera" size={18} />
              Agregar
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={pick} />
      </div>
    </div>
  );
}
