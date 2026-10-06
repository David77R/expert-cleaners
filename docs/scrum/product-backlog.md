# Product backlog

Puntos en escala Fibonacci. Prioridad: M (must), S (should), C (could).

| ID     | Épica       | Historia                                                                                        | Pts | Prio | Sprint |
| ------ | ----------- | ----------------------------------------------------------------------------------------------- | --- | ---- | ------ |
| EC-001 | Plataforma  | Como desarrollador quiero un repo con CI, tipos estrictos y pruebas para entregar con confianza | 3   | M    | 1      |
| EC-002 | Plataforma  | Como equipo quiero un modelo de datos Cliente→Direcciones→Citas con migraciones                 | 5   | M    | 1      |
| EC-003 | Calendario  | Como agente quiero crear una cita con reglas del catálogo para no olvidar datos obligatorios    | 5   | M    | 1      |
| EC-004 | Calendario  | Como agente quiero confirmar, completar, cancelar y reprogramar con motivo y confirmación       | 5   | M    | 1      |
| EC-005 | Calendario  | Como agente quiero ver advertencias de solapamiento sin que el sistema me bloquee               | 3   | M    | 1      |
| EC-006 | Calendario  | Como auditor quiero un historial de quién cambió qué en cada cita                               | 3   | M    | 1      |
| EC-007 | Plataforma  | Como admin quiero iniciar sesión con rol Agente o Admin                                         | 5   | M    | 1      |
| EC-008 | Calendario  | Como agente quiero ver el día por técnico con datos reales                                      | 5   | M    | 1      |
| EC-009 | Calendario  | Como agente quiero arrastrar una cita y confirmar el movimiento                                 | 8   | M    | 2      |
| EC-010 | Calendario  | Como agente quiero vistas Semana y Mes                                                          | 5   | S    | 2      |
| EC-011 | Calendario  | Como agente quiero panel lateral de cita editable con historial                                 | 8   | M    | 2      |
| EC-012 | Clientes    | Como agente quiero crear y buscar clientes por nombre, teléfono, dirección o ID                 | 5   | M    | 2      |
| EC-013 | Clientes    | Como agente quiero varias direcciones por cliente y notas de historial                          | 3   | M    | 2      |
| EC-014 | Plataforma  | Como admin quiero administrar el catálogo de servicios y sus campos                             | 5   | M    | 2      |
| EC-015 | Calendario  | Como agente quiero recogida y entrega con dos direcciones                                       | 3   | M    | 2      |
| EC-016 | Mapa        | Como agente quiero geocodificar direcciones y ver paradas en un mapa real                       | 8   | M    | 3      |
| EC-017 | Mapa        | Como agente quiero ruta numerada con tiempos entre paradas y filtro por servicio                | 8   | M    | 3      |
| EC-018 | Mapa        | Como agente quiero aceptar o reordenar una ruta sugerida sin que se muevan citas                | 5   | S    | 3      |
| EC-019 | Reportes    | Como admin quiero reportes por agente (día, semana, mes) con exportar PDF                       | 8   | M    | 3      |
| EC-020 | Plataforma  | Como agente quiero centro de alertas (solapes, no confirmadas, impagas)                         | 5   | S    | 3      |
| EC-021 | Facturación | Como agente quiero generar el invoice en PDF a cualquier dirección                              | 8   | M    | 4      |
| EC-022 | Facturación | Como agente quiero marcar pagado y que quede en el historial                                    | 2   | M    | 4      |
| EC-023 | Calendario  | Como agente quiero adjuntar fotos del sofá o la alfombra a la cita                              | 5   | S    | 4      |
| EC-024 | Plataforma  | Como equipo quiero pruebas end-to-end de los flujos críticos y despliegue a producción          | 8   | M    | 4      |
| EC-025 | Futuro      | Asistente de IA que sugiere rutas (nunca mueve citas)                                           | 13  | C    | Fase 2 |

## Pendientes de Expert Cleaners

Formato real del Service ID, fórmulas de precio por dimensiones, estructura legal del invoice, si se integra o reemplaza CleanCloud y cómo se cobra hoy. Hasta que se resuelvan, se usa la regla genérica del prototipo (ID `SVC-` consecutivo, precio base referencial, factura ilustrativa).
