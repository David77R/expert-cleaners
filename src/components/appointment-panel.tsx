import Link from "next/link";
import { DateInput } from "@/components/date-jump";
import { CANCEL_REASON_LABELS, describeChange, minutesToTimeInput, panelActions } from "@/domain/appointment-panel";
import { CANCEL_REASONS } from "@/domain/appointment-rules";
import { formatDayLabel, formatRange, initialsOf, readableOn } from "@/domain/calendar-view";
import { formatPhone } from "@/domain/customer-rules";
import {
  centsToDollars,
  describeDetails,
  fieldsForService,
  serviceLabel,
  type ItemDetails,
} from "@/domain/appointment-items";
import type { FormService } from "@/domain/appointment-form";
import { describeSpecs, formatAddress, formatMoney } from "@/domain/invoice";
import { calendarHref } from "@/lib/calendar-links";
import {
  addressAction,
  cancelAction,
  completeAction,
  confirmAction,
  invoiceAction,
  itemsAction,
  notesAction,
  payAction,
  rescheduleAction,
  unconfirmAction,
} from "@/app/calendar/actions";
import { ActionForm } from "@/components/action-form";
import type { CalendarNav, CalendarTechnician } from "@/components/calendar-types";
import { Icon } from "@/components/icons";
import { PanelItemsForm } from "@/components/panel-items-form";
import { AddressFields } from "@/components/address-fields";
import { UnlocatedAddressAlert, isUnlocated } from "@/components/unlocated-address";
import { updateAddressAction } from "@/app/customers/[id]/actions";
import { TimeRangeField } from "@/components/time-range-fields";
import { AppointmentDeliverySection } from "@/components/appointment-delivery";
import { Expandable, FIELD, Row, Section } from "@/components/panel-kit";
import { PhotoGallery } from "@/components/photo-gallery";
import { StatusBadge } from "@/components/status-badge";
import type { getAppointment } from "@/server/appointments";
import type { PanelPhotos } from "@/server/photos";

type Detail = Awaited<ReturnType<typeof getAppointment>>;

