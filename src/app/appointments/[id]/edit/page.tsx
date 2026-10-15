import Link from "next/link";
import { DateInput } from "@/components/date-jump";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { getDb } from "@/db/client";
import { services as servicesTable, technicians as techniciansTable } from "@/db/schema";
import { addressAction, itemsAction, notesAction, rescheduleAction } from "@/app/calendar/actions";
import { ActionForm } from "@/components/action-form";
import { AppShell } from "@/components/app-header";
import { BackLink } from "@/components/back-link";
import { FIELD } from "@/components/panel-kit";
import { PanelItemsForm } from "@/components/panel-items-form";
import { PhotoGallery } from "@/components/photo-gallery";
import { StatusBadge } from "@/components/status-badge";
import { AddressFields } from "@/components/address-fields";
import { UnlocatedAddressAlert, isUnlocated } from "@/components/unlocated-address";
import { updateAddressAction } from "@/app/customers/[id]/actions";
import { TimeRangeField } from "@/components/time-range-fields";
import { centsToDollars, serviceLabel } from "@/domain/appointment-items";
import { toFormService } from "@/domain/appointment-form";
import { minutesToTimeInput, panelActions } from "@/domain/appointment-panel";
import { DomainError } from "@/domain/appointment-rules";
import { formatDayLabel, formatRange } from "@/domain/calendar-view";
import { formatAddress, formatMoney } from "@/domain/invoice";
import { calendarHref } from "@/lib/calendar-links";
import { getAppointment } from "@/server/appointments";
import { getActor } from "@/server/auth";
import { panelPhotos } from "@/server/photos";
import { getPhotoStorage } from "@/server/storage";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function safeReturn(raw: string, fallback: string): string {
  return raw.startsWith("/calendar") || raw.startsWith("/customers/") ? raw : fallback;
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-md border border-hair bg-paper p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {hint && <p className="text-sm text-soft">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function EditAppointmentPage({ params, searchParams }: PageProps<"/appointments/[id]/edit">) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = getDb();
  let appointment: Awaited<ReturnType<typeof getAppointment>>;
  try {
    appointment = await getAppointment(db, id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }

  const back = safeReturn(
    first((await searchParams).volver),
    calendarHref({ date: appointment.date, appt: appointment.id }),
  );
  const [photos, allServices, allTechnicians] = await Promise.all([
    panelPhotos(db, getPhotoStorage, actor, id),
    db.select().from(servicesTable),
    db.select().from(techniciansTable),
  ]);
  const services = allServices
    .filter((s) => s.active || appointment.items.some((item) => item.serviceId === s.id))
    .map(toFormService);
  const technicians = allTechnicians.filter((t) => t.active || t.id === appointment.technicianId);

  const actions = panelActions(appointment.status, appointment.paymentStatus, appointment.invoiceStatus);
  const cancelled = appointment.status === "cancelled";
  const canEditItems = !cancelled && appointment.invoiceStatus !== "sent";
  const items =
    appointment.items.length > 0
      ? appointment.items
      : [
          {
            id: appointment.id,
            service: appointment.service,
            specs: appointment.specs,
            details: {},
            priceCents: appointment.priceCents,
          },
        ];
  const customer = appointment.customer;

  return (
    <AppShell active="calendar" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <BackLink fallback={back} />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2.5">
              <span className="font-display text-sm font-semibold tabular-nums text-soft">{appointment.code}</span>
              <StatusBadge status={appointment.status} />
            </span>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Editar cita · {serviceLabel(appointment)}
            </h1>
            <p className="text-sm text-soft">
              <Link href={`/customers/${customer.id}`} className="font-medium text-ink hover:underline">
                {customer.firstName} {customer.lastName}
              </Link>{" "}
              · {formatDayLabel(appointment.date)} · {formatRange(appointment.startMin, appointment.durationMin)} ·{" "}
              {appointment.technician.name}
            </p>
          </div>
          <p className="text-sm text-soft">
            Total
            <span className="font-display ml-2 text-2xl font-semibold tabular-nums text-ink">
              {formatMoney(appointment.priceCents)}
            </span>
          </p>
        </div>

        {cancelled && (
          <p className="rounded-md bg-neutral-soft px-4 py-3 text-sm text-soft">
            Esta cita está cancelada: solo se pueden ver sus datos.
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <Card
              title="Servicios y precios"
              hint={
                canEditItems
                  ? "Cambia los servicios, corrige los precios y los datos de cada artículo. Guarda al terminar."
                  : "La factura ya se envió o la cita está cancelada: los servicios no se pueden cambiar."
              }
            >
              {canEditItems ? (
                <ActionForm
                  action={itemsAction.bind(null, id)}
                  submit="Guardar servicios y precios"
                  pendingText="Guardando…"
                  tone="primary"
                >
                  <PanelItemsForm
                    appointmentId={id}
                    services={services}
                    compact={false}
                    initialItems={items.map((item) => ({
                      serviceId: item.service.id,
                      price: centsToDollars(item.priceCents),
                      specs: Object.fromEntries(Object.entries(item.specs).map(([key, value]) => [key, String(value)])),
                      details: Object.fromEntries(
                        Object.entries(item.details ?? {}).map(([key, value]) => [key, String(value)]),
                      ),
                    }))}
                    durationMin={appointment.durationMin}
                    showDuration={false}
                    hasDestination={appointment.destinationAddress !== null}
                  />
                </ActionForm>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between gap-3 rounded-md border border-hair px-3.5 py-2.5 text-sm"
                    >
                      <span className="font-medium">{item.service.name}</span>
                      <span className="tabular-nums">{formatMoney(item.priceCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Fotos" hint="Elige a qué artículo pertenecen o déjalas para toda la cita.">
              <PhotoGallery
                appointmentId={id}
                photos={photos.photos}
                available={photos.available}
                canUpload={!cancelled}
                items={appointment.items.map((item, index) => ({
                  id: item.id,
                  label: `${index + 1}. ${item.service.name}`,
                }))}
              />
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            {actions.reschedule && (
              <Card
                title="Fecha, horario y técnico"
                hint="Cambia la hora de inicio, la de salida, el día o el técnico."
              >
                <ActionForm action={rescheduleAction.bind(null, id)} submit="Guardar horario" pendingText="Guardando…">
                  <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                    Fecha
                    <DateInput name="date" required defaultValue={appointment.date} className={FIELD} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <TimeRangeField
                      defaultStart={minutesToTimeInput(appointment.startMin)}
                      defaultDuration={appointment.durationMin}
                      inputClassName={FIELD}
                      labelClassName="flex flex-col gap-1 text-xs font-medium text-soft"
                    />
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                    Técnico
                    <select name="technicianId" defaultValue={appointment.technicianId} className={FIELD}>
                      {technicians.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-soft">
                    Motivo del cambio
                    <input
                      type="text"
                      name="reason"
                      required
                      placeholder="Ej: el cliente pidió otro día"
                      className={FIELD}
                    />
                  </label>
                </ActionForm>
              </Card>
            )}

            <Card title="Dirección del servicio">
              {isUnlocated(appointment.address) && <UnlocatedAddressAlert />}
              {!cancelled && (
                <ActionForm
                  action={updateAddressAction.bind(null, customer.id, appointment.address.id)}
                  submit="Guardar dirección corregida"
                  pendingText="Guardando…"
                  tone={isUnlocated(appointment.address) ? "primary" : "secondary"}
                >
                  <AddressFields defaults={appointment.address} />
                </ActionForm>
              )}
              {!cancelled && customer.addresses.length > 1 ? (
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
              ) : (
                cancelled && <p className="text-sm">{formatAddress(appointment.address)}</p>
              )}
              <Link
                href={`/customers/${customer.id}`}
                className="w-fit text-xs font-semibold text-brand-ink hover:underline"
              >
                Agregar otra dirección en la ficha del cliente
              </Link>
            </Card>

            <Card title="Notas de la cita">
              <ActionForm action={notesAction.bind(null, id)} submit="Guardar notas" pendingText="Guardando…">
                <textarea
                  name="notes"
                  rows={4}
                  defaultValue={appointment.notes}
                  placeholder="Acceso, mascotas, indicaciones para el técnico…"
                  aria-label="Notas de la cita"
                  className={`${FIELD} resize-y`}
                />
              </ActionForm>
            </Card>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
