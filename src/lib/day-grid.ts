export const START_HOUR = 7;
export const END_HOUR = 20;
export const HOUR_PX = 88;

export function toPx(min: number): number {
  return ((min - START_HOUR * 60) / 60) * HOUR_PX;
}
