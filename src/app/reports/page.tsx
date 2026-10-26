import { reportPeople } from "@/server/reports";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { CALENDAR_VIEWS, shiftAnchor, viewHeading, type CalendarView } from "@/domain/calendar-view";
import { todayIn } from "@/domain/date-rules";
import { formatMoney } from "@/domain/invoice";
import { isoDate } from "@/domain/schemas";
import { AppShell } from "@/components/app-header";
import { Icon } from "@/components/icons";
import { getActor } from "@/server/auth";
import { getAgentReport } from "@/server/reports";

const PERIOD_LABEL: Record<CalendarView, string> = { day: "Día", week: "Semana", month: "Mes" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePeriod(value: unknown): CalendarView {
  return (CALENDAR_VIEWS as readonly unknown[]).includes(value) ? (value as CalendarView) : "week";
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const params = await searchParams;
  const today = todayIn();
  const period = parsePeriod(first(params.period));
  const parsedDate = isoDate.safeParse(first(params.date) ?? today);
  if (!parsedDate.success) notFound();
  const date = parsedDate.data;
  const requestedAgent = z.uuid().safeParse(first(params.agentId));

  const db = getDb();
  const people = await reportPeople(db, actor.companyId);
  const selectedAgentId =
    requestedAgent.success && people.some((p) => p.id === requestedAgent.data) ? requestedAgent.data : null;

  const report = await getAgentReport(db, actor, { period, date, agentId: selectedAgentId ?? undefined });
  const heading = viewHeading(period, date);

  function hrefFor(next: { period?: CalendarView; date?: string; agentId?: string | null }): string {
    const sp = new URLSearchParams({ period: next.period ?? period, date: next.date ?? date });
    const nextAgent = next.agentId === undefined ? selectedAgentId : next.agentId;
    if (nextAgent) sp.set("agentId", nextAgent);
    return `/reports?${sp.toString()}`;
  }

  const pdfParams = new URLSearchParams({ period, date });
  if (selectedAgentId) pdfParams.set("agentId", selectedAgentId);

  return (
    <AppShell active="reports" actor={actor}>
      <main className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center overflow-hidden rounded-md border border-hair bg-paper">
              <Link
                href={hrefFor({ date: shiftAnchor(period, date, -1) })}
                aria-label="Periodo anterior"
                className="flex h-10 w-10 items-center justify-center text-soft transition-colors hover:bg-canvas"
              >
                <Icon name="left" />
              </Link>
              <Link
                href={hrefFor({ date: today })}
                aria-current={date === today ? "date" : undefined}
                className={`flex h-10 items-center border-x border-hair px-4 text-sm font-semibold transition-colors ${
                  date === today ? "bg-brand-soft text-brand-ink" : "text-ink hover:bg-canvas"
                }`}
              >
                Hoy
              </Link>
              <Link
                href={hrefFor({ date: shiftAnchor(period, date, 1) })}
                aria-label="Periodo siguiente"
                className="flex h-10 w-10 items-center justify-center text-soft transition-colors hover:bg-canvas"
              >
                <Icon name="right" />
              </Link>
            </div>

            <h1 className="flex flex-col leading-none">
              <span className="font-display text-2xl font-semibold tracking-tight">Reportes</span>
              <span className="mt-1.5 text-sm text-soft">
                {heading.primary} · {heading.secondary}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href={`/api/reports/agents/pdf?${pdfParams.toString()}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Icon name="note" />
              Descargar PDF
            </a>
            <div role="group" aria-label="Periodo" className="flex gap-1 border-b border-hair">
              {CALENDAR_VIEWS.map((option) => (
                <Link
                  key={option}
                  href={hrefFor({ period: option })}
                  aria-current={option === period ? "true" : undefined}
                  className={`-mb-px border-b-[3px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                    option === period ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {PERIOD_LABEL[option]}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-1 gap-y-2" role="group" aria-label="Filtrar por agente">
          <Link
            href={hrefFor({ agentId: null })}
            aria-current={selectedAgentId === null ? "true" : undefined}
            className={`border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedAgentId === null ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Todos los agentes
          </Link>
          {people.map((person) => (
            <Link
              key={person.id}
              href={hrefFor({ agentId: person.id })}
              aria-current={person.id === selectedAgentId ? "true" : undefined}
              className={`border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                person.id === selectedAgentId ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {person.name}
            </Link>
          ))}
        </div>

        <div className="overflow-x-auto rounded-md border border-hair bg-paper">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-hair bg-canvas/60 text-left text-xs font-semibold uppercase tracking-wide text-soft">
              <tr>
                <th className="px-4 py-3">Agente</th>
                <th className="px-4 py-3 text-right">Programadas</th>
                <th className="px-4 py-3 text-right">Completadas</th>
                <th className="px-4 py-3 text-right">Canceladas</th>
                <th className="px-4 py-3 text-right">Facturado</th>
                <th className="px-4 py-3 text-right">Pagado</th>
                <th className="px-4 py-3 text-right">Pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {report.agents.map((agent) => (
                <tr key={agent.agentId}>
                  <td className="px-4 py-3 font-medium">{agent.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{agent.scheduled}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{agent.completed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{agent.cancelled}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(agent.bookedCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(agent.paidCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(agent.unpaidCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-hair bg-canvas/40 font-semibold">
              <tr>
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">{report.totals.scheduled}</td>
                <td className="px-4 py-3 text-right tabular-nums">{report.totals.completed}</td>
                <td className="px-4 py-3 text-right tabular-nums">{report.totals.cancelled}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(report.totals.bookedCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(report.totals.paidCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(report.totals.unpaidCents)}</td>
              </tr>
            </tfoot>
          </table>

          {report.agents.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-soft">No hay agentes para mostrar.</p>
          )}
        </div>
      </main>
    </AppShell>
  );
}
