"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { BrandMark } from "@/components/brand-mark";
import { client } from "@/config/clients";

const FIELD =
  "mt-1.5 w-full rounded-md border border-hair bg-paper px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      <section
        aria-hidden="true"
        className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-rail p-12 lg:flex"
      >
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(var(--rail-line) 1px, transparent 1px), linear-gradient(90deg, var(--rail-line) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <BrandMark size="lg" />
          {!client.logo && <span className="font-display text-xl font-semibold text-white">{client.shortName}</span>}
        </div>
        <div className="relative max-w-md">
          <p className="font-display text-3xl font-semibold leading-tight text-white">{client.headline}</p>
          <p className="mt-4 text-sm text-rail-text">
            {client.tagline} · {client.location.label}
          </p>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <form action={action} className="w-full max-w-sm">
          <span className="mb-6 flex w-fit rounded-lg bg-rail p-2 lg:hidden">
            <BrandMark size="lg" />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="mt-1.5 text-sm text-soft">Entra con tu cuenta del equipo.</p>

          <label className="mt-8 block text-sm font-medium" htmlFor="email">
            Correo
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={FIELD} />

          <label className="mt-4 block text-sm font-medium" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={FIELD}
          />

          {state?.error && (
            <p role="alert" className="mt-4 text-sm font-medium text-attention">
              {state.error}
            </p>
          )}

          <button
            disabled={pending}
            className="mt-6 w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </main>
  );
}
