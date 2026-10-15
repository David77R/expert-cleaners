export function spreadPositions(stops: readonly { id: string; lat: number; lng: number }[]) {
  const seen = new Map<string, number>();
  const positions = new Map<string, [number, number]>();
  for (const stop of stops) {
    const key = `${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) {
      positions.set(stop.id, [stop.lat, stop.lng]);
      continue;
    }
    const angle = (count - 1) * (Math.PI / 3);
    const ring = 0.00018 * (1 + Math.floor((count - 1) / 6));
    positions.set(stop.id, [stop.lat + ring * Math.sin(angle), stop.lng + ring * Math.cos(angle)]);
  }
  return positions;
}
