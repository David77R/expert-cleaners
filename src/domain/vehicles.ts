import { z } from "zod";

export const VEHICLE_SIZES = ["sedan", "suv", "pickup", "van", "other"] as const;
export type VehicleSize = (typeof VEHICLE_SIZES)[number];
export type SizePrices = Partial<Record<VehicleSize, number>>;

export const VEHICLE_SIZE_LABELS: Record<VehicleSize, string> = {
  sedan: "Sedán / coupé",
  suv: "SUV",
  pickup: "Pickup",
  van: "Van / minivan",
  other: "Otro",
};

export type VehicleLike = {
  make: string;
  model: string;
  year: number | null;
  color: string;
  plate: string;
  size: string;
};

export function isVehicleSize(value: string): value is VehicleSize {
  return (VEHICLE_SIZES as readonly string[]).includes(value);
}

export function sizeLabel(size: string): string {
  return isVehicleSize(size) ? VEHICLE_SIZE_LABELS[size] : VEHICLE_SIZE_LABELS.other;
}

export function vehicleName(vehicle: VehicleLike): string {
  const name = [vehicle.make, vehicle.model, vehicle.year ? String(vehicle.year) : ""].filter(Boolean).join(" ");
  return name || sizeLabel(vehicle.size);
}

export function vehicleSummary(vehicle: VehicleLike): string {
  return [vehicleName(vehicle), vehicle.color, vehicle.plate ? `Placa ${vehicle.plate}` : "", sizeLabel(vehicle.size)]
    .filter((part, index, all) => part && all.indexOf(part) === index)
    .join(" · ");
}

export function priceForSize(
  service: { basePriceCents: number; sizePrices?: SizePrices | null },
  size?: string | null,
) {
  if (!size || !isVehicleSize(size)) return service.basePriceCents;
  return service.sizePrices?.[size] ?? service.basePriceCents;
}

const optionalText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`).default("");

export const vehicleSchema = z.object({
  make: optionalText(40),
  model: optionalText(40),
  year: z
    .union([z.number(), z.string()])
    .transform((value, ctx) => {
      if (value === "" || value === null) return null;
      const year = Number(value);
      if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
        ctx.addIssue({ code: "custom", message: "Año no válido" });
        return z.NEVER;
      }
      return year;
    })
    .nullable()
    .default(null),
  color: optionalText(30),
  plate: z
    .string()
    .trim()
    .max(12, "Máximo 12 caracteres")
    .transform((value) => value.toUpperCase())
    .default(""),
  size: z.enum(VEHICLE_SIZES, "Elige el tipo de vehículo").default("sedan"),
  notes: optionalText(300),
});

export type VehicleInput = z.input<typeof vehicleSchema>;

export const sizePricesValue = z.partialRecord(z.enum(VEHICLE_SIZES), z.number().int().min(0).max(10_000_000));

export const sizePricesSchema = sizePricesValue.default({});
