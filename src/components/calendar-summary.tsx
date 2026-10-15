import Link from "next/link";
import type { Summary } from "@/domain/calendar-view";
import { filterForSummaryKey, type StatusFilter } from "@/domain/status-filter";
import { Icon, type IconName } from "@/components/icons";

type Card = {
  key: keyof Summary;
  label: string;
  plural: string;
  icon: IconName;
  bubble: string;
  number: string;
  alert?: string;
};

const CARDS: Card[] = [
  {
    key: "notConfirmed",
    label: "Por confirmar",
    plural: "Por confirmar",
    icon: "clock",
    bubble: "bg-warning-soft text-warning",
    number: "text-warning",
    alert: "border-warning/50 bg-warning-soft/40",
  },
  {
    key: "confirmed",
    label: "Confirmada",
    plural: "Confirmadas",
    icon: "check",
    bubble: "bg-success-soft text-success",
    number: "text-success",
  },
  {
    key: "rescheduled",
    label: "Reprogramada",
    plural: "Reprogramadas",
    icon: "refresh",
    bubble: "bg-info-soft text-info",
    number: "text-info",
  },
  {
    key: "completed",
    label: "Completada",
    plural: "Completadas",
    icon: "check",
    bubble: "bg-brand-soft text-brand-ink",
    number: "text-brand-ink",
  },
  {
    key: "overlaps",
    label: "Con conflicto",
    plural: "Con conflicto",
    icon: "alert",
    bubble: "bg-attention-soft text-attention",
    number: "text-attention",
    alert: "border-attention/50 bg-attention-soft/50",
  },
  {
    key: "cancelled",
    label: "Cancelada",
    plural: "Canceladas",
    icon: "close",
    bubble: "bg-neutral-soft text-muted",
    number: "text-soft",
  },
];

export function CalendarSummary({
  summary,
  showConflicts = true,
  hrefFor,
  activeFilter = null,
}: {
  summary: Summary;
  showConflicts?: boolean;
  hrefFor: (filter: StatusFilter | null) => string;
  activeFilter?: StatusFilter | null;
}) {
  const cards = CARDS.filter((card) => showConflicts || card.key !== "overlaps");

  return (
    <section aria-label="Resumen de citas" className="grid grid-cols-[repeat(auto-fit,minmax(7.75rem,1fr))] gap-2.5">
      <Link
        href={hrefFor(null)}
        scroll={false}
        aria-current={activeFilter === null ? "true" : undefined}
        title="Ver todas las citas"
        className={`flex min-w-0 flex-col gap-1.5 rounded-xl bg-rail px-3.5 py-3 text-white transition-all hover:-translate-y-0.5 hover:shadow-md ${
          activeFilter === null ? "ring-2 ring-brand ring-offset-2" : ""
        }`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Icon name="calendar" size={15} />
          </span>
          <span className="font-display text-2xl font-semibold leading-none tabular-nums">{summary.total}</span>
        </span>
        <span className="truncate text-xs font-medium text-rail-text">
          {summary.total === 1 ? "Cita activa" : "Citas activas"}
        </span>
      </Link>
      {cards.map((card) => {
        const value = summary[card.key];
        const active = value > 0;
        const filter = filterForSummaryKey(card.key);
        const selected = filter !== null && filter === activeFilter;
        return (
          <Link
            key={card.key}
            href={hrefFor(selected ? null : filter)}
            scroll={false}
            aria-current={selected ? "true" : undefined}
            title={selected ? "Quitar el filtro" : `Ver solo: ${card.plural.toLowerCase()}`}
            className={`flex min-w-0 flex-col gap-1.5 rounded-xl border px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${
              active && card.alert ? card.alert : "border-hair bg-paper"
            } ${active || selected ? "" : "opacity-60"} ${selected ? "ring-2 ring-brand ring-offset-2" : ""}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${card.bubble}`}>
                <Icon name={card.icon} size={15} />
              </span>
              <span
                className={`font-display text-2xl font-semibold leading-none tabular-nums ${active ? card.number : "text-muted"}`}
              >
                {value}
              </span>
            </span>
            <span className="truncate text-xs font-medium text-soft">{value === 1 ? card.label : card.plural}</span>
          </Link>
        );
      })}
    </section>
  );
}
