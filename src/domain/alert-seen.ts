export const SEEN_COOKIE = "ec_alertas_vistas";
const LIMIT = 150;

type SeenItem = { type: string; appointmentIds: readonly string[] };

export function alertKeys(items: readonly SeenItem[]): string[] {
  return items.flatMap((item) => item.appointmentIds.map((id) => `${item.type.slice(0, 2)}${id.slice(0, 8)}`));
}

export function parseSeen(raw: string | undefined | null): Set<string> {
  return new Set((raw ?? "").split(".").filter((key) => /^[a-z_]{2}[0-9a-f-]{1,8}$/.test(key)));
}

export function unseenCount(items: readonly SeenItem[], raw: string | undefined | null): number {
  const seen = parseSeen(raw);
  return items.filter((item) => alertKeys([item]).some((key) => !seen.has(key))).length;
}

export function mergeSeen(raw: string | undefined | null, keys: readonly string[]): string {
  const merged = [...parseSeen(raw)].filter((key) => !keys.includes(key));
  return [...merged, ...keys].slice(-LIMIT).join(".");
}
