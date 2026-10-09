const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export const BUSINESS_TIMEZONE = "America/New_York";

export type Period = "day" | "week" | "month";

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isRealDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

export function enumerateDates(from: string, to: string): string[] {
  const total = daysBetween(from, to);
  return Array.from({ length: total + 1 }, (_, index) => addDays(from, index));
}

export function todayIn(timeZone: string = BUSINESS_TIMEZONE, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function periodBounds(period: Period, anchor: string): { from: string; to: string } {
  if (period === "day") return { from: anchor, to: anchor };
  if (period === "week") {
    const weekday = new Date(toUtc(anchor)).getUTCDay();
    const from = addDays(anchor, -weekday);
    return { from, to: addDays(from, 6) };
  }
  const [year, month] = [Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7))];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${anchor.slice(0, 8)}01`, to: `${anchor.slice(0, 8)}${String(lastDay).padStart(2, "0")}` };
}

export function minutesNowIn(timeZone: string = BUSINESS_TIMEZONE, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return Number(parts.hour) * 60 + Number(parts.minute);
}
