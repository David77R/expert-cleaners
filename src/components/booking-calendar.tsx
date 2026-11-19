"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import type { BookingDay } from "@/components/booking-form";

const pad = (value: number) => String(value).padStart(2, "0");
const monthKey = (iso: string) => iso.slice(0, 7);

function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`;
}

export function BookingCalendar({
  days,
  selected,
  onSelect,
  locale,
  labels,
}: {
  days: BookingDay[];
  selected: string | null;
  onSelect: (date: string) => void;
  locale: string;
  labels: { previous: string; next: string; closed: string };
}) {
  const open = useMemo(() => new Map(days.map((day) => [day.date, day.open])), [days]);
  const firstOpen = days.find((day) => day.open)?.date ?? days[0]?.date ?? "";
  const firstMonth = monthKey(days[0]?.date ?? firstOpen);
  const lastMonth = monthKey(days.at(-1)?.date ?? firstOpen);
  const [month, setMonth] = useState(monthKey(selected ?? firstOpen));

  const format = useMemo(
    () => ({
      title: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }),
      long: new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
    }),
    [locale],
  );

  const [year, monthNumber] = month.split("-").map(Number);
  const offset = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    format.weekday.format(new Date(Date.UTC(2023, 0, 1 + index))),
  );
  const cells = Array.from({ length: length }, (_, index) => `${month}-${pad(index + 1)}`);

  return (
    <div className="rounded-xl border border-hair bg-paper p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          disabled={month <= firstMonth}
          aria-label={labels.previous}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-soft transition-colors hover:bg-brand-soft hover:text-brand disabled:pointer-events-none disabled:opacity-30"
        >
          <Icon name="left" size={18} />
        </button>
        <p className="font-display text-base font-semibold text-ink first-letter:uppercase" aria-live="polite">
          {format.title.format(new Date(Date.UTC(year, monthNumber - 1, 15)))}
        </p>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= lastMonth}
          aria-label={labels.next}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-soft transition-colors hover:bg-brand-soft hover:text-brand disabled:pointer-events-none disabled:opacity-30"
        >
          <Icon name="right" size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((weekday) => (
          <span key={weekday} className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {weekday.replace(".", "")}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={`empty-${index}`} aria-hidden="true" />
        ))}
        {cells.map((date) => {
          const available = open.get(date) === true;
          const isSelected = date === selected;
          const label = format.long.format(new Date(`${date}T12:00:00Z`));
          return (
            <button
              key={date}
              type="button"
              disabled={!available}
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={available ? label : `${label} · ${labels.closed}`}
              className={`relative flex h-11 items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:bg-transparent disabled:font-normal disabled:text-muted/50 sm:h-12 ${
                isSelected
                  ? "bg-brand text-white shadow-[0_8px_18px_-8px_color-mix(in_srgb,var(--brand)_80%,transparent)]"
                  : "text-ink hover:bg-brand-soft hover:text-brand"
              }`}
            >
              {Number(date.slice(8, 10))}
              {available && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-success" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
