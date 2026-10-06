# ADR 0002 — Dominio puro y auditoría en la misma transacción

- Estado: aceptada
- Fecha: 2026-10-05

## Contexto

El Documento Maestro exige un historial de cambios por cita (quién, qué, desde, hacia, cuándo) y reglas como "el solapamiento es advertencia, no bloqueo". Si el historial se escribe aparte del cambio, pueden quedar cambios sin rastro o rastros de cambios que no ocurrieron.

## Decisión

- Las reglas viven en `src/domain` como funciones puras sin dependencias de Next ni de la base de datos.
- Cada operación en `src/server/appointments.ts` corre en una transacción que actualiza la cita y escribe sus filas de `appointment_history` juntas.
- Los campos del historial se guardan como claves estables (`status`, `technician`, `schedule`) y la interfaz los traduce; así el idioma no queda grabado en los datos.
- Los conflictos de horario se devuelven como `conflicts` en la respuesta y se guarda igual el cambio.

## Por qué

- Las reglas puras se prueban en milisegundos y sin infraestructura.
- La transacción garantiza que historial y estado nunca divergen.
- Devolver advertencias en lugar de errores respeta la regla de que el agente decide.

## Consecuencias

- Las operaciones reciben `db` como parámetro; es más verboso, pero permite probarlas con una base real en memoria (ADR 0003).
