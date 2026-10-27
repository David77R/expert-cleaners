import { describe, expect, it } from "vitest";
import { SERVICE_ICON_KEYS, guessServiceIcon, serviceIconChoices } from "@/domain/service-icons";

describe("serviceIconChoices", () => {
  it("muestra solo íconos de lavado y detailing a una empresa de vehículos", () => {
    const keys = serviceIconChoices({ vehicles: true });
    expect(keys).toContain("car");
    expect(keys).toContain("wash");
    expect(keys).toContain("shield");
    expect(keys).not.toContain("sofa");
    expect(keys).not.toContain("carpet");
    expect(keys).not.toContain("truck");
  });

  it("deja a las empresas de limpieza sus íconos de siempre sin los de detailing", () => {
    const keys = serviceIconChoices({ vehicles: false });
    expect(keys).toContain("sofa");
    expect(keys).toContain("car");
    expect(keys).not.toContain("wash");
    expect(keys).not.toContain("wheel");
    expect(keys.length).toBe(SERVICE_ICON_KEYS.length - 5);
  });

  it("conserva el ícono ya elegido aunque no sea de la lista de la empresa", () => {
    expect(serviceIconChoices({ vehicles: true }, "sofa")).toContain("sofa");
    expect(serviceIconChoices({ vehicles: true }, "inventado")).not.toContain("inventado");
  });
});

describe("guessServiceIcon para detailing", () => {
  it("reconoce servicios de carro", () => {
    expect(guessServiceIcon({ name: "Ceramic coating" })).toBe("shield");
    expect(guessServiceIcon({ name: "Limpieza de rines" })).toBe("wheel");
    expect(guessServiceIcon({ name: "Limpieza a vapor" })).toBe("steam");
    expect(guessServiceIcon({ name: "Express wash" })).toBe("wash");
  });

  it("no le quita prioridad a los muebles", () => {
    expect(guessServiceIcon({ name: "Asientos de comedor" })).toBe("chair");
  });
});
