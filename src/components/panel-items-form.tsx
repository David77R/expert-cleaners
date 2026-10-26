"use client";

import { useState } from "react";
import { AppointmentItemsEditor, type EditorItem } from "@/components/appointment-items-editor";
import { INPUT } from "@/components/form-kit";
import type { PickerVehicle } from "@/components/vehicle-select";
import type { ItemValues } from "@/domain/appointment-items";
import { DESTINATION_PREFIX, type FormService } from "@/domain/appointment-form";
import { DEFAULT_STATE } from "@/domain/customer-form";

const DESTINATION_INPUTS = [
  { field: "line1", label: "Calle y número" },
  { field: "unit", label: "Apartamento o suite" },
  { field: "city", label: "Ciudad" },
  { field: "state", label: "Estado" },
  { field: "zip", label: "Código postal" },
] as const;

export function PanelItemsForm({
  appointmentId,
  services,
  initialItems,
  durationMin,
  hasDestination,
  compact = true,
  showDuration = true,
  customerId = null,
  vehicles = [],
}: {
  appointmentId: string;
  services: FormService[];
  initialItems: ItemValues[];
  durationMin: number;
  hasDestination: boolean;
  compact?: boolean;
  showDuration?: boolean;
  customerId?: string | null;
  vehicles?: PickerVehicle[];
}) {
  const [needsDestination, setNeedsDestination] = useState(false);
  const idPrefix = `panel-${appointmentId}`;

  function changeItems(items: EditorItem[]) {
    setNeedsDestination(items.some((item) => item.service?.twoAddresses));
  }

  return (
    <div className="flex flex-col gap-3">
      <AppointmentItemsEditor
        services={services}
        initialItems={initialItems}
        idPrefix={idPrefix}
        compact={compact}
        onChange={changeItems}
        customerId={customerId}
        vehicles={vehicles}
      />
      {needsDestination && !hasDestination && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Dirección de entrega</legend>
          {DESTINATION_INPUTS.map(({ field, label }) => (
            <label key={field} className="flex flex-col gap-1 text-sm">
              {label}
              <input
                name={`${DESTINATION_PREFIX}${field}`}
                defaultValue={field === "state" ? DEFAULT_STATE : ""}
                className={INPUT}
              />
            </label>
          ))}
        </fieldset>
      )}
      {showDuration && (
        <label htmlFor={`${idPrefix}-duration`} className="flex flex-col gap-1.5 text-sm font-medium">
          Duración (minutos)
          <input
            id={`${idPrefix}-duration`}
            name="durationMin"
            type="number"
            inputMode="numeric"
            min={0}
            max={720}
            step={1}
            defaultValue={durationMin}
            className={INPUT}
          />
        </label>
      )}
    </div>
  );
}
