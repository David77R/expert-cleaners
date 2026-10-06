# ADR 0004 — Mapas y rutas sin Google Maps

- Estado: propuesta (se implementa en el Sprint 3)
- Fecha: 2026-10-05

## Contexto

El mapa debe permitir acercarse, navegar y abrir cada parada, como MoeGo, pero Google Maps Platform exige tarjeta y cobra por uso. El volumen es pequeño: 3 a 5 técnicos y decenas de paradas al día.

## Decisión

Leaflet para el mapa, tiles de CARTO/OpenStreetMap y OpenRouteService (plan gratuito) para geocodificar direcciones y calcular tiempos y distancias entre paradas.

## Por qué

- Cubre la interacción que el cliente pidió con costo cero.
- Las coordenadas se guardan en `addresses.lat/lng`, así que cambiar de proveedor no toca el modelo.

## Consecuencias

- Los tiles públicos tienen límites de uso: hay que respetar su política y cachear. Si el uso crece, se pasa a un proveedor de tiles de pago sin cambiar el código de la interfaz.
- Geocodificación y ruteo se encapsulan en `src/server/geo/` para poder reemplazarlos.
