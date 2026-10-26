"use client";

import Link from "next/link";
import { useActionState, useState, type ComponentProps } from "react";
import { createCompanyAction, updateCompanyAction, type CompanyFormState } from "@/app/empresas/actions";
import { Card, Field, INPUT } from "@/components/form-kit";
import { TimeInput } from "@/components/time-input";
import { WEEKDAY_LONG } from "@/domain/calendar-view";
import { WEEK_DAYS, themeFromColors, type CompanyFormValues } from "@/domain/company-form";

function CompanyField(props: Omit<ComponentProps<typeof Field>, "prefix">) {
  return <Field prefix="company" {...props} />;
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-md border border-hair px-4 py-3 text-sm sm:col-span-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-hair accent-brand"
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-soft">{hint}</span>
      </span>
    </label>
  );
}

function ColorPreview({ brand, rail }: { brand: string; rail: string }) {
  const theme = themeFromColors(brand, rail);
  return (
    <div className="overflow-hidden rounded-md border border-hair sm:col-span-2" aria-hidden="true">
      <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: theme["--rail"] }}>
        <span className="h-7 w-7 rounded-md" style={{ backgroundColor: theme["--brand"] }} />
        <span className="text-sm font-semibold text-white">Menú</span>
        <span className="ml-auto text-xs" style={{ color: theme["--rail-text"] }}>
          Texto secundario
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ backgroundColor: theme["--canvas"] }}>
        <span
          className="rounded-md px-3 py-1.5 text-sm font-semibold text-white"
          style={{ backgroundColor: theme["--brand"] }}
        >
          Nueva cita
        </span>
        <span
          className="rounded-md px-3 py-1.5 text-sm font-semibold"
          style={{ backgroundColor: theme["--brand-soft"], color: theme["--brand-ink"] }}
        >
          Hoy
        </span>
      </div>
    </div>
  );
}

