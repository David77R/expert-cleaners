"use client";

import { useEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import { saveInspectionAction } from "@/app/appointments/[id]/trabajo/actions";
import { Icon } from "@/components/icons";
import {
  DAMAGE_KINDS,
  MAX_DAMAGE_MARKS,
  type DamageKind,
  type DamageMark,
  type Inspection,
} from "@/domain/vehicle-care";

const KIND_COLORS: Record<DamageKind, string> = {
  scratch: "#d97706",
  dent: "#dc2626",
  chip: "#7c3aed",
  glass: "#0284c7",
  wheel: "#475569",
  stain: "#a16207",
  other: "#0f766e",
};

const SAVED_AT = new Intl.DateTimeFormat("es-US", {
  timeZone: "America/New_York",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function CarOutline() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      <rect x="26" y="66" width="16" height="58" rx="6" className="fill-canvas" />
      <rect x="158" y="66" width="16" height="58" rx="6" className="fill-canvas" />
      <rect x="26" y="276" width="16" height="58" rx="6" className="fill-canvas" />
      <rect x="158" y="276" width="16" height="58" rx="6" className="fill-canvas" />
      <path
        d="M100 18c-40 0-58 14-60 46l-2 98v120l2 54c2 30 20 46 60 46s58-16 60-46l2-54V162l-2-98c-2-32-20-46-60-46z"
        className="fill-paper"
      />
      <ellipse cx="34" cy="150" rx="8" ry="5" className="fill-paper" />
      <ellipse cx="166" cy="150" rx="8" ry="5" className="fill-paper" />
      <path d="M52 132c14-10 82-10 96 0l-8 34H60z" className="fill-canvas" />
      <path d="M60 166h80v104H60z" />
      <path d="M60 270h80l6 26c-14 8-78 8-92 0z" className="fill-canvas" />
      <path d="M44 120c6-30 18-46 56-48 38 2 50 18 56 48" strokeDasharray="4 5" />
      <path d="M48 214h-8M152 214h8" />
    </g>
  );
}

export function DamageDiagram({
  appointmentId,
  itemId,
  inspection,
  editable,
}: {
  appointmentId: string;
  itemId: string;
  inspection: Inspection | null;
  editable: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [marks, setMarks] = useState<DamageMark[]>(inspection?.marks ?? []);
  const [notes, setNotes] = useState(inspection?.notes ?? "");
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [kind, setKind] = useState<DamageKind>("scratch");
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const picker = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pending) picker.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pending]);

  function place(event: MouseEvent<SVGSVGElement>) {
    if (!editable || !svg.current || marks.length >= MAX_DAMAGE_MARKS) return;
    const box = svg.current.getBoundingClientRect();
    const x = Math.round(((event.clientX - box.left) / box.width) * 1000) / 10;
    const y = Math.round(((event.clientY - box.top) / box.height) * 1000) / 10;
    setPending({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
    setNote("");
    setMessage(null);
  }

  function addMark() {
    if (!pending) return;
    setMarks((previous) => [...previous, { ...pending, kind, note: note.trim() }]);
    setPending(null);
    setDirty(true);
  }

  function removeMark(index: number) {
    setMarks((previous) => previous.filter((_, position) => position !== index));
    setDirty(true);
  }

  function save() {
    setMessage(null);
    startSaving(async () => {
      const result = await saveInspectionAction(appointmentId, itemId, marks, notes);
      if (result.ok) {
        setDirty(false);
        setMessage(null);
      } else setMessage({ tone: "error", text: result.error });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-start">
        <div className="relative mx-auto w-full max-w-[13rem] sm:max-w-[15rem]">
          <svg
            ref={svg}
            viewBox="0 0 200 400"
            role="img"
            aria-label="Dibujo del carro visto desde arriba. Toca donde está el daño."
            onClick={place}
            className={`block w-full text-muted ${editable ? "cursor-crosshair" : ""}`}
          >
            <text x="100" y="12" textAnchor="middle" className="fill-soft text-[11px] font-semibold tracking-widest">
              FRENTE
            </text>
            <CarOutline />
            <text x="100" y="398" textAnchor="middle" className="fill-soft text-[11px] font-semibold tracking-widest">
              ATRÁS
            </text>
            {marks.map((mark, index) => (
              <g key={index} transform={`translate(${mark.x * 2} ${mark.y * 4})`}>
                <circle r="11" fill={KIND_COLORS[mark.kind]} stroke="white" strokeWidth="2.5" />
                <text y="4" textAnchor="middle" className="fill-white text-[11px] font-bold">
                  {index + 1}
                </text>
              </g>
            ))}
            {pending && (
              <g transform={`translate(${pending.x * 2} ${pending.y * 4})`}>
                <circle
                  r="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                  className="text-ink"
                />
              </g>
            )}
          </svg>
          {editable && marks.length === 0 && !pending && (
            <p className="mt-2 text-center text-xs text-muted">Toca el carro donde está cada rayón o golpe.</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {pending && (
            <div
              ref={picker}
              className="flex scroll-mb-24 flex-col gap-3 rounded-md border border-brand bg-brand-soft/40 p-3"
            >
              <p className="text-sm font-semibold">Marca {marks.length + 1}: ¿qué tiene?</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(DAMAGE_KINDS) as [DamageKind, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setKind(key)}
                    aria-pressed={kind === key}
                    className={`flex min-h-11 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${
                      kind === key ? "border-ink bg-paper font-semibold" : "border-hair bg-paper/70"
                    }`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: KIND_COLORS[key] }} />
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={120}
                placeholder="Detalle (opcional): tamaño, ya estaba, etc."
                aria-label="Detalle del daño"
                className="w-full rounded-md border border-hair bg-paper px-3 py-2.5 text-[16px] sm:text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addMark}
                  className="flex-1 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-white"
                >
                  Agregar marca
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="rounded-md px-3 py-2.5 text-sm font-semibold text-soft hover:bg-canvas"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {marks.length === 0 ? (
            <p className="rounded-md bg-success-soft/60 px-3 py-2.5 text-sm text-success">Sin daños marcados.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-hair rounded-md border border-hair">
              {marks.map((mark, index) => (
                <li key={index} className="flex items-center gap-3 px-3 py-2">
                  <span
                    className="font-display flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: KIND_COLORS[mark.kind] }}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-medium">{DAMAGE_KINDS[mark.kind]}</span>
                    {mark.note && <span className="block truncate text-xs text-soft">{mark.note}</span>}
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => removeMark(index)}
                      aria-label={`Quitar marca ${index + 1}`}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-attention"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Observaciones
            <textarea
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setDirty(true);
              }}
              disabled={!editable}
              rows={3}
              maxLength={500}
              placeholder="Nivel de suciedad, pelo de mascota, objetos dentro del carro…"
              className="resize-y rounded-md border border-hair bg-paper px-3 py-2.5 text-[16px] font-normal sm:text-sm"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {inspection
            ? `Última inspección: ${inspection.by} · ${SAVED_AT.format(new Date(inspection.at))}`
            : "Todavía no se ha guardado la inspección."}
        </p>
        {editable && (
          <button
            type="button"
            onClick={save}
            disabled={saving || (!dirty && inspection !== null)}
            className="flex min-h-11 items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Icon name="check" size={16} />
            {saving ? "Guardando…" : inspection && !dirty ? "Inspección guardada" : "Guardar inspección"}
          </button>
        )}
      </div>
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`text-sm font-medium ${message.tone === "error" ? "text-attention" : "text-success"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
