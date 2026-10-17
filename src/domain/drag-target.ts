import type { AppointmentStatus } from "@/db/schema";

export const SNAP_MINUTES = 15;

export type LaneBox = { id: string; left: number; right: number };

export function isDraggable(status: AppointmentStatus): boolean {
  return status !== "cancelled";
}

export function snapMinutes(minutes: number, step: number = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

export function dropStartMinutes(options: {
  pointerOffsetPx: number;
  grabOffsetMin: number;
  durationMin: number;
  startHour: number;
  endHour: number;
  hourPx: number;
}): number {
  const { pointerOffsetPx, grabOffsetMin, durationMin, startHour, endHour, hourPx } = options;
  const raw = startHour * 60 + (pointerOffsetPx / hourPx) * 60 - grabOffsetMin;
  const earliest = startHour * 60;
  const latest = Math.max(earliest, endHour * 60 - Math.max(durationMin, SNAP_MINUTES));
  return Math.min(Math.max(snapMinutes(raw), earliest), latest);
}

export function laneAt(x: number, lanes: readonly LaneBox[]): string | null {
  if (lanes.length === 0) return null;
  const inside = lanes.find((lane) => x >= lane.left && x < lane.right);
  if (inside) return inside.id;
  const sorted = [...lanes].sort((a, b) => a.left - b.left);
  return x < sorted[0].left ? sorted[0].id : sorted[sorted.length - 1].id;
}

export function isSameSlot(
  from: { startMin: number; technicianId: string },
  to: { startMin: number; technicianId: string },
): boolean {
  return from.startMin === to.startMin && from.technicianId === to.technicianId;
}
