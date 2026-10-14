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

function formatAddress(input: GeocodeInput): string {
  return [input.line1, input.unit, input.city, input.state, input.zip]
    .filter((part) => part && part.trim() !== "")
    .join(", ");
}

export function createOrsGeocoder(apiKey: string): Geocoder {
  return {
    async geocode(input) {
      const url = new URL(ORS_GEOCODE_URL);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("text", formatAddress(input));
      url.searchParams.set("size", "1");
      url.searchParams.set("boundary.country", "US");

      const res = await fetch(url);
      if (!res.ok) return null;

      const data = (await res.json()) as {
        features?: Array<{ geometry: { coordinates: [number, number] } }>;
      };
      const feature = data.features?.[0];
      if (!feature) return null;

      const [lng, lat] = feature.geometry.coordinates;
      return { lat, lng };
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
