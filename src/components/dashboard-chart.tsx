import Link from "next/link";
import { WEEKDAY_SHORT, weekdayIndex } from "@/domain/calendar-view";
import { calendarHref } from "@/lib/calendar-links";

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const step = value <= 10 ? 2 : value <= 25 ? 5 : 10;
  return Math.ceil(value / step) * step;
}

export function AppointmentsChart({ daily, today }: { daily: { date: string; total: number }[]; today: string }) {
  const max = niceMax(Math.max(...daily.map((day) => day.total), 0));
  const ticks = [max, max / 2, 0];
  const past = daily.filter((day) => day.date < today);
  const average = past.length > 0 ? past.reduce((sum, day) => sum + day.total, 0) / past.length : 0;

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex">
        <div className="flex w-8 shrink-0 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted">
          {ticks.map((tick) => (
            <span key={tick} className="-translate-y-1/2 pr-2 leading-none">
              {tick}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map((tick) => (
              <span
                key={tick}
                className={`block border-t ${tick === 0 ? "border-hair" : "border-dashed border-hair/70"}`}
              />
            ))}
          </div>
          {average > 0 && (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dotted border-ink/40"
              style={{ bottom: `calc(1.5rem + (100% - 1.5rem) * ${average / max})` }}
            >
              <span className="absolute -top-4 right-0 rounded-[3px] bg-paper px-1 text-[10px] font-medium text-soft">
                Promedio {average.toFixed(1)}
              </span>
            </div>
          )}
          <ol className="relative flex h-56 items-end gap-[3px]">
            {daily.map((day) => {
              const isToday = day.date === today;
              const future = day.date > today;
              const height = max === 0 ? 0 : (day.total / max) * 100;
              const label = `${WEEKDAY_SHORT[weekdayIndex(day.date)]} ${Number(day.date.slice(8, 10))}`;
              return (
                <li key={day.date} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
                  <Link
                    href={calendarHref({ view: "day", date: day.date })}
                    aria-label={`${label}: ${day.total} ${day.total === 1 ? "cita" : "citas"}`}
                    className="relative flex h-[calc(100%-1.5rem)] items-end justify-center rounded-sm hover:bg-brand-soft/50"
                  >
                    <span
                      className={`block w-full max-w-7 rounded-t-[4px] transition-opacity group-hover:opacity-80 ${
                        isToday ? "bg-brand-ink" : future ? "bg-brand/35" : "bg-brand"
                      }`}
                      style={{ height: `${height}%`, minHeight: day.total > 0 ? 3 : 0 }}
                    />
                    <span className="pointer-events-none absolute bottom-full z-20 mb-1 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                      {label} · {day.total} {day.total === 1 ? "cita" : "citas"}
                    </span>
                  </Link>
                  <span
                    className={`mt-1.5 h-4 text-center text-[10px] leading-4 tabular-nums ${
                      isToday ? "font-bold text-brand-ink" : "text-muted"
                    }`}
                  >
                    {isToday ? "Hoy" : Number(day.date.slice(8, 10))}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-8 text-xs text-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-brand" /> Días pasados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-brand-ink" /> Hoy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-brand/35" /> Próximos días (ya agendadas)
        </span>
      </figcaption>
    </figure>
  );
}
