import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { DomainError } from "@/domain/appointment-rules";
import { formatDayLabel } from "@/domain/calendar-view";
import { formatMinutes } from "@/domain/appointment-rules";
import { parseDuplicateIds } from "@/domain/customer-form";
import { formatPhone } from "@/domain/customer-rules";
import { formatMoney } from "@/domain/invoice";
import { calendarHref } from "@/lib/calendar-links";
import { AppShell } from "@/components/app-header";
import { CustomerAvatar } from "@/components/customer-avatar";
import { Icon } from "@/components/icons";
import { NoteForm } from "@/components/note-form";
import { StatusBadge } from "@/components/status-badge";
import { getActor } from "@/server/auth";
import { customersByIds, getCustomer } from "@/server/customers";

const NOTE_DATE = new Intl.DateTimeFormat("es-US", {
  timeZone: "America/New_York",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerPage({ params, searchParams }: PageProps<"/customers/[id]">) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();

  let customer;
  try {
    customer = await getCustomer(getDb(), parsed.data);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }

  const query = await searchParams;
  const justCreated = first(query.nuevo) === "1";
  const duplicateIds = justCreated
    ? parseDuplicateIds(first(query.dup), (value) => z.uuid().safeParse(value).success).filter(
        (id) => id !== customer.id,
      )
    : [];
  const duplicates = await customersByIds(getDb(), duplicateIds);

  const fullName = `${customer.firstName} ${customer.lastName}`;

  return (
    <AppShell active="customers" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <Link href="/customers" className="flex w-fit items-center gap-1 text-sm font-medium text-soft hover:text-ink">
          <Icon name="left" /> Todos los clientes
        </Link>

        {justCreated && (
          <div
            role="status"
            className="flex flex-col gap-1.5 rounded-md bg-success-soft px-4 py-3 text-sm text-success"
          >
            <p className="font-medium">Cliente creado: {customer.code}</p>
            {duplicates.length > 0 && (
              <p className="text-ink">
                Ya hay {duplicates.length === 1 ? "otro cliente" : "otros clientes"} con este teléfono:{" "}
                {duplicates.map((match, index) => (
                  <span key={match.id}>
                    {index > 0 && ", "}
                    <Link href={`/customers/${match.id}`} className="font-medium underline underline-offset-2">
                      {match.firstName} {match.lastName} ({match.code})
                    </Link>
                  </span>
                ))}
                . Revisa que no sea un registro repetido.
              </p>
            )}
          </div>
        )}

        <section className="flex flex-col gap-4 rounded-md border border-hair border-t-[3px] border-t-brand bg-paper p-5 sm:flex-row sm:items-center sm:p-6">
          <CustomerAvatar name={fullName} seed={customer.code} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight">{fullName}</h1>
              <span className="font-display rounded-[3px] bg-canvas px-2 py-0.5 text-xs font-medium tabular-nums text-soft">
                {customer.code}
              </span>
              <span
                className={`rounded-[3px] px-2.5 py-1 text-xs font-medium ${
                  customer.allowMarketing ? "bg-success-soft text-success" : "bg-neutral-soft text-muted"
                }`}
              >
                {customer.allowMarketing ? "Acepta promociones" : "Sin promociones"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-soft">
              <span className="flex items-center gap-1.5 tabular-nums">
                <Icon name="phone" size={14} />
                {formatPhone(customer.phone)}
              </span>
              {customer.email && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <Icon name="mail" size={14} />
                  <span className="truncate">{customer.email}</span>
                </span>
              )}
            </div>
            {customer.notes && (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">{customer.notes}</p>
            )}
          </div>
          <Link
            href={`/appointments/new?customer=${customer.id}`}
            className="flex items-center justify-center gap-2 self-start rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:self-center"
          >
            <Icon name="plus" />
            Nueva cita
          </Link>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-semibold">
                Direcciones <span className="text-sm font-normal text-muted">({customer.addresses.length})</span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {customer.addresses.map((address) => (
                  <li key={address.id} className="flex gap-3 rounded-md border border-hair bg-paper p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-info-soft text-info">
                      <Icon name="pin" size={18} />
                    </span>
                    <span className="flex min-w-0 flex-col text-sm">
                      <span className="font-medium">
                        {address.line1}
                        {address.unit ? `, ${address.unit}` : ""}
                      </span>
                      <span className="text-soft">
                        {address.city}, {address.state} {address.zip}
                      </span>
                      {address.notes && <span className="mt-1 text-xs text-muted">{address.notes}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-semibold">
                Citas recientes <span className="text-sm font-normal text-muted">({customer.appointments.length})</span>
              </h2>
              {customer.appointments.length === 0 ? (
                <p className="rounded-md border border-dashed border-hair bg-paper px-4 py-8 text-center text-sm text-muted">
                  Este cliente todavía no tiene citas.
                </p>
              ) : (
                <ul className="overflow-hidden rounded-md border border-hair bg-paper">
                  {customer.appointments.map((appointment) => (
                    <li key={appointment.id} className="border-b border-hair last:border-b-0">
                      <Link
                        href={calendarHref({ view: "day", date: appointment.date })}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-brand-soft/40"
                      >
                        <span className="flex w-28 shrink-0 flex-col leading-tight">
                          <span className="text-sm font-semibold">{formatDayLabel(appointment.date)}</span>
                          <span className="flex items-center gap-1 text-xs tabular-nums text-muted">
                            <Icon name="clock" size={11} />
                            {formatMinutes(appointment.startMin)}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="truncate text-sm font-medium">{appointment.serviceName}</span>
                          <span className="text-xs text-muted">{appointment.code}</span>
                        </span>
                        <StatusBadge status={appointment.status} compact />
                        <span className="w-20 text-right text-sm font-medium tabular-nums">
                          {formatMoney(appointment.priceCents)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
              <Icon name="note" size={18} className="text-brand" /> Historial del cliente
            </h2>
            <div className="rounded-md border border-hair bg-paper p-4">
              <NoteForm customerId={customer.id} />
            </div>
            {customer.history.length === 0 ? (
              <p className="px-1 text-sm text-muted">Sin observaciones registradas todavía.</p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {customer.history.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-md border border-hair border-l-4 border-l-brand bg-paper px-4 py-3"
                  >
                    <p className="whitespace-pre-wrap break-words text-sm">{note.text}</p>
                    <p className="mt-1.5 text-xs text-muted">
                      {note.authorName} · {NOTE_DATE.format(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
