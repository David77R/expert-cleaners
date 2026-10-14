import { describe, expect, it } from "vitest";
import { describeDuration, durationBetween, endTimeFor } from "@/components/time-range-fields";
import { addDays, confirmationMessage, whatsappHref } from "@/domain/order";
import { guessServiceIcon, serviceIconOf } from "@/domain/service-icons";

describe("mensaje de confirmación del pedido", () => {
  it("incluye recogida, entrega, servicios, total y código", () => {
    const text = confirmationMessage({
      customerName: " Melissa ",
      code: "SVC-7774",
      pickup: { date: "2026-10-14", startMin: 540 },
      delivery: { date: "2026-10-17", startMin: 780 },
      items: [
        { name: "Silla", priceCents: 9000 },
        { name: "Sofa", priceCents: 22800 },
      ],
      totalCents: 31800,
    });
    expect(text).toContain("Hola Melissa,");
    expect(text).toContain("Recogida: Mié 14 oct, 9:00 AM");
    expect(text).toContain("Entrega: Sáb 17 oct, 1:00 PM");
    expect(text).toContain("• Sofa: $228.00");
    expect(text).toContain("Total: $318.00");
    expect(text).toContain("SVC-7774");
  });

  it("omite la entrega si no está programada", () => {
    const text = confirmationMessage({
      customerName: "Ana",
      code: "SVC-1",
      pickup: { date: "2026-10-14", startMin: 540 },
      delivery: null,
      items: [],
      totalCents: 0,
    });
    expect(text).not.toContain("Entrega:");
  });

  it("arma el enlace de WhatsApp con el código de país de EE. UU.", () => {
    expect(whatsappHref("(305) 555-0142", "Hola")).toBe("https://wa.me/13055550142?text=Hola");
    expect(whatsappHref("+58 414 1234567", "a b")).toBe("https://wa.me/584141234567?text=a%20b");
  });

  it("suma días cruzando meses", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("íconos de servicios", () => {
  it("elige un ícono según el nombre del servicio", () => {
    const cases: [string, string][] = [
      ["Limpieza de Sofás", "sofa"],
      ["Sillon", "armchair"],
      ["Silla", "chair"],
      ["Bancos o taburetes", "stool"],
      ["Ottoman", "ottoman"],
      ["Cojines", "cushion"],
      ["Colchon", "mattress"],
      ["Camas", "bed"],
      ["Esqueleto Sofa", "frame"],
      ["Forros Sofa", "cover"],
      ["Forros Alfombras", "cover"],
      ["Reproceso Rug", "rework"],
      ["Rug", "rug"],
      ["Carpets", "carpet"],
      ["Antideslizante", "antislip"],
      ["Cortina", "curtain"],
      ["zebra blinds", "blinds"],
      ["Carro", "car"],
      ["Zapato", "shoe"],
      ["ODOR OUT EXPERT", "bottle"],
      ["DESINTALAR RUG", "rug"],
      ["PROMO DIA DE LAS MADRES", "sparkles"],
      ["Anulado", "ban"],
      ["Recogida de Tapetes", "truck"],
      ["Goma", "tag"],
    ];
    for (const [name, icon] of cases) expect([name, guessServiceIcon({ name })]).toEqual([name, icon]);
  });

  it("usa la categoría si el nombre no dice nada y respeta el ícono elegido", () => {
    expect(guessServiceIcon({ name: "Básico", category: "Limpieza residencial" })).toBe("house");
    expect(serviceIconOf({ name: "Sofa", icon: "car" })).toBe("car");
    expect(serviceIconOf({ name: "Sofa", icon: "inventado" })).toBe("sofa");
  });
});

describe("hora de inicio y de salida", () => {
  it("calcula la salida desde el inicio y la duración", () => {
    expect(endTimeFor("09:00", "150")).toBe("11:30");
    expect(endTimeFor("09:00", "0")).toBe("09:00");
    expect(endTimeFor("", "60")).toBe("");
    expect(endTimeFor("23:30", "60")).toBe("");
  });

  it("calcula la duración entre dos horas", () => {
    expect(durationBetween("09:00", "11:15")).toBe(135);
    expect(durationBetween("09:00", "09:00")).toBe(0);
    expect(durationBetween("10:00", "09:00")).toBeNull();
  });

  it("describe la duración en horas y minutos", () => {
    expect(describeDuration(45)).toBe("45 min");
    expect(describeDuration(120)).toBe("2 h");
    expect(describeDuration(135)).toBe("2 h 15 min");
  });
});
