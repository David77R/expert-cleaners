"use client";

import { useEffect, useState } from "react";
import type { getAppointment } from "@/server/appointments";
import {
  CANCEL_REASON_LABEL,
  CANCEL_REASONS,
  formatMinutes,
  HISTORY_FIELD_LABEL,
  INVOICE_LABEL,
  PAYMENT_LABEL,
  STATUS_LABEL,
  type CancelReason,
} from "@/domain/appointment-rules";

type AppointmentDetail = Awaited<ReturnType<typeof getAppointment>>;

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateTime = new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short" });

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-VE", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${date}T00:00:00`),
  );
}

async function extractError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.issues)) return body.issues.map((i: { message: string }) => i.message).join(", ");
  } catch {
    // respuesta sin cuerpo JSON
  }
  return "Algo salió mal. Intenta de nuevo.";
}

async function fetchDetail(id: string): Promise<AppointmentDetail> {
  const res = await fetch(`/api/appointments/${id}`);
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

async function postAction(id: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/appointments/${id}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await extractError(res));
}

export function AppointmentPanel({
  appointmentId,
  onClose,
  onChanged,
}: {
  appointmentId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<AppointmentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<CancelReason>(CANCEL_REASONS[0]);
  const [cancelExplanation, setCancelExplanation] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetchDetail(appointmentId)
      .then((detail) => {
        if (cancelled) return;
        setData(detail);
        setNotesDraft(detail.notes);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "No se pudo cargar la cita.");
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  async function run(action: string, body: Record<string, unknown>, onSuccess?: () => void) {
    setPending(action);
    setActionError(null);
    try {
      await postAction(appointmentId, { action, ...body });
      const fresh = await fetchDetail(appointmentId);
      setData(fresh);
      setNotesDraft(fresh.notes);
      onChanged();
      onSuccess?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Cerrar panel"
        onClick={onClose}
        className="absolute inset-0 bg-ink/20"
      />
      <aside
        className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto border-l border-hair bg-white"
        style={{ transform: mounted ? "translateX(0)" : "translateX(100%)" }}
      >
        {loadError && (
          <div className="flex flex-1 flex-col items-start justify-center gap-3 p-6">
            <p className="text-sm text-ink/70">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoadError(null);
                setData(null);
                fetchDetail(appointmentId)
                  .then((detail) => {
                    setData(detail);
                    setNotesDraft(detail.notes);
                  })
                  .catch((err) => setLoadError(err instanceof Error ? err.message : "No se pudo cargar la cita."));
              }}
              className="rounded-lg border border-hair px-3 py-1.5 text-sm"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loadError && !data && <p className="p-6 text-sm text-ink/60">Cargando cita…</p>}

        {!loadError && data && (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-hair p-5">
              <div>
                <p className="font-display text-lg font-semibold">{data.code}</p>
                <p className="text-sm text-ink/60">
                  {formatDate(data.date)} · {formatMinutes(data.startMin)}–
                  {formatMinutes(data.startMin + data.durationMin)}
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg border border-hair px-2 py-1 text-sm">
                Cerrar
              </button>
            </header>

            <div className="flex flex-1 flex-col gap-5 p-5">
              <section>
                <p className="text-sm text-ink/60">Estado</p>
                <p className="font-medium">{STATUS_LABEL[data.status]}</p>
                <p className="mt-2 text-sm text-ink/60">
                  {data.service.name} · {data.technician.name} · {currency.format(data.priceCents / 100)}
                </p>
                <p className="text-sm text-ink/60">Agente: {data.agent?.name ?? "—"}</p>
              </section>

              <section className="border-t border-hair pt-4">
                <p className="text-sm text-ink/60">Cliente</p>
                <p className="font-medium">
                  {data.customer.firstName} {data.customer.lastName}
                </p>
                <p className="text-sm text-ink/60">{data.customer.phone}</p>
                <p className="text-sm text-ink/60">
                  {data.address.line1}
                  {data.address.unit ? ` ${data.address.unit}` : ""}, {data.address.city}, {data.address.state}{" "}
                  {data.address.zip}
                </p>
              </section>

              <section className="border-t border-hair pt-4">
                <p className="text-sm text-ink/60">Notas internas (solo agentes)</p>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-hair p-2 text-sm"
                />
                <button
                  type="button"
                  disabled={notesDraft === data.notes || pending === "update_notes"}
                  onClick={() => run("update_notes", { notes: notesDraft })}
                  className="mt-2 rounded-lg border border-hair px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  {pending === "update_notes" ? "Guardando…" : "Guardar notas"}
                </button>
              </section>

              <section className="border-t border-hair pt-4">
                <p className="text-sm text-ink/60">Pago y factura</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm">{PAYMENT_LABEL[data.paymentStatus]}</span>
                  {data.paymentStatus === "unpaid" && data.status !== "cancelled" && (
                    <button
                      type="button"
                      disabled={pending === "mark_paid"}
                      onClick={() => run("mark_paid", {})}
                      className="rounded-lg border border-hair px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      {pending === "mark_paid" ? "Marcando…" : "Marcar pagado"}
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm">{INVOICE_LABEL[data.invoiceStatus]}</span>
                  {data.invoiceStatus !== "sent" && data.status !== "cancelled" && (
                    <button
                      type="button"
                      disabled={pending === "advance_invoice"}
                      onClick={() => run("advance_invoice", {})}
                      className="rounded-lg border border-hair px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      {pending === "advance_invoice"
                        ? "Actualizando…"
                        : data.invoiceStatus === "not_generated"
                          ? "Generar factura"
                          : "Marcar enviada"}
                    </button>
                  )}
                </div>
              </section>

              <section className="border-t border-hair pt-4">
                <p className="text-sm text-ink/60">Fotos</p>
                {data.photos.length === 0 ? (
                  <p className="mt-1 text-sm text-ink/50">Aún no hay fotos para esta cita.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {data.photos.map((photo) => (
                      <li key={photo.id} className="text-ink/70">
                        {photo.storagePath}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="border-t border-hair pt-4">
                <p className="text-sm text-ink/60">Historial</p>
                {data.history.length === 0 ? (
                  <p className="mt-1 text-sm text-ink/50">Sin cambios registrados todavía.</p>
                ) : (
                  <ul className="mt-1 space-y-2 text-sm">
                    {data.history.map((h) => (
                      <li key={h.id} className="text-ink/70">
                        <span className="font-medium text-ink">{HISTORY_FIELD_LABEL[h.field] ?? h.field}</span>{" "}
                        {h.fromValue ?? "—"} → {h.toValue ?? "—"}
                        <br />
                        {h.actorName} · {dateTime.format(new Date(h.createdAt as unknown as string))}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {actionError && <p className="border-t border-hair pt-4 text-sm text-[#d63f63]">{actionError}</p>}

              <section className="mt-auto flex flex-wrap gap-2 border-t border-hair pt-4">
                {(data.status === "not_confirmed" || data.status === "rescheduled") && (
                  <button
                    type="button"
                    disabled={pending === "confirm"}
                    onClick={() => run("confirm", {})}
                    className="rounded-lg bg-brand px-3 py-1.5 text-sm text-white disabled:opacity-40"
                  >
                    {pending === "confirm" ? "Confirmando…" : "Confirmar"}
                  </button>
                )}
                {data.status !== "cancelled" && data.status !== "completed" && (
                  <button
                    type="button"
                    disabled={pending === "complete"}
                    onClick={() => run("complete", {})}
                    className="rounded-lg border border-hair px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    {pending === "complete" ? "Completando…" : "Completar"}
                  </button>
                )}
                {data.status !== "cancelled" && data.status !== "completed" && !cancelOpen && (
                  <button
                    type="button"
                    onClick={() => setCancelOpen(true)}
                    className="rounded-lg border border-hair px-3 py-1.5 text-sm text-[#d63f63]"
                  >
                    Cancelar cita
                  </button>
                )}
              </section>

              {cancelOpen && (
                <section className="rounded-lg border border-hair p-3">
                  <label className="text-sm text-ink/60" htmlFor="cancel-reason">
                    Motivo de la cancelación
                  </label>
                  <select
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value as CancelReason)}
                    className="mt-1 w-full rounded-lg border border-hair p-2 text-sm"
                  >
                    {CANCEL_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {CANCEL_REASON_LABEL[reason]}
                      </option>
                    ))}
                  </select>
                  {cancelReason === "other" && (
                    <textarea
                      value={cancelExplanation}
                      onChange={(e) => setCancelExplanation(e.target.value)}
                      placeholder="Explica el motivo"
                      rows={2}
                      className="mt-2 w-full rounded-lg border border-hair p-2 text-sm"
                    />
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={pending === "cancel"}
                      onClick={() =>
                        run(
                          "cancel",
                          { reason: cancelReason, explanation: cancelReason === "other" ? cancelExplanation : undefined },
                          () => setCancelOpen(false),
                        )
                      }
                      className="rounded-lg bg-[#d63f63] px-3 py-1.5 text-sm text-white disabled:opacity-40"
                    >
                      {pending === "cancel" ? "Cancelando…" : "Confirmar cancelación"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelOpen(false)}
                      className="rounded-lg border border-hair px-3 py-1.5 text-sm"
                    >
                      Volver
                    </button>
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
