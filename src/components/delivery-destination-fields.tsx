"use client";

import { useState } from "react";
import { AddressFields } from "@/components/address-fields";

type Snapshot = { line1: string; unit?: string; city: string; state: string; zip: string };

export function DeliveryDestinationFields({
  serviceAddress,
  destination,
}: {
  serviceAddress: string;
  destination: Snapshot | null;
}) {
  const [mode, setMode] = useState<"same" | "custom">(destination ? "custom" : "same");
  return (
    <div className="flex flex-col gap-2.5">
      <input type="hidden" name="destinationMode" value={mode} />
      <div role="radiogroup" aria-label="Dirección de entrega" className="flex flex-col gap-1.5">
        {(
          [
            ["same", "La misma del servicio", serviceAddress],
            ["custom", "Otra dirección", "Escríbela y elige la sugerencia"],
          ] as const
        ).map(([value, title, detail]) => (
          <label
            key={value}
            className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors ${
              mode === value ? "border-brand bg-brand-soft/40" : "border-hair hover:bg-canvas"
            }`}
          >
            <input
              type="radio"
              checked={mode === value}
              onChange={() => setMode(value)}
              className="mt-0.5 accent-brand"
            />
            <span className="min-w-0 leading-tight">
              <span className="block font-medium">{title}</span>
              <span className="block text-xs text-soft">{detail}</span>
            </span>
          </label>
        ))}
      </div>
      {mode === "custom" && <AddressFields defaults={destination ?? {}} />}
    </div>
  );
}
