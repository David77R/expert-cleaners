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
  zip?: string;
  exact?: boolean;
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
      const second = pickGeocodeResult(await requestFeatures(free), input);
      if (second || !input.zip.trim()) return second;

      const noZip = withServiceArea(new URL(ORS_STRUCTURED_URL), apiKey);
      noZip.searchParams.set("address", input.line1.trim());
      noZip.searchParams.set("locality", input.city.trim());
      noZip.searchParams.set("region", input.state.trim());
      noZip.searchParams.set("country", "US");
      return pickGeocodeResult(await requestFeatures(noZip), { zip: "" });
    },
  };
}

const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/address";

type CensusMatch = {
  coordinates?: { x?: number; y?: number };
  addressComponents?: {
    zip?: string;
    city?: string;
    state?: string;
    preDirection?: string;
    preType?: string;
    streetName?: string;
    suffixType?: string;
    suffixDirection?: string;
  };
};

const CENSUS_ONELINE_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

function titleWord(word: string): string {
  const lower = word.toLowerCase();
  return /^\d/.test(lower) ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCase(value: string): string {
  return value.split(/\s+/).filter(Boolean).map(titleWord).join(" ");
}

export function parseCensusSuggestions(data: unknown, houseNumber: string): AddressSuggestion[] {
  const matches = (data as { result?: { addressMatches?: CensusMatch[] } } | null)?.result?.addressMatches ?? [];
  const suggestions: AddressSuggestion[] = [];
  for (const match of matches) {
    const { x, y } = match.coordinates ?? {};
    const c = match.addressComponents ?? {};
    if (typeof x !== "number" || typeof y !== "number" || !c.streetName) continue;
    const street = [
      (c.preDirection ?? "").toUpperCase(),
      titleCase(c.preType ?? ""),
      titleCase(c.streetName),
      titleCase(c.suffixType ?? ""),
      (c.suffixDirection ?? "").toUpperCase(),
    ]
      .filter(Boolean)
      .join(" ");
    const line1 = `${houseNumber} ${street}`;
    const city = titleCase(c.city ?? "");
    const state = (c.state ?? "").toUpperCase();
    const zip = zip5(c.zip);
    suggestions.push({
      label: [line1, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      line1,
      city,
      state,
      zip,
      lat: y,
      lng: x,
      verified: true,
    });
  }
  return suggestions;
}

async function requestCensusOneLine(address: string, timeoutMs: number): Promise<unknown> {
  const url = new URL(CENSUS_ONELINE_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Census geocoder failed", error);
    return null;
  }
}

export function hasHouseNumber(line1: string): boolean {
  return /^\s*\d+[A-Za-z]?(?:-\d+)?\s+\S/.test(line1);
}

export function pickCensusMatch(data: unknown, input: Pick<GeocodeInput, "zip" | "state">): GeocodeResult | null {
  const matches = (data as { result?: { addressMatches?: CensusMatch[] } } | null)?.result?.addressMatches ?? [];
  const valid = matches.filter((match) => {
    const { x, y } = match.coordinates ?? {};
    const state = match.addressComponents?.state ?? "";
    return (
      typeof x === "number" &&
      typeof y === "number" &&
      (!input.state.trim() || !state || state.toUpperCase() === input.state.trim().toUpperCase())
    );
  });
  const wanted = zip5(input.zip);
  const chosen = valid.find((match) => wanted !== "" && zip5(match.addressComponents?.zip) === wanted) ?? valid[0];
  if (!chosen?.coordinates) return null;
  const zip = zip5(chosen.addressComponents?.zip);
  return {
    lat: chosen.coordinates.y as number,
    lng: chosen.coordinates.x as number,
    exact: true,
    ...(zip ? { zip } : {}),
  };
}

async function requestCensus(input: GeocodeInput, withZip: boolean, timeoutMs = 7000): Promise<unknown> {
  const url = new URL(CENSUS_URL);
  url.searchParams.set("street", input.line1.trim());
  if (input.city.trim()) url.searchParams.set("city", input.city.trim());
  url.searchParams.set("state", input.state.trim() || "FL");
  if (withZip && input.zip.trim()) url.searchParams.set("zip", zip5(input.zip));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.error(`Census geocoder ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error("Census geocoder failed", error);
    return null;
  }
}

export function createCensusGeocoder(): Geocoder {
  return {
    async geocode(input) {
      if (!hasHouseNumber(input.line1)) return null;
      if (zip5(input.zip)) {
        const withZip = pickCensusMatch(await requestCensus(input, true), input);
        if (withZip) return withZip;
      }
      if (!input.city.trim()) return null;
      return pickCensusMatch(await requestCensus(input, false), input);
    },
  };
}

export function chainGeocoders(geocoders: readonly Geocoder[]): Geocoder {
  return {
    async geocode(input) {
      for (const geocoder of geocoders) {
        const result = await geocoder.geocode(input);
        if (result) return result;
      }
      return null;
    },
  };
}

let cached: Geocoder | null | undefined;

export function getGeocoder(): Geocoder | null {
  if (cached === undefined) {
    const { ORS_API_KEY } = env();
    cached = chainGeocoders([createCensusGeocoder(), ...(ORS_API_KEY ? [createOrsGeocoder(ORS_API_KEY)] : [])]);
  }
  return cached;
}

type Geocodable = GeocodeInput & { lat?: number | null; lng?: number | null };

let census: Geocoder | undefined;

export async function geocodeIfNeeded<T extends Geocodable>(address: T): Promise<T> {
  const hasCoords = address.lat != null && address.lng != null;
  if (hasCoords && !hasHouseNumber(address.line1)) return address;

  const geocoder = hasCoords ? (census ??= createCensusGeocoder()) : getGeocoder();
  if (!geocoder) return address;

  const result = await geocoder.geocode(address);
  if (!result) return address;

  const zip = result.zip && result.zip !== zip5(address.zip) ? { zip: result.zip } : {};
  return { ...address, ...zip, lat: result.lat, lng: result.lng };
}

export type AddressSuggestion = {
  label: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  approximate?: boolean;
  verified?: boolean;
  streetOnly?: boolean;
};

const ORS_AUTOCOMPLETE_URL = "https://api.openrouteservice.org/geocode/autocomplete";
const MIAMI_FOCUS = { lat: 25.7617, lng: -80.1918 };
const MAX_SUGGESTIONS = 6;
const SUGGEST_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 300;

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
    const suggestion: AddressSuggestion = {
      ...(text(p.layer) === "street" ? { streetOnly: true } : {}),
      label: text(p.label) || line1,
      line1,
      city: text(p.locality) || text(p.localadmin) || text(p.county),
      state: stateCode(text(p.region_a) || text(p.region)),
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

const PHOTON_URL = "https://photon.komoot.io/api/";
const SOUTH_FLORIDA_BBOX = "-81.9,24.4,-79.9,27.3";

const US_STATES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "puerto rico": "PR",
};

function stateCode(value: string): string {
  const clean = value.trim();
  if (/^[A-Za-z]{2}$/.test(clean)) return clean.toUpperCase();
  return US_STATES[clean.toLowerCase()] ?? clean;
}

export function parsePhotonSuggestions(data: unknown): AddressSuggestion[] {
  const features = (data as { features?: PeliasFeature[] } | null)?.features ?? [];
  const suggestions: AddressSuggestion[] = [];
  for (const feature of features) {
    const p = feature.properties ?? {};
    if (text(p.countrycode) && text(p.countrycode).toUpperCase() !== "US") continue;
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const street = [text(p.housenumber), text(p.street)].filter(Boolean).join(" ");
    const line1 = street || text(p.name);
    if (!line1) continue;
    const city = text(p.city) || text(p.district) || text(p.county);
    const state = stateCode(text(p.state));
    const zip = text(p.postcode);
    const label = [line1, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    if (suggestions.some((s) => s.label === label)) continue;
    suggestions.push({
      ...(text(p.type) === "street" ? { streetOnly: true } : {}),
      label,
      line1,
      city,
      state,
      zip,
      lat,
      lng,
    });
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return suggestions;
}

async function fetchJson(url: URL, source: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(SUGGEST_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": "expert-cleaners/1.0" },
    });
    if (!res.ok) {
      console.error(`${source} ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error(`${source} failed`, error);
    return null;
  }
}

function orsSuggestionUrl(base: string, apiKey: string, query: string): URL {
  const url = new URL(base);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("text", query);
  url.searchParams.set("boundary.country", "US");
  url.searchParams.set("focus.point.lat", String(MIAMI_FOCUS.lat));
  url.searchParams.set("focus.point.lon", String(MIAMI_FOCUS.lng));
  url.searchParams.set("layers", "address,street,venue");
  url.searchParams.set("size", String(MAX_SUGGESTIONS));
  return url;
}

export function splitHouseNumber(query: string): { number: string; street: string } | null {
  const match = /^\s*(\d+[A-Za-z]?(?:-\d+)?)\s+(.+)$/.exec(query);
  return match ? { number: match[1], street: match[2].trim() } : null;
}

function suggestionKey(suggestion: AddressSuggestion): string {
  return `${suggestion.line1}|${suggestion.city}`.toLowerCase().replace(/\s+/g, " ");
}

function relabel(suggestion: AddressSuggestion, line1: string): AddressSuggestion {
  const tail = [suggestion.city, [suggestion.state, suggestion.zip].filter(Boolean).join(" ")].filter(Boolean);
  return { ...suggestion, line1, label: [line1, ...tail].join(", "), approximate: true };
}

export function rankSuggestions(query: string, lists: readonly AddressSuggestion[][]): AddressSuggestion[] {
  const house = splitHouseNumber(query);
  const exact: AddressSuggestion[] = [];
  const completed: AddressSuggestion[] = [];
  const rest: AddressSuggestion[] = [];
  for (const suggestion of lists.flat()) {
    const leading = splitHouseNumber(suggestion.line1);
    if (!house) rest.push(suggestion);
    else if (leading?.number.toLowerCase() === house.number.toLowerCase()) exact.push(suggestion);
    else if (suggestion.streetOnly && !leading)
      completed.push(relabel(suggestion, `${house.number} ${suggestion.line1}`));
    else rest.push(suggestion);
  }
  const seen = new Set<string>();
  const ranked: AddressSuggestion[] = [];
  for (const suggestion of [...exact, ...completed, ...rest]) {
    const key = suggestionKey(suggestion);
    if (seen.has(key)) continue;
    seen.add(key);
    const { streetOnly, ...clean } = suggestion;
    ranked.push(streetOnly && !clean.approximate && house ? { ...clean, approximate: true } : clean);
    if (ranked.length === MAX_SUGGESTIONS) break;
  }
  return ranked;
}

const suggestionCache = new Map<string, { at: number; value: AddressSuggestion[] }>();

function photonUrl(query: string): URL {
  const photon = new URL(PHOTON_URL);
  photon.searchParams.set("q", query);
  photon.searchParams.set("limit", String(MAX_SUGGESTIONS * 2));
  photon.searchParams.set("lang", "en");
  photon.searchParams.set("lat", String(MIAMI_FOCUS.lat));
  photon.searchParams.set("lon", String(MIAMI_FOCUS.lng));
  photon.searchParams.set("bbox", SOUTH_FLORIDA_BBOX);
  return photon;
}

const SUGGEST_CENSUS_TIMEOUT_MS = 4500;
const MAX_VERIFICATIONS = 4;

function distanceToFocus(suggestion: Pick<AddressSuggestion, "lat" | "lng">): number {
  return Math.hypot(suggestion.lat - MIAMI_FOCUS.lat, (suggestion.lng - MIAMI_FOCUS.lng) * 0.9);
}

async function censusFromQuery(query: string): Promise<AddressSuggestion[]> {
  const house = splitHouseNumber(query);
  if (!house) return [];
  const hasPlace = query.includes(",");
  const lines = hasPlace ? [query] : [`${query}, Miami, FL`, `${query}, FL`];
  const results = await Promise.all(
    lines.map((line) =>
      requestCensusOneLine(line, SUGGEST_CENSUS_TIMEOUT_MS).then((data) => parseCensusSuggestions(data, house.number)),
    ),
  );
  return results.flat();
}

export function mergeVerified(
  verified: readonly AddressSuggestion[],
  rest: readonly AddressSuggestion[],
): AddressSuggestion[] {
  const seen = new Set<string>();
  const unique = [...verified]
    .sort((a, b) => distanceToFocus(a) - distanceToFocus(b))
    .filter((suggestion) => {
      const key = `${suggestion.lat.toFixed(4)},${suggestion.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const labels = new Set(unique.map((suggestion) => suggestionKey(suggestion)));
  return [...unique, ...rest.filter((suggestion) => !labels.has(suggestionKey(suggestion)))].slice(0, MAX_SUGGESTIONS);
}

async function verifyWithCensus(
  houseNumber: string,
  ranked: AddressSuggestion[],
  direct: AddressSuggestion[],
): Promise<AddressSuggestion[]> {
  const candidates = ranked.filter((suggestion) => suggestion.approximate).slice(0, MAX_VERIFICATIONS);
  const checks = await Promise.all(
    candidates.map(async (candidate) => {
      const data = await requestCensus(
        { line1: candidate.line1, city: candidate.city, state: candidate.state || "FL", zip: "" },
        false,
        SUGGEST_CENSUS_TIMEOUT_MS,
      );
      return { candidate, found: parseCensusSuggestions(data, houseNumber) };
    }),
  );
  const rejected = new Set(checks.filter((check) => check.found.length === 0).map((check) => check.candidate));
  const verified = [...direct, ...checks.flatMap((check) => check.found)];
  if (verified.length === 0) return ranked;
  return mergeVerified(
    verified,
    ranked.filter((suggestion) => !rejected.has(suggestion) && !checks.some((check) => check.candidate === suggestion)),
  );
}

export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  const textQuery = query.trim().replace(/\s+/g, " ");
  if (textQuery.length < 3) return [];

  const cacheKey = textQuery.toLowerCase();
  const hit = suggestionCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const { ORS_API_KEY } = env();
  const censusDirect = censusFromQuery(textQuery);
  const [ors, photon] = await Promise.all([
    ORS_API_KEY
      ? fetchJson(orsSuggestionUrl(ORS_AUTOCOMPLETE_URL, ORS_API_KEY, textQuery), "OpenRouteService autocomplete").then(
          parseSuggestions,
        )
      : Promise.resolve([]),
    fetchJson(photonUrl(textQuery), "Photon").then(parsePhotonSuggestions),
  ]);

  let value = rankSuggestions(textQuery, [ors, photon]);
  if (value.length === 0 && ORS_API_KEY) {
    const search = parseSuggestions(
      await fetchJson(orsSuggestionUrl(ORS_GEOCODE_URL, ORS_API_KEY, textQuery), "OpenRouteService search"),
    );
    value = rankSuggestions(textQuery, [search]);
  }

  const house = splitHouseNumber(textQuery);
  if (house) value = await verifyWithCensus(house.number, value, await censusDirect);
  if (value.length > 0) {
    if (suggestionCache.size >= CACHE_LIMIT) suggestionCache.delete(suggestionCache.keys().next().value as string);
    suggestionCache.set(cacheKey, { at: Date.now(), value });
  }
  return value;
}
