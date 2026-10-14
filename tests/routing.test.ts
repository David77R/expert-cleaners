import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrsRouter } from "@/server/routing";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rutas con OpenRouteService", () => {
  it("pide la ruta permitiendo ajustar cada punto a la calle más cercana", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              geometry: { coordinates: [[-80.19, 25.76]] },
              properties: { summary: { distance: 1200, duration: 300 } },
            },
          ],
        }),
      ),
    );
    const route = await createOrsRouter("key").route([
      { lat: 25.76, lng: -80.19 },
      { lat: 25.77, lng: -80.2 },
    ]);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.coordinates).toEqual([
      [-80.19, 25.76],
      [-80.2, 25.77],
    ]);
    expect(body.radiuses).toEqual([-1, -1]);
    expect(route).toEqual({ coordinates: [[-80.19, 25.76]], distanceMeters: 1200, durationSeconds: 300 });
  });

  it("devuelve null y deja el motivo en el log si el servicio falla", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Could not find routable point", { status: 404 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = await createOrsRouter("key").route([
      { lat: 25.76, lng: -80.19 },
      { lat: 25.77, lng: -80.2 },
    ]);
    expect(route).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("404"));
  });

  it("no llama al servicio con menos de dos puntos", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await createOrsRouter("key").route([{ lat: 1, lng: 1 }])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
