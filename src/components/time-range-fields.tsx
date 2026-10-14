"use client";

import { useId, useState } from "react";
import { minutesToTimeInput, parseTimeInput } from "@/domain/appointment-panel";
import { formatMinutes } from "@/domain/appointment-rules";

const MAX_DURATION = 720;

export function endTimeFor(start: string, duration: string): string {
  const startMin = parseTimeInput(start);
  const minutes = Number(duration);
  if (startMin === null || duration.trim() === "" || !Number.isInteger(minutes) || minutes < 0) return "";
  const end = startMin + minutes;
  return end < 24 * 60 ? minutesToTimeInput(end) : "";
}

export function durationBetween(start: string, end: string): number | null {
  const startMin = parseTimeInput(start);
  const endMin = parseTimeInput(end);
  if (startMin === null || endMin === null || endMin < startMin) return null;
  return endMin - startMin;
}

export function describeDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function TimeRange({
  start,
  duration,
  onStart,
  onDuration,
  startError,
  durationError,
  inputClassName,
  labelClassName,
  startName = "time",
  durationName = "durationMin",
}: {
  start: string;
  duration: string;
  onStart: (value: string) => void;
  onDuration: (value: string) => void;
  startError?: string;
  durationError?: string;
  inputClassName: string;
  labelClassName: string;
  startName?: string;
  durationName?: string;
}) {
  const id = useId();
  const [endError, setEndError] = useState<string | null>(null);
  const end = endTimeFor(start, duration);
  const minutes = Number(duration);
  const error = endError ?? durationError;

  function changeEnd(value: string) {
    if (value === "") return;
    if (parseTimeInput(start) === null) {
      setEndError("Primero elige la hora de inicio.");
      return;
    }
    const between = durationBetween(start, value);
    if (between === null) {
      setEndError("La hora de salida debe ser después de la de inicio.");
      return;
    }
    if (between > MAX_DURATION) {
      setEndError("La cita no puede durar más de 12 horas.");
      return;
    }
    setEndError(null);
    onDuration(String(between));
  }

  return (
    <>
      <input type="hidden" name={durationName} value={duration} />
      <div className={labelClassName}>
        <label htmlFor={`${id}-start`}>Hora de inicio</label>
        <input
          id={`${id}-start`}
          name={startName}
          type="time"
          value={start}
          onChange={(event) => {
            setEndError(null);
            onStart(event.target.value);
          }}
          required
          aria-invalid={Boolean(startError)}
          className={inputClassName}
        />
        {startError && (
          <p role="alert" className="text-sm font-normal text-attention">
            {startError}
          </p>
        )}
      </div>
      <div className={labelClassName}>
        <label htmlFor={`${id}-end`}>Hora de salida</label>
        <input
          id={`${id}-end`}
          type="time"
          value={end}
          onChange={(event) => changeEnd(event.target.value)}
          aria-invalid={Boolean(error)}
          className={inputClassName}
        />
        {error ? (
          <p role="alert" className="text-sm font-normal text-attention">
            {error}
          </p>
        ) : (
          duration.trim() !== "" &&
          Number.isInteger(minutes) &&
          end !== "" && (
            <p className="text-xs font-normal text-soft">
              Dura {describeDuration(minutes)} · de {formatMinutes(parseTimeInput(start) ?? 0)} a{" "}
              {formatMinutes((parseTimeInput(start) ?? 0) + minutes)}
            </p>
          )
        )}
      </div>
    </>
  );
}

export function TimeRangeField({
  defaultStart,
  defaultDuration,
  inputClassName,
  labelClassName,
}: {
  defaultStart: string;
  defaultDuration: number;
  inputClassName: string;
  labelClassName: string;
}) {
  const [start, setStart] = useState(defaultStart);
  const [duration, setDuration] = useState(String(defaultDuration));
  return (
    <TimeRange
      start={start}
      duration={duration}
      onStart={setStart}
      onDuration={setDuration}
      inputClassName={inputClassName}
      labelClassName={labelClassName}
    />
  );
}
