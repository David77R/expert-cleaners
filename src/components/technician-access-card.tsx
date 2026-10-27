"use client";

import { useActionState } from "react";
import {
  createTechnicianAccessAction,
  updateTechnicianAccessAction,
  type AccessFormState,
} from "@/app/technicians/access-actions";
import { INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";

type Access = { email: string; active: boolean } | null;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-attention">
      {message}
    </p>
  );
}

export function TechnicianAccessCard({
  technicianId,
  technicianName,
  access,
}: {
  technicianId: string;
  technicianName: string;
  access: Access;
}) {
  const action = access
    ? updateTechnicianAccessAction.bind(null, technicianId)
    : createTechnicianAccessAction.bind(null, technicianId);
  const [state, formAction, pending] = useActionState<AccessFormState, FormData>(action, {});
  const email = state.email ?? access?.email ?? "";

  return (
    <section className="flex max-w-3xl flex-col gap-4 rounded-md border border-hair bg-paper p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-soft text-indigo">
          <Icon name="agent" size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Usuario del técnico</h2>
          <p className="mt-0.5 text-sm text-soft">
            {access
              ? `${technicianName} entra al sistema y solo ve sus citas y la hoja de trabajo. Los teléfonos de los clientes le salen ocultos; llama y escribe con los botones.`
              : `Créale un usuario a ${technicianName} para que vea sus citas en el celular. Solo verá lo suyo y los teléfonos de los clientes le saldrán ocultos.`}
          </p>
        </div>
        {access && (
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              access.active ? "bg-success-soft text-success" : "bg-neutral-soft text-muted"
            }`}
          >
            {access.active ? "Activo" : "Desactivado"}
          </span>
        )}
      </div>

      <form action={formAction} className="grid gap-4 sm:grid-cols-2" noValidate>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Correo para entrar
          <input
            name="email"
            type="email"
            autoComplete="off"
            defaultValue={email}
            key={email}
            required
            aria-invalid={Boolean(state.errors?.email)}
            aria-describedby={state.errors?.email ? "access-email-error" : undefined}
            className={INPUT}
          />
          <FieldError id="access-email-error" message={state.errors?.email} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {access ? "Nueva contraseña" : "Contraseña"}
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required={!access}
            placeholder={access ? "Déjala vacía para no cambiarla" : "Mínimo 8 caracteres"}
            aria-invalid={Boolean(state.errors?.password)}
            aria-describedby={state.errors?.password ? "access-password-error" : undefined}
            className={INPUT}
          />
          <FieldError id="access-password-error" message={state.errors?.password} />
        </label>
        {access && (
          <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={access.active}
              className="h-4 w-4 rounded border-hair accent-brand"
            />
            Puede entrar al sistema
          </label>
        )}
        {state.message && (
          <p
            role={state.ok ? "status" : "alert"}
            className={`rounded-md px-3.5 py-2.5 text-sm font-medium sm:col-span-2 ${
              state.ok ? "bg-success-soft text-success" : "bg-attention-soft text-attention"
            }`}
          >
            {state.message}
          </p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Guardando…" : access ? "Guardar usuario" : "Crear usuario"}
          </button>
        </div>
      </form>
    </section>
  );
}