export function CompanyForm({ companyId, initialValues }: { companyId?: string; initialValues: CompanyFormValues }) {
  const initial: CompanyFormState = { values: initialValues, errors: {} };
  const action = companyId ? updateCompanyAction.bind(null, companyId) : createCompanyAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const { values, errors } = state;
  const editing = Boolean(companyId);
  const [brandColor, setBrandColor] = useState(values.brandColor);
  const [railColor, setRailColor] = useState(values.railColor);

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-5" noValidate>
      <Card title="Datos de la empresa">
        <CompanyField name="name" label="Nombre completo" error={errors.name}>
          {(props) => <input {...props} name="name" defaultValue={values.name} className={INPUT} />}
        </CompanyField>
        <CompanyField name="shortName" label="Nombre corto" error={errors.shortName}>
          {(props) => (
            <input
              {...props}
              name="shortName"
              defaultValue={values.shortName}
              placeholder="Sale en el menú y los PDF"
              className={INPUT}
            />
          )}
        </CompanyField>
        <CompanyField name="initials" label="Iniciales" error={errors.initials}>
          {(props) => (
            <input
              {...props}
              name="initials"
              defaultValue={values.initials}
              maxLength={4}
              placeholder="Si no hay logo"
              className={INPUT}
            />
          )}
        </CompanyField>
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Identificador</span>
            <span className="rounded-md bg-canvas px-3.5 py-2.5 text-sm text-soft">{values.slug}</span>
            <input type="hidden" name="slug" value={values.slug} />
          </div>
        ) : (
          <CompanyField name="slug" label="Identificador" error={errors.slug}>
            {(props) => (
              <input
                {...props}
                name="slug"
                defaultValue={values.slug}
                placeholder="ej: mi-empresa"
                autoCapitalize="off"
                className={INPUT}
              />
            )}
          </CompanyField>
        )}
        <CompanyField name="tagline" label="Frase bajo el nombre" optional error={errors.tagline}>
          {(props) => <input {...props} name="tagline" defaultValue={values.tagline} className={INPUT} />}
        </CompanyField>
        <CompanyField name="headline" label="Mensaje del inicio de sesión" optional error={errors.headline}>
          {(props) => <input {...props} name="headline" defaultValue={values.headline} className={INPUT} />}
        </CompanyField>
        <CompanyField name="phone" label="Teléfono" optional error={errors.phone}>
          {(props) => <input {...props} name="phone" type="tel" defaultValue={values.phone} className={INPUT} />}
        </CompanyField>
        <CompanyField name="email" label="Correo" optional error={errors.email}>
          {(props) => <input {...props} name="email" type="email" defaultValue={values.email} className={INPUT} />}
        </CompanyField>
      </Card>

      <Card
        title="Zona de trabajo"
        hint="Se usa para el reloj, el centro del mapa y para buscar direcciones cerca. Si dejas las coordenadas vacías, las buscamos con la ciudad."
      >
        <CompanyField name="city" label="Ciudad" error={errors.city}>
          {(props) => <input {...props} name="city" defaultValue={values.city} className={INPUT} />}
        </CompanyField>
        <CompanyField name="state" label="Estado" error={errors.state}>
          {(props) => (
            <input
              {...props}
              name="state"
              defaultValue={values.state}
              maxLength={2}
              placeholder="FL"
              className={INPUT}
            />
          )}
        </CompanyField>
        <CompanyField name="radiusKm" label="Radio de servicio (km)" error={errors.radiusKm}>
          {(props) => (
            <input {...props} name="radiusKm" inputMode="numeric" defaultValue={values.radiusKm} className={INPUT} />
          )}
        </CompanyField>
        <div className="grid grid-cols-2 gap-3">
          <CompanyField name="lat" label="Latitud" optional error={errors.lat}>
            {(props) => <input {...props} name="lat" inputMode="decimal" defaultValue={values.lat} className={INPUT} />}
          </CompanyField>
          <CompanyField name="lng" label="Longitud" optional error={errors.lng}>
            {(props) => <input {...props} name="lng" inputMode="decimal" defaultValue={values.lng} className={INPUT} />}
          </CompanyField>
        </div>
      </Card>

      <Card title="Colores" hint="El color principal va en botones y resaltados; el oscuro, en el menú lateral.">
        <CompanyField name="brandColor" label="Color principal" error={errors.brandColor}>
          {(props) => (
            <input
              {...props}
              type="color"
              name="brandColor"
              value={brandColor}
              onChange={(event) => setBrandColor(event.target.value)}
              className="h-11 w-full cursor-pointer rounded-md border border-hair bg-paper p-1"
            />
          )}
        </CompanyField>
        <CompanyField name="railColor" label="Color del menú" error={errors.railColor}>
          {(props) => (
            <input
              {...props}
              type="color"
              name="railColor"
              value={railColor}
              onChange={(event) => setRailColor(event.target.value)}
              className="h-11 w-full cursor-pointer rounded-md border border-hair bg-paper p-1"
            />
          )}
        </CompanyField>
        <ColorPreview brand={brandColor} rail={railColor} />
      </Card>

      <Card title="Funciones">
        {values.rugPickup && <input type="hidden" name="rugPickup" value="on" />}
        <Toggle
          name="vehicles"
          label="Vehículos de los clientes"
          hint="Cada cliente tiene sus carros y el precio cambia según el tipo de vehículo."
          defaultChecked={values.vehicles}
        />
        <Toggle
          name="publicBooking"
          label="Reserva en línea"
          hint="Los clientes reservan solos en la página pública de la empresa."
          defaultChecked={values.publicBooking}
        />
      </Card>

      <Card title="Reserva en línea" hint="Solo aplica si la reserva en línea está activa.">
        <CompanyField name="locale" label="Idioma de la página" error={errors.locale}>
          {(props) => (
            <select {...props} name="locale" defaultValue={values.locale} className={INPUT}>
              <option value="es">Español</option>
              <option value="en">Inglés</option>
            </select>
          )}
        </CompanyField>
        <CompanyField name="slotMinutes" label="Cada cuántos minutos hay un turno" error={errors.slotMinutes}>
          {(props) => (
            <input
              {...props}
              name="slotMinutes"
              inputMode="numeric"
              defaultValue={values.slotMinutes}
              className={INPUT}
            />
          )}
        </CompanyField>
        <CompanyField name="minNoticeHours" label="Aviso mínimo (horas)" error={errors.minNoticeHours}>
          {(props) => (
            <input
              {...props}
              name="minNoticeHours"
              inputMode="numeric"
              defaultValue={values.minNoticeHours}
              className={INPUT}
            />
          )}
        </CompanyField>
        <CompanyField name="maxDaysAhead" label="Días hacia adelante" error={errors.maxDaysAhead}>
          {(props) => (
            <input
              {...props}
              name="maxDaysAhead"
              inputMode="numeric"
              defaultValue={values.maxDaysAhead}
              className={INPUT}
            />
          )}
        </CompanyField>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Horario de atención</legend>
          <ul className="flex flex-col divide-y divide-hair rounded-md border border-hair">
            {WEEK_DAYS.map((day) => {
              const hours = values.hours[day];
              return (
                <li
                  key={day}
                  className="grid grid-cols-[8rem_repeat(auto-fit,minmax(9.5rem,1fr))] items-center gap-3 px-4 py-2.5"
                >
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      name={`open_${day}`}
                      defaultChecked={hours.open}
                      className="h-4 w-4 rounded border-hair accent-brand"
                    />
                    {WEEKDAY_LONG[day]}
                  </label>
                  <TimeInput
                    name={`start_${day}`}
                    defaultValue={hours.start}
                    aria-label={`Abre el ${WEEKDAY_LONG[day]}`}
                    className={INPUT}
                  />
                  <TimeInput
                    name={`end_${day}`}
                    defaultValue={hours.end}
                    aria-label={`Cierra el ${WEEKDAY_LONG[day]}`}
                    className={INPUT}
                  />
                </li>
              );
            })}
          </ul>
          {errors.hours && (
            <p role="alert" className="text-sm text-attention">
              {errors.hours}
            </p>
          )}
        </fieldset>
      </Card>

      <label className="flex items-start gap-2.5 rounded-md border border-hair bg-paper px-5 py-4 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values.active}
          className="mt-0.5 h-4 w-4 rounded border-hair accent-brand"
        />
        <span>
          <span className="block font-medium">Empresa activa</span>
          <span className="text-soft">
            Si la desactivas, su equipo no puede entrar y la reserva en línea se cierra. Sus datos se conservan.
          </span>
        </span>
      </label>

      {state.message && (
        <p role="alert" className="rounded-md bg-attention-soft px-3.5 py-2.5 text-sm font-medium text-attention">
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/empresas" className="rounded-md px-4 py-2 text-sm font-semibold text-soft hover:bg-canvas">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear empresa"}
        </button>
      </div>
    </form>
  );
}
