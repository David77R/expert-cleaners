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
| Login con roles y calendario (día, semana, mes)         | Escrito y compilando; falta probar con Supabase real |
| Panel de la cita, fotos, clientes y alta de citas       | Listo en la interfaz; probado con datos de prueba    |
| Mover citas arrastrando (con confirmación)              | Listo en la vista del día, con mouse                 |
| Administración de servicios (solo administrador)        | Listo                                                |
| Mapa, rutas, centro de alertas y reportes en pantalla   | Pendiente                                            |

## Empezar

```bash
npm install
cp .env.example .env.local
npm run check
```

Para correr la app necesitas un proyecto Supabase (o Supabase CLI local):

1. Completa `.env.local` con `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Para las fotos, agrega también `SUPABASE_SERVICE_ROLE_KEY` y crea en Supabase un bucket privado llamado `appointment-photos`.
2. `npm run db:migrate` aplica `drizzle/`.
3. Ejecuta `supabase/profiles-trigger.sql` en el editor SQL de Supabase.
4. `npm run db:seed` carga técnicos, servicios y un cliente de ejemplo.
5. Crea un usuario en Supabase Auth y `npm run dev`.

## Un sistema, varias empresas

Todas las empresas viven en la misma base de datos, en la tabla `companies`. Cada empresa guarda ahí su nombre, logo, colores, zona de trabajo, horario de reservas y funciones (recogida de alfombras, vehículos, reserva en línea). Clientes, citas, técnicos, servicios, vehículos, rutas y agentes llevan `company_id`, y cada consulta filtra por la empresa de quien entró. Los logos e íconos van en `public/clients/<slug>/`.

Un administrador o agente solo ve su empresa. El dueño (rol `owner`) puede ver cualquier empresa; la empresa activa se guarda en la cookie `cc-company`. El dueño cambia de empresa con el selector del menú y administra todas en `/empresas`: crear, editar datos, zona, colores, funciones y horario, subir el logo (se guarda en el bucket público `company-branding` y genera los íconos de la app), desactivar y crear el primer administrador. La pantalla de inicio de sesión usa la empresa de `NEXT_PUBLIC_CLIENT_ID` (`expert-cleaners` si no está definida).

Si una empresa tiene la reserva en línea activa, sus clientes reservan en `/reservar/<slug>`. Se puede preseleccionar un paquete con `/reservar/<slug>?package=<slug-del-paquete>`.

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

Citas, clientes, servicios, fotos (con subida y visor desde el panel de la cita), reportes por agente, alertas y factura en PDF. La referencia completa, con parámetros, roles y códigos de error, está en [docs/api.md](docs/api.md).

Errores: `422` validación, `401` sin sesión, `403` sin permiso, `404` no existe, `409` regla de negocio.

## Documentación

- [Arquitectura y diagramas](docs/architecture.md)
- [Referencia de la API](docs/api.md)
- [Decisiones (ADRs)](docs/adr)
- [Scrum: proceso, backlog, Sprint 1 y roadmap](docs/scrum)
