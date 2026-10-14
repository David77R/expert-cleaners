import { formatMinutes } from "./appointment-rules";
import { formatDayLabel } from "./calendar-view";
import { formatMoney } from "./invoice";

export type OrderVisit = { date: string; startMin: number };

export function confirmationMessage(order: {
  customerName: string;
  code: string;
  pickup: OrderVisit;
  delivery?: OrderVisit | null;
  items: readonly { name: string; priceCents: number }[];
  totalCents: number;
}): string {
  const lines = [
    `Hola ${order.customerName.trim()}, le confirmamos su servicio con Expert Cleaners.`,
    "",
    `Recogida: ${formatDayLabel(order.pickup.date)}, ${formatMinutes(order.pickup.startMin)}`,
  ];
  if (order.delivery) {
    lines.push(`Entrega: ${formatDayLabel(order.delivery.date)}, ${formatMinutes(order.delivery.startMin)}`);
  }
  lines.push("", "Servicios:");
  for (const item of order.items) lines.push(`• ${item.name}: ${formatMoney(item.priceCents)}`);
  lines.push(
    `Total: ${formatMoney(order.totalCents)}`,
    "",
    `Código de su orden: ${order.code}`,
    "¡Gracias por elegirnos!",
  );
  return lines.join("\n");
}

export function whatsappHref(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const international = digits.length === 10 ? `1${digits}` : digits;
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
