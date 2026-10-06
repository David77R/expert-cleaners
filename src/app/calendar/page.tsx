import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { technicians } from "@/db/schema";
import { CalendarBoard } from "@/components/calendar-board";
import { getDay } from "@/server/appointments";
import { getActor } from "@/server/auth";
import { logout } from "../login/actions";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const raw = (await searchParams).date;
  const parsed = isoDate.safeParse(Array.isArray(raw) ? raw[0] : (raw ?? new Date().toISOString().slice(0, 10)));
  if (!parsed.success) notFound();
  const date = parsed.data;

  const db = getDb();
  const [day, techs] = await Promise.all([getDay(db, date), db.select().from(technicians)]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Calendario</h1>
          <p className="text-sm text-ink/60">
            {date} · {day.appointments.length} citas
          </p>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            className="rounded-lg border border-hair bg-white px-3 py-1.5"
            href={`/calendar?date=${shift(date, -1)}`}
          >
            Anterior
          </Link>
          <Link className="rounded-lg border border-hair bg-white px-3 py-1.5" href="/calendar">
            Hoy
          </Link>
          <Link
            className="rounded-lg border border-hair bg-white px-3 py-1.5"
            href={`/calendar?date=${shift(date, 1)}`}
          >
            Siguiente
          </Link>
          <form action={logout}>
            <button className="rounded-lg px-3 py-1.5 text-ink/60">Salir ({actor.name})</button>
          </form>
        </nav>
      </header>
      <CalendarBoard day={day} technicians={techs.filter((t) => t.active)} />
    </main>
  );
}
