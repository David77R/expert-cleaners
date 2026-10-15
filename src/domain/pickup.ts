import { slugify } from "./service-rules";

const PICKUP_WORDS = new Set(["rug", "rugs", "alfombra", "alfombras", "tapete", "tapetes", "carpet", "carpets"]);

type ServiceLike = { name: string; slug?: string | null; category?: string | null };

export function isPickupService(service: ServiceLike): boolean {
  const words = [service.name, service.slug ?? "", service.category ?? ""]
    .map((value) => slugify(value))
    .join("-")
    .split("-");
  return words.some((word) => PICKUP_WORDS.has(word));
}

export function needsPickup(services: readonly (ServiceLike | null | undefined)[]): boolean {
  return services.some((service) => Boolean(service && isPickupService(service)));
}

export function appointmentNeedsPickup(appointment: {
  service: ServiceLike;
  items?: readonly { service: ServiceLike }[];
}): boolean {
  const items = appointment.items ?? [];
  return items.length > 0 ? needsPickup(items.map((item) => item.service)) : isPickupService(appointment.service);
}
