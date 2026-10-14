import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import type { Technician } from "@/db/schema";
import { WEEKDAY_SHORT, readableOn, formatTime, initialsOf } from "@/domain/calendar-view";
import { describeWorkDays } from "@/domain/technician-form";
import { AppShell } from "@/components/app-header";
import { Icon } from "@/components/icons";
import { getActor } from "@/server/auth";
import { listTechnicians } from "@/server/technicians";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function TechnicianRow({ technician, muted = false }: { technician: Technician; muted?: boolean }) {
  return (
    <li>
      <Link
        href={`/technicians/${technician.id}`}
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-canvas/70"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={`font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${muted ? "opacity-50" : ""}`}
            style={{ backgroundColor: technician.color, color: readableOn(technician.color) }}
          >
            {initialsOf(technician.name)}
          </span>
          <span className="min-w-0">
            <span className={`block truncate font-medium ${muted ? "text-soft" : ""}`}>{technician.name}</span>
            <span className="block truncate text-sm text-soft">{technician.zone}</span>
          </span>
        </span>
        <span className="flex items-center gap-5 text-sm text-soft">
          <span>{describeWorkDays(technician.workDays, WEEKDAY_SHORT)}</span>
          <span className="tabular-nums">
            {formatTime(technician.shiftStartMin)} – {formatTime(technician.shiftEndMin)}
          </span>
          <Icon name="right" className="text-muted" />
        </span>
      </Link>
    </li>
  );
}

export default async function TechniciansPage({ searchParams }: PageProps<"/technicians">) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/calendar");

  const params = await searchParams;
  const technicians = await listTechnicians(getDb());
  const active = technicians.filter((technician) => technician.active);
  const inactive = technicians.filter((technician) => !technician.active);

  const aviso = first(params.aviso);
  const saved = technicians.find((technician) => technician.id === first(params.id));
  const banner =
    aviso === "eliminado"
      ? "Técnico eliminado."
      : saved && (aviso === "creado" || aviso === "actualizado")
        ? `${aviso === "creado" ? "Técnico creado" : "Cambios guardados"}: ${saved.name}.`
        : null;

  return (
    <AppShell active="technicians" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Técnicos</h1>
            <p className="text-sm text-soft">Quién atiende las citas, en qué zona y en qué horario.</p>
          </div>
          <Link
            href="/technicians/new"
            className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Icon name="plus" />
            Nuevo técnico
          </Link>
        </div>

        {banner && (
          <p role="status" className="rounded-md bg-success-soft px-4 py-3 text-sm font-medium text-success">
            {banner}
          </p>
        )}

        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-hair bg-paper px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-canvas text-muted">
              <Icon name="wrench" size={22} />
            </span>
            <p className="font-display text-lg font-semibold">Todavía no hay técnicos activos</p>
            <p className="max-w-sm text-sm text-soft">Agrega al menos uno para poder agendar citas.</p>
          </div>
        ) : (
          <ul className="divide-y divide-hair overflow-hidden rounded-md border border-hair bg-paper">
            {active.map((technician) => (
              <TechnicianRow key={technician.id} technician={technician} />
            ))}
          </ul>
        )}

        {inactive.length > 0 && (
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">No disponibles</h2>
              <p className="text-sm text-soft">No aparecen al agendar, pero sus citas anteriores se conservan.</p>
            </div>
            <ul className="divide-y divide-hair overflow-hidden rounded-md border border-hair bg-paper">
              {inactive.map((technician) => (
                <TechnicianRow key={technician.id} technician={technician} muted />
              ))}
            </ul>
          </div>
        )}
      </main>
    </AppShell>
  );
}
