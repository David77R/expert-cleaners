import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parsePhotonSuggestions,
  parseSuggestions,
  pickGeocodeResult,
  rankSuggestions,
  splitHouseNumber,
  suggestAddresses,
} from "@/server/geocoding";

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

describe("elegir el resultado de geocodificación", () => {
  const feature = (layer: string, postalcode: string | undefined, lng: number, lat: number, confidence = 0.8) => ({
    geometry: { coordinates: [lng, lat] },
    properties: { layer, postalcode, confidence },
  });

  it("prefiere una dirección exacta con el mismo código postal", () => {
    const data = {
      features: [feature("address", "33133", -80.2, 25.7), feature("address", "33134", -80.27, 25.75)],
    };
    expect(pickGeocodeResult(data, { zip: "33134-1234" })).toEqual({ lat: 25.75, lng: -80.27 });
  });

  it("descarta centroides de ciudad, código postal o agua", () => {
    const data = {
      features: [feature("locality", undefined, -80.25, 25.72), feature("postalcode", "33134", -80.21, 25.69)],
    };
    expect(pickGeocodeResult(data, { zip: "33134" })).toBeNull();
  });

  it("acepta una calle solo si coincide el código postal y una dirección con otro código si es muy confiable", () => {
    expect(pickGeocodeResult({ features: [feature("street", "33134", -80.26, 25.74)] }, { zip: "33134" })).toEqual({
      lat: 25.74,
      lng: -80.26,
    });
    expect(pickGeocodeResult({ features: [feature("street", "33155", -80.3, 25.7)] }, { zip: "33134" })).toBeNull();
    expect(
      pickGeocodeResult({ features: [feature("address", "33146", -80.27, 25.72, 0.95)] }, { zip: "33134" }),
    ).toEqual({ lat: 25.72, lng: -80.27 });
  });

  it("no falla con respuestas vacías", () => {
    expect(pickGeocodeResult(null, { zip: "33134" })).toBeNull();
    expect(pickGeocodeResult({ features: [] }, { zip: "" })).toBeNull();
  });
});

describe("sugerencias de respaldo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("lee sugerencias de Photon con el estado en dos letras", () => {
    const [first] = parsePhotonSuggestions({
      features: [
        {
          geometry: { coordinates: [-80.26, 25.75] },
          properties: {
            housenumber: "405",
            street: "Alhambra Circle",
            city: "Coral Gables",
            state: "Florida",
            postcode: "33134",
            countrycode: "US",
          },
        },
        { geometry: { coordinates: [-3.7, 40.4] }, properties: { name: "Madrid", countrycode: "ES" } },
      ],
    });
    expect(first).toEqual({
      label: "405 Alhambra Circle, Coral Gables, FL 33134",
      line1: "405 Alhambra Circle",
      city: "Coral Gables",
      state: "FL",
      zip: "33134",
      lat: 25.75,
      lng: -80.26,
    });
  });

  it("si el servicio principal no responde, busca en el respaldo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("photon")) {
        return new Response(
          JSON.stringify({
            features: [
              {
                geometry: { coordinates: [-80.19, 25.76] },
                properties: { housenumber: "1200", street: "Brickell Ave", city: "Miami", state: "Florida" },
              },
            ],
          }),
        );
      }
      return new Response("error", { status: 503 });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/db");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("ORS_API_KEY", "ors-key");
    const suggestions = await suggestAddresses("1200 Brick");
    expect(suggestions.map((s) => s.line1)).toEqual(["1200 Brickell Ave"]);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("photon"))).toBe(true);
  });
});

describe("direcciones con número de casa", () => {
  const street = {
    label: "Northwest 80th Terrace, West Little River, FL",
    line1: "Northwest 80th Terrace",
    city: "West Little River",
    state: "FL",
    zip: "",
    lat: 25.85,
    lng: -80.21,
    streetOnly: true,
  };

  it("separa el número de la calle", () => {
    expect(splitHouseNumber("795 Northwest 80th Terrace")).toEqual({ number: "795", street: "Northwest 80th Terrace" });
    expect(splitHouseNumber("12-34 Main St")).toEqual({ number: "12-34", street: "Main St" });
    expect(splitHouseNumber("Northwest 80th Terrace")).toBeNull();
  });

  it("pone primero la dirección exacta y completa con el número las calles sin número", () => {
    const exact = {
      ...street,
      label: "795 NW 80th Ter, Miami, FL 33150",
      line1: "795 NW 80th Ter",
      city: "Miami",
      zip: "33150",
      streetOnly: undefined,
    };
    const other = {
      ...street,
      label: "801 NW 80th Ter",
      line1: "801 NW 80th Ter",
      city: "Miami",
      streetOnly: undefined,
    };
    const ranked = rankSuggestions("795 Northwest 80th Terrace", [[street, other], [exact]]);
    expect(ranked.map((s) => s.line1)).toEqual(["795 NW 80th Ter", "795 Northwest 80th Terrace", "801 NW 80th Ter"]);
    expect(ranked[0].approximate).toBeUndefined();
    expect(ranked[1]).toMatchObject({ approximate: true, label: "795 Northwest 80th Terrace, West Little River, FL" });
    expect(ranked.every((s) => !("streetOnly" in s))).toBe(true);
  });

  it("no le pega el número a lugares que no son calles", () => {
    const venue = { ...street, line1: "Dolphin Mall", label: "Dolphin Mall", streetOnly: undefined };
    expect(rankSuggestions("795 Dolphin", [[venue]])[0].line1).toBe("Dolphin Mall");
  });

  it("sin número deja las sugerencias como vienen", () => {
    const ranked = rankSuggestions("Northwest 80th", [[street]]);
    expect(ranked[0]).toMatchObject({ line1: "Northwest 80th Terrace" });
    expect(ranked[0].approximate).toBeUndefined();
  });

  it("reconoce calles de ORS y de Photon", () => {
    expect(
      parseSuggestions({ features: [feature({ layer: "street", street: "NW 80th Ter", label: "x" })] })[0].streetOnly,
    ).toBe(true);
    expect(
      parsePhotonSuggestions({
        features: [
          {
            geometry: { coordinates: [-80.2, 25.8] },
            properties: { type: "street", name: "NW 80th Ter", countrycode: "US" },
          },
        ],
      })[0].streetOnly,
    ).toBe(true);
  });
});
