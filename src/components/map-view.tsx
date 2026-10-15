"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from "react";
import { MapContainer, Marker, Polyline, Tooltip, TileLayer } from "react-leaflet";
import { formatRange, initialsOf, readableOn } from "@/domain/calendar-view";
import { appointmentIdFromKey } from "@/domain/delivery";
import { spreadPositions } from "@/domain/map-positions";

export type MapStop = {
  id: string;
  code: string;
  startMin: number;
  durationMin: number;
  customerName: string;
  lat: number;
  lng: number;
  technicianId: string;
  technicianName: string;
  technicianColor: string;
  serviceId: string;
  serviceName: string;
  address: string;
  notes: string;
  kind?: "delivery";
  status?: string;
};

export type MapTechnicianOption = { id: string; name: string; color: string };
export type MapServiceOption = { id: string; name: string };

export type MapRouteDraft = {
  mode: "tech" | "service";
  groupKey: string;
  stopIds: string[];
  createdByName: string;
  createdAt: string;
};

const DEFAULT_ROUTE_COLOR = "#1d4ed8";
const DRAFT_ROUTE_COLOR = "#7c3aed";
const DEFAULT_CENTER: [number, number] = [25.7617, -80.1918]; // Miami-Dade
const DEFAULT_ZOOM = 10;

