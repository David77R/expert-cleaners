# ADR 0003 — Pruebas contra Postgres real en memoria (PGlite)

- Estado: aceptada
- Fecha: 2026-10-05

## Contexto

Las reglas más importantes (transacciones, historial, códigos consecutivos, enums) dependen de Postgres. Simular la base con mocks probaría los mocks, no el sistema.

## Decisión

Las pruebas de integración aplican las migraciones reales de `drizzle/` sobre PGlite (Postgres compilado a WebAssembly) y ejecutan los servicios contra esa base. No requieren Docker ni credenciales.

## Por qué

- Detectan errores de migración y de SQL, no solo de lógica.
- Corren igual en el computador de David y en GitHub Actions.
- Cada archivo de prueba arranca una base limpia en menos de un segundo.

## Consecuencias

- PGlite no replica extensiones ni políticas RLS de Supabase; eso se verifica contra un proyecto Supabase real en el Sprint 2.
