import { describe, expect, it } from "vitest";
import { CLIENTS, clientIdFrom } from "@/config/clients";
import { isPickupService } from "@/domain/pickup";

describe("configuración por cliente", () => {
  it("elige el cliente por la variable y usa Expert Cleaners si no existe", () => {
    expect(clientIdFrom("rva")).toBe("rva");
    expect(clientIdFrom("otro")).toBe("expert-cleaners");
    expect(clientIdFrom(undefined)).toBe("expert-cleaners");
  });

  it("RVA trabaja en Orlando sin recogida de alfombras y con vehículos y reservas", () => {
    expect(CLIENTS.rva.location.city).toBe("Orlando");
    expect(CLIENTS.rva.features).toEqual({ rugPickup: false, vehicles: true, publicBooking: true });
  });

  it("sin la función de alfombras ningún servicio pide recogida", () => {
    expect(isPickupService({ name: "Limpieza de alfombras" }, true)).toBe(true);
    expect(isPickupService({ name: "Limpieza de alfombras" }, false)).toBe(false);
  });
});
