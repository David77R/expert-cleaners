import type { getDay } from "@/server/appointments";
import { formatMinutes } from "@/domain/appointment-rules";

type Day = Awaited<ReturnType<typeof getDay>>;
type Technician = Day["appointments"][number]["technician"];

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_PX = 64;

const STATUS_LABEL: Record<string, string> = {
  not_confirmed: "No confirmada",
  confirmed: "Confirmada",
  rescheduled: "Reprogramada",
  cancelled: "Cancelada",
  completed: "Completada",
};

export function DayGrid({ day, technicians }: { day: Day; technicians: Technician[] }) {
  const overlap = new Set(day.overlapIds);
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="overflow-x-auto rounded-xl border border-hair bg-white">
      <div
        className="grid min-w-[720px]"
        style={{ gridTemplateColumns: `64px repeat(${technicians.length}, minmax(0, 1fr))` }}
      >
        <div />
        {technicians.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 border-b border-l border-hair px-3 py-2 text-sm font-medium"
            style={{ borderBottomColor: t.color }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.name}
          </div>
        ))}

        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h) => (
            <div
              key={h}
              className="absolute right-2 -translate-y-2 text-xs text-ink/50"
              style={{ top: (h - START_HOUR) * HOUR_PX }}
            >
              {formatMinutes(h * 60)}
            </div>
          ))}
        </div>

        {technicians.map((t) => (
          <div key={t.id} className="relative border-l border-hair" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-hair/70"
                style={{ top: (h - START_HOUR) * HOUR_PX }}
              />
            ))}
            {day.appointments
              .filter((a) => a.technicianId === t.id)
              .map((a) => {
                const top = ((a.startMin - START_HOUR * 60) / 60) * HOUR_PX;
                const height = Math.max((a.durationMin / 60) * HOUR_PX, 28);
                const cancelled = a.status === "cancelled";
                return (
                  <article
                    key={a.id}
                    className="absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-2 py-1 text-xs"
                    style={{
                      top,
                      height,
                      borderLeftColor: t.color,
                      backgroundColor: `${t.color}1f`,
                      opacity: cancelled ? 0.5 : 1,
                      outline: overlap.has(a.id) ? "2px dashed #d63f63" : undefined,
                    }}
                  >
                    <div className="font-semibold">{a.code}</div>
                    <div className="truncate text-ink/70">
                      {a.service.name} · {formatMinutes(a.startMin)}
                    </div>
                    <div className="text-ink/60">{STATUS_LABEL[a.status]}</div>
                  </article>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
