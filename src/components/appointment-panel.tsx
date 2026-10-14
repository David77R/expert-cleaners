import Link from "next/link";
import type { ReactNode } from "react";
import { CANCEL_REASON_LABELS, describeChange, minutesToTimeInput, panelActions } from "@/domain/appointment-panel";
import { CANCEL_REASONS } from "@/domain/appointment-rules";
import { formatDayLabel, formatRange, initialsOf, readableOn } from "@/domain/calendar-view";
import { formatPhone } from "@/domain/customer-rules";
import { describeSpecs, formatAddress, formatMoney } from "@/domain/invoice";
import { calendarHref } from "@/lib/calendar-links";
import {
  addressAction,
  cancelAction,
  completeAction,
  confirmAction,
  invoiceAction,
  notesAction,
  payAction,
  rescheduleAction,
} from "@/app/calendar/actions";
import { ActionForm } from "@/components/action-form";
import type { CalendarNav, CalendarTechnician } from "@/components/calendar-types";
import { Icon } from "@/components/icons";
import { PhotoGallery } from "@/components/photo-gallery";
import { StatusBadge } from "@/components/status-badge";
import type { getAppointment } from "@/server/appointments";
import type { PanelPhotos } from "@/server/photos";

type Detail = Awaited<ReturnType<typeof getAppointment>>;

const FIELD =
  "w-full rounded-md border border-hair bg-paper px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