const HISTORY_TIME = new Intl.DateTimeFormat("es-US", {
  timeZone: "America/New_York",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function AppointmentPanel({
  appointment,
  technicians,
  services,
  nav,
  photos,
}: {
  appointment: Detail;
  technicians: CalendarTechnician[];
  services: FormService[];
  nav: CalendarNav;
  photos: PanelPhotos;
}) {
  const actions = panelActions(appointment.status, appointment.paymentStatus, appointment.invoiceStatus);
  const closeHref = calendarHref(nav);
  const technicianNames = Object.fromEntries(technicians.map((t) => [t.id, t.name]));
  const items =
    appointment.items.length > 0
      ? appointment.items
      : [
          {
            id: appointment.id,
            service: appointment.service,
            specs: appointment.specs,
            details: {} as ItemDetails,
            priceCents: appointment.priceCents,
          },
        ];
  const canEditItems = appointment.status !== "cancelled" && appointment.invoiceStatus !== "sent";
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
            <h2 className="font-display text-2xl font-semibold leading-tight">{serviceLabel(appointment)}</h2>
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
          <Link
            href={`/appointments/${id}/edit?volver=${encodeURIComponent(calendarHref({ ...nav, appt: id }))}`}
            className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Icon name="wrench" size={14} />
            Editar cita: servicios, precios y fotos
          </Link>
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

        {(actions.confirm || actions.unconfirm || actions.complete || actions.pay || actions.invoice) && (
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
              {actions.unconfirm && (
                <ActionForm
                  action={unconfirmAction.bind(null, id)}
                  submit="Quitar confirmación"
                  pendingText="Guardando…"
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

        {actions.reschedule && (
          <Section title="Fecha y hora">
            <p className="flex items-center gap-1.5 text-sm text-soft">
              <Icon name="calendar" size={14} />
              {formatDayLabel(appointment.date)} · {formatRange(appointment.startMin, appointment.durationMin)}
            </p>
            <Expandable title="Cambiar fecha, hora o técnico">
              <ActionForm
                action={rescheduleAction.bind(null, id)}
                submit="Guardar nuevo horario"
                pendingText="Guardando…"
                tone="primary"
              >
                <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                  Fecha
                  <DateInput name="date" required defaultValue={appointment.date} className={FIELD} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <TimeRangeField
                    defaultStart={minutesToTimeInput(appointment.startMin)}
                    defaultDuration={appointment.durationMin}
                    inputClassName={FIELD}
                    labelClassName="flex flex-col gap-1 text-xs font-medium text-soft"
                  />
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
          {isUnlocated(appointment.address) && <UnlocatedAddressAlert />}
          <dl className="flex flex-col gap-2">
            <Row label="Dirección del servicio">
              <span className={isUnlocated(appointment.address) ? "text-attention" : undefined}>
                {formatAddress(appointment.address)}
              </span>
            </Row>
            {appointment.destinationAddress && (
              <Row label="Dirección de entrega">{formatAddress(appointment.destinationAddress)}</Row>
            )}
            {appointment.billingAddress && <Row label="Facturar a">{formatAddress(appointment.billingAddress)}</Row>}
          </dl>
          {appointment.status !== "cancelled" && (
            <Expandable
              title="Corregir dirección"
              tone={isUnlocated(appointment.address) ? "danger" : undefined}
              defaultOpen={isUnlocated(appointment.address)}
            >
              <ActionForm
                action={updateAddressAction.bind(null, customer.id, appointment.address.id)}
                submit="Guardar dirección"
                pendingText="Guardando…"
                tone="primary"
              >
                <AddressFields defaults={appointment.address} />
                <p className="text-xs text-soft">
                  Escribe la calle con el número y elige la sugerencia verificada. Se corrige en la ficha del cliente y
                  en todas sus citas con esta dirección.
                </p>
              </ActionForm>
            </Expandable>
          )}
          {appointment.status !== "cancelled" && customer.addresses.length > 1 && (
            <Expandable title="Usar otra dirección del cliente">
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
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border border-hair px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{item.service.name}</span>
                  <span className="tabular-nums">{formatMoney(item.priceCents)}</span>
                </div>
                {[...describeSpecs(item.specs, fieldsForService(item.service)), ...describeDetails(item.details)]
                  .length > 0 && (
                  <p className="mt-1 text-xs text-soft">
                    {[...describeSpecs(item.specs, fieldsForService(item.service)), ...describeDetails(item.details)]
                      .map((spec) => `${spec.label}: ${spec.value}`)
                      .join(" · ")}
                  </p>
                )}
                {photos.photos.some((photo) => photo.itemId === item.id) && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {photos.photos
                      .filter((photo) => photo.itemId === item.id)
                      .map((photo) => (
                        <li
                          key={photo.id}
                          className="h-12 w-12 overflow-hidden rounded-md border border-hair bg-canvas"
                        >
                          <a href={photo.url} target="_blank" rel="noreferrer" aria-label="Ver foto">
                            <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </a>
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-2">
            <Row label="Total">
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
          {canEditItems && (
            <Expandable title="Editar servicios y precio">
              <ActionForm action={itemsAction.bind(null, id)} submit="Guardar cambios" pendingText="Guardando…">
                <PanelItemsForm
                  appointmentId={id}
                  services={services}
                  initialItems={items.map((item) => ({
                    serviceId: item.service.id,
                    price: centsToDollars(item.priceCents),
                    specs: Object.fromEntries(Object.entries(item.specs).map(([key, value]) => [key, String(value)])),
                    details: Object.fromEntries(
                      Object.entries(item.details ?? {}).map(([key, value]) => [key, String(value)]),
                    ),
                  }))}
                  durationMin={appointment.durationMin}
                  hasDestination={appointment.destinationAddress !== null}
                />
              </ActionForm>
            </Expandable>
          )}
        </Section>

        <AppointmentDeliverySection appointment={appointment} technicians={technicians} nav={nav} />

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

        {actions.cancel && (
          <Section title="Cambios en la cita">
            <div className="flex flex-col gap-2">
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
