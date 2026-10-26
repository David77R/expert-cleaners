"use client";

import { useId } from "react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { FIELD } from "@/components/panel-kit";
import { DEFAULT_STATE } from "@/domain/customer-form";

type AddressDefaults = {
  line1?: string;
  unit?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string | null;
};

export function AddressFields({ defaults = {} }: { defaults?: AddressDefaults }) {
  const id = useId();
  const label = "flex flex-col gap-1 text-xs font-medium text-soft";
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label htmlFor={`${id}-line1`} className={`${label} sm:col-span-2`}>
        Calle y número
        <AddressAutocomplete
          control={{ id: `${id}-line1`, "aria-invalid": false, "aria-describedby": undefined }}
          name="line1"
          defaultValue={defaults.line1 ?? ""}
          required
          placeholder="Empieza a escribir y elige una sugerencia"
          className={FIELD}
        />
      </label>
      <label className={label}>
        Apartamento o suite
        <input name="unit" defaultValue={defaults.unit ?? ""} className={FIELD} />
      </label>
      <label className={label}>
        Ciudad
        <input name="city" required defaultValue={defaults.city ?? ""} className={FIELD} />
      </label>
      <label className={label}>
        Estado
        <input
          name="state"
          maxLength={2}
          defaultValue={defaults.state ?? DEFAULT_STATE}
          className={`${FIELD} uppercase`}
        />
      </label>
      <label className={label}>
        Código postal
        <input name="zip" required inputMode="numeric" defaultValue={defaults.zip ?? ""} className={FIELD} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Indicaciones
        <input
          name="notes"
          defaultValue={defaults.notes ?? ""}
          placeholder="Portón, código de acceso…"
          className={FIELD}
        />
      </label>
    </div>
  );
}
