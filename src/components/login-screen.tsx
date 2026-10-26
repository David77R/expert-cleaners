"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { login } from "@/app/login/actions";
import { CompanySolutionsMark } from "@/components/company-solutions-mark";
import { Icon } from "@/components/icons";
import { OpsMap } from "@/components/ops-map";

const FIELD =
  "mt-1.5 w-full rounded-lg border border-[#d9dcea] bg-white px-3.5 py-3 text-sm text-[#0f1424] placeholder:text-[#9aa0b8] focus:border-[#5b6cff] focus:outline-none focus:ring-4 focus:ring-[#5b6cff]/15";

const ROLES = [
  { value: "team", label: "Usuario", hint: "Equipo de una empresa", icon: "users" },
  { value: "owner", label: "Dueño", hint: "Todas las empresas", icon: "building" },
] as const;

export function LoginScreen() {
  const [state, action, pending] = useActionState(login, undefined);
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("team");
  const [showPassword, setShowPassword] = useState(false);
  const companyOff = useSearchParams().get("aviso") === "empresa";

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#070b14] lg:flex-row">
      <section className="relative flex min-h-[44vh] flex-col justify-between overflow-hidden px-6 pb-14 pt-[max(1.5rem,env(safe-area-inset-top))] lg:min-h-0 lg:flex-[1.15] lg:p-12">
        <OpsMap />
        <div className="relative flex items-center gap-3">
          <CompanySolutionsMark size={44} />
          <span className="leading-tight">
            <span className="font-display block text-xl font-semibold tracking-tight text-white">
              Company Solutions
            </span>
            <span className="block text-xs font-medium uppercase tracking-[0.18em] text-[#8f9bc7]">
              Field operations
            </span>
          </span>
        </div>
        <div className="relative max-w-lg">
          <p className="font-display text-[1.9rem] font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Cada ruta, cada cita, cada equipo.
            <span className="block bg-gradient-to-r from-[#8e9bff] via-[#60a5fa] to-[#34d399] bg-clip-text text-transparent">
              En tiempo real.
            </span>
          </p>
          <p className="mt-4 hidden max-w-md text-sm leading-relaxed text-[#a3acc9] sm:block">
            La plataforma de operaciones para empresas de servicio a domicilio: agenda, rutas, técnicos, clientes y
            reservas en línea, con la marca de cada negocio.
          </p>
        </div>
      </section>

      <section className="relative -mt-8 flex flex-1 items-start justify-center rounded-t-3xl bg-[#f6f7fb] px-5 pb-10 pt-8 lg:mt-0 lg:items-center lg:rounded-none lg:px-10 lg:py-12">
        <form action={action} className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#0f1424]">Iniciar sesión</h1>
          <p className="mt-1.5 text-sm text-[#5d6480]">Elige cómo entras y escribe tus datos.</p>

          <fieldset className="mt-7">
            <legend className="text-sm font-medium text-[#0f1424]">Entrar como</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-[#e9ebf5] p-1">
              {ROLES.map((option) => (
                <label key={option.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="as"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                    className="peer sr-only"
                  />
                  <span className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[#5d6480] transition-all peer-checked:bg-white peer-checked:text-[#0f1424] peer-checked:shadow-[0_1px_3px_rgb(15_20_36/0.12)] peer-focus-visible:ring-2 peer-focus-visible:ring-[#5b6cff]">
                    <Icon name={option.icon} size={18} className={role === option.value ? "text-[#5b6cff]" : ""} />
                    <span className="leading-tight">
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="block text-[11px] opacity-80">{option.hint}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-6 block text-sm font-medium text-[#0f1424]" htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@correo.com"
            className={FIELD}
          />

          <label className="mt-4 block text-sm font-medium text-[#0f1424]" htmlFor="password">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className={`${FIELD} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="absolute bottom-0 right-1 flex h-[46px] w-10 items-center justify-center text-[#7b819c] hover:text-[#0f1424]"
            >
              <Icon name="eye" size={18} />
            </button>
          </div>

          {companyOff && !state?.error && (
            <p role="status" className="mt-4 rounded-lg bg-[#fff4e0] px-3.5 py-2.5 text-sm font-medium text-[#8a5a00]">
              Tu empresa está desactivada en este momento. Habla con el administrador.
            </p>
          )}

          {state?.error && (
            <p role="alert" className="mt-4 rounded-lg bg-[#fdecec] px-3.5 py-2.5 text-sm font-medium text-[#b42318]">
              {state.error}
            </p>
          )}

          <button
            disabled={pending}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#5b6cff] to-[#4553f0] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgb(79_91_255/0.6)] transition-opacity hover:opacity-95 disabled:opacity-60"
          >
            {pending ? "Entrando…" : role === "owner" ? "Entrar como dueño" : "Entrar"}
            {!pending && <Icon name="right" size={16} />}
          </button>

          <p className="mt-8 text-center text-xs text-[#8a90a8]">
            Company Solutions · Operaciones de servicio en campo
          </p>
        </form>
      </section>
    </main>
  );
}
