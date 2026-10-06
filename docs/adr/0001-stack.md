# ADR 0001 — Next.js + TypeScript + Postgres (Supabase)

- Estado: aceptada
- Fecha: 2026-10-05

## Contexto

El sistema es una herramienta interna de operación diaria: calendario, mapa, citas, clientes y reportes. Lo usan pocos agentes, pero los datos son muy relacionales (Cliente → Direcciones → Citas) y hay que auditar cada cambio. El plazo es de 4 semanas y se prefieren herramientas gratuitas. Además, el proyecto sirve como pieza de portafolio.

## Decisión

Un solo repositorio en TypeScript estricto con Next.js (App Router y Route Handlers), Postgres administrado por Supabase (Auth incluido), Drizzle como ORM y Zod para validar la entrada.

## Por qué

- Un solo lenguaje y un solo despliegue reduce la superficie que hay que mantener en 4 semanas.
- Postgres modela bien las relaciones, las transacciones del historial de cambios y los reportes por agente; Firestore obligaba a duplicar datos y a calcular reportes en código.
- Supabase da Auth, Storage y Postgres en un plan gratuito suficiente para 3 técnicos y unos pocos agentes.
- Drizzle mantiene el esquema en TypeScript, genera migraciones SQL revisables y no oculta el SQL.
- Zod valida en el borde y deriva los tipos, así la API y las pruebas comparten el mismo contrato.

## Consecuencias

- El plan gratuito de Supabase pausa proyectos inactivos; hay que avisarlo al cliente antes de producción.
- Next.js 16 renombra `middleware` a `proxy`; el control de sesión vive en `src/proxy.ts`.
- Cambiar de proveedor de Postgres es barato porque solo `DATABASE_URL` y la capa de Auth dependen de Supabase.
