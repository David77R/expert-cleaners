"use client";

import Link from "next/link";
import { useActionState, useState, type ComponentProps } from "react";
import { createAgentAction, updateAgentAction, type AgentFormState } from "@/app/agents/actions";
import type { AgentFormValues } from "@/domain/agent-form";
import { Card, Field, INPUT } from "@/components/form-kit";
import { Icon } from "@/components/icons";

function AgentField(props: Omit<ComponentProps<typeof Field>, "prefix">) {
  return <Field prefix="agent" {...props} />;
}

export function AgentForm({ agentId, initialValues }: { agentId?: string; initialValues: AgentFormValues }) {
  const initial: AgentFormState = { values: initialValues, errors: {} };
  const action = agentId ? updateAgentAction.bind(null, agentId) : createAgentAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const [showPassword, setShowPassword] = useState(false);
  const { values, errors } = state;
  const editing = Boolean(agentId);

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-5" noValidate>
      <Card title="Datos del agente">
        <AgentField name="name" label="Nombre" error={errors.name}>
          {(props) => (
            <input {...props} name="name" defaultValue={values.name} required autoComplete="off" className={INPUT} />
          )}
        </AgentField>
        <AgentField name="email" label="Correo para iniciar sesión" error={errors.email}>
          {(props) => (
            <input
              {...props}
              name="email"
              type="email"
              defaultValue={values.email}
              required
              autoComplete="off"
              placeholder="agente@empresa.com"
              className={INPUT}
            />
          )}
        </AgentField>
      </Card>

      <Card
        title={editing ? "Cambiar contraseña" : "Contraseña temporal"}
        hint={
          editing
            ? "Déjala en blanco para no cambiarla."
            : "Entrégasela al agente; podrá entrar con su correo y esta contraseña."
        }
      >
        <AgentField name="password" label={editing ? "Nueva contraseña" : "Contraseña"} error={errors.password}>
          {(props) => (
            <div className="relative">
              <input
                {...props}
                name="password"
                type={showPassword ? "text" : "password"}
                required={!editing}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                className={`${INPUT} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted transition-colors hover:text-ink"
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
              </button>
            </div>
          )}
        </AgentField>
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
            <span className="block font-medium">Acceso activo</span>
            <span className="text-soft">
              Si lo desmarcas, el agente ya no puede iniciar sesión. Su trabajo y su historial se conservan.
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
        <Link href="/agents" className="rounded-md px-4 py-2 text-sm font-semibold text-soft hover:bg-canvas">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear agente"}
        </button>
      </div>
    </form>
  );
}