function numberedIcon(
  order: number,
  color: string,
  draggable = false,
  delivery = false,
  unconfirmed = false,
): L.DivIcon {
  const textColor = readableOn(color);
  const border = draggable ? "border:2px dashed #fff;cursor:grab" : "border:2px solid #fff;cursor:pointer";
  const shape = delivery ? "rounded-[5px] rotate-45" : "rounded-full";
  const label = delivery ? `<span class="-rotate-45">${order}</span>` : `${order}`;
  const flag = unconfirmed
    ? `<span title="Sin confirmar" style="background:var(--warning);color:#fff;border:2px solid #fff" class="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black leading-none shadow">!</span>`
    : "";
  return L.divIcon({
    html: `<div class="relative"><div style="background:${color};color:${textColor};${border}" class="flex h-7 w-7 items-center justify-center ${shape} text-[11px] font-bold shadow-md ${unconfirmed ? "ring-2 ring-warning ring-offset-1" : ""}">${label}</div>${flag}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

type RouteGroup = { key: string; color: string; stops: MapStop[] };
type RouteState = "loading" | "ok" | "unavailable";
type RouteFetch = {
  status: RouteState;
  coordinates: [number, number][] | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
};
type StoredRoute = RouteFetch & { signature: string };

const LOADING_ROUTE: RouteFetch = { status: "loading", coordinates: null, distanceMeters: null, durationSeconds: null };

function stopsSignature(stops: MapStop[]): string {
  return stops.map((s) => s.id).join(",");
}

function toRouteFetch(
  route: { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number } | null,
): RouteFetch {
  return route
    ? {
        status: "ok",
        coordinates: route.coordinates,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
      }
    : { status: "unavailable", coordinates: null, distanceMeters: null, durationSeconds: null };
}

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatMin(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

async function fetchRoute(
  stops: MapStop[],
): Promise<{ coordinates: [number, number][]; distanceMeters: number; durationSeconds: number } | null> {
  try {
    const res = await fetch("/api/routes/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: stops.map((s) => ({ lat: s.lat, lng: s.lng })) }),
    });
    const data: {
      route: { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number } | null;
    } = await res.json();
    return data.route;
  } catch {
    return null;
  }
}

export function MapView({
  date,
  stops,
  technicians,
  services,
  drafts,
  returnHref,
}: {
  date: string;
  stops: MapStop[];
  technicians: MapTechnicianOption[];
  services: MapServiceOption[];
  drafts: MapRouteDraft[];
  returnHref: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"tech" | "service">("tech");
  const [selectedStop, setSelectedStop] = useState<MapStop | null>(null);
  const [checkedTechIds, setCheckedTechIds] = useState<Set<string>>(() => new Set(technicians.map((t) => t.id)));
  const [checkedServiceIds, setCheckedServiceIds] = useState<Set<string>>(() => new Set(services.map((s) => s.id)));
  const [fetchedRoutes, setFetchedRoutes] = useState<Record<string, StoredRoute>>({});
  const [editingKeyState, setEditingGroupKey] = useState<string | null>(null);
  const [viewingKeyState, setViewingGroupKey] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState<MapStop[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fetchedDraftRoutes, setFetchedDraftRoutes] = useState<Record<string, StoredRoute>>({});

  function changeMode(next: "tech" | "service") {
    setMode(next);
    setEditingGroupKey(null);
    setViewingGroupKey(null);
    setDraftOrder([]);
  }

  function toggleTech(id: string) {
    setCheckedTechIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleService(id: string) {
    setCheckedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const positions = spreadPositions(stops);

  const visibleStops =
    mode === "tech"
      ? stops.filter((s) => checkedTechIds.has(s.technicianId))
      : stops.filter((s) => checkedServiceIds.has(s.serviceId));

  const routeGroups = useMemo<RouteGroup[]>(() => {
    if (mode === "tech") {
      const byTech = new Map<string, MapStop[]>();
      for (const stop of visibleStops) {
        const list = byTech.get(stop.technicianId) ?? [];
        list.push(stop);
        byTech.set(stop.technicianId, list);
      }
      return [...byTech.entries()].map(([technicianId, groupStops]) => ({
        key: technicianId,
        color: groupStops[0].technicianColor,
        stops: [...groupStops].sort((a, b) => a.startMin - b.startMin),
      }));
    }
    return [
      { key: "all", color: DEFAULT_ROUTE_COLOR, stops: [...visibleStops].sort((a, b) => a.startMin - b.startMin) },
    ];
  }, [mode, visibleStops]);

  const routeSignature = routeGroups.map((g) => `${g.key}:${stopsSignature(g.stops)}`).join("|");

  const routes = useMemo<Record<string, RouteFetch>>(() => {
    const view: Record<string, RouteFetch> = {};
    for (const group of routeGroups) {
      if (group.stops.length < 2) continue;
      const stored = fetchedRoutes[group.key];
      view[group.key] = stored && stored.signature === stopsSignature(group.stops) ? stored : LOADING_ROUTE;
    }
    return view;
  }, [routeGroups, fetchedRoutes]);

  useEffect(() => {
    let cancelled = false;
    const toFetch = routeGroups.filter((g) => g.stops.length >= 2);

    Promise.all(
      toFetch.map(async (group) => ({
        key: group.key,
        signature: stopsSignature(group.stops),
        route: await fetchRoute(group.stops),
      })),
    ).then((results) => {
      if (cancelled) return;
      setFetchedRoutes((prev) => {
        const next = { ...prev };
        for (const result of results) next[result.key] = { ...toRouteFetch(result.route), signature: result.signature };
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSignature]);

  const editingGroupKey =
    editingKeyState && routeGroups.some((g) => g.key === editingKeyState && g.stops.length >= 2)
      ? editingKeyState
      : null;
  const viewingGroupKey =
    viewingKeyState && routeGroups.some((g) => g.key === viewingKeyState && g.stops.length >= 2)
      ? viewingKeyState
      : null;

  function savedDraftFor(groupKey: string): MapRouteDraft | null {
    return drafts.find((d) => d.mode === mode && d.groupKey === groupKey) ?? null;
  }

  const editingGroup = editingGroupKey ? routeGroups.find((g) => g.key === editingGroupKey) : undefined;
  const viewingGroup = viewingGroupKey ? routeGroups.find((g) => g.key === viewingGroupKey) : undefined;
  const viewingSaved = viewingGroupKey ? savedDraftFor(viewingGroupKey) : null;
  const editableGroups = routeGroups.filter((g) => g.stops.length >= 2);

  const referenceOrders = useMemo<Record<string, MapStop[]>>(() => {
    const map: Record<string, MapStop[]> = {};
    for (const group of routeGroups) {
      if (group.stops.length < 2) continue;
      if (editingGroupKey === group.key) {
        if (draftOrder.length >= 2) map[group.key] = draftOrder;
        continue;
      }
      const saved = drafts.find((d) => d.mode === mode && d.groupKey === group.key);
      if (!saved) continue;
      const ordered = saved.stopIds
        .map((id) => group.stops.find((s) => s.id === id))
        .filter((s): s is MapStop => Boolean(s));
      if (ordered.length >= 2) map[group.key] = ordered;
    }
    return map;
  }, [routeGroups, drafts, mode, editingGroupKey, draftOrder]);

  const referenceSignature = Object.entries(referenceOrders)
    .map(([key, order]) => `${key}:${order.map((s) => s.id).join(",")}`)
    .join("|");

  const draftRoutes = useMemo<Record<string, RouteFetch>>(() => {
    const view: Record<string, RouteFetch> = {};
    for (const [key, order] of Object.entries(referenceOrders)) {
      const stored = fetchedDraftRoutes[key];
      view[key] = stored && stored.signature === stopsSignature(order) ? stored : LOADING_ROUTE;
    }
    return view;
  }, [referenceOrders, fetchedDraftRoutes]);

  useEffect(() => {
    const keys = Object.keys(referenceOrders);
    if (keys.length === 0) return;
    let cancelled = false;

    Promise.all(
      keys.map(async (key) => ({
        key,
        signature: stopsSignature(referenceOrders[key]),
        route: await fetchRoute(referenceOrders[key]),
      })),
    ).then((results) => {
      if (cancelled) return;
      setFetchedDraftRoutes((prev) => {
        const next = { ...prev };
        for (const result of results) next[result.key] = { ...toRouteFetch(result.route), signature: result.signature };
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceSignature]);

  const viewingOrder = viewingGroupKey ? (referenceOrders[viewingGroupKey] ?? []) : [];

  function startEditingDraft(group: RouteGroup) {
    const saved = savedDraftFor(group.key);
    const baseOrder = saved
      ? saved.stopIds.map((id) => group.stops.find((s) => s.id === id)).filter((s): s is MapStop => Boolean(s))
      : group.stops;
    const missing = group.stops.filter((s) => !baseOrder.some((b) => b.id === s.id));
    setDraftOrder([...baseOrder, ...missing]);
    setEditingGroupKey(group.key);
    setViewingGroupKey(null);
    setSaveError(null);
  }

  function startViewingDraft(groupKey: string) {
    setViewingGroupKey(groupKey);
    setEditingGroupKey(null);
    setDraftOrder([]);
  }

  function cancelEditingDraft() {
    setEditingGroupKey(null);
    setDraftOrder([]);
    setSaveError(null);
  }

  function handleDragStart(event: ReactDragEvent, index: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    setDragIndex(index);
  }

  function handleDragOver(event: ReactDragEvent, index: number) {
    event.preventDefault();
    if (dragIndex !== null && index !== dragIndex) setDragOverIndex(index);
  }

  function handleDrop(event: ReactDragEvent, index: number) {
    event.preventDefault();
    setDraftOrder((prev) => {
      if (dragIndex === null || dragIndex === index) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleMarkerDragEnd(stopId: string, event: L.LeafletEvent) {
    const marker = event.target as L.Marker;
    const dropLatLng = marker.getLatLng();
    setDraftOrder((prev) => {
      const draggedIndex = prev.findIndex((s) => s.id === stopId);
      if (draggedIndex === -1) return prev;
      let nearestIndex = -1;
      let nearestDist = Infinity;
      prev.forEach((s, index) => {
        if (index === draggedIndex) return;
        const dist = Math.hypot(s.lat - dropLatLng.lat, s.lng - dropLatLng.lng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIndex = index;
        }
      });
      if (nearestIndex === -1) return prev;
      const next = [...prev];
      [next[draggedIndex], next[nearestIndex]] = [next[nearestIndex], next[draggedIndex]];
      return next;
    });
  }

  async function saveDraft() {
    if (!editingGroupKey) return;
    setSavingDraft(true);
    setSaveError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch("/api/route-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mode, groupKey: editingGroupKey, stopIds: draftOrder.map((s) => s.id) }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("save_failed");
      setEditingGroupKey(null);
      setDraftOrder([]);
      router.refresh();
    } catch {
      setSaveError("No se pudo guardar la ruta sugerida. Intenta de nuevo.");
    } finally {
      clearTimeout(timeout);
      setSavingDraft(false);
    }
  }

  async function discardDraft(groupKey: string) {
    setSavingDraft(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      await fetch("/api/route-drafts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mode, groupKey }),
        signal: controller.signal,
      });
      router.refresh();
    } finally {
      clearTimeout(timeout);
      setSavingDraft(false);
    }
  }

  const anyRouteUnavailable = routeGroups.some((g) => g.stops.length >= 2 && routes[g.key]?.status === "unavailable");
  const hasVisibleStops = visibleStops.length > 0;
  const bounds = hasVisibleStops ? visibleStops.map((s) => [s.lat, s.lng] as [number, number]) : null;
  const mapKey = hasVisibleStops ? `stops:${visibleStops.map((s) => s.id).join(",")}` : "empty";

  const mapChildren = (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {routeGroups.map((group) => {
        const route = routes[group.key];
        const polyline = route?.coordinates?.map(([lng, lat]) => [lat, lng] as [number, number]);
        return polyline ? (
          <Polyline key={group.key} positions={polyline} color={group.color} weight={4} opacity={0.8} />
        ) : null;
      })}
      {Object.keys(referenceOrders).map((key) => {
        const route = draftRoutes[key];
        const polyline = route?.coordinates?.map(([lng, lat]) => [lat, lng] as [number, number]);
        if (!polyline) return null;
        const color = routeGroups.find((g) => g.key === key)?.color ?? DRAFT_ROUTE_COLOR;
        return (
          <Polyline key={`draft-${key}`} positions={polyline} color={color} weight={4} opacity={0.85} dashArray="8 6" />
        );
      })}
      {routeGroups.map((group) => {
        const isEditingThis = editingGroupKey === group.key;
        const displayStops = isEditingThis ? draftOrder : group.stops;
        return displayStops.map((stop, index) => (
          <Marker
            key={stop.id}
            position={positions.get(stop.id) ?? [stop.lat, stop.lng]}
            icon={numberedIcon(
              index + 1,
              group.color,
              isEditingThis,
              stop.kind === "delivery",
              stop.kind !== "delivery" && stop.status === "not_confirmed",
            )}
            draggable={isEditingThis}
            eventHandlers={{
              click: () => setSelectedStop(stop),
              ...(isEditingThis ? { dragend: (event: L.LeafletEvent) => handleMarkerDragEnd(stop.id, event) } : {}),
            }}
          >
            <Tooltip direction="top" offset={[0, -16]} opacity={1}>
              <div className="text-xs">
                {stop.kind !== "delivery" && stop.status === "not_confirmed" && (
                  <p className="mb-1 rounded bg-warning px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Sin confirmar
                  </p>
                )}
                <p className="font-semibold">
                  {stop.kind === "delivery" && "Entrega · "}
                  {stop.code} — {stop.customerName}
                </p>
                <p className="text-muted">{stop.serviceName}</p>
                <p className="text-muted">
                  {stop.technicianName} · {formatRange(stop.startMin, stop.durationMin)}
                </p>
              </div>
            </Tooltip>
          </Marker>
        ));
      })}
    </>
  );

  return (
    <div className="flex flex-col gap-2">
      {stops.length === 0 && (
        <p className="text-xs text-muted">No hay citas con dirección geocodificada para este día.</p>
      )}
      {stops.length > 0 && !hasVisibleStops && (
        <p className="text-xs text-muted">Ningún resultado con el filtro actual.</p>
      )}

      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="h-[520px] min-w-0 flex-1 overflow-hidden rounded-md border border-hair">
          {hasVisibleStops ? (
            <MapContainer
              key={mapKey}
              bounds={bounds as [number, number][]}
              boundsOptions={{ padding: [32, 32] }}
              className="h-full w-full"
              scrollWheelZoom
            >
              {mapChildren}
            </MapContainer>
          ) : (
            <MapContainer
              key="empty"
              center={DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              className="h-full w-full"
              scrollWheelZoom
            >
              {mapChildren}
            </MapContainer>
          )}
        </div>

        <aside className="flex h-[520px] w-full flex-col overflow-hidden rounded-md border border-hair bg-paper lg:w-64 lg:shrink-0">
          {editingGroupKey ? (
            <>
              <div className="flex flex-col border-b border-hair px-3 py-2">
                <p className="text-sm font-semibold">Mejorar ruta</p>
                <p className="text-xs text-muted">
                  Arrastra en la lista o en el mapa para reordenar. No toca la ruta real.
                </p>
                {draftRoutes[editingGroupKey]?.status === "ok" && (
                  <p className="mt-1 text-xs font-medium text-muted">
                    Este orden: {formatKm(draftRoutes[editingGroupKey]!.distanceMeters!)} ·{" "}
                    {formatMin(draftRoutes[editingGroupKey]!.durationSeconds!)}
                    {routes[editingGroupKey]?.status === "ok" &&
                      ` (real: ${formatMin(routes[editingGroupKey]!.durationSeconds!)})`}
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                <div className="flex flex-col gap-1">
                  {draftOrder.map((stop, index) => (
                    <div
                      key={stop.id}
                      draggable
                      onDragStart={(event) => handleDragStart(event, index)}
                      onDragOver={(event) => handleDragOver(event, index)}
                      onDrop={(event) => handleDrop(event, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex cursor-grab items-center gap-2 rounded border px-2 py-1.5 text-sm transition active:cursor-grabbing ${
                        dragIndex === index
                          ? "scale-[0.98] border-hair bg-canvas opacity-40"
                          : dragOverIndex === index
                            ? "border-brand bg-brand/5"
                            : "border-hair bg-canvas"
                      }`}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: editingGroup?.color ?? DRAFT_ROUTE_COLOR }}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {stop.code} — {stop.customerName}
                        </p>
                        <p className="truncate text-xs text-muted">{formatRange(stop.startMin, stop.durationMin)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-hair p-2">
                {saveError && <p className="text-xs text-attention">{saveError}</p>}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={savingDraft}
                    className="flex-1 rounded-lg bg-brand px-2 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {savingDraft ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditingDraft}
                    disabled={savingDraft}
                    className="rounded-lg border border-hair px-2 py-1.5 text-sm disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </>
          ) : viewingGroupKey ? (
            <>
              <div className="flex flex-col border-b border-hair px-3 py-2">
                <p className="text-sm font-semibold">Ruta sugerida</p>
                <p className="text-xs text-muted">
                  {viewingSaved ? `Sugerida por ${viewingSaved.createdByName}. ` : ""}
                  Esto es lo que debe seguir el agente; no cambia la cita real.
                </p>
                {draftRoutes[viewingGroupKey]?.status === "ok" && (
                  <p className="mt-1 text-xs font-medium text-muted">
                    Sugerida: {formatKm(draftRoutes[viewingGroupKey]!.distanceMeters!)} ·{" "}
                    {formatMin(draftRoutes[viewingGroupKey]!.durationSeconds!)}
                    {routes[viewingGroupKey]?.status === "ok" &&
                      ` (real: ${formatMin(routes[viewingGroupKey]!.durationSeconds!)})`}
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                <div className="flex flex-col gap-1">
                  {viewingOrder.map((stop, index) => (
                    <div
                      key={stop.id}
                      className="flex items-center gap-2 rounded border border-hair bg-canvas px-2 py-1.5 text-sm"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: viewingGroup?.color ?? DRAFT_ROUTE_COLOR }}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {stop.code} — {stop.customerName}
                        </p>
                        <p className="truncate text-xs text-muted">{formatRange(stop.startMin, stop.durationMin)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-1.5 border-t border-hair p-2">
                <button
                  type="button"
                  onClick={() => viewingGroup && startEditingDraft(viewingGroup)}
                  className="flex-1 rounded-lg bg-brand px-2 py-1.5 text-sm font-semibold text-white"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => viewingGroupKey && discardDraft(viewingGroupKey)}
                  disabled={savingDraft}
                  className="rounded-lg border border-hair px-2 py-1.5 text-sm disabled:opacity-40"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={() => setViewingGroupKey(null)}
                  className="rounded-lg border border-hair px-2 py-1.5 text-sm"
                >
                  Cerrar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex border-b border-hair">
                <button
                  type="button"
                  onClick={() => changeMode("tech")}
                  className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                    mode === "tech" ? "bg-canvas text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  Técnicos{" "}
                  <span className="text-xs text-soft">
                    {checkedTechIds.size}/{technicians.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => changeMode("service")}
                  className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                    mode === "service" ? "bg-canvas text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  Servicios{" "}
                  <span className="text-xs text-soft">
                    {checkedServiceIds.size}/{services.length}
                  </span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {mode === "tech" ? (
                  <div className="flex flex-col gap-0.5">
                    {technicians.map((technician) => {
                      const group = routeGroups.find((g) => g.key === technician.id);
                      const canImprove = Boolean(group && group.stops.length >= 2);
                      const saved = canImprove ? savedDraftFor(technician.id) : null;
                      return (
                        <div key={technician.id} className="flex flex-col gap-0.5 rounded px-1.5 py-1 hover:bg-canvas">
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checkedTechIds.has(technician.id)}
                              onChange={() => toggleTech(technician.id)}
                              className="h-4 w-4 shrink-0"
                            />
                            <span
                              className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold"
                              style={{ backgroundColor: technician.color, color: readableOn(technician.color) }}
                            >
                              {initialsOf(technician.name)}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{technician.name}</span>
                            {routes[technician.id]?.status === "ok" && (
                              <span className="shrink-0 text-[10px] text-soft">
                                {formatKm(routes[technician.id]!.distanceMeters!)} ·{" "}
                                {formatMin(routes[technician.id]!.durationSeconds!)}
                              </span>
                            )}
                          </label>
                          {canImprove && group && (
                            <div className="flex items-center gap-2 pl-[30px] text-[11px]">
                              <button
                                type="button"
                                onClick={() => (saved ? startViewingDraft(technician.id) : startEditingDraft(group))}
                                className="font-medium text-brand hover:underline"
                              >
                                {saved ? "Ver ruta sugerida" : "Mejorar ruta"}
                              </button>
                              {saved && (
                                <button
                                  type="button"
                                  onClick={() => discardDraft(technician.id)}
                                  disabled={savingDraft}
                                  className="text-muted hover:underline disabled:opacity-40"
                                >
                                  Descartar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {services.map((service) => (
                      <label
                        key={service.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-canvas"
                      >
                        <input
                          type="checkbox"
                          checked={checkedServiceIds.has(service.id)}
                          onChange={() => toggleService(service.id)}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="truncate">{service.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {mode === "service" && routes.all?.status === "ok" && (
                <p className="border-t border-hair px-2 py-1.5 text-xs text-muted">
                  Ruta combinada: {formatKm(routes.all.distanceMeters!)} · {formatMin(routes.all.durationSeconds!)}
                </p>
              )}

              {mode === "service" &&
                editableGroups.map((group) => {
                  const saved = savedDraftFor(group.key);
                  return (
                    <div key={group.key} className="flex flex-col gap-1.5 border-t border-hair p-2">
                      {routes[group.key]?.status === "ok" && (
                        <p className="text-xs text-muted">
                          Ruta real: {formatKm(routes[group.key]!.distanceMeters!)} ·{" "}
                          {formatMin(routes[group.key]!.durationSeconds!)}
                        </p>
                      )}
                      {saved && (
                        <p className="text-xs text-muted">
                          Sugerida por {saved.createdByName}
                          {draftRoutes[group.key]?.status === "ok" &&
                            ` — ${formatKm(draftRoutes[group.key]!.distanceMeters!)} · ${formatMin(draftRoutes[group.key]!.durationSeconds!)}`}
                        </p>
                      )}
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => (saved ? startViewingDraft(group.key) : startEditingDraft(group))}
                          className="flex-1 rounded-lg bg-brand px-2 py-1.5 text-sm font-semibold text-white"
                        >
                          {saved ? "Ver ruta sugerida" : "Mejorar ruta"}
                        </button>
                        {saved && (
                          <button
                            type="button"
                            onClick={() => discardDraft(group.key)}
                            disabled={savingDraft}
                            className="rounded-lg border border-hair px-2 py-1.5 text-sm disabled:opacity-40"
                          >
                            Descartar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              <p className="border-t border-hair px-2 py-1.5 text-xs text-muted">
                {mode === "tech"
                  ? 'Una ruta por técnico marcado, en su color. "Mejorar ruta" aparece bajo cada técnico con 2 o más paradas.'
                  : "Una sola ruta con los servicios marcados, ordenada por hora."}
              </p>
            </>
          )}
        </aside>
      </div>

      {anyRouteUnavailable && (
        <p className="text-xs text-muted">
          No se pudo calcular alguna ruta entre paradas; se muestran solo los puntos.
        </p>
      )}

      {selectedStop && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setSelectedStop(null)}
            className="absolute inset-0 bg-ink/20"
          />
          <div className="relative flex w-full max-w-md flex-col gap-4 rounded-lg border border-hair bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold">
                  {selectedStop.code}
                  {selectedStop.kind === "delivery" && (
                    <span className="ml-2 rounded-[3px] bg-brand-soft px-1.5 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-brand-ink">
                      Entrega
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted">{selectedStop.serviceName}</p>
                {selectedStop.kind !== "delivery" && selectedStop.status === "not_confirmed" && (
                  <p className="mt-1.5 flex w-fit items-center gap-1 rounded bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                    Sin confirmar: llama al cliente para confirmar
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedStop(null)}
                className="rounded-lg border border-hair px-2 py-1 text-sm"
              >
                Cerrar
              </button>
            </div>

            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-muted">Cliente</dt>
                <dd className="font-medium">{selectedStop.customerName}</dd>
              </div>
              <div>
                <dt className="text-muted">Técnico</dt>
                <dd className="flex items-center gap-2 font-medium">
                  <span
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] text-[8px] font-bold"
                    style={{
                      backgroundColor: selectedStop.technicianColor,
                      color: readableOn(selectedStop.technicianColor),
                    }}
                  >
                    {initialsOf(selectedStop.technicianName)}
                  </span>
                  {selectedStop.technicianName}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Horario</dt>
                <dd className="font-medium">{formatRange(selectedStop.startMin, selectedStop.durationMin)}</dd>
              </div>
              <div>
                <dt className="text-muted">Dirección</dt>
                <dd className="font-medium">{selectedStop.address}</dd>
              </div>
              <div>
                <dt className="text-muted">ID interno</dt>
                <dd className="font-mono text-xs text-muted">{selectedStop.id}</dd>
              </div>
              {selectedStop.notes && (
                <div>
                  <dt className="text-muted">Notas</dt>
                  <dd>{selectedStop.notes}</dd>
                </div>
              )}
            </dl>

            <a
              href={`/appointments/${appointmentIdFromKey(selectedStop.id)}/edit?volver=${encodeURIComponent(returnHref)}`}
              className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Editar cita: servicios, precios y fotos
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
