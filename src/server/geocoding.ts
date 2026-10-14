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
