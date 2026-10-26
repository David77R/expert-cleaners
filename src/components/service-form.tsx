"use client";

import Link from "next/link";
import { useBrand } from "@/components/brand-provider";
import { useActionState, useState, useTransition, type ComponentProps, type FormEvent } from "react";
import { createServiceAction, updateServiceAction, type ServiceFormState } from "@/app/services/actions";
import { Card, Field, INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";
import { ServiceIcon } from "@/components/service-icon";
import { SERVICE_ICONS, SERVICE_ICON_KEYS } from "@/domain/service-icons";
import { VEHICLE_SIZES, VEHICLE_SIZE_LABELS } from "@/domain/vehicles";
import {
  MAX_SERVICE_FIELDS,
  SIZE_PRICE_PREFIX,
  emptyFieldDraft,
  type FieldDraft,
  type ServiceFormValues,
  type ServiceTextField,
} from "@/domain/service-form";

type Row = FieldDraft & { rid: number };

function ServiceFormField(props: Omit<ComponentProps<typeof Field>, "prefix" | "name"> & { name: ServiceTextField }) {
  return <Field prefix="service" {...props} />;
}

const ICON_CHOICE =
  "flex cursor-pointer flex-col items-center gap-1 rounded-md border border-hair bg-paper px-1.5 py-2 text-center text-ink transition-colors hover:bg-canvas has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/30";

const ICON_BUTTON =
  "flex h-9 w-9 items-center justify-center rounded-md text-soft transition-colors hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-40";

export function ServiceForm({
  serviceId,
  initialValues,
  categories,
  lockTwoAddresses,
}: {
  serviceId?: string;
  initialValues: ServiceFormValues;
  categories: string[];
  lockTwoAddresses: boolean;
}) {
  const brand = useBrand();
  const initial: ServiceFormState = { values: initialValues, errors: {} };
  const [state, action, actionPending] = useActionState(
    serviceId ? updateServiceAction.bind(null, serviceId) : createServiceAction,
    initial,
  );
  const [transitionPending, startTransition] = useTransition();
  const pending = actionPending || transitionPending;
  const { values, errors } = state;
  const editing = serviceId !== undefined;

  const [nextId, setNextId] = useState(initialValues.fields.length);
  const [rows, setRows] = useState<Row[]>(() => initialValues.fields.map((field, index) => ({ ...field, rid: index })));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }

  function addRow() {
    setRows((previous) => [...previous, { ...emptyFieldDraft(), rid: nextId }]);
    setNextId((id) => id + 1);
  }

  function removeRow(rid: number) {
    setRows((previous) => previous.filter((row) => row.rid !== rid));
  }

  function moveRow(index: number, direction: 1 | -1) {
    setRows((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const copy = [...previous];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function changeType(rid: number, type: FieldDraft["type"]) {
    setRows((previous) => previous.map((row) => (row.rid === rid ? { ...row, type } : row)));
  }

  const hasFieldErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-5" noValidate>
      <Card title="Datos del servicio">
        <ServiceFormField name="name" label="Nombre" error={errors.name} wide>
          {(props) => (
            <input {...props} name="name" defaultValue={values.name} required className={INPUT} maxLength={80} />
          )}
        </ServiceFormField>
        <ServiceFormField name="category" label="Categoría" error={errors.category}>
          {(props) => (
            <>
              <input
                {...props}
                name="category"
                list="service-categories"
                defaultValue={values.category}
                required
                autoComplete="off"
                placeholder="Ej: Alfombras"
                className={INPUT}
              />
              <datalist id="service-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </>
          )}
        </ServiceFormField>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="text-sm font-medium">
            Ícono
            <span className="ml-1.5 font-normal text-muted">(si no eliges, se asigna según el nombre)</span>
          </legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-9">
            <label className={ICON_CHOICE} title="Automático">
              <input type="radio" name="icon" value="" defaultChecked={values.icon === ""} className="sr-only" />
              <span className="flex h-7 items-center text-xs font-semibold text-soft">Auto</span>
              <span className="text-[10px] leading-tight text-muted">Automático</span>
            </label>
            {SERVICE_ICON_KEYS.map((key) => (
              <label key={key} className={ICON_CHOICE} title={SERVICE_ICONS[key]}>
                <input type="radio" name="icon" value={key} defaultChecked={values.icon === key} className="sr-only" />
                <ServiceIcon icon={key} size={26} />
                <span className="line-clamp-1 text-[10px] leading-tight text-muted">{SERVICE_ICONS[key]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-4">
          <ServiceFormField name="price" label="Precio base" error={errors.price}>
            {(props) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-muted">
                  $
                </span>
                <input
                  {...props}
                  name="price"
                  inputMode="decimal"
                  defaultValue={values.price}
                  required
                  placeholder="0"
                  className={`${INPUT} pl-7 tabular-nums`}
                />
              </div>
            )}
          </ServiceFormField>
          <ServiceFormField name="durationMin" label="Duración (min)" error={errors.durationMin}>
            {(props) => (
              <input
                {...props}
                name="durationMin"
                inputMode="numeric"
                defaultValue={values.durationMin}
                required
                className={`${INPUT} tabular-nums`}
              />
            )}
          </ServiceFormField>
        </div>
        {brand.features.vehicles && (
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="text-sm font-medium">
              Precio según el tipo de vehículo <span className="font-normal text-muted">(opcional)</span>
            </legend>
            <p className="text-xs text-soft">Déjalo vacío para usar el precio base en ese tipo de vehículo.</p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-3">
              {VEHICLE_SIZES.map((size) => (
                <label key={size} className="flex flex-col gap-1 text-xs font-medium text-soft">
                  {VEHICLE_SIZE_LABELS[size]}
                  <span className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
                      $
                    </span>
                    <input
                      name={`${SIZE_PRICE_PREFIX}${size}`}
                      inputMode="decimal"
                      defaultValue={values.sizePrices[size]}
                      placeholder={values.price || "0"}
                      className={`${INPUT} pl-6 tabular-nums`}
                    />
                  </span>
                </label>
              ))}
            </div>
            {errors.sizePrices && <p className="text-sm text-attention">{errors.sizePrices}</p>}
          </fieldset>
        )}
        <ServiceFormField name="description" label="Descripción" error={errors.description} wide optional>
          {(props) => (
            <textarea
              {...props}
              name="description"
              rows={2}
              defaultValue={values.description}
              placeholder="Lo que se le explica al cliente sobre el servicio"
              className={`${INPUT} resize-y`}
            />
          )}
        </ServiceFormField>
        <div className="flex flex-col gap-2.5 sm:col-span-2">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="twoAddresses"
              defaultChecked={values.twoAddresses}
              disabled={lockTwoAddresses}
              className="h-4 w-4 rounded border-hair accent-brand"
            />
            Lleva dos direcciones (recogida y entrega)
          </label>
          {lockTwoAddresses && (
            <p className="text-sm text-soft">Esto ya no se puede cambiar porque el servicio tiene citas registradas.</p>
          )}
          {editing && (
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={values.active}
                className="h-4 w-4 rounded border-hair accent-brand"
              />
              Disponible para agendar
            </label>
          )}
        </div>
      </Card>

      <fieldset className="flex flex-col gap-4 rounded-md border border-hair bg-paper p-5 sm:p-6">
        <legend className="sr-only">Datos que se piden al agendar</legend>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Datos que se piden al agendar</h2>
            <p className="mt-0.5 text-sm text-soft">
              Por ejemplo, cantidad de asientos o tipo de tela. Aparecen en el formulario de la cita en este orden.
            </p>
          </div>
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= MAX_SERVICE_FIELDS}
            className="flex min-h-10 items-center gap-2 rounded-md border border-hair bg-paper px-3.5 text-sm font-semibold transition-colors hover:bg-canvas disabled:pointer-events-none disabled:opacity-60"
          >
            <Icon name="plus" />
            Agregar dato
          </button>
        </div>

        <input type="hidden" name="fieldCount" value={rows.length} />
        {errors.fields && (
          <p role="alert" className="text-sm text-attention">
            {errors.fields}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-hair px-3 py-4 text-sm text-soft">
            Este servicio no pide datos adicionales al agendar.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {rows.map((row, index) => {
              const rowErrors = errors.rows?.[index];
              return (
                <li key={row.rid} className="flex flex-col gap-3 rounded-md border border-hair bg-canvas/60 p-4">
                  <input type="hidden" name={`field_${index}_key`} defaultValue={row.key} />
                  <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
                    <Field
                      prefix="service"
                      name={`field-${row.rid}-label`}
                      label="Nombre del dato"
                      error={rowErrors?.label}
                    >
                      {(props) => (
                        <input
                          {...props}
                          name={`field_${index}_label`}
                          defaultValue={row.label}
                          placeholder="Ej: Cantidad de asientos"
                          className={INPUT}
                        />
                      )}
                    </Field>
                    <Field prefix="service" name={`field-${row.rid}-type`} label="Tipo">
                      {(props) => (
                        <select
                          {...props}
                          name={`field_${index}_type`}
                          value={row.type}
                          onChange={(event) =>
                            changeType(row.rid, event.target.value === "select" ? "select" : "number")
                          }
                          className={INPUT}
                        >
                          <option value="number">Número</option>
                          <option value="select">Lista de opciones</option>
                        </select>
                      )}
                    </Field>
                  </div>

                  {row.type === "select" && (
                    <Field
                      prefix="service"
                      name={`field-${row.rid}-options`}
                      label="Opciones (una por línea)"
                      error={rowErrors?.options}
                    >
                      {(props) => (
                        <textarea
                          {...props}
                          name={`field_${index}_options`}
                          rows={3}
                          defaultValue={row.options}
                          placeholder={"Tela\nCuero\nMicrofibra"}
                          className={`${INPUT} resize-y`}
                        />
                      )}
                    </Field>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        name={`field_${index}_required`}
                        defaultChecked={row.required}
                        className="h-4 w-4 rounded border-hair accent-brand"
                      />
                      Obligatorio
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveRow(index, -1)}
                        disabled={index === 0}
                        className={ICON_BUTTON}
                      >
                        <Icon name="up" />
                        <span className="sr-only">Subir este dato</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRow(index, 1)}
                        disabled={index === rows.length - 1}
                        className={ICON_BUTTON}
                      >
                        <Icon name="down" />
                        <span className="sr-only">Bajar este dato</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row.rid)}
                        className={`${ICON_BUTTON} hover:text-attention`}
                      >
                        <Icon name="trash" />
                        <span className="sr-only">Quitar este dato</span>
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </fieldset>

      <Card
        title="Checklist del técnico"
        hint="Las tareas que el técnico marca en la hoja de trabajo de cada cita. Una tarea por línea; escribe # al inicio para poner un título de grupo."
      >
        <ServiceFormField name="checklist" label="Tareas" error={errors.checklist} wide optional>
          {(props) => (
            <textarea
              {...props}
              name="checklist"
              rows={8}
              defaultValue={values.checklist}
              placeholder={"# Exterior\nLavado a mano con shampoo\nLimpieza de rines\n\n# Interior\nAspirado completo"}
              className={`${INPUT} resize-y font-mono text-[13px] leading-relaxed`}
            />
          )}
        </ServiceFormField>
      </Card>

      <Card title="Notas del equipo">
        <ServiceFormField name="internalNotes" label="Notas internas" error={errors.internalNotes} wide optional>
          {(props) => (
            <textarea
              {...props}
              name="internalNotes"
              rows={3}
              defaultValue={values.internalNotes}
              placeholder="Para el equipo; el cliente no las ve"
              className={`${INPUT} resize-y`}
            />
          )}
        </ServiceFormField>
        <ServiceFormField
          name="detailedSpecs"
          label="Especificaciones detalladas"
          error={errors.detailedSpecs}
          wide
          optional
        >
          {(props) => (
            <textarea
              {...props}
              name="detailedSpecs"
              rows={4}
              defaultValue={values.detailedSpecs}
              placeholder="Qué incluye, productos que se usan, tiempos de secado…"
              className={`${INPUT} resize-y`}
            />
          )}
        </ServiceFormField>
      </Card>

      {state.message && (
        <p role="alert" className="rounded-md bg-attention-soft px-3.5 py-2.5 text-sm font-medium text-attention">
          {state.message}
        </p>
      )}
      {!state.message && hasFieldErrors && (
        <p role="alert" className="rounded-md bg-attention-soft px-3.5 py-2.5 text-sm font-medium text-attention">
          Revisa los datos marcados antes de continuar.
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/orders/new" className="rounded-md px-4 py-2 text-sm font-semibold text-soft hover:bg-canvas">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear servicio"}
        </button>
      </div>
    </form>
  );
}
