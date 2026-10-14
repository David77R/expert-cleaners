"use client";

import dynamic from "next/dynamic";
import type { MapRouteDraft, MapServiceOption, MapStop, MapTechnicianOption } from "@/components/map-view";

const MapView = dynamic(() => import("@/components/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-md border border-hair bg-paper text-sm text-muted">
      Cargando mapa…
    </div>
  ),
});

export function MapViewLoader({
  date,
  stops,
  technicians,
  services,
  drafts,
}: {
  date: string;
  stops: MapStop[];
  technicians: MapTechnicianOption[];
  services: MapServiceOption[];
  drafts: MapRouteDraft[];
}) {
  return <MapView date={date} stops={stops} technicians={technicians} services={services} drafts={drafts} />;
}
