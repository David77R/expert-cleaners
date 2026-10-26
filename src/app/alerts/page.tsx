import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { AlertLevel, AlertType } from "@/domain/alert-rules";
import { formatDayLabel, formatTime } from "@/domain/calendar-view";
import { addDays, todayIn } from "@/domain/date-rules";
import { isoDate } from "@/domain/schemas";
import { AppShell } from "@/components/app-header";
import { Icon, type IconName } from "@/components/icons";
import { getDb } from "@/db/client";
import { getActor } from "@/server/auth";
import { getAlerts } from "@/server/alerts";
import { AlertsDatePicker } from "@/components/date-jump";
import { MarkAlertsSeen } from "@/components/mark-alerts-seen";
import { alertKeys } from "@/domain/alert-seen";

const TYPE_LABEL: Record<AlertType, string> = {
  not_confirmed: "Citas sin confirmar",
  overlap: "Choques de horario",
  completed_unpaid: "Completadas sin cobrar",
  rescheduled: "Reprogramadas",
};

const LEVEL_ICON: Record<AlertLevel, IconName> = { attention: "alert", warning: "clock", info: "note" };
const LEVEL_BG: Record<AlertLevel, string> = {
  attention: "bg-attention-soft",
  warning: "bg-warning-soft",
  info: "bg-info-soft",
};
const LEVEL_TEXT: Record<AlertLevel, string> = {
  attention: "text-attention",
  warning: "text-warning",
  info: "text-info",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AlertsPage({ searchParams }: PageProps<"/alerts">) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const params = await searchParams;
  const today = todayIn();
  const parsedDate = isoDate.safeParse(first(params.date) ?? today);
  if (!parsedDate.success) notFound();
  const date = parsedDate.data;

  const db = getDb();
  const { items } = await getAlerts(db, actor.companyId, { date });

  function hrefFor(nextDate: string): string {
    return `/alerts?date=${nextDate}`;
  }

  return (
    <AppShell active="alerts" actor={actor}>
      <MarkAlertsSeen keys={alertKeys(items)} />
      <main className="mx-auto flex w-full max-w-[72rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Centro de alertas</h1>
            <p className="mt-1.5 text-sm text-soft">
              Lo que necesita atención hasta el {date === today ? "día de hoy" : formatDayLabel(date)}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-md border border-hair bg-paper">
              <Link
                href={hrefFor(addDays(date, -1))}
                aria-label="Día anterior"
                className="flex h-10 w-10 items-center justify-center text-soft transition-colors hover:bg-canvas"
              >
                <Icon name="left" />
              </Link>
              <Link
                href={hrefFor(today)}
                aria-current={date === today ? "date" : undefined}
                className={`flex h-10 items-center border-x border-hair px-4 text-sm font-semibold transition-colors ${
                  date === today ? "bg-brand-soft text-brand-ink" : "text-ink hover:bg-canvas"
                }`}
              >
                Hoy
              </Link>
              <Link
                href={hrefFor(addDays(date, 1))}
                aria-label="Día siguiente"
                className="flex h-10 w-10 items-center justify-center text-soft transition-colors hover:bg-canvas"
              >
                <Icon name="right" />
              </Link>
            </div>
            <AlertsDatePicker date={date} today={today} />
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-hair bg-paper px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-success-soft text-success">
              <Icon name="clock" size={22} />
            </span>
            <p className="font-display text-lg font-semibold">Sin alertas pendientes</p>
            <p className="max-w-sm text-sm text-soft">
              No hay citas sin confirmar, choques de horario, cobros pendientes ni reprogramaciones.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {items.map((item) => (
              <section key={item.type} className="overflow-hidden rounded-md border border-hair bg-paper">
                <div
                  className={`flex items-center justify-between gap-3 border-b border-hair px-5 py-3 ${LEVEL_BG[item.level]}`}
                >
                  <span className={`flex items-center gap-2 text-sm font-semibold ${LEVEL_TEXT[item.level]}`}>
                    <Icon name={LEVEL_ICON[item.level]} size={16} />
                    {TYPE_LABEL[item.type]}
                  </span>
                  <span className={`font-display text-sm font-bold ${LEVEL_TEXT[item.level]}`}>{item.count}</span>
                </div>
                <ul className="divide-y divide-hair">
                  {item.appointments.map((appt) => (
                    <li key={appt.id}>
                      <Link
                        href={`/calendar?date=${appt.date}&appt=${appt.id}`}
                        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3 transition-colors hover:bg-canvas/70"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {appt.code} — {appt.customerName}
                          </span>
                          <span className="mt-0.5 block text-sm text-soft">{appt.technicianName}</span>
                        </span>
                        <span className="flex items-center gap-4 text-sm tabular-nums text-soft">
                          {appt.date !== date && <span>{appt.date}</span>}
                          {formatTime(appt.startMin)}
                          <Icon name="right" className="text-muted" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
