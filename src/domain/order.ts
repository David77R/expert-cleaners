import { formatMinutes } from "./appointment-rules";
import { formatDayLabel } from "./calendar-view";
import { formatMoney } from "./invoice";

export type OrderVisit = { date: string; startMin: number };

export function groupOrderItems(items: readonly { name: string; priceCents: number }[]) {
  const groups = new Map<string, { name: string; prices: number[] }>();
  for (const item of items) {
    const group = groups.get(item.name) ?? { name: item.name, prices: [] };
    group.prices.push(item.priceCents);
    groups.set(item.name, group);
  }
  return [...groups.values()].map((group) => {
    const totalCents = group.prices.reduce((sum, price) => sum + price, 0);
    const uniform = group.prices.every((price) => price === group.prices[0]);
    return {
      name: group.name,
      count: group.prices.length,
      totalCents,
      unitCents: uniform ? group.prices[0] : Math.round(totalCents / group.prices.length),
      exactUnit: uniform,
    };
  });
}

export function confirmationMessage(order: {
  companyName: string;
  customerName: string;
  code: string;
  pickup: OrderVisit;
  delivery?: OrderVisit | null;
  kind?: "pickup" | "visit";
  items: readonly { name: string; priceCents: number }[];
  totalCents: number;
}): string {
  const lines = [
    `Hola ${order.customerName.trim()}, le confirmamos su servicio con ${order.companyName}.`,
    "",
    `${order.kind === "visit" ? "Cita" : "Recogida"}: ${formatDayLabel(order.pickup.date)}, ${formatMinutes(order.pickup.startMin)}`,
  ];
  if (order.delivery) {
    lines.push(`Entrega: ${formatDayLabel(order.delivery.date)}, ${formatMinutes(order.delivery.startMin)}`);
  }
  lines.push("", "Servicios:");
  for (const group of groupOrderItems(order.items)) {
    lines.push(
      group.count === 1
        ? `• ${group.name}: ${formatMoney(group.totalCents)}`
        : `• ${group.name} x${group.count}: ${formatMoney(group.totalCents)} (${group.exactUnit ? "" : "≈ "}${formatMoney(group.unitCents)} c/u)`,
    );
  }
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
