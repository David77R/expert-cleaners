import type { AppointmentStatus } from "@/db/schema";
import { addDays, periodBounds, type Period } from "./date-rules";

export const CALENDAR_VIEWS = ["day", "week", "month"] as const;
export type CalendarView = Period;

export const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
export const WEEKDAY_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
export const WEEKDAY_NARROW = ["D", "L", "M", "M", "J", "V", "S"] as const;

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

function parts(date: string) {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function parseView(value: unknown): CalendarView {
  return (CALENDAR_VIEWS as readonly unknown[]).includes(value) ? (value as CalendarView) : "day";
}

export function weekdayIndex(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function viewRange(view: CalendarView, anchor: string): { from: string; to: string } {
  if (view !== "month") return periodBounds(view, anchor);
  const month = periodBounds("month", anchor);
  return { from: periodBounds("week", month.from).from, to: periodBounds("week", month.to).to };
}

export function monthWeeks(anchor: string): string[][] {
  const { from, to } = viewRange("month", anchor);
  const weeks: string[][] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
  }
  return weeks;
}

export function weekDates(anchor: string): string[] {
  const { from } = periodBounds("week", anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(from, index));
}

export function isInSameMonth(date: string, anchor: string): boolean {
  return date.slice(0, 7) === anchor.slice(0, 7);
}

export function shiftAnchor(view: CalendarView, anchor: string, step: -1 | 1): string {
  if (view === "day") return addDays(anchor, step);
  if (view === "week") return addDays(anchor, step * 7);
  const { year, month, day } = parts(anchor);
  const target = new Date(Date.UTC(year, month - 1 + step, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function formatDayLabel(date: string): string {
  const { month, day } = parts(date);
  return `${WEEKDAY_SHORT[weekdayIndex(date)]} ${day} ${MONTHS[month - 1].slice(0, 3)}`;
}

export function viewTitle(view: CalendarView, anchor: string): string {
  const { year, month, day } = parts(anchor);
  if (view === "day") return `${WEEKDAY_SHORT[weekdayIndex(anchor)]} ${day} de ${MONTHS[month - 1]} de ${year}`;
  if (view === "month") return capitalize(`${MONTHS[month - 1]} de ${year}`);

  const { from, to } = periodBounds("week", anchor);
  const start = parts(from);
  const end = parts(to);
  if (start.month === end.month) return `${start.day} – ${end.day} de ${MONTHS[end.month - 1]} de ${end.year}`;
  const startLabel = `${start.day} ${MONTHS[start.month - 1].slice(0, 3)}${start.year === end.year ? "" : ` ${start.year}`}`;
  return `${startLabel} – ${end.day} ${MONTHS[end.month - 1].slice(0, 3)} ${end.year}`;
}

export type Summary = {
  total: number;
  notConfirmed: number;
  confirmed: number;
  rescheduled: number;
  completed: number;
  cancelled: number;
  overlaps: number;
};

export function summarize(
  appointments: ReadonlyArray<{ id: string; status: AppointmentStatus }>,
  overlapIds: ReadonlyArray<string>,
): Summary {
  const summary: Summary = {
    total: 0,
    notConfirmed: 0,
    confirmed: 0,
    rescheduled: 0,
    completed: 0,
    cancelled: 0,
    overlaps: overlapIds.length,
  };
  for (const appointment of appointments) {
    if (appointment.status === "cancelled") {
      summary.cancelled += 1;
      continue;
    }
    summary.total += 1;
    if (appointment.status === "not_confirmed") summary.notConfirmed += 1;
    else if (appointment.status === "confirmed") summary.confirmed += 1;
    else if (appointment.status === "rescheduled") summary.rescheduled += 1;
    else summary.completed += 1;
  }
  return summary;
}

export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase());
  return letters.join("") || "?";
}

export type Slot = { id: string; startMin: number; durationMin: number };
export type SlotLayout = { column: number; columns: number };

const MIN_VISUAL_MIN = 30;

export function layoutSlots(slots: ReadonlyArray<Slot>): Map<string, SlotLayout> {
  const sorted = [...slots].sort((a, b) => a.startMin - b.startMin || a.id.localeCompare(b.id));
  const result = new Map<string, SlotLayout>();

  let cluster: { id: string; column: number }[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const item of cluster) result.set(item.id, { column: item.column, columns: columnEnds.length });
    cluster = [];
    columnEnds = [];
  };

  for (const slot of sorted) {
    const end = slot.startMin + Math.max(slot.durationMin, MIN_VISUAL_MIN);
    if (slot.startMin >= clusterEnd) flush();
    let column = columnEnds.findIndex((columnEnd) => columnEnd <= slot.startMin);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = end;
    cluster.push({ id: slot.id, column });
    clusterEnd = cluster.length === 1 ? end : Math.max(clusterEnd, end);
  }
  flush();
  return result;
}

export function viewHeading(view: CalendarView, anchor: string): { primary: string; secondary: string } {
  const { year, month, day } = parts(anchor);
  if (view === "day") {
    return { primary: `${WEEKDAY_LONG[weekdayIndex(anchor)]} ${day}`, secondary: `${MONTHS[month - 1]} de ${year}` };
  }
  if (view === "month") return { primary: capitalize(MONTHS[month - 1]), secondary: String(year) };

  const { from, to } = periodBounds("week", anchor);
  const start = parts(from);
  const end = parts(to);
  const primary =
    start.month === end.month
      ? `${start.day} – ${end.day} ${MONTHS[end.month - 1]}`
      : `${start.day} ${MONTHS[start.month - 1].slice(0, 3)} – ${end.day} ${MONTHS[end.month - 1].slice(0, 3)}`;
  return { primary, secondary: start.year === end.year ? String(end.year) : `${start.year} – ${end.year}` };
}

function clock(min: number): { text: string; suffix: "AM" | "PM" } {
  const hours24 = Math.floor(min / 60) % 24;
  const minutes = min % 60;
  return {
    text: `${hours24 % 12 === 0 ? 12 : hours24 % 12}:${String(minutes).padStart(2, "0")}`,
    suffix: hours24 >= 12 ? "PM" : "AM",
  };
}

export function formatRange(startMin: number, durationMin: number): string {
  const start = clock(startMin);
  const end = clock(startMin + durationMin);
  return start.suffix === end.suffix
    ? `${start.text}–${end.text} ${end.suffix}`
    : `${start.text} ${start.suffix}–${end.text} ${end.suffix}`;
}

export function formatTime(min: number): string {
  const { text, suffix } = clock(min);
  return `${text} ${suffix}`;
}

export type ShiftInfo = { shiftStartMin: number; shiftEndMin: number; workDays: number[] };

export function offShiftRanges(
  shift: ShiftInfo,
  date: string,
  fromMin: number,
  toMin: number,
): Array<[number, number]> {
  if (!shift.workDays.includes(weekdayIndex(date))) return [[fromMin, toMin]];
  const ranges: Array<[number, number]> = [];
  if (shift.shiftStartMin > fromMin) ranges.push([fromMin, Math.min(shift.shiftStartMin, toMin)]);
  if (shift.shiftEndMin < toMin) ranges.push([Math.max(shift.shiftEndMin, fromMin), toMin]);
  return ranges.filter(([start, end]) => end > start);
}

export function readableOn(hex: string): "#12181f" | "#ffffff" {
  const value = hex.replace("#", "");
  const channel = (offset: number) => {
    const c = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.3 ? "#12181f" : "#ffffff";
}
