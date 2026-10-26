import { describe, expect, it } from "vitest";
import { appointmentNeedsPickup, isPickupService, needsPickup } from "@/domain/pickup";

describe("servicios con recogida y entrega", () => {
  it("solo alfombras y rugs llevan recogida y entrega", () => {
    expect(isPickupService({ name: "RUGS" }, true)).toBe(true);
    expect(isPickupService({ name: "Limpieza de alfombra persa" }, true)).toBe(true);
    expect(isPickupService({ name: "CARPET" }, true)).toBe(false);
    expect(isPickupService({ name: "Carpet cleaning" }, true)).toBe(false);
    expect(isPickupService({ name: "Tapete" }, true)).toBe(true);
    expect(isPickupService({ name: "SOFA" }, true)).toBe(false);
    expect(isPickupService({ name: "Limpieza residencial" }, true)).toBe(false);
    expect(isPickupService({ name: "Antideslizante", category: "Alfombras" }, true)).toBe(true);
  });

  it("un pedido mixto con una alfombra lleva recogida y entrega", () => {
    expect(needsPickup([{ name: "SOFA" }, { name: "RUGS" }], true)).toBe(true);
    expect(needsPickup([{ name: "SOFA" }, { name: "SILLA" }], true)).toBe(false);
    expect(needsPickup([], true)).toBe(false);
  });

  it("revisa los artículos de la cita", () => {
    expect(
      appointmentNeedsPickup(
        {
          service: { name: "SOFA" },
          items: [{ service: { name: "SOFA" } }, { service: { name: "Rug" } }],
        },
        true,
      ),
    ).toBe(true);
    expect(appointmentNeedsPickup({ service: { name: "SOFA" }, items: [] }, true)).toBe(false);
    expect(appointmentNeedsPickup({ service: { name: "Alfombra" } }, true)).toBe(true);
  });

  it("si la empresa no recoge alfombras nada pide recogida", () => {
    expect(isPickupService({ name: "Lavado de alfombras del carro" }, false)).toBe(false);
    expect(needsPickup([{ name: "RUGS" }], false)).toBe(false);
    expect(appointmentNeedsPickup({ service: { name: "Alfombra" } }, false)).toBe(false);
  });
});