const HISTORY_TIME = new Intl.DateTimeFormat("es-US", {
  timeZone: "America/New_York",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-hair px-5 py-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="shrink-0 text-soft">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

function Expandable({ title, tone, children }: { title: string; tone?: "danger"; children: ReactNode }) {
  return (
    <details className="group rounded-md border border-hair bg-paper open:shadow-sm">
      <summary
        className={`flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-sm font-semibold ${
          tone === "danger" ? "text-attention" : "text-ink"
        }`}
      >
        {title}
        <Icon name="right" className="transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-hair px-3.5 py-3">{children}</div>
    </details>
  );
}

export function AppointmentPanel({
  appointment,
  technicians,
  nav,
  photos,
}: {
  appointment: Detail;
  technicians: CalendarTechnician[];
  nav: CalendarNav;
  photos: PanelPhotos;
}) {
  const actions = panelActions(appointment.status, appointment.paymentStatus, appointment.invoiceStatus);
  const closeHref = calendarHref(nav);
  const technicianNames = Object.fromEntries(technicians.map((t) => [t.id, t.name]));
  const specs = describeSpecs(appointment.specs, appointment.service.fields);
  const customer = appointment.customer;
  const customerName = `${customer.firstName} ${customer.lastName}`;
  const technician = appointment.technician;
  const id = appointment.id;

  return (
    <>
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Cerrar panel"
        className="fixed inset-0 z-40 bg-ink/50 2xl:hidden"
        tabIndex={-1}
      />
      <aside
        aria-label={`Cita ${appointment.code}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[25rem] flex-col overflow-y-auto border-l border-hair bg-paper shadow-2xl"
      >
        <div className="h-1.5 shrink-0" style={{ backgroundColor: technician.color }} />
        <header className="flex flex-col gap-3 px-5 pb-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5">
              <span className="font-display text-sm font-semibold tabular-nums text-soft">{appointment.code}</span>
              <StatusBadge status={appointment.status} />
            </span>
            <Link
              href={closeHref}
              scroll={false}
              className="flex h-9 w-9 items-center justify-center rounded-md text-soft hover:bg-canvas"
            >
              <Icon name="close" />
              <span className="sr-only">Cerrar</span>
            </Link>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold leading-tight">{appointment.service.name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-soft">
              <Icon name="clock" size={14} />
              {formatDayLabel(appointment.date)} · {formatRange(appointment.startMin, appointment.durationMin)}
            </p>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <span
              className="font-display flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold"
              style={{ backgroundColor: technician.color, color: readableOn(technician.color) }}
            >
              {initialsOf(technician.name)}
            </span>
            <span className="leading-tight">
              <span className="block font-medium">{technician.name}</span>
              <span className="block text-xs text-soft">{technician.zone}</span>
            </span>
          </div>
          {appointment.alerts.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {appointment.alerts.map((alert) => (
                <li
                  key={alert.key}
                  className={`rounded-[3px] px-2 py-0.5 text-xs font-medium ${
                    alert.level === "attention"
                      ? "bg-attention-soft text-attention"
                      : alert.level === "warning"
                        ? "bg-warning-soft text-warning"
                        : "bg-info-soft text-info"
                  }`}
                >
                  {alert.label}
                </li>
              ))}
            </ul>
          )}
        </header>

        {appointment.status === "cancelled" && (
          <p className="mx-5 mb-4 rounded-md bg-neutral-soft px-3 py-2 text-sm text-soft">
            Cancelada
            {appointment.cancellationReason
              ? `: ${
                  appointment.cancellationReason.startsWith("other: ")
                    ? appointment.cancellationReason.slice(7)
                    : (CANCEL_REASON_LABELS[appointment.cancellationReason] ?? appointment.cancellationReason)
                }`
              : ""}
          </p>
        )}

        {(actions.confirm || actions.complete || actions.pay || actions.invoice) && (
          <Section title="Acciones">
            <div className="grid grid-cols-2 gap-2">
              {actions.confirm && (
                <ActionForm
                  action={confirmAction.bind(null, id)}
                  submit="Confirmar"
                  pendingText="Confirmando…"
                  tone="primary"
                />
              )}
              {actions.complete && (
                <ActionForm
                  action={completeAction.bind(null, id)}
                  submit="Completar"
                  pendingText="Guardando…"
                  tone={actions.confirm ? "secondary" : "primary"}
                />
              )}
              {actions.pay && (
                <ActionForm action={payAction.bind(null, id)} submit="Registrar cobro" pendingText="Guardando…" />
              )}
              {actions.invoice && (
                <ActionForm
                  action={invoiceAction.bind(null, id)}
                  submit={actions.invoice === "generate" ? "Generar factura" : "Marcar factura enviada"}
                  pendingText="Guardando…"
                />
              )}
            </div>
          </Section>
        )}

        <Section title="Cliente">
          <Link
            href={`/customers/${customer.id}`}
            className="flex items-center justify-between gap-3 rounded-md border border-hair px-3.5 py-3 transition-colors hover:bg-canvas"
          >
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-medium">{customerName}</span>
              <span className="mt-1 block text-sm tabular-nums text-soft">{formatPhone(customer.phone)}</span>
              {customer.email && <span className="block truncate text-sm text-soft">{customer.email}</span>}
            </span>
            <Icon name="right" className="shrink-0 text-muted" />
          </Link>
          <dl className="flex flex-col gap-2">
            <Row label="Dirección del servicio">{formatAddress(appointment.address)}</Row>
            {appointment.destinationAddress && (
              <Row label="Dirección de entrega">{formatAddress(appointment.destinationAddress)}</Row>
            )}
            {appointment.billingAddress && <Row label="Facturar a">{formatAddress(appointment.billingAddress)}</Row>}
          </dl>
          {appointment.status !== "cancelled" && customer.addresses.length > 1 && (
            <Expandable title="Cambiar dirección del servicio">
              <ActionForm action={addressAction.bind(null, id)} submit="Usar esta dirección" pendingText="Guardando…">
                <fieldset className="flex flex-col gap-2">
                  <legend className="sr-only">Direcciones del cliente</legend>
                  {customer.addresses.map((address) => (
                    <label
                      key={address.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-md border border-hair px-3 py-2.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40"
                    >
                      <input
                        type="radio"
                        name="addressId"
                        value={address.id}
                        defaultChecked={address.id === appointment.addressId}
                        className="mt-0.5 accent-brand"
                      />
                      <span className="min-w-0">
                        {formatAddress(address)}
                        {address.id === appointment.addressId && (
                          <span className="ml-1.5 text-xs text-muted">(actual)</span>
                        )}
                      </span>
                    </label>
                  ))}
                </fieldset>
              </ActionForm>
            </Expandable>
          )}
        </Section>

        <Section title="Servicio y cobro">
          <dl className="flex flex-col gap-2">
            {specs.map((spec) => (
              <Row key={spec.label} label={spec.label}>
                {spec.value}
              </Row>
            ))}
            <Row label="Precio">
              <span className="font-display text-base tabular-nums">{formatMoney(appointment.priceCents)}</span>
            </Row>
            <Row label="Pago">
              <span className={appointment.paymentStatus === "paid" ? "text-success" : "text-attention"}>
                {appointment.paymentStatus === "paid" ? "Pagado" : "Sin pagar"}
              </span>
            </Row>
            <Row label="Factura">
              {appointment.invoiceStatus === "not_generated" ? (
                <span className="text-soft">Sin generar</span>
              ) : (
                <a
                  href={`/api/appointments/${id}/invoice`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-ink underline underline-offset-2"
                >
                  {appointment.invoiceStatus === "sent" ? "Enviada · ver PDF" : "Generada · ver PDF"}
                </a>
              )}
            </Row>
          </dl>
        </Section>

        <Section title="Notas de la cita">
          <ActionForm action={notesAction.bind(null, id)} submit="Guardar notas" pendingText="Guardando…">
            <textarea
              name="notes"
              rows={3}
              defaultValue={appointment.notes}
              placeholder="Acceso, mascotas, indicaciones para el técnico…"
              aria-label="Notas de la cita"
              className={`${FIELD} resize-y`}
            />
          </ActionForm>
        </Section>

        <Section title="Fotos">
          <PhotoGallery
            appointmentId={id}
            photos={photos.photos}
            available={photos.available}
            canUpload={appointment.status !== "cancelled"}
          />
        </Section>

        {(actions.reschedule || actions.cancel) && (
          <Section title="Cambios en la cita">
            <div className="flex flex-col gap-2">
              {actions.reschedule && (
                <Expandable title="Reprogramar">
                  <ActionForm
                    action={rescheduleAction.bind(null, id)}
                    submit="Reprogramar cita"
                    pendingText="Guardando…"
                    tone="primary"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                        Fecha
                        <input type="date" name="date" required defaultValue={appointment.date} className={FIELD} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                        Hora
                        <input
                          type="time"
                          name="time"
                          required
                          defaultValue={minutesToTimeInput(appointment.startMin)}
                          className={FIELD}
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                      Técnico
                      <select name="technicianId" defaultValue={technician.id} className={FIELD}>
                        {technicians.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                      Motivo
                      <input
                        type="text"
                        name="reason"
                        required
                        placeholder="Ej: el cliente pidió otro día"
                        className={FIELD}
                      />
                    </label>
                  </ActionForm>
                </Expandable>
              )}
              {actions.cancel && (
                <Expandable title="Cancelar cita" tone="danger">
                  <ActionForm
                    action={cancelAction.bind(null, id)}
                    submit="Cancelar cita"
                    pendingText="Cancelando…"
                    tone="danger"
                  >
                    <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                      Motivo
                      <select name="reason" required defaultValue="" className={FIELD}>
                        <option value="" disabled>
                          Elige un motivo
                        </option>
                        {CANCEL_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {CANCEL_REASON_LABELS[reason]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                      Explicación (obligatoria si el motivo es «Otro motivo»)
                      <input type="text" name="explanation" className={FIELD} />
                    </label>
                  </ActionForm>
                </Expandable>
              )}
            </div>
          </Section>
        )}

        <Section title="Historial">
          <ol className="flex flex-col">
            {appointment.history.map((entry) => (
              <li key={entry.id} className="relative border-l-2 border-hair py-1.5 pl-4">
                <span className="absolute -left-[5px] top-3 h-2 w-2 rounded-full bg-muted" />
                <p className="text-sm">{describeChange(entry, technicianNames)}</p>
                <p className="text-xs text-muted">
                  {entry.actorName} · {HISTORY_TIME.format(entry.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        </Section>
      </aside>
    </>
  );
}
