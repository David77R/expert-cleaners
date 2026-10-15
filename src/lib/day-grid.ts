export const START_HOUR = 7;
export const END_HOUR = 20;
export const HOUR_PX = 88;

export function toPx(min: number, startHour: number = START_HOUR): number {
  return ((min - startHour * 60) / 60) * HOUR_PX;
}

export function gridHours(blocks: readonly { startMin: number; durationMin: number }[]): {
  startHour: number;
  endHour: number;
} {
  let earliest = START_HOUR * 60;
  let latest = END_HOUR * 60;
  for (const block of blocks) {
    earliest = Math.min(earliest, block.startMin);
    latest = Math.max(latest, block.startMin + Math.max(block.durationMin, 30));
  }
  return { startHour: Math.max(0, Math.floor(earliest / 60)), endHour: Math.min(24, Math.ceil(latest / 60)) };
}
