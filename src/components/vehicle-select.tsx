"use client";

import { useState } from "react";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import { VEHICLE_SIZES, VEHICLE_SIZE_LABELS, vehicleSummary, type VehicleSize } from "@/domain/vehicles";

export type PickerVehicle = {
  id: string;
  make: string;
  model: string;
  year: number | null;
  color: string;
  plate: string;
  size: string;
};

const FIELD = `${INPUT} py-2`;
const NEW = "__new__";

export async function fetchVehicles(customerId: string): Promise<PickerVehicle[]> {
  try {
    const response = await fetch(`/api/customers/${customerId}/vehicles`);
    if (!response.ok) return [];
    const body = (await response.json()) as { vehicles: PickerVehicle[] };
    return body.vehicles;
  } catch {
    return [];
  }
}

export function VehicleSelect({
  customerId,
  vehicles,
  value,
  onChange,
  onCreated,
  label = "Vehículo",
}: {
  customerId: string | null;
  vehicles: readonly PickerVehicle[];
  value: string | null;
  onChange: (vehicleId: string | null) => void;
  onCreated: (vehicle: PickerVehicle) => void;
  label?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ size: "sedan" as VehicleSize, make: "", model: "", color: "", plate: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!customerId) {
    return <p className="text-xs text-muted">Elige el cliente para asignar el vehículo.</p>;
  }

  async function save() {
    if (!customerId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customerId}/vehicles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await response.json().catch(() => null)) as { vehicle?: PickerVehicle; message?: string } | null;
      if (!response.ok || !body?.vehicle) {
        setError(body?.message ?? "No se pudo guardar el vehículo.");
        return;
      }
      onCreated(body.vehicle);
      onChange(body.vehicle.id);
      setAdding(false);
      setDraft({ size: "sedan", make: "", model: "", color: "", plate: "" });
    } catch {
      setError("Sin conexión. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-soft">
        {label}
        <select
          value={adding ? NEW : (value ?? "")}
          onChange={(event) => {
            if (event.target.value === NEW) {
              setAdding(true);
              return;
            }
            setAdding(false);
            onChange(event.target.value || null);
          }}
          className={FIELD}
        >
          <option value="">Sin vehículo</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicleSummary(vehicle)}
            </option>
          ))}
          <option value={NEW}>＋ Agregar vehículo…</option>
        </select>
      </label>
      {adding && (
        <div className="flex flex-col gap-2 rounded-md border border-brand/30 bg-brand-soft/30 p-2.5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2">
            <select
              aria-label="Tipo de vehículo"
              value={draft.size}
              onChange={(event) => setDraft({ ...draft, size: event.target.value as VehicleSize })}
              className={FIELD}
            >
              {VEHICLE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {VEHICLE_SIZE_LABELS[size]}
                </option>
              ))}
            </select>
            <input
              aria-label="Marca"
              placeholder="Marca"
              value={draft.make}
              maxLength={40}
              onChange={(event) => setDraft({ ...draft, make: event.target.value })}
              className={FIELD}
            />
            <input
              aria-label="Modelo"
              placeholder="Modelo"
              value={draft.model}
              maxLength={40}
              onChange={(event) => setDraft({ ...draft, model: event.target.value })}
              className={FIELD}
            />
            <input
              aria-label="Color"
              placeholder="Color"
              value={draft.color}
              maxLength={30}
              onChange={(event) => setDraft({ ...draft, color: event.target.value })}
              className={FIELD}
            />
            <input
              aria-label="Placa"
              placeholder="Placa"
              value={draft.plate}
              maxLength={12}
              onChange={(event) => setDraft({ ...draft, plate: event.target.value })}
              className={`${FIELD} uppercase`}
            />
          </div>
          {error && <p className="text-xs text-attention">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              <Icon name="check" size={13} />
              {saving ? "Guardando…" : "Guardar vehículo"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-soft hover:bg-canvas"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
