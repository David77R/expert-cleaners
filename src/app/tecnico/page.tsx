import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { formatDayLabel, formatRange } from "@/domain/calendar-view";
import { formatPhone } from "@/domain/customer-rules";
import { addDays, todayIn } from "@/domain/date-rules";
import { formatAddress } from "@/domain/invoice";
import { hideCustomerPhones } from "@/domain/phone-privacy";
import { isoDate } from "@/domain/schemas";
import { vehicleSummary } from "@/domain/vehicles";
import { AppShell } from "@/components/app-header";
import { ContactButton } from "@/components/contact-buttons";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { getDay } from "@/server/appointments";
import { TECHNICIAN_HOME, getActor } from "@/server/auth";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TechnicianHomePage({ searchParams }: PageProps<"/tecnico">) {
  const actor = await getActor({ allowTechnician: true });
  if (!actor) redirect("/login");
  if (actor.role !== "technician" || !actor.technicianId) redirect("/calendar");

  const today = todayIn();
  const parsed = isoDate.safeParse(first((await searchParams).date) ?? today);
  const date = parsed.success ? parsed.data : today;
  const day = await getDay(getDb(), actor.companyId, date, actor.technicianId);
  const appointments = hideCustomerPhones(
    actor,
    day.appointments.filter((appointment) => appointment.status !== "cancelled"),
  );
  const pending = appointments.filter((appointment) => appointment.status !== "completed").length;

  const dayHref = (value: string) => (value === today ? TECHNICIAN_HOME : `${TECHNICIAN_HOME}?date=${value}`);

  return (
    <AppShell active="calendar" actor={actor}>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-5 md:py-8">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-soft">Hola, {actor.name.split(" ")[0]}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {date === today ? "Tus citas de hoy" : formatDayLabel(date)}
          </h1>
          <p className="text-sm text-soft">
            {appointments.length === 0
              ? "No tienes servicios asignados este día."
              : `${appointments.length} ${appointments.length === 1 ? "servicio" : "servicios"}${
                  pending > 0 ? `, ${pending} por hacer` : ", todos completados"
                }.`}
          </p>
        </div>

        <nav
          aria-label="Cambiar de día"
          className="flex items-center overflow-hidden rounded-xl border border-hair bg-paper"
        >
          <Link
            href={dayHref(addDays(date, -1))}
            aria-label="Día anterior"
            className="flex h-11 w-12 items-center justify-center text-soft transition-colors hover:bg-canvas"
          >
            <Icon name="left" />
          </Link>
          <Link
            href={dayHref(today)}
            aria-current={date === today ? "date" : undefined}
            className={`flex h-11 flex-1 items-center justify-center border-x border-hair text-sm font-semibold transition-colors ${
              date === today ? "bg-brand-soft text-brand-ink" : "hover:bg-canvas"
            }`}
          >
            {date === today ? "Hoy" : "Volver a hoy"}
          </Link>
          <Link
            href={dayHref(addDays(date, 1))}
            aria-label="Día siguiente"
            className="flex h-11 w-12 items-center justify-center text-soft transition-colors hover:bg-canvas"
          >
            <Icon name="right" />
          </Link>
        </nav>

        {appointments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hair bg-paper px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-soft text-success">
              <Icon name="calendar" size={22} />
            </span>
            <p className="font-display text-lg font-semibold">Día libre</p>
            <p className="max-w-xs text-sm text-soft">Cuando te asignen un servicio aparecerá aquí.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {appointments.map((appointment) => {
              const address = formatAddress(appointment.address);
              const vehicles = appointment.items
                .map((item) => (item.vehicle ? vehicleSummary(item.vehicle) : null))
                .filter((value): value is string => Boolean(value));
              const services =
                appointment.items.map((item) => item.service.name).join(" + ") || appointment.service.name;
              const done = appointment.status === "completed";
              return (
                <li
                  key={appointment.id}
                  className={`flex flex-col gap-4 rounded-xl border bg-paper p-4 shadow-sm ${
                    done ? "border-hair opacity-75" : "border-hair"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold tabular-nums">
                        {formatRange(appointment.startMin, appointment.durationMin)}
                      </p>
                      <p className="text-sm font-medium text-brand-ink">{services}</p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </div>

                  <dl className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center gap-2.5">
                      <dt className="sr-only">Cliente</dt>
                      <Icon name="users" size={16} className="shrink-0 text-muted" />
                      <dd className="min-w-0 truncate">
                        <span className="font-medium">
                          {appointment.customer.firstName} {appointment.customer.lastName}
                        </span>
                        <span className="text-soft"> · {formatPhone(appointment.customer.phone)}</span>
                      </dd>
                    </div>
                    {vehicles.length > 0 && (
                      <div className="flex items-center gap-2.5">
                        <dt className="sr-only">Vehículo</dt>
                        <Icon name="car" size={16} className="shrink-0 text-muted" />
                        <dd className="min-w-0 truncate">{vehicles.join(" · ")}</dd>
                      </div>
                    )}
                    <div className="flex items-start gap-2.5">
                      <dt className="sr-only">Dirección</dt>
                      <Icon name="pin" size={16} className="mt-0.5 shrink-0 text-muted" />
                      <dd className="min-w-0">{address}</dd>
                    </div>
                    {appointment.notes && (
                      <div className="rounded-md bg-warning-soft px-3 py-2 text-warning">
                        <dt className="sr-only">Notas</dt>
                        <dd>{appointment.notes}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="grid grid-cols-3 gap-2">
                    <ContactButton customerId={appointment.customer.id} channel="call" />
                    <ContactButton customerId={appointment.customer.id} channel="whatsapp" />
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-hair bg-paper px-3 py-2 text-sm font-semibold hover:bg-canvas"
                    >
                      <Icon name="pin" size={16} />
                      Ir
                    </a>
                  </div>
                  <Link
                    href={`/appointments/${appointment.id}/trabajo`}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <Icon name="note" size={16} />
                    {done ? "Ver hoja de trabajo" : "Abrir hoja de trabajo"}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </AppShell>
  );
}
