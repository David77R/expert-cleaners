"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { login } from "@/app/login/actions";
import { CompanySolutionsMark } from "@/components/company-solutions-mark";
import { Icon } from "@/components/icons";
import { UsOpsMap } from "@/components/us-ops-map";

const FIELD =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[16px] text-white transition-[border-color,box-shadow,background-color] duration-300 placeholder:text-white/35 hover:border-white/20 focus:border-[#7c8cff] focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgb(91_108_255/0.18),0_0_28px_-6px_rgb(124_140_255/0.6)] focus:outline-none sm:text-sm";

const ROLES = [
  { value: "team", label: "Usuario", hint: "Equipo de una empresa", icon: "users" },
  { value: "owner", label: "Dueño", hint: "Todas las empresas", icon: "building" },
] as const;

const rise = (step: number) => ({ animationDelay: `${0.12 + step * 0.08}s` });

export function LoginScreen() {
  const [state, action, pending] = useActionState(login, undefined);
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("team");
  const [showPassword, setShowPassword] = useState(false);
  const companyOff = useSearchParams().get("aviso") === "empresa";

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#070b14] lg:flex-row">
      <section className="relative flex min-h-[44vh] flex-col justify-between overflow-hidden px-6 pb-14 pt-[max(1.5rem,env(safe-area-inset-top))] lg:min-h-0 lg:flex-[1.15] lg:p-12">
        <UsOpsMap />
        <div className="relative flex items-center gap-3">
          <span className="login-breathe rounded-[11px]">
            <CompanySolutionsMark size={44} />
          </span>
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

      <section className="relative -mt-8 flex flex-1 items-start justify-center overflow-hidden rounded-t-[2rem] border-t border-white/10 bg-[#0a0f1d] px-4 pb-10 pt-8 sm:px-6 lg:mt-0 lg:items-center lg:rounded-none lg:border-l lg:border-t-0 lg:px-10 lg:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="login-aurora absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#5b6cff]/25 blur-3xl" />
          <div
            className="login-aurora absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#34d399]/12 blur-3xl"
            style={{ animationDelay: "-11s" }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(70%_60%_at_50%_40%,#000,transparent)]" />
        </div>

        <div className="login-border relative w-full max-w-sm rounded-[1.75rem] p-px shadow-[0_30px_80px_-30px_rgb(91_108_255/0.55)]">
          <form
            action={action}
            className="relative rounded-[calc(1.75rem-1px)] bg-[#0d1426]/95 p-6 backdrop-blur-xl sm:p-7"
          >
            <div className="login-rise" style={rise(0)}>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white">Iniciar sesión</h1>
              <p className="mt-1.5 text-sm text-[#9aa3c4]">Elige cómo entras y escribe tus datos.</p>
            </div>

            <fieldset className="login-rise mt-7" style={rise(1)}>
              <legend className="text-sm font-medium text-[#c9cfe6]">Entrar como</legend>
              <div className="relative mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 left-1 top-1 w-[calc(50%-6px)] rounded-xl bg-gradient-to-br from-[#5b6cff]/35 to-[#5b6cff]/10 shadow-[0_0_24px_-4px_rgb(91_108_255/0.7)] ring-1 ring-inset ring-[#8e9bff]/50 transition-transform duration-500 ease-[cubic-bezier(0.3,1.3,0.5,1)]"
                  style={{ transform: role === "owner" ? "translateX(calc(100% + 4px))" : "translateX(0)" }}
                />
                {ROLES.map((option) => (
                  <label key={option.value} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="as"
                      value={option.value}
                      checked={role === option.value}
                      onChange={() => setRole(option.value)}
                      className="peer sr-only"
                    />
                    <span className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[#8b93b3] transition-colors duration-300 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#8e9bff]">
                      <Icon
                        name={option.icon}
                        size={18}
                        className={`transition-colors duration-300 ${role === option.value ? "text-[#a9b3ff]" : ""}`}
                      />
                      <span className="leading-tight">
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="block text-[11px] opacity-75">{option.hint}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="login-rise mt-6" style={rise(2)}>
              <label className="block text-sm font-medium text-[#c9cfe6]" htmlFor="email">
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
            </div>

            <div className="login-rise mt-4" style={rise(3)}>
              <label className="block text-sm font-medium text-[#c9cfe6]" htmlFor="password">
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
                  className="absolute bottom-0 right-1 flex h-[48px] w-10 items-center justify-center text-[#8b93b3] transition-colors hover:text-white"
                >
                  <Icon name="eye" size={18} />
                </button>
              </div>
            </div>

            {companyOff && !state?.error && (
              <p
                role="status"
                className="mt-4 rounded-xl border border-[#f5b942]/30 bg-[#f5b942]/10 px-3.5 py-2.5 text-sm font-medium text-[#ffd58a]"
              >
                Tu empresa está desactivada en este momento. Habla con el administrador.
              </p>
            )}

            {state?.error && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-3.5 py-2.5 text-sm font-medium text-[#ffb4b4]"
              >
                {state.error}
              </p>
            )}

            <div className="login-rise mt-6" style={rise(4)}>
              <button
                disabled={pending}
                className="login-shine flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgb(79_91_255/0.9)] transition-[transform,box-shadow,opacity] duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-10px_rgb(79_91_255/1)] active:translate-y-0 disabled:opacity-60"
              >
                {pending ? "Entrando…" : role === "owner" ? "Entrar como dueño" : "Entrar"}
                {!pending && <Icon name="right" size={16} />}
              </button>
            </div>

            <p className="login-rise mt-7 text-center text-xs text-[#6f7899]" style={rise(5)}>
              Company Solutions · Operaciones de servicio en campo
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
