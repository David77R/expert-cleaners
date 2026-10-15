import { describe, expect, it } from "vitest";
import { appointmentNeedsPickup, isPickupService, needsPickup } from "@/domain/pickup";

describe("servicios con recogida y entrega", () => {
  it("solo alfombras y rugs llevan recogida y entrega", () => {
    expect(isPickupService({ name: "RUGS" })).toBe(true);
    expect(isPickupService({ name: "Limpieza de alfombra persa" })).toBe(true);
    expect(isPickupService({ name: "CARPET" })).toBe(true);
    expect(isPickupService({ name: "Tapete" })).toBe(true);
    expect(isPickupService({ name: "SOFA" })).toBe(false);
    expect(isPickupService({ name: "Limpieza residencial" })).toBe(false);
    expect(isPickupService({ name: "Antideslizante", category: "Alfombras" })).toBe(true);
  });

  it("un pedido mixto con una alfombra lleva recogida y entrega", () => {
    expect(needsPickup([{ name: "SOFA" }, { name: "RUGS" }])).toBe(true);
    expect(needsPickup([{ name: "SOFA" }, { name: "SILLA" }])).toBe(false);
    expect(needsPickup([])).toBe(false);
  });

  it("revisa los artículos de la cita", () => {
    expect(
      appointmentNeedsPickup({
        service: { name: "SOFA" },
        items: [{ service: { name: "SOFA" } }, { service: { name: "Rug" } }],
      }),
    ).toBe(true);
    expect(appointmentNeedsPickup({ service: { name: "SOFA" }, items: [] })).toBe(false);
    expect(appointmentNeedsPickup({ service: { name: "Alfombra" } })).toBe(true);
  });
});
