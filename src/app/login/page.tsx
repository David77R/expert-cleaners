"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm rounded-2xl border border-hair bg-white p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold">Expert Cleaners</h1>
        <p className="mt-1 text-sm text-ink/60">Centro de operaciones</p>
        <label className="mt-6 block text-sm font-medium" htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-hair px-3 py-2 text-sm"
        />
        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-hair px-3 py-2 text-sm"
        />
        {state?.error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <button
          disabled={pending}
          className="mt-6 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Entrando…" : "Iniciar sesión"}
        </button>
      </form>
    </main>
  );
}
