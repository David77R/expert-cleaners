# Roadmap

Fechas propuestas para 4 sprints semanales; se ajustan a la aprobación del mockup por el staff.

```mermaid
gantt
  title Expert Cleaners — MVP en 4 sprints
  dateFormat YYYY-MM-DD
  axisFormat %d %b
  section Sprint 1 · Cimientos
  Repo, CI y modelo de datos        :done,   s1a, 2026-10-05, 2d
  Reglas de citas e historial       :done,   s1b, 2026-10-06, 2d
  Login con roles y calendario día  :active, s1c, 2026-10-07, 3d
  section Sprint 2 · Operación
  Drag and drop con confirmación    :s2a, 2026-10-12, 3d
  Panel lateral y clientes          :s2b, 2026-10-12, 4d
  Catálogo de servicios             :s2c, 2026-10-14, 3d
  section Sprint 3 · Mapa y reportes
  Geocodificación y mapa real       :s3a, 2026-10-19, 3d
  Rutas, tiempos y filtros          :s3b, 2026-10-20, 3d
  Reportes por agente y alertas     :s3c, 2026-10-21, 4d
  section Sprint 4 · Facturación y salida
  Invoice PDF y pagos               :s4a, 2026-10-26, 3d
  Fotos, E2E y correcciones         :s4b, 2026-10-27, 3d
  Despliegue y capacitación         :milestone, s4c, 2026-10-30, 0d
```

## Riesgos

| Riesgo                                              | Probabilidad | Impacto | Mitigación                                              |
| --------------------------------------------------- | ------------ | ------- | ------------------------------------------------------- |
| Reglas "Por confirmar" sin resolver                 | Alta         | Media   | Regla genérica y marcada; se cambia en una fase 2       |
| Supabase gratuito pausa el proyecto por inactividad | Media        | Alta    | Avisar al cliente; plan Pro si entra en producción real |
| Límites de tiles y geocodificación gratuitos        | Baja         | Media   | Cachear coordenadas; proveedor intercambiable           |
| Plazo de 4 semanas ajustado                         | Media        | Alta    | Priorización MoSCoW; IA y pagos automáticos a fase 2    |
