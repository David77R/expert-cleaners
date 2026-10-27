import type { Actor } from "@/db/schema";
import { phoneDigits } from "@/domain/customer-rules";

export type ContactChannel = "call" | "whatsapp";

export function canSeePhones(actor: Pick<Actor, "role">): boolean {
  return actor.role !== "technician";
}

export function maskPhone(phone: string): string {
  const digits = phoneDigits(phone);
  if (digits.length < 4) return "•••";
  return `(•••) •••-${digits.slice(-4)}`;
}

export function isMaskedPhone(phone: string): boolean {
  return phone.includes("•");
}

export function hidePhone<T extends { phone: string }>(actor: Pick<Actor, "role">, item: T): T {
  return canSeePhones(actor) ? item : { ...item, phone: maskPhone(item.phone) };
}

export function hideCustomerPhones<T extends { customer: { phone: string } }>(
  actor: Pick<Actor, "role">,
  items: readonly T[],
): T[] {
  if (canSeePhones(actor)) return [...items];
  return items.map((item) => ({ ...item, customer: { ...item.customer, phone: maskPhone(item.customer.phone) } }));
}

export function contactHref(phone: string, channel: ContactChannel, text?: string): string {
  const digits = phoneDigits(phone);
  const international = digits.length === 10 ? `1${digits}` : digits;
  if (channel === "call") return `tel:+${international}`;
  return `https://wa.me/${international}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
