"use client";

import { useActionState } from "react";
import { quickCreateCustomerAction, type QuickCustomerState } from "@/app/orders/new/actions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Field, INPUT } from "@/components/form-kit";
import type { PickerCustomer } from "@/domain/appointment-form";
import { DEFAULT_STATE, type CustomerFormValues, type CustomerPrefill } from "@/domain/customer-form";

export function QuickCustomerForm({
  onCreated,
  onCancel,
  prefill = {},
}: {
  onCreated: (customer: PickerCustomer, existing: boolean) => void;
  onCancel: () => void;
  prefill?: CustomerPrefill;
}) {
  const [state, action, pending] = useActionState(
    async (previous: QuickCustomerState, formData: FormData) => {
      const next = await quickCreateCustomerAction(previous, formData);
      if (next.customer) onCreated(next.customer, Boolean(next.existing));
      return next;
    },
    { errors: {}, stamp: 0 },
  );
  const values: Partial<CustomerFormValues> | undefined = state.values ?? prefill;
  const errors = state.errors;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field prefix="quick" name="firstName" label="Nombre" error={errors.firstName}>
          {(props) => <input {...props} name="firstName" defaultValue={values?.firstName} className={INPUT} />}
        </Field>
        <Field prefix="quick" name="lastName" label="Apellido" error={errors.lastName}>
          {(props) => <input {...props} name="lastName" defaultValue={values?.lastName} className={INPUT} />}
        </Field>
        <Field prefix="quick" name="phone" label="Teléfono" error={errors.phone}>
          {(props) => <input {...props} name="phone" type="tel" defaultValue={values?.phone} className={INPUT} />}
        </Field>
        <Field prefix="quick" name="email" label="Correo" error={errors.email} optional>
          {(props) => <input {...props} name="email" type="email" defaultValue={values?.email} className={INPUT} />}
        </Field>
        <Field prefix="quick" name="line1" label="Calle y número" error={errors.line1} wide>
          {(props) => (
            <AddressAutocomplete
              control={props}
              name="line1"
              defaultValue={values?.line1 ?? ""}
              placeholder="Empieza a escribir y elige una sugerencia"
              className={INPUT}
            />
          )}
        </Field>
        <Field prefix="quick" name="unit" label="Apartamento o suite" error={errors.unit} optional>
          {(props) => <input {...props} name="unit" defaultValue={values?.unit} className={INPUT} />}
        </Field>
        <Field prefix="quick" name="city" label="Ciudad" error={errors.city}>
          {(props) => <input {...props} name="city" defaultValue={values?.city} className={INPUT} />}
        </Field>
        <Field prefix="quick" name="state" label="Estado" error={errors.state}>
          {(props) => (
            <input
              {...props}
              name="state"
              maxLength={2}
              defaultValue={values?.state || DEFAULT_STATE}
              className={`${INPUT} uppercase`}
            />
          )}
        </Field>
        <Field prefix="quick" name="zip" label="Código postal" error={errors.zip}>
          {(props) => <input {...props} name="zip" inputMode="numeric" defaultValue={values?.zip} className={INPUT} />}
        </Field>
        <Field prefix="quick" name="addressNotes" label="Indicaciones de la dirección" wide optional>
          {(props) => (
            <input
              {...props}
              name="addressNotes"
              defaultValue={values?.addressNotes}
              placeholder="Portón, código de acceso…"
              className={INPUT}
            />
          )}
        </Field>
        <Field prefix="quick" name="notes" label="Notas del cliente" wide optional>
          {(props) => <textarea {...props} name="notes" rows={2} defaultValue={values?.notes} className={INPUT} />}
        </Field>
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="allowMarketing"
            defaultChecked={values?.allowMarketing === "on"}
            className="h-4 w-4 accent-brand"
          />
          Acepta recibir promociones
        </label>
      </div>
      {state.message && (
        <p role="alert" className="rounded-md bg-attention-soft px-3.5 py-2.5 text-sm font-medium text-attention">
          {state.message}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm font-semibold text-soft hover:bg-canvas"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Crear y usar en el pedido"}
        </button>
      </div>
    </form>
  );
}
