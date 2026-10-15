"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { MONTHS, WEEKDAY_NARROW, weekdayIndex, type CalendarView } from "@/domain/calendar-view";
import { addDays } from "@/domain/date-rules";
import { calendarHref } from "@/lib/calendar-links";

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function shiftMonth(start: string, delta: number): string {
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7)) - 1 + delta;
  const shifted = new Date(Date.UTC(year, month, 1));
  return shifted.toISOString().slice(0, 10);
}

export function monthGrid(start: string): string[] {
  const first = addDays(start, -weekdayIndex(start));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

export function DatePicker({
  date,
  today,
  hrefFor,
  align = "left",
}: {
  date: string;
  today: string;
  hrefFor: (date: string) => string;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(monthStart(date));

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) setShown(monthStart(date));
    setOpen(!open);
  }

  function pick(value: string) {
    setOpen(false);
    router.push(hrefFor(value));
  }

  const days = monthGrid(shown);
  const month = Number(shown.slice(5, 7));
  const year = shown.slice(0, 4);

  return (
    <div ref={box} className="relative flex">
      <button
        type="button"
        onClick={toggle}
        aria-label="Elegir un día en el calendario"
        aria-expanded={open}
        title="Elegir un día"
        className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
          open
            ? "border-brand bg-brand text-white"
            : "border-hair bg-paper text-soft hover:border-brand/50 hover:bg-brand-soft hover:text-brand-ink"
        }`}
      >
        <Icon name="calendar" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Elegir día"
          className={`absolute top-12 z-40 w-[18.5rem] ${align === "right" ? "right-0" : "left-0"} overflow-hidden rounded-xl border border-hair bg-paper shadow-xl`}
        >
          <div className="flex items-center justify-between bg-brand px-3 py-2.5 text-white">
            <button
              type="button"
              onClick={() => setShown(shiftMonth(shown, -1))}
              aria-label="Mes anterior"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
            >
              <Icon name="left" size={16} />
            </button>
            <span className="font-display text-base font-semibold capitalize">
              {MONTHS[month - 1]} {year}
            </span>
            <button
              type="button"
              onClick={() => setShown(shiftMonth(shown, 1))}
              aria-label="Mes siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
            >
              <Icon name="right" size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-3 pb-1 pt-3 text-center">
            {WEEKDAY_NARROW.map((label, index) => (
              <span key={index} className="text-[11px] font-semibold uppercase text-muted">
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-3 pb-3">
            {days.map((day) => {
              const inMonth = Number(day.slice(5, 7)) === month;
              const selected = day === date;
              const isToday = day === today;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  aria-label={day}
                  aria-current={selected ? "date" : undefined}
                  className={`relative flex h-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
                    selected
                      ? "bg-brand font-semibold text-white"
                      : isToday
                        ? "font-semibold text-brand-ink ring-1 ring-inset ring-brand hover:bg-brand-soft"
                        : inMonth
                          ? "text-ink hover:bg-brand-soft"
                          : "text-muted/60 hover:bg-canvas"
                  }`}
                >
                  {Number(day.slice(8, 10))}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-hair bg-canvas/60 px-3 py-2">
            <button
              type="button"
              onClick={() => pick(today)}
              className="rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand hover:text-white"
            >
              Ir a hoy
            </button>
            <button
              type="button"
              onClick={() => pick(addDays(today, 1))}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-soft hover:bg-paper hover:text-ink"
            >
              Mañana
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DateJump({
  view,
  date,
  today,
  tech,
  mapa,
  entregas,
}: {
  view: CalendarView;
  date: string;
  today: string;
  tech: string | null;
  mapa: boolean;
  entregas: boolean;
}) {
  return (
    <DatePicker
      date={date}
      today={today}
      hrefFor={(value) => calendarHref({ view, date: value, tech, mapa, entregas })}
    />
  );
}

export function AlertsDatePicker({ date, today }: { date: string; today: string }) {
  return <DatePicker date={date} today={today} align="right" hrefFor={(value) => `/alerts?date=${value}`} />;
}
