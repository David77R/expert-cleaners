import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import { formatDayLabel, formatRange, initialsOf, readableOn } from "@/domain/calendar-view";
import { formatPhone } from "@/domain/customer-rules";
import { formatAddress } from "@/domain/invoice";
import { isAdmin } from "@/domain/permissions";
import { checklistTasks } from "@/domain/vehicle-care";
import { vehicleSummary } from "@/domain/vehicles";
import { AppShell } from "@/components/app-header";
import { DamageDiagram } from "@/components/damage-diagram";
import { Icon } from "@/components/icons";
import { InspectionPhotos } from "@/components/inspection-photos";
import { ItemChecklist } from "@/components/item-checklist";
import { StatusBadge } from "@/components/status-badge";
import { calendarHref } from "@/lib/calendar-links";
import { getAppointment } from "@/server/appointments";
import { TECHNICIAN_HOME, getActor, getBrand } from "@/server/auth";
import { assertTechnicianAppointment } from "@/server/technician-access";
import { panelPhotos } from "@/server/photos";
import { getPhotoStorage } from "@/server/storage";
import { ContactButton } from "@/components/contact-buttons";
import { hidePhone } from "@/domain/phone-privacy";

function Step({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-hair pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        <span className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rail text-xs font-bold text-white">
          {number}
        </span>
        <div>
          <h3 className="font-display text-base font-semibold leading-7">{title}</h3>
          {hint && <p className="text-sm text-soft">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function WorkSheetPage({ params }: PageProps<"/appointments/[id]/trabajo">) {
  const actor = await getActor({ allowTechnician: true });
  if (!actor) redirect("/login");
  const brand = await getBrand();
  const isTechnician = actor.role === "technician";

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  let appointment: Awaited<ReturnType<typeof getAppointment>>;
  try {
    await assertTechnicianAppointment(db, actor, id);
    appointment = await getAppointment(db, actor.companyId, id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  const photos = await panelPhotos(db, getPhotoStorage, actor, id);
  const editable = appointment.status !== "cancelled";
  const customer = hidePhone(actor, appointment.customer);
  const technician = appointment.technician;
  const address = formatAddress(appointment.address);
  const back = isTechnician
    ? `${TECHNICIAN_HOME}?date=${appointment.date}`
    : calendarHref({ date: appointment.date, appt: appointment.id });

  return (
    <AppShell active="calendar" actor={actor}>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-5 md:px-8 md:py-6">
        <div className="flex flex-col gap-1">
          <Link href={back} className="flex w-fit items-center gap-1 text-sm font-medium text-soft hover:text-ink">
            <Icon name="left" size={15} /> {isTechnician ? "Volver a mis citas" : "Volver al calendario"}
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Hoja de trabajo</h1>
            <span className="font-display text-sm font-semibold tabular-nums text-soft">{appointment.code}</span>
            <StatusBadge status={appointment.status} />
          </div>
        </div>

        <section className="flex flex-col gap-3 rounded-md border border-hair bg-paper p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span
              className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold"
              style={{ backgroundColor: technician.color, color: readableOn(technician.color) }}
            >
              {initialsOf(technician.name)}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block font-semibold">
                {formatDayLabel(appointment.date)} · {formatRange(appointment.startMin, appointment.durationMin)}
              </span>
              <span className="block text-sm text-soft">{technician.name}</span>
            </span>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex min-h-11 items-center gap-2 rounded-md bg-canvas py-1.5 pl-3 pr-1.5 font-medium">
              <span className="min-w-0 flex-1 truncate">
                {customer.firstName} {customer.lastName} · {formatPhone(customer.phone)}
              </span>
              <ContactButton customerId={customer.id} channel="call" />
              <ContactButton customerId={customer.id} channel="whatsapp" />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-2 rounded-md bg-canvas px-3 py-2 font-medium hover:bg-hair/50"
            >
              <Icon name="pin" size={16} />
              <span className="min-w-0 truncate">{address}</span>
            </a>
          </div>
          {appointment.notes && (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
              <span className="font-semibold">Notas: </span>
              {appointment.notes}
            </p>
          )}
          {!editable && (
            <p className="rounded-md bg-neutral-soft px-3 py-2 text-sm text-soft">
              La cita está cancelada: la hoja queda solo para consulta.
            </p>
          )}
        </section>

        {appointment.items.length === 0 && (
          <p className="rounded-md border border-dashed border-hair bg-paper px-4 py-6 text-center text-sm text-soft">
            Esta cita es de antes de que existieran los servicios por artículo, así que no tiene hoja de trabajo.
          </p>
        )}

        {appointment.items.map((item) => {
          const tasks = checklistTasks(item.service.checklist);
          const inspect = brand.features.vehicles;
          const itemPhotos = photos.photos
            .filter((photo) => photo.itemId === item.id)
            .map(({ id: photoId, url, label }) => ({ id: photoId, url, label }));
          let step = 0;
          return (
            <article key={item.id} className="flex flex-col gap-5 rounded-md border border-hair bg-paper p-4 sm:p-5">
              <header className="flex flex-col gap-1">
                <h2 className="font-display text-lg font-semibold">{item.service.name}</h2>
                {item.vehicle ? (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-brand-ink">
                    <Icon name="car" size={15} />
                    {vehicleSummary(item.vehicle)}
                  </p>
                ) : (
                  inspect && <p className="text-sm text-soft">Sin vehículo asignado en este servicio.</p>
                )}
              </header>

              {inspect && (
                <Step
                  number={++step}
                  title="Fotos antes de empezar"
                  hint="Una foto por lado. Si hay un daño, se nota que ya estaba."
                >
                  {photos.available ? (
                    <InspectionPhotos
                      appointmentId={appointment.id}
                      itemId={item.id}
                      photos={itemPhotos}
                      editable={editable}
                    />
                  ) : (
                    <p className="rounded-md bg-neutral-soft px-3 py-2.5 text-sm text-soft">
                      Las fotos no están disponibles: falta conectar el almacenamiento.
                    </p>
                  )}
                </Step>
              )}

              {inspect && (
                <Step
                  number={++step}
                  title="Daños que ya tenía el carro"
                  hint="Toca el dibujo donde está cada rayón, golpe o detalle."
                >
                  <DamageDiagram
                    appointmentId={appointment.id}
                    itemId={item.id}
                    inspection={item.inspection}
                    editable={editable}
                  />
                </Step>
              )}

              <Step number={++step} title={`Checklist ${item.service.name}`}>
                {tasks.length > 0 ? (
                  <ItemChecklist
                    appointmentId={appointment.id}
                    itemId={item.id}
                    groups={item.service.checklist}
                    done={item.checklist}
                    editable={editable}
                  />
                ) : (
                  <p className="rounded-md bg-canvas px-3 py-2.5 text-sm text-soft">
                    Este servicio todavía no tiene checklist.
                    {isAdmin(actor) && (
                      <>
                        {" "}
                        <Link href={`/services/${item.service.id}`} className="font-semibold text-brand-ink underline">
                          Agregarlo en Servicios
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </Step>
            </article>
          );
        })}
      </main>
    </AppShell>
  );
}
