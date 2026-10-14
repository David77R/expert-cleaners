import { env } from "@/lib/env";

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

export interface Router {
  route(points: RoutePoint[]): Promise<RouteResult | null>;
}

const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

export function createOrsRouter(apiKey: string): Router {
  return {
    async route(points) {
      if (points.length < 2) return null;

      const res = await fetch(ORS_DIRECTIONS_URL, {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]) }),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        features?: Array<{
          geometry: { coordinates: [number, number][] };
          properties: { summary: { distance: number; duration: number } };
        }>;
      };
      const feature = data.features?.[0];
      if (!feature) return null;

      return {
        coordinates: feature.geometry.coordinates,
        distanceMeters: feature.properties.summary.distance,
        durationSeconds: feature.properties.summary.duration,
      };
    },
  };
}

let cached: Router | null | undefined;

export function getRouter(): Router | null {
  if (cached === undefined) {
    const { ORS_API_KEY } = env();
    cached = ORS_API_KEY ? createOrsRouter(ORS_API_KEY) : null;
  }
  return cached;
}
