"use client";

import Link from "next/link";
import { useBrand } from "@/components/brand-provider";
import { useActionState, type ComponentProps } from "react";
import { createCustomerAction, type CustomerFormState } from "@/app/customers/new/actions";
import { emptyCustomerForm, type CustomerFormField, type CustomerPrefill } from "@/domain/customer-form";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Card, Field, INPUT } from "@/components/form-kit";

function CustomerField(props: Omit<ComponentProps<typeof Field>, "prefix" | "name"> & { name: CustomerFormField }) {
  return <Field prefix="customer" {...props} />;
}

export function CustomerForm({ prefill = {} }: { prefill?: CustomerPrefill }) {
  const brand = useBrand();
  const initial: CustomerFormState = { values: { ...emptyCustomerForm(brand.location.state), ...prefill }, errors: {} };
  const [state, action, pending] = useActionState(createCustomerAction, initial);
  const { values, errors } = state;

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-5" noValidate>
      <Card title="Datos del cliente">
        <CustomerField name="firstName" label="Nombre" error={errors.firstName}>
          {(props) => (
            <input
              {...props}
              name="firstName"
              defaultValue={values.firstName}
              required
              autoComplete="given-name"
              className={INPUT}
            />
          )}
        </CustomerField>
        <CustomerField name="lastName" label="Apellido" error={errors.lastName}>
          {(props) => (
            <input
              {...props}
              name="lastName"
              defaultValue={values.lastName}
              required
              autoComplete="family-name"
              className={INPUT}
            />
          )}
        </CustomerField>
        <CustomerField name="phone" label="Teléfono" error={errors.phone}>
          {(props) => (
            <input
              {...props}
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={values.phone}
              required
              autoComplete="tel"
              placeholder="(305) 555-0142"
              className={INPUT}
            />
          )}
        </CustomerField>
        <CustomerField name="email" label="Correo" error={errors.email} optional>
          {(props) => (
            <input
              {...props}
              name="email"
              type="email"
              defaultValue={values.email}
              autoComplete="email"
              placeholder="cliente@correo.com"
              className={INPUT}
            />
          )}
        </CustomerField>
        <CustomerField name="notes" label="Notas generales" error={errors.notes} wide optional>
          {(props) => (
            <textarea
              {...props}
              name="notes"
              rows={3}
              defaultValue={values.notes}
              placeholder="Ej: prefiere que llamen antes de llegar"
              className={`${INPUT} resize-y`}
            />
          )}
        </CustomerField>
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="allowMarketing"
            defaultChecked={values.allowMarketing === "on"}
            className="h-4 w-4 rounded border-hair accent-brand"
          />
          El cliente acepta recibir promociones
        </label>
      </Card>

      <Card
        title="Dirección del servicio"
        hint="Empieza a escribir la calle y elige una sugerencia: la ciudad, el estado y el código postal se llenan solos."
      >
        <CustomerField name="line1" label="Calle y número" error={errors.line1} wide>
          {(props) => (
            <AddressAutocomplete
              control={props}
              name="line1"
              defaultValue={values.line1}
              required
              placeholder="1450 SW 8th St"
              className={INPUT}
            />
          )}
        </CustomerField>
        <CustomerField name="unit" label="Apartamento o suite" error={errors.unit} optional>
          {(props) => (
            <input
              {...props}
              name="unit"
              defaultValue={values.unit}
              autoComplete="address-line2"
              placeholder="Apt 4B"
              className={INPUT}
            />
          )}
        </CustomerField>
        <CustomerField name="city" label="Ciudad" error={errors.city}>
          {(props) => (
            <input
              {...props}
              name="city"
              defaultValue={values.city}
              required
              autoComplete="address-level2"
              className={INPUT}
            />
          )}
        </CustomerField>
        <CustomerField name="state" label="Estado" error={errors.state}>
          {(props) => (
            <input
              {...props}
              name="state"
              defaultValue={values.state}
              required
              maxLength={2}
              autoComplete="address-level1"
              className={`${INPUT} uppercase`}
            />
          )}
        </CustomerField>
        <CustomerField name="zip" label="Código postal" error={errors.zip}>
          {(props) => (
            <input
              {...props}
              name="zip"
              inputMode="numeric"
              defaultValue={values.zip}
              required
              autoComplete="postal-code"
              placeholder="33135"
              className={INPUT}
            />
          )}
        </CustomerField>
        <CustomerField name="addressNotes" label="Indicaciones de acceso" error={errors.addressNotes} wide optional>
          {(props) => (
            <textarea
              {...props}
              name="addressNotes"
              rows={2}
              defaultValue={values.addressNotes}
              placeholder="Ej: entrar por el estacionamiento trasero"
              className={`${INPUT} resize-y`}
            />
          )}
        </CustomerField>
      </Card>

      {state.message && (
        <p role="alert" className="rounded-md bg-attention-soft px-3.5 py-2.5 text-sm font-medium text-attention">
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/customers" className="rounded-md px-4 py-2 text-sm font-semibold text-soft hover:bg-canvas">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
