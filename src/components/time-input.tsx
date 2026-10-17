"use client";

import { useState } from "react";

type Parts = { hour: string; minute: string; period: "AM" | "PM" };

const HOURS = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

export function toParts(value: string): Parts {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hour: "", minute: "", period: "AM" };
  const hours = Number(match[1]);
  return {
    hour: String(hours % 12 === 0 ? 12 : hours % 12),
    minute: match[2],
    period: hours >= 12 ? "PM" : "AM",
  };
}

export function fromParts(parts: Parts): string {
  if (!parts.hour) return "";
  const hour12 = Number(parts.hour) % 12;
  const hours = parts.period === "PM" ? hour12 + 12 : hour12;
  return `${String(hours).padStart(2, "0")}:${parts.minute || "00"}`;
}

export function TimeInput({
  name,
  value,
  defaultValue = "",
  onChange,
  id,
  required,
  className = "",
  ...aria
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  id?: string;
  required?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const [periodHint, setPeriodHint] = useState<Parts["period"]>("AM");
  const current = value ?? own;
  const parsed = toParts(current);
  const parts = parsed.hour ? parsed : { ...parsed, period: periodHint };
  const minutes = parts.minute && !MINUTES.includes(parts.minute) ? [...MINUTES, parts.minute].sort() : MINUTES;

  function update(patch: Partial<Parts>) {
    if (patch.period) setPeriodHint(patch.period);
    const merged = { ...parts, ...patch };
    const next = merged.hour ? fromParts(merged) : "";
    if (next === current) return;
    if (value === undefined) setOwn(next);
    onChange?.(next);
  }

  const select =
    "h-full min-h-10 appearance-none bg-transparent px-1 text-center tabular-nums focus:outline-none focus-visible:rounded focus-visible:bg-brand-soft sm:px-1.5";

  return (
    <div
      className={`${className} flex min-w-0 items-stretch gap-0.5 !py-0 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 sm:gap-1`}
      aria-invalid={aria["aria-invalid"]}
    >
      {name && <input type="hidden" name={name} value={current} />}
      <select
        id={id}
        value={parts.hour}
        required={required}
        onChange={(event) => update({ hour: event.target.value })}
        aria-label={id ? undefined : (aria["aria-label"] ?? "Hora")}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
        className={`${select} min-w-[2.25rem] sm:min-w-[2.75rem]`}
      >
        <option value="">--</option>
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span className="self-center font-semibold text-muted">:</span>
      <select
        value={parts.minute}
        onChange={(event) => update({ minute: event.target.value, hour: parts.hour || "12" })}
        aria-label="Minutos"
        className={`${select} min-w-[2.25rem] sm:min-w-[2.75rem]`}
      >
        <option value="">--</option>
        {minutes.map((minute) => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => update({ period: parts.period === "AM" ? "PM" : "AM" })}
        aria-label={`${parts.period}: toca para cambiar a ${parts.period === "AM" ? "PM" : "AM"}`}
        className="my-1 ml-auto shrink-0 rounded bg-brand px-2 text-xs font-bold text-white sm:hidden"
      >
        {parts.period}
      </button>
      <div role="group" aria-label="AM o PM" className="ml-auto hidden items-center gap-0.5 py-1 sm:flex">
        {(["AM", "PM"] as const).map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={parts.period === period}
            onClick={() => update({ period })}
            className={`rounded px-2 py-1 text-xs font-bold transition-colors ${
              parts.period === period ? "bg-brand text-white" : "text-soft hover:bg-brand-soft hover:text-brand-ink"
            }`}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  );
}
