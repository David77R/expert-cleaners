import { describe, expect, it } from "vitest";
import { parseSuggestions } from "@/server/geocoding";

function feature(properties: Record<string, unknown>, coordinates: [number, number] = [-80.22, 25.76]) {
  return { geometry: { coordinates }, properties };
}

describe("sugerencias de direcciones", () => {
  it("arma la dirección con número, calle, ciudad, estado y código postal", () => {
    const [first] = parseSuggestions({
      features: [
        feature({
          housenumber: "1450",
          street: "SW 8th St",
          locality: "Miami",
          region_a: "fl",
          postalcode: "33135",
          label: "1450 SW 8th St, Miami, FL, USA",
        }),
      ],
    });
    expect(first).toEqual({
      label: "1450 SW 8th St, Miami, FL, USA",
      line1: "1450 SW 8th St",
      city: "Miami",
      state: "FL",
      zip: "33135",
      lat: 25.76,
      lng: -80.22,
    });
  });

  it("usa el nombre cuando no hay calle y la ciudad administrativa cuando no hay localidad", () => {
    const [first] = parseSuggestions({
      features: [feature({ name: "Dolphin Mall", localadmin: "Sweetwater", region_a: "FL", label: "Dolphin Mall" })],
    });
    expect(first).toMatchObject({ line1: "Dolphin Mall", city: "Sweetwater", zip: "" });
  });

  it("descarta resultados sin coordenadas, sin dirección o repetidos, y limita a 6", () => {
    const repeated = feature({ street: "Brickell Ave", label: "Brickell Ave, Miami" });
    const many = Array.from({ length: 10 }, (_, i) => feature({ street: `Calle ${i}`, label: `Calle ${i}` }));
    const result = parseSuggestions({
      features: [
        { properties: { street: "Sin coordenadas" } },
        feature({ label: "Vacía" }),
        repeated,
        repeated,
        ...many,
      ],
    });
    expect(result[0].line1).toBe("Brickell Ave");
    expect(result.filter((s) => s.line1 === "Brickell Ave")).toHaveLength(1);
    expect(result).toHaveLength(6);
  });

  it("devuelve una lista vacía ante respuestas inesperadas", () => {
    expect(parseSuggestions(null)).toEqual([]);
    expect(parseSuggestions({ error: "quota" })).toEqual([]);
  });
});
