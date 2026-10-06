# Expert Cleaners

Sistema de operación diaria para una empresa de limpieza en Miami: calendario por técnico, citas con historial de cambios, clientes con varias direcciones, servicios con campos dinámicos y, en los siguientes sprints, mapa de rutas, reportes por agente e invoices en PDF.

El prototipo visual que validó el producto con el staff está en un repositorio aparte; este repo es el MVP real.

## Stack

Next.js 16 (App Router) · TypeScript estricto · Postgres en Supabase · Drizzle ORM · Zod · Vitest + PGlite · Tailwind CSS 4 · GitHub Actions

## Estado

| Área                                                    | Estado                                               |
| ------------------------------------------------------- | ---------------------------------------------------- |
| Modelo de datos y migración inicial                     | Listo, probado                                       |
| Reglas de citas, historial, conflictos, dos direcciones | Listo, 35 pruebas                                    |
| API REST con validación y errores tipados               | Listo, probada a nivel de servicio                   |
| Login con roles y calendario del día                    | Escrito y compilando; falta probar con Supabase real |
| Drag and drop, mapa, reportes, invoice PDF              | Sprints 2 a 4                                        |

## Empezar

```bash
npm install
cp .env.example .env.local
npm run check
```

Para correr la app necesitas un proyecto Supabase (o Supabase CLI local):

1. Completa `.env.local` con `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. `npm run db:migrate` aplica `drizzle/`.
3. Ejecuta `supabase/profiles-trigger.sql` en el editor SQL de Supabase.
4. `npm run db:seed` carga técnicos, servicios y un cliente de ejemplo.
5. Crea un usuario en Supabase Auth y `npm run dev`.

## Scripts

| Script                  | Qué hace                                      |
| ----------------------- | --------------------------------------------- |
| `npm run check`         | typecheck + lint + pruebas                    |
| `npm run test:coverage` | pruebas con cobertura de dominio y servicios  |
| `npm run db:generate`   | genera una migración desde `src/db/schema.ts` |
| `npm run db:migrate`    | aplica migraciones                            |
| `npm run format`        | formatea con Prettier                         |

## Estructura

```
src/
  app/          páginas y Route Handlers
  components/   componentes de interfaz
  db/           esquema Drizzle, cliente, seed
  domain/       reglas puras y esquemas Zod
  server/       servicios con transacción, auth, errores HTTP
  proxy.ts      control de sesión (Next 16)
tests/          pruebas de dominio e integración con PGlite
drizzle/        migraciones SQL generadas
supabase/       SQL específico de Supabase
docs/           arquitectura, ADRs y scrum
```

## API

| Método y ruta                        | Descripción                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/appointments?date=`        | Citas del día y ids con solapamiento                                                                                                    |
| `POST /api/appointments`             | Crea una cita (nace no confirmada)                                                                                                      |
| `GET /api/appointments/:id`          | Detalle con historial y fotos                                                                                                           |
| `POST /api/appointments/:id/actions` | `confirm`, `complete`, `cancel`, `reschedule`, `move`, `mark_paid`, `advance_invoice`, `set_destination`, `set_billing`, `update_notes` |

Errores: `422` validación, `401` sin sesión, `403` sin permiso, `404` no existe, `409` regla de negocio.

## Documentación

- [Arquitectura y diagramas](docs/architecture.md)
- [Decisiones (ADRs)](docs/adr)
- [Scrum: proceso, backlog, Sprint 1 y roadmap](docs/scrum)
