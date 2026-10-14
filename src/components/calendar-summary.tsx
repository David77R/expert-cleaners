import type { Summary } from "@/domain/calendar-view";
import { Icon } from "@/components/icons";

const SEGMENTS: { key: keyof Summary; label: string; plural: string; bar: string; text: string }[] = [
  { key: "notConfirmed", label: "por confirmar", plural: "por confirmar", bar: "bg-warning", text: "text-warning" },
  { key: "confirmed", label: "confirmada", plural: "confirmadas", bar: "bg-success", text: "text-success" },
  { key: "rescheduled", label: "reprogramada", plural: "reprogramadas", bar: "bg-info", text: "text-info" },
  { key: "completed", label: "completada", plural: "completadas", bar: "bg-brand", text: "text-brand-ink" },
];

export function CalendarSummary({ summary }: { summary: Summary }) {
  const visible = SEGMENTS.filter((segment) => summary[segment.key] > 0);

  return (
    <section aria-label="Resumen de citas" className="flex flex-col gap-3 border-y border-hair py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold tabular-nums">{summary.total}</span>
          <span className="text-sm text-soft">{summary.total === 1 ? "cita" : "citas"}</span>
          {summary.cancelled > 0 && (
            <span className="text-sm text-muted">
              · {summary.cancelled} {summary.cancelled === 1 ? "cancelada" : "canceladas"}
            </span>
          )}
        </p>
        {summary.overlaps > 0 && (
          <p className="flex items-center gap-1.5 rounded-[3px] bg-attention-soft px-2.5 py-1 text-sm font-medium text-attention">
            <Icon name="alert" size={15} />
            {summary.overlaps} {summary.overlaps === 1 ? "cita con solape" : "citas con solape"}
          </p>
        )}
      </div>

      <div
        role="img"
        aria-label={visible.map((s) => `${summary[s.key]} ${s.plural}`).join(", ") || "Sin citas"}
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-[3px] bg-neutral-soft"
      >
        {visible.map((segment) => (
          <span key={segment.key} className={segment.bar} style={{ flexGrow: summary[segment.key], flexBasis: 0 }} />
        ))}
      </div>

      {visible.length > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {visible.map((segment) => (
            <li key={segment.key} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-[2px] ${segment.bar}`} />
              <span className={`font-semibold tabular-nums ${segment.text}`}>{summary[segment.key]}</span>
              <span className="text-soft">{summary[segment.key] === 1 ? segment.label : segment.plural}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
