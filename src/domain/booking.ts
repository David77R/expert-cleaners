import { blocksOverlap } from "./appointment-rules";
import { addDays } from "./date-rules";
import { weekdayIndex } from "./calendar-view";

export type BookingTechnician = {
  id: string;
  active: boolean;
  workDays: readonly number[];
  shiftStartMin: number;
  shiftEndMin: number;
};

export type BusyBlock = { technicianId: string; startMin: number; durationMin: number };

export type Slot = { startMin: number; technicianIds: string[] };

export type BookingWindow = { firstDate: string; earliestMin: number; lastDate: string };

export function bookingWindow(
  today: string,
  nowMin: number,
  minNoticeHours: number,
  maxDaysAhead: number,
): BookingWindow {
  const earliest = nowMin + minNoticeHours * 60;
  return {
    firstDate: addDays(today, Math.floor(earliest / 1440)),
    earliestMin: earliest % 1440,
    lastDate: addDays(today, maxDaysAhead),
  };
}

export function isBookableDate(date: string, window: BookingWindow): boolean {
  return date >= window.firstDate && date <= window.lastDate;
}

export function freeTechnicians(
  date: string,
  startMin: number,
  durationMin: number,
  technicians: readonly BookingTechnician[],
  busy: readonly BusyBlock[],
): string[] {
  const weekday = weekdayIndex(date);
  const span = { startMin, durationMin: Math.max(durationMin, 1) };
  const load = new Map<string, number>();
  for (const block of busy) load.set(block.technicianId, (load.get(block.technicianId) ?? 0) + block.durationMin);
  return technicians
    .filter(
      (technician) =>
        technician.active &&
        technician.workDays.includes(weekday) &&
        technician.shiftStartMin <= startMin &&
        startMin + durationMin <= technician.shiftEndMin &&
        !busy.some((block) => block.technicianId === technician.id && blocksOverlap(block, span)),
    )
    .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0))
    .map((technician) => technician.id);
}

export function availableSlots(options: {
  date: string;
  hours: readonly [number, number] | null;
  stepMin: number;
  durationMin: number;
  technicians: readonly BookingTechnician[];
  busy: readonly BusyBlock[];
  window: BookingWindow;
}): Slot[] {
  const { date, hours, stepMin, durationMin, technicians, busy, window } = options;
  if (!hours || !isBookableDate(date, window)) return [];
  const [open, close] = hours;
  const slots: Slot[] = [];
  for (let start = open; start + durationMin <= close; start += stepMin) {
    if (date === window.firstDate && start < window.earliestMin) continue;
    const free = freeTechnicians(date, start, durationMin, technicians, busy);
    if (free.length > 0) slots.push({ startMin: start, technicianIds: free });
  }
  return slots;
}
