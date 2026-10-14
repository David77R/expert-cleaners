# ADR 0007: Geocodificación automática y orden de ruta en el Mapa

## Estado

Aceptado

## Contexto

EC-016 (Sprint 3) pide mostrar en un mapa las citas del día, ordenadas según el horario ya agendado, con la ruta entre paradas. El stack de mapa/rutas ya quedó decidido en ADR 0004 (Leaflet + OpenRouteService). Falta decidir cuándo se geocodifica cada dirección y si el mapa puede reordenar las citas por su cuenta.

## Decisión

- La geocodificación es automática y ocurre en el servidor: al guardar una dirección de cliente o una `destinationAddress`/`billingAddress` de una cita, se geocodifica si faltan `lat`/`lng`, antes de insertar. El resultado se cachea en la fila (una sola llamada a ORS por dirección).
- Si ORS falla, la dirección se guarda igual sin coordenadas — no bloquea el flujo —, y el mapa simplemente omite esa parada, mostrando un aviso de cuántas citas quedaron sin geocodificar.
- El mapa dibuja la ruta en el orden ya agendado (por `startMin`); ningún proceso automático reordena citas, manteniendo la regla existente de que la IA nunca mueve una cita por su cuenta.
- Un botón aparte ("Mejorar ruta"), fuera del flujo principal, permite al agente armar manualmente un orden de referencia distinto (arrastrando las paradas) y guardarlo como sugerencia, sin tocar jamás la cita real. El agente usa esa referencia para llamar a los clientes y reprogramar a mano si decide hacerlo.

## Consecuencias

- Direcciones guardadas antes de este cambio, sin `lat`/`lng`, necesitan un backfill puntual.
- Las "rutas sugeridas" viven en su propia tabla (`route_drafts`), separada de `appointments`, para que nunca puedan confundirse con el horario real ni afectarlo.

## Alternativas consideradas

- **Reordenar automáticamente las citas del día por cercanía:** se descartó porque viola la regla de que el Agente decide, no la IA.
- **Geocodificar bajo demanda (al abrir el mapa) en vez de al guardar:** se descartó porque multiplicaría llamadas a ORS cada vez que se abre el Mapa, en vez de una sola vez por dirección.
