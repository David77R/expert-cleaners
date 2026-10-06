# Sprint 1 — Cimientos

- Periodo: 5 al 9 de octubre de 2026
- Meta: un agente puede crear una cita real con las reglas del negocio y verla en el calendario del día.

## Estado del tablero

### Hecho

- [x] EC-001 Repo, CI, TypeScript estricto, lint, formato y pruebas
- [x] EC-002 Esquema Drizzle, migración inicial y seed
- [x] EC-003 Crear cita con validación de servicio, dirección, técnico y especificaciones
- [x] EC-004 Confirmar, completar, cancelar y reprogramar con motivo
- [x] EC-005 Conflictos de horario como advertencia
- [x] EC-006 Historial de cambios en la misma transacción

### En revisión

- [ ] EC-007 Login con roles — código escrito (Supabase Auth, `proxy.ts`, `requireActor`/`requireAdmin`); falta probarlo contra un proyecto Supabase real
- [ ] EC-008 Calendario del día — componente y página escritos y compilando; falta verlo con datos reales

### Por hacer antes del viernes

- [ ] Crear el proyecto Supabase, aplicar `drizzle/0000_init.sql` y `supabase/profiles-trigger.sql`
- [ ] Cargar el seed y revisar el calendario con datos reales
- [ ] Demo al staff y retrospectiva

## Criterios de aceptación de la demo

1. Iniciar sesión como agente y ver el calendario de hoy.
2. Crear una cita por API y verla en su columna de técnico.
3. Cancelar sin motivo devuelve error; con motivo conserva la cita.
4. Dos citas solapadas del mismo técnico se marcan con advertencia y ninguna se bloquea.
5. El historial muestra quién cambió qué.

## Métricas

| Métrica               | Valor |
| --------------------- | ----- |
| Puntos comprometidos  | 34    |
| Puntos terminados     | 24    |
| Pruebas automatizadas | 35    |
| Pruebas pasando       | 35    |
