import { env } from "@/lib/env";

export interface GeocodeInput {
  line1: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

export interface Geocoder {
  geocode(input: GeocodeInput): Promise<GeocodeResult | null>;
}

const ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search";
const ORS_STRUCTURED_URL = "https://api.openrouteservice.org/geocode/search/structured";
const SERVICE_AREA = { lat: 25.7617, lng: -80.1918, radiusKm: 200 };
const PRECISE_LAYERS = new Set(["address", "venue"]);

type GeocodeFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { layer?: string; postalcode?: string; confidence?: number };
};

function zip5(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(0, 5);
}

export function pickGeocodeResult(data: unknown, input: Pick<GeocodeInput, "zip">): GeocodeResult | null {
  const features = (data as { features?: GeocodeFeature[] } | null)?.features ?? [];
  const wantedZip = zip5(input.zip);
  const candidates = features.filter((feature) => {
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    return typeof lat === "number" && typeof lng === "number";
  });
  const sameZip = (feature: GeocodeFeature) => wantedZip !== "" && zip5(feature.properties?.postalcode) === wantedZip;
  const precise = candidates.filter((feature) => PRECISE_LAYERS.has(feature.properties?.layer ?? ""));
  const chosen =
    precise.find(sameZip) ??
    precise.find((feature) => !feature.properties?.postalcode || wantedZip === "") ??
    precise.find((feature) => (feature.properties?.confidence ?? 0) >= 0.9) ??
    candidates.find((feature) => feature.properties?.layer === "street" && sameZip(feature));
  if (!chosen?.geometry?.coordinates) return null;
  const [lng, lat] = chosen.geometry.coordinates;
  return { lat, lng };
}

function withServiceArea(url: URL, apiKey: string): URL {
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("size", "5");
  url.searchParams.set("boundary.country", "US");
  url.searchParams.set("boundary.circle.lat", String(SERVICE_AREA.lat));
  url.searchParams.set("boundary.circle.lon", String(SERVICE_AREA.lng));
  url.searchParams.set("boundary.circle.radius", String(SERVICE_AREA.radiusKm));
  return url;
}

async function requestFeatures(url: URL): Promise<unknown> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error(`OpenRouteService geocode ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error("OpenRouteService geocode failed", error);
    return null;
  }
}

export function createOrsGeocoder(apiKey: string): Geocoder {
  return {
    async geocode(input) {
      const structured = withServiceArea(new URL(ORS_STRUCTURED_URL), apiKey);
      structured.searchParams.set("address", input.line1.trim());
      structured.searchParams.set("locality", input.city.trim());
      structured.searchParams.set("region", input.state.trim());
      if (input.zip.trim()) structured.searchParams.set("postalcode", input.zip.trim());
      structured.searchParams.set("country", "US");
      const first = pickGeocodeResult(await requestFeatures(structured), input);
      if (first) return first;

      const free = withServiceArea(new URL(ORS_GEOCODE_URL), apiKey);
      free.searchParams.set("text", [input.line1, input.city, input.state, input.zip].filter(Boolean).join(", "));
      free.searchParams.set("layers", "address,venue,street");
      free.searchParams.set("focus.point.lat", String(SERVICE_AREA.lat));
      free.searchParams.set("focus.point.lon", String(SERVICE_AREA.lng));
      return pickGeocodeResult(await requestFeatures(free), input);
    },
  };
}

let cached: Geocoder | null | undefined;

export function getGeocoder(): Geocoder | null {
  if (cached === undefined) {
    const { ORS_API_KEY } = env();
    cached = ORS_API_KEY ? createOrsGeocoder(ORS_API_KEY) : null;
  }
  return cached;
}

type Geocodable = GeocodeInput & { lat?: number | null; lng?: number | null };

export async function geocodeIfNeeded<T extends Geocodable>(address: T): Promise<T> {
  if (address.lat != null && address.lng != null) return address;

  const geocoder = getGeocoder();
  if (!geocoder) return address;

  const result = await geocoder.geocode(address);
  if (!result) return address;

  return { ...address, lat: result.lat, lng: result.lng };
}

export type AddressSuggestion = {
  label: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
};

const ORS_AUTOCOMPLETE_URL = "https://api.openrouteservice.org/geocode/autocomplete";
const MIAMI_FOCUS = { lat: 25.7617, lng: -80.1918 };
const MAX_SUGGESTIONS = 6;

type PeliasFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseSuggestions(data: unknown): AddressSuggestion[] {
  const features = (data as { features?: PeliasFeature[] } | null)?.features ?? [];
  const suggestions: AddressSuggestion[] = [];
  for (const feature of features) {
    const p = feature.properties ?? {};
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const street = [text(p.housenumber), text(p.street)].filter(Boolean).join(" ");
    const line1 = street || text(p.name);
    if (!line1) continue;
    const suggestion = {
      label: text(p.label) || line1,
      line1,
      city: text(p.locality) || text(p.localadmin) || text(p.county),
      state: text(p.region_a).toUpperCase(),
      zip: text(p.postalcode),
      lat,
      lng,
    };
    if (suggestions.some((s) => s.label === suggestion.label)) continue;
    suggestions.push(suggestion);
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return suggestions;
}

export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  const textQuery = query.trim();
  if (textQuery.length < 3) return [];
  const { ORS_API_KEY } = env();
  if (!ORS_API_KEY) return [];

  const url = new URL(ORS_AUTOCOMPLETE_URL);
  url.searchParams.set("api_key", ORS_API_KEY);
  url.searchParams.set("text", textQuery);
  url.searchParams.set("boundary.country", "US");
  url.searchParams.set("focus.point.lat", String(MIAMI_FOCUS.lat));
  url.searchParams.set("focus.point.lon", String(MIAMI_FOCUS.lng));
  url.searchParams.set("layers", "address,street,venue");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    return parseSuggestions(await res.json());
  } catch {
    return [];
  }
}
