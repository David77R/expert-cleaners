"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type ComponentProps, type FormEvent } from "react";
import { createAppointmentAction, type AppointmentFormState } from "@/app/appointments/new/actions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { AppointmentItemsEditor, itemsDuration, type EditorItem } from "@/components/appointment-items-editor";
import { CustomerPicker } from "@/components/customer-picker";
import { Card, Field, INPUT } from "@/components/form-kit";
import { readItemValues } from "@/domain/appointment-items";
import {
  DESTINATION_PREFIX,
  type AppointmentFormValues,
  type FormService,
  type FormTechnician,
  type PickerCustomer,
} from "@/domain/appointment-form";
import { formatMinutes } from "@/domain/appointment-rules";
import { formatAddress } from "@/domain/invoice";
import { calendarHref } from "@/lib/calendar-links";

function AppointmentField(props: Omit<ComponentProps<typeof Field>, "prefix">) {
  return <Field prefix="appointment" {...props} />;
}

function Group({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:col-span-2" role="group" aria-label={label}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error && (
        <p role="alert" className="text-sm text-attention">
          {error}
        </p>
      )}
    </div>
  );
}

const CHOICE =
  "flex cursor-pointer items-center gap-3 rounded-md border border-hair bg-paper px-3.5 py-3 text-sm transition-colors hover:bg-canvas has-[:checked]:border-brand has-[:checked]:bg-brand-soft/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/30";

