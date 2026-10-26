"use client";

import { useActionState } from "react";
import { uploadLogoAction, type LogoState } from "@/app/empresas/actions";

export function CompanyLogoForm({ companyId, hasLogo }: { companyId: string; hasLogo: boolean }) {
  const [state, formAction, pending] = useActionState(uploadLogoAction.bind(null, companyId), {
    stamp: 0,
  } as LogoState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="company-logo" className="text-sm font-medium">
        {hasLogo ? "Cambiar logo" : "Subir logo"}
      </label>
      <input
        key={state.stamp}
        id="company-logo"
        name="logo"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="block w-full text-sm text-soft file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-ink"
      />
      <p className="text-xs text-muted">
        PNG, JPG, WebP o SVG de hasta 5 MB. Mejor con fondo transparente: se muestra sobre el color del menú. También se
        usa para el ícono de la app.
      </p>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-attention">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm font-medium text-success">
          {state.notice}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Subiendo…" : "Guardar logo"}
      </button>
    </form>
  );
}
