import type { AppointmentStatus } from "@/db/schema";

export const CANCEL_REASONS = [
  "customer_cancelled",
  "customer_requested_other_date",
  "weather",
  "duplicate",
  "other",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  not_confirmed: ["confirmed", "rescheduled", "cancelled", "completed"],
  confirmed: ["rescheduled", "cancelled", "completed"],
  rescheduled: ["confirmed", "rescheduled", "cancelled", "completed"],
  completed: [],
  cancelled: [],
};

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError("invalid_transition", `No se puede pasar de ${from} a ${to}`);
  }
}

export type TimeBlock = {
  id: string;
  technicianId: string;
  date: string;
  startMin: number;
  durationMin: number;
  status: AppointmentStatus;
};

export function blocksOverlap(
  a: Pick<TimeBlock, "startMin" | "durationMin">,
  b: Pick<TimeBlock, "startMin" | "durationMin">,
): boolean {
  return a.startMin < b.startMin + b.durationMin && b.startMin < a.startMin + a.durationMin;
}

export function findConflicts(
  candidate: Omit<TimeBlock, "status"> & { status?: AppointmentStatus },
  existing: readonly TimeBlock[],
): TimeBlock[] {
  return existing.filter(
    (other) =>
      other.id !== candidate.id &&
      other.status !== "cancelled" &&
      other.technicianId === candidate.technicianId &&
      other.date === candidate.date &&
      blocksOverlap(candidate, other),
  );
}

export function resolveCancelReason(reason: CancelReason, explanation?: string): string {
  if (reason === "other") {
    const text = explanation?.trim();
    if (!text) throw new DomainError("explanation_required", "Explica el motivo de la cancelación");
    return `other: ${text}`;
  }
  return reason;
}

export function requireReason(reason: string | undefined, code: string, message: string): string {
  const text = reason?.trim();
  if (!text) throw new DomainError(code, message);
  return text;
}

export type FieldChange = { field: string; from: string | null; to: string | null };

export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  labels: Partial<Record<keyof T, string>>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const key of Object.keys(labels) as (keyof T)[]) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes.push({ field: labels[key] as string, from: stringify(a), to: stringify(b) });
    }
  }
  return changes;
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function formatMinutes(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