export function AppointmentForm({
  services,
  technicians,
  initialCustomer,
  initialValues,
}: {
  services: FormService[];
  technicians: FormTechnician[];
  initialCustomer: PickerCustomer | null;
  initialValues: AppointmentFormValues;
}) {
  const initial: AppointmentFormState = { values: initialValues, errors: {} };
  const [state, action, actionPending] = useActionState(createAppointmentAction, initial);
  const [transitionPending, startTransition] = useTransition();
  const pending = actionPending || transitionPending;
  const { values, errors } = state;

  const [customer, setCustomer] = useState<PickerCustomer | null>(initialCustomer);
  const [addressId, setAddressId] = useState(initialValues.addressId ?? "");
  const [items, setItems] = useState<EditorItem[]>(() =>
    readItemValues(initialValues).map((row) => ({
      service: services.find((option) => option.id === row.serviceId) ?? null,
      priceCents: 0,
    })),
  );
  const [technicianId, setTechnicianId] = useState(initialValues.technicianId ?? "");
  const [duration, setDuration] = useState(initialValues.durationMin ?? "");

  const needsDestination = items.some((item) => item.service?.twoAddresses);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }

  function chooseCustomer(next: PickerCustomer) {
    setCustomer(next);
    setAddressId(next.addresses[0]?.id ?? "");
  }

  function changeItems(next: EditorItem[]) {
    const signature = (list: EditorItem[]) => list.map((item) => item.service?.id ?? "").join(",");
    const changed = signature(next) !== signature(items);
    setItems(next);
    if (changed && next.some((item) => item.service)) setDuration(String(itemsDuration(next)));
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-5" noValidate>
      <Card title="Cliente">
        <div className="flex flex-col gap-4 sm:col-span-2">
          <input type="hidden" name="customerId" value={customer?.id ?? ""} />
          <CustomerPicker
            selected={customer}
            onSelect={chooseCustomer}
            onClear={() => {
              setCustomer(null);
              setAddressId("");
            }}
            error={errors.customerId}
          />
          {customer && (
            <Group label="Dirección del servicio" error={errors.addressId}>
              <div className="grid gap-2">
                {customer.addresses.map((address) => (
                  <label key={address.id} className={CHOICE}>
                    <input
                      type="radio"
                      name="addressId"
                      value={address.id}
                      checked={addressId === address.id}
                      onChange={() => setAddressId(address.id)}
                      className="h-4 w-4 accent-brand"
                    />
                    <span>{formatAddress(address)}</span>
                  </label>
                ))}
              </div>
            </Group>
          )}
        </div>
      </Card>

      <Card title="Servicios" hint="Agrega todos los artículos de la cita. El precio de cada uno se puede ajustar.">
        <AppointmentItemsEditor
          services={services}
          initialItems={readItemValues(initialValues)}
          errors={errors}
          idPrefix="appointment"
          onChange={changeItems}
        />

        {needsDestination && (
          <>
            <p className="text-sm font-medium sm:col-span-2">Dirección de entrega</p>
            <AppointmentField
              name={`${DESTINATION_PREFIX}line1`}
              label="Calle y número"
              error={errors[`${DESTINATION_PREFIX}line1`]}
              wide
            >
              {(props) => (
                <AddressAutocomplete
                  control={props}
                  name={`${DESTINATION_PREFIX}line1`}
                  prefix={DESTINATION_PREFIX}
                  defaultValue={values[`${DESTINATION_PREFIX}line1`] ?? ""}
                  className={INPUT}
                />
              )}
            </AppointmentField>
            <AppointmentField
              name={`${DESTINATION_PREFIX}unit`}
              label="Apartamento o suite"
              error={errors[`${DESTINATION_PREFIX}unit`]}
              optional
            >
              {(props) => (
                <input
                  {...props}
                  name={`${DESTINATION_PREFIX}unit`}
                  defaultValue={values[`${DESTINATION_PREFIX}unit`] ?? ""}
                  className={INPUT}
                />
              )}
            </AppointmentField>
            <AppointmentField
              name={`${DESTINATION_PREFIX}city`}
              label="Ciudad"
              error={errors[`${DESTINATION_PREFIX}city`]}
            >
              {(props) => (
                <input
                  {...props}
                  name={`${DESTINATION_PREFIX}city`}
                  defaultValue={values[`${DESTINATION_PREFIX}city`] ?? ""}
                  className={INPUT}
                />
              )}
            </AppointmentField>
            <AppointmentField
              name={`${DESTINATION_PREFIX}state`}
              label="Estado"
              error={errors[`${DESTINATION_PREFIX}state`]}
            >
              {(props) => (
                <input
                  {...props}
                  name={`${DESTINATION_PREFIX}state`}
                  defaultValue={values[`${DESTINATION_PREFIX}state`] ?? "FL"}
                  maxLength={2}
                  className={`${INPUT} uppercase`}
                />
              )}
            </AppointmentField>
            <AppointmentField
              name={`${DESTINATION_PREFIX}zip`}
              label="Código postal"
              error={errors[`${DESTINATION_PREFIX}zip`]}
            >
              {(props) => (
                <input
                  {...props}
                  name={`${DESTINATION_PREFIX}zip`}
                  inputMode="numeric"
                  defaultValue={values[`${DESTINATION_PREFIX}zip`] ?? ""}
                  className={INPUT}
                />
              )}
            </AppointmentField>
          </>
        )}
      </Card>

      <Card
        title="Horario"
        hint="Si la hora coincide con otra cita del técnico, la cita se crea igual y se marca en conflicto."
      >
        <Group label="Técnico" error={errors.technicianId}>
          <div className="grid gap-2 sm:grid-cols-2">
            {technicians.map((technician) => (
              <label key={technician.id} className={CHOICE}>
                <input
                  type="radio"
                  name="technicianId"
                  value={technician.id}
                  checked={technicianId === technician.id}
                  onChange={() => setTechnicianId(technician.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="h-9 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: technician.color }}
                />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate font-medium">{technician.name}</span>
                  <span className="block text-xs text-soft">
                    {technician.zone} · {formatMinutes(technician.shiftStartMin)} –{" "}
                    {formatMinutes(technician.shiftEndMin)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Group>

        <AppointmentField name="date" label="Fecha" error={errors.date}>
          {(props) => (
            <input {...props} name="date" type="date" defaultValue={values.date ?? ""} required className={INPUT} />
          )}
        </AppointmentField>
        <AppointmentField name="time" label="Hora de inicio" error={errors.time}>
          {(props) => (
            <input {...props} name="time" type="time" defaultValue={values.time ?? ""} required className={INPUT} />
          )}
        </AppointmentField>
        <AppointmentField name="durationMin" label="Duración (minutos)" error={errors.durationMin}>
          {(props) => (
            <input
              {...props}
              name="durationMin"
              type="number"
              inputMode="numeric"
              min={0}
              max={720}
              step={1}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              required
              className={INPUT}
            />
          )}
        </AppointmentField>
      </Card>

      <Card title="Notas de la cita">
        <AppointmentField name="notes" label="Indicaciones para el técnico" wide optional>
          {(props) => (
            <textarea
              {...props}
              name="notes"
              rows={3}
              defaultValue={values.notes ?? ""}
              placeholder="Acceso, mascotas, estacionamiento…"
              className={`${INPUT} resize-y`}
            />
          )}
        </AppointmentField>
      </Card>

      {state.message && (
        <p role="alert" className="rounded-md bg-attention-soft px-3.5 py-2.5 text-sm font-medium text-attention">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={calendarHref({ date: values.date || undefined })}
            className="rounded-md px-4 py-2 text-sm font-semibold text-soft hover:bg-canvas"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Creando…" : "Crear cita"}
          </button>
        </div>
      </div>
    </form>
  );
}
