export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidPhone(value: string): boolean {
  const length = phoneDigits(value).length;
  return length >= 7 && length <= 15;
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function formatPhone(value: string): string {
  const digits = phoneDigits(value);
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return value.trim();
  const formatted = `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  return digits.length === 11 ? `+1 ${formatted}` : formatted;
}

export const AVATAR_TONES = 6;

export function avatarTone(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % AVATAR_TONES;
}
