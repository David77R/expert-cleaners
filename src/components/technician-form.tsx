"use client";

import Link from "next/link";
import { TimeInput } from "@/components/time-input";
import { useActionState, type ComponentProps } from "react";
import { createTechnicianAction, updateTechnicianAction, type TechnicianFormState } from "@/app/technicians/actions";
import { WEEKDAY_LONG } from "@/domain/calendar-view";
import { TECHNICIAN_COLORS, WEEK_ORDER, type TechnicianFormValues } from "@/domain/technician-form";
import { Card, Field, INPUT } from "@/components/form-kit";

function TechnicianField(props: Omit<ComponentProps<typeof Field>, "prefix">) {
  return <Field prefix="technician" {...props} />;
}

export function TechnicianForm({
  technicianId,
  initialValues,
}: {
  technicianId?: string;
  initialValues: TechnicianFormValues;
}) {
  const initial: TechnicianFormState = { values: initialValues, errors: {} };
  const action = technicianId ? updateTechnicianAction.bind(null, technicianId) : createTechnicianAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const { values, errors } = state;
  const editing = Boolean(technicianId);

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-5" noValidate>
      <Card title="Datos del técnico">
        <TechnicianField name="name" label="Nombre" error={errors.name}>
          {(props) => (
            <input {...props} name="name" defaultValue={values.name} required autoComplete="off" className={INPUT} />
          )}
        </TechnicianField>
        <TechnicianField name="zone" label="Zona que cubre" error={errors.zone}>
          {(props) => (
            <input
              {...props}
              name="zone"
              defaultValue={values.zone}
              required
              placeholder="Ej: Miami Central"
              className={INPUT}
            />
          )}
        </TechnicianField>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Color en el calendario</legend>
          <div className="flex flex-wrap items-center gap-2.5">
            {TECHNICIAN_COLORS.map((color) => (
              <label key={color} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={color}
                  defaultChecked={values.color.toLowerCase() === color.toLowerCase()}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="block h-8 w-8 rounded-full ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand"
                  style={{ backgroundColor: color }}
                />
                <span className="sr-only">{color}</span>
              </label>
            ))}
            {!TECHNICIAN_COLORS.some((color) => color.toLowerCase() === values.color.toLowerCase()) && (
              <label className="cursor-pointer">
                <input type="radio" name="color" value={values.color} defaultChecked className="peer sr-only" />
                <span
                  aria-hidden="true"
                  className="block h-8 w-8 rounded-full ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-ink"
                  style={{ backgroundColor: values.color }}
                />
                <span className="sr-only">Color actual</span>
              </label>
            )}
          </div>
          {errors.color && (
            <p role="alert" className="text-sm text-attention">
              {errors.color}
            </p>
          )}
        </fieldset>
      </Card>

      <Card title="Horario" hint="Fuera de este horario el calendario sombrea la columna del técnico.">
        <TechnicianField name="shiftStart" label="Entrada" error={errors.shiftStart}>
          {(props) => (
            <TimeInput {...props} name="shiftStart" defaultValue={values.shiftStart} required className={INPUT} />
          )}
        </TechnicianField>
        <TechnicianField name="shiftEnd" label="Salida" error={errors.shiftEnd}>
          {(props) => (
            <TimeInput {...props} name="shiftEnd" defaultValue={values.shiftEnd} required className={INPUT} />
          )}
        </TechnicianField>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Días de trabajo</legend>
          <div className="flex flex-wrap gap-2">
            {WEEK_ORDER.map((day) => (
              <label key={day} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="workDays"
                  value={day}
                  defaultChecked={values.workDays.includes(day)}
                  className="peer sr-only"
                />
                <span className="block rounded-full border border-hair px-3.5 py-1.5 text-sm text-soft transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                  {WEEKDAY_LONG[day]}
                </span>
              </label>
            ))}
          </div>
          {errors.workDays && (
            <p role="alert" className="text-sm text-attention">
              {errors.workDays}
            </p>
          )}
        </fieldset>
      </Card>

      {editing && (
        <label className="flex items-start gap-2.5 rounded-md border border-hair bg-paper px-5 py-4 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={values.active}
            className="mt-0.5 h-4 w-4 rounded border-hair accent-brand"
          />
          <span>
            <span className="block font-medium">Disponible para agendar</span>
            <span className="text-soft">
              Si lo desmarcas, deja de aparecer en el calendario y al crear citas. Su historial se conserva.
            </span>
          </span>
        </label>
      )}
      {!editing && <input type="hidden" name="active" value="on" />}

      {state.message && (
        <p role="alert" className="rounded-md bg-attention-soft px-3.5 py-2.5 text-sm font-medium text-attention">
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/technicians" className="rounded-md px-4 py-2 text-sm font-semibold text-soft hover:bg-canvas">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear técnico"}
        </button>
      </div>
    </form>
  );
}
