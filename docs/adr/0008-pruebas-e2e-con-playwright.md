# ADR 0008 — Pruebas E2E con Playwright, contra Supabase Auth real

- Estado: aceptada (falta el despliegue — ver Consecuencias)
- Fecha: 2026-10-13

## Contexto

Las pruebas de `tests/` (Vitest + PGlite) cubren reglas de negocio y la capa de servidor, pero no verifican que el flujo completo funcione en el navegador: iniciar sesión, ver el día, crear una cita y cancelarla. EC-024 pide esa cobertura además del despliegue.

## Decisión

Playwright (`@playwright/test`) contra `npm run dev`, en `e2e/`. Las pruebas inician sesión con credenciales reales de Supabase Auth (`E2E_EMAIL` / `E2E_PASSWORD` en `.env.local`, nunca pedidas en el chat) y usan el cliente sembrado por `npm run db:seed` (Andrés Molina / CLI-1001) para crear y cancelar citas de verdad.

## Por qué

- Es gratis y ya cubre Chromium sin configuración adicional.
- Probar contra Supabase Auth real (no un mock) es la única forma de confirmar que el login funciona de verdad; un mock de Auth no prueba nada que Vitest no pruebe ya.
- Las pruebas se saltan solas (`test.skip`) si `E2E_EMAIL`/`E2E_PASSWORD` no están definidas, para no romper a quien no las haya configurado.

## Consecuencias

- Cada corrida crea una cita real (y la cancela) contra la base de datos que apunte `.env.local`. No correr esto contra una base con citas reales de clientes — solo contra la base de desarrollo/seed.
- No corren en CI, por decisión del 2026-10-13. Se evaluó un proyecto Supabase exclusivo para pruebas, con secrets en GitHub Actions, y se descartó: montarlo y mantenerlo cuesta más de lo que aporta en esta etapa. En su lugar, antes de cada despliegue se corren a mano `npm run test` y `npm run test:e2e`, este último contra la base de desarrollo y con la VPN apagada.
- Las pruebas cancelan las citas que crean, así que la base de desarrollo no acumula citas activas, aunque sí historial de citas canceladas.
- El despliegue (la otra mitad de EC-024) sigue sin empezar: falta decidir proveedor de hosting antes de tocar nada de infraestructura real.
