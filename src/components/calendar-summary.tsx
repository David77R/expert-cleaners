import type { Summary } from "@/domain/calendar-view";
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

export function CalendarSummary({ summary, showConflicts = true }: { summary: Summary; showConflicts?: boolean }) {
  const cards = CARDS.filter((card) => showConflicts || card.key !== "overlaps");

  return (
    <section aria-label="Resumen de citas" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
      <div className="flex items-center gap-3 rounded-xl bg-rail px-4 py-3 text-white">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Icon name="calendar" size={18} />
        </span>
        <span className="leading-tight">
          <span className="font-display block text-2xl font-semibold tabular-nums">{summary.total}</span>
          <span className="block text-xs text-rail-text">{summary.total === 1 ? "Cita activa" : "Citas activas"}</span>
        </span>
      </div>
      {cards.map((card) => {
        const value = summary[card.key];
        const active = value > 0;
        return (
          <div
            key={card.key}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
              active && card.alert ? card.alert : "border-hair bg-paper"
            } ${active ? "" : "opacity-60"}`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${card.bubble}`}>
              <Icon name={card.icon} size={18} />
            </span>
            <span className="leading-tight">
              <span
                className={`font-display block text-2xl font-semibold tabular-nums ${active ? card.number : "text-muted"}`}
              >
                {value}
              </span>
              <span className="block text-xs text-soft">{value === 1 ? card.label : card.plural}</span>
            </span>
          </div>
        );
      })}
    </section>
  );
}
