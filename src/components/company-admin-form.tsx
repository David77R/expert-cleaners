"use client";

import { useActionState, type ComponentProps } from "react";
import { createCompanyAdminAction, type CompanyAdminState } from "@/app/empresas/actions";
import { Field, INPUT } from "@/components/form-kit";
import { emptyAgentForm } from "@/domain/agent-form";

function AdminField(props: Omit<ComponentProps<typeof Field>, "prefix">) {
  return <Field prefix="company-admin" {...props} />;
}

export function CompanyAdminForm({ companyId }: { companyId: string }) {
  const initial: CompanyAdminState = { values: emptyAgentForm(), errors: {} };
  const [state, formAction, pending] = useActionState(createCompanyAdminAction.bind(null, companyId), initial);
  const { values, errors } = state;
  return (
    <form action={formAction} className="grid gap-4" noValidate key={state.notice ?? "form"}>
      <AdminField name="name" label="Nombre" error={errors.name}>
        {(props) => <input {...props} name="name" defaultValue={values.name} autoComplete="off" className={INPUT} />}
      </AdminField>
      <AdminField name="email" label="Correo" error={errors.email}>
        {(props) => (
          <input
            {...props}
            name="email"
            type="email"
            defaultValue={values.email}
            autoComplete="off"
            className={INPUT}
          />
        )}
      </AdminField>
      <AdminField name="password" label="Contraseña temporal" error={errors.password}>
        {(props) => <input {...props} name="password" type="password" autoComplete="new-password" className={INPUT} />}
      </AdminField>
      {state.message && (
        <p role="alert" className="text-sm font-medium text-attention">
          {state.message}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm font-medium text-success">
          {state.notice}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear administrador"}
        </button>
      </div>
    </form>
  );
}
