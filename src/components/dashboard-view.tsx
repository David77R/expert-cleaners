import Link from "next/link";
import type { ReactNode } from "react";
import { serviceLabel } from "@/domain/appointment-items";
import { STATUS_LABELS } from "@/domain/appointment-panel";
import { formatMinutes } from "@/domain/appointment-rules";
import { WEEKDAY_LONG, formatRange, initialsOf, readableOn, viewHeading, weekdayIndex } from "@/domain/calendar-view";
import { entryKey } from "@/domain/delivery";
import { formatMoney } from "@/domain/invoice";
import { serviceIconOf } from "@/domain/service-icons";
import { calendarHref } from "@/lib/calendar-links";
import { AppointmentsChart } from "@/components/dashboard-chart";
import { Icon, type IconName } from "@/components/icons";
import { ServiceIcon } from "@/components/service-icon";
import { StatusBadge } from "@/components/status-badge";
import type { Dashboard } from "@/server/dashboard";

function greeting(minutes: number): string {
  if (minutes < 12 * 60) return "Buenos días";
  if (minutes < 19 * 60) return "Buenas tardes";
  return "Buenas noches";
}

function hours(minutes: number): string {
  const value = minutes / 60;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} h`;
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col gap-4 rounded-md border border-hair bg-paper p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  detail,
  icon,
  href,
  tone = "brand",
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  icon: IconName;
  href: string;
  tone?: "brand" | "warning" | "attention" | "info";
}) {
  const tones = {
    brand: "bg-brand-soft text-brand-ink",
    warning: "bg-warning-soft text-warning",
    attention: "bg-attention-soft text-attention",
    info: "bg-info-soft text-info",
  };
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-3 rounded-md border border-hair bg-paper p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-soft">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${tones[tone]}`}>
          <Icon name={icon} size={16} />
        </span>
      </span>
      <span className="font-display text-3xl font-semibold leading-none tracking-tight tabular-nums">{value}</span>
      {detail && <span className="text-xs text-soft">{detail}</span>}
    </Link>
  );
}

function QuickAction({
  href,
  label,
  icon,
  primary = false,
}: {
  href: string;
  label: string;
  icon: IconName;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-4 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md ${
        primary ? "bg-brand text-white" : "border border-hair bg-paper text-ink hover:border-brand/40"
      }`}
    >
      <Icon name={icon} size={18} className={primary ? "" : "text-brand-ink"} />
      {label}
    </Link>
  );
}

export function DashboardView({
  data,
  actorName,
  now,
  rugPickup,
}: {
  data: Dashboard;
  actorName: string;
  now: number;
  rugPickup: boolean;
}) {
  const today = data.today;
  const month = viewHeading("month", today);
  const topMax = Math.max(1, ...data.topServices.map((service) => service.total));
  const next = data.agenda.find((entry) => entry.startMin + entry.durationMin > now);
  const firstName = actorName.split(" ")[0];

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-soft">
            {WEEKDAY_LONG[weekdayIndex(today)]} {Number(today.slice(8, 10))} de {month.primary.toLowerCase()}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {greeting(now)}, {firstName}
          </h1>
        </div>
        {next && (
          <Link
            href={calendarHref({ view: "day", date: today, appt: next.id, entregas: next.kind === "delivery" })}
            className="flex items-center gap-3 rounded-md border border-brand/30 bg-brand-soft/50 px-4 py-2.5 text-sm hover:bg-brand-soft"
          >
            <Icon name="clock" className="text-brand-ink" />
            <span>
              <span className="font-semibold">
                {next.startMin <= now ? "En curso" : "Próxima"}: {formatMinutes(next.startMin)}
              </span>{" "}
              · {next.kind === "delivery" ? "Entrega" : serviceLabel(next)} · {next.customer.firstName}{" "}
              {next.customer.lastName}
            </span>
          </Link>
        )}
      </div>

      <nav aria-label="Accesos rápidos" className="flex flex-wrap gap-2.5">
        <QuickAction href="/orders/new" label="Nuevo pedido" icon="plus" primary />
        <QuickAction href="/customers/new" label="Nuevo cliente" icon="users" />
        <QuickAction href={calendarHref({ view: "day", date: today })} label="Calendario de hoy" icon="calendar" />
        <QuickAction href={calendarHref({ view: "day", date: today, mapa: true })} label="Mapa y rutas" icon="pin" />
        {rugPickup && (
          <QuickAction
            href={calendarHref({ view: "day", date: today, entregas: true })}
            label="Entregas de hoy"
            icon="truck"
          />
        )}
        <QuickAction href="/alerts" label="Alertas" icon="alert" />
        <QuickAction href="/reports" label="Reportes" icon="report" />
      </nav>

      <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${rugPickup ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
        <Kpi
          label="Citas hoy"
          value={String(data.todayCount)}
          icon="calendar"
          href={calendarHref({ view: "day", date: today })}
          detail={`${data.status.confirmed} confirmadas · ${data.status.completed} completadas`}
        />
        {rugPickup && (
          <Kpi
            label="Entregas hoy"
            value={String(data.deliveryCount)}
            icon="truck"
            tone="info"
            href={calendarHref({ view: "day", date: today, entregas: true })}
            detail="Con el botón Entregas"
          />
        )}
        <Kpi
          label="Por confirmar"
          value={String(data.pendingWeek)}
          icon="clock"
          tone={data.pendingWeek > 0 ? "warning" : "brand"}
          href={calendarHref({ view: "week", date: today })}
          detail="Próximos 7 días"
        />
        <Kpi
          label="Conflictos hoy"
          value={String(data.overlapCount)}
          icon="alert"
          tone={data.overlapCount > 0 ? "attention" : "brand"}
          href="/alerts"
          detail={data.overlapCount > 0 ? "Revisa los horarios" : "Sin choques de horario"}
        />
        <Kpi
          label={`Vendido en ${month.primary.toLowerCase()}`}
          value={formatMoney(data.monthRevenueCents)}
          icon="money"
          href="/reports"
          detail={`${data.monthCount} citas · ${formatMoney(data.monthPaidCents)} cobrado`}
        />
        <Kpi
          label="Pendiente de cobro"
          value={formatMoney(data.unpaidCents)}
          icon="money"
          tone={data.unpaidCount > 0 ? "attention" : "brand"}
          href="/alerts"
          detail={`${data.unpaidCount} ${data.unpaidCount === 1 ? "cita completada" : "citas completadas"} sin pagar`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Citas por día"
          action={<span className="text-xs text-muted">Últimas 2 semanas y próximos 7 días</span>}
        >
          <AppointmentsChart daily={data.daily} today={today} />
        </Panel>

        <Panel
          title="Agenda de hoy"
          action={
            <Link
              href={calendarHref({ view: "day", date: today, entregas: true })}
              className="text-xs font-semibold text-brand-ink hover:underline"
            >
              Ver calendario
            </Link>
          }
        >
          {data.agenda.length === 0 ? (
            <p className="rounded-md border border-dashed border-hair px-4 py-10 text-center text-sm text-muted">
              No hay citas ni entregas para hoy.
            </p>
          ) : (
            <ol className="-mx-2 flex max-h-[19rem] flex-col overflow-y-auto">
              {data.agenda.map((entry) => {
                const finished = entry.startMin + entry.durationMin <= now;
                const isNext = next && entryKey(next) === entryKey(entry);
                return (
                  <li key={entryKey(entry)}>
                    <Link
                      href={calendarHref({
                        view: "day",
                        date: today,
                        appt: entry.id,
                        entregas: entry.kind === "delivery",
                      })}
                      className={`flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-canvas ${
                        finished ? "opacity-55" : ""
                      } ${isNext ? "bg-brand-soft/40" : ""}`}
                    >
                      <span className="w-16 shrink-0 text-xs font-semibold tabular-nums">
                        {formatMinutes(entry.startMin)}
                      </span>
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.technician.color }}
                      />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-sm font-medium">
                          {entry.kind === "delivery" && (
                            <span className="mr-1.5 rounded-[3px] bg-brand-soft px-1 py-px text-[10px] font-bold uppercase text-brand-ink">
                              Entrega
                            </span>
                          )}
                          {entry.customer.firstName} {entry.customer.lastName}
                        </span>
                        <span className="block truncate text-xs text-soft">
                          {serviceLabel(entry)} · {entry.technician.name} ·{" "}
                          {formatRange(entry.startMin, entry.durationMin)}
                        </span>
                      </span>
                      {entry.kind !== "delivery" && <StatusBadge status={entry.status} compact />}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title={`Servicios más pedidos en ${month.primary.toLowerCase()}`}
          action={
            <Link href="/reports" className="text-xs font-semibold text-brand-ink hover:underline">
              Reportes
            </Link>
          }
        >
          {data.topServices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Todavía no hay servicios vendidos este mes.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.topServices.map((service) => (
                <li key={service.serviceId} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
                    <ServiceIcon icon={serviceIconOf(service)} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{service.name}</span>
                      <span className="shrink-0 tabular-nums text-soft">
                        {service.total} · {formatMoney(service.revenue)}
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-canvas">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${(service.total / topMax) * 100}%` }}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Carga de técnicos hoy"
          action={
            <Link
              href={calendarHref({ view: "day", date: today, mapa: true })}
              className="text-xs font-semibold text-brand-ink hover:underline"
            >
              Ver rutas
            </Link>
          }
        >
          {data.technicianLoad.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Ningún técnico tiene visitas hoy.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.technicianLoad.map((tech) => {
                const ratio = Math.min(1, tech.minutes / tech.capacity);
                return (
                  <li key={tech.id} className="flex items-center gap-3">
                    <span
                      className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                      style={{ backgroundColor: tech.color, color: readableOn(tech.color) }}
                    >
                      {initialsOf(tech.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{tech.name}</span>
                        <span className="shrink-0 tabular-nums text-soft">
                          {tech.visits} {tech.visits === 1 ? "visita" : "visitas"} · {hours(tech.minutes)} de{" "}
                          {hours(tech.capacity)}
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-canvas">
                        <span
                          className={`block h-full rounded-full ${ratio >= 1 ? "bg-attention" : "bg-brand"}`}
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-hair bg-paper px-4 py-3 text-sm">
          <span className="text-soft">Clientes nuevos en {month.primary.toLowerCase()}:</span>{" "}
          <span className="font-semibold tabular-nums">{data.newCustomers}</span>
        </div>
        <div className="rounded-md border border-hair bg-paper px-4 py-3 text-sm">
          <span className="text-soft">Hoy por estado:</span>{" "}
          <span className="font-medium">
            {data.status.notConfirmed} {STATUS_LABELS.not_confirmed.toLowerCase()} · {data.status.rescheduled}{" "}
            {STATUS_LABELS.rescheduled.toLowerCase()}
          </span>
        </div>
        <div className="rounded-md border border-hair bg-paper px-4 py-3 text-sm">
          <span className="text-soft">Ticket promedio del mes:</span>{" "}
          <span className="font-semibold tabular-nums">
            {formatMoney(data.monthCount > 0 ? Math.round(data.monthRevenueCents / data.monthCount) : 0)}
          </span>
        </div>
      </div>
    </main>
  );
}
