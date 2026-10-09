# Referencia de la API

Todas las rutas viven en `src/app/api`, requieren sesión y responden JSON. Sin sesión devuelven `401`. Los importes están en centavos y las fechas en formato `YYYY-MM-DD`. Los días de negocio se calculan en `America/New_York`.

## Convenciones de error

| Estado | `error`                  | Cuándo ocurre                                                    |
| ------ | ------------------------ | ---------------------------------------------------------------- |
| 401    | `unauthorized`           | No hay sesión válida                                             |
| 403    | `forbidden`              | La acción requiere rol administrador                             |
| 404    | `not_found`              | El recurso no existe                                             |
| 413    | `photo_too_large`        | La foto supera los 4 MB                                          |
| 415    | `photo_unsupported_type` | El archivo no es JPG, PNG ni WebP (se revisa la firma real)      |
| 409    | código de dominio        | Una regla de negocio impide la operación (ver tabla siguiente)   |
| 422    | `validation_error`       | El cuerpo o la consulta no cumple el esquema; incluye `issues[]` |
| 500    | `internal_error`         | Error inesperado; el detalle queda solo en los logs del servidor |

Códigos de dominio frecuentes: `invalid_transition`, `reason_required`, `explanation_required`, `service_unavailable`, `technician_unavailable`, `address_mismatch`, `destination_required`, `destination_not_allowed`, `specs_required`, `not_movable`, `cancelled`, `invoice_sent`, `last_address`, `address_in_use`, `slug_taken`, `invalid_slug`, `service_in_use`, `invoice_not_generated`, `photo_limit`.

Los solapes de horario nunca bloquean: las mutaciones de citas devuelven `{ appointment, conflicts }` y el agente decide.

## Citas

| Método | Ruta                            | Descripción                                                                                  |
| ------ | ------------------------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/api/appointments?date=`       | Citas de un día, con `overlapIds`. Acepta `technicianId`                                     |
| GET    | `/api/appointments/range`       | Citas entre `from` y `to` (máximo 42 días), con `overlapIds` y `countsByDate`                |
| POST   | `/api/appointments`             | Crea una cita. Responde `201` con `{ appointment, conflicts }`                               |
| GET    | `/api/appointments/:id`         | Detalle con cliente, dirección, servicio, técnico, fotos e historial                         |
| POST   | `/api/appointments/:id/actions` | Ejecuta una acción sobre la cita (ver abajo)                                                 |
| GET    | `/api/appointments/:id/invoice` | Factura en PDF (`application/pdf`). Responde `409 invoice_not_generated` hasta que se genere |

Acciones (`{ "action": ... }`): `confirm`, `complete`, `mark_paid`, `advance_invoice`, `cancel` (`reason`, `explanation`), `reschedule` (`date`, `startMin`, `technicianId?`, `reason`), `move` (`startMin`, `technicianId`), `set_destination`, `set_billing` (`address`) y `update_notes` (`notes`). Cada acción corre en una transacción y deja su entrada en el historial.

## Fotos de la cita

| Método | Ruta                                    | Descripción                                                                         |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------- |
| GET    | `/api/appointments/:id/photos`          | Fotos en orden de subida, cada una con URL firmada de una hora y quién la subió     |
| POST   | `/api/appointments/:id/photos`          | Sube una foto (`multipart/form-data`, campo `file`). Responde `201` con `{ photo }` |
| DELETE | `/api/appointments/:id/photos/:photoId` | Elimina la foto. Solo quien la subió o un administrador                             |

Se aceptan JPG, PNG y WebP de hasta 4 MB, con un máximo de 20 fotos por cita. El tipo se determina por el contenido del archivo y no por lo que declare el navegador. No se pueden agregar fotos a una cita cancelada. Subir y eliminar dejan una entrada `photo` en el historial. Los archivos viven en un bucket privado, así que solo se ven con la URL firmada que devuelve la API.

## Clientes

| Método | Ruta                                      | Descripción                                                                             |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| GET    | `/api/customers?q=&limit=&offset=`        | Búsqueda por nombre, teléfono, correo o código. Responde `{ items, hasMore }`           |
| POST   | `/api/customers`                          | Crea cliente con al menos una dirección. Devuelve `duplicates` si el teléfono ya existe |
| GET    | `/api/customers/:id`                      | Detalle con direcciones, `history` (notas firmadas) y últimas 20 citas                  |
| PATCH  | `/api/customers/:id`                      | Edita solo los campos enviados; `null` limpia correo y notas                            |
| POST   | `/api/customers/:id/addresses`            | Agrega una dirección                                                                    |
| PATCH  | `/api/customers/:id/addresses/:addressId` | Edita una dirección                                                                     |
| DELETE | `/api/customers/:id/addresses/:addressId` | Elimina si no es la última ni tiene citas asociadas                                     |
| POST   | `/api/customers/:id/notes`                | Agrega una nota firmada por el usuario                                                  |

## Servicios

| Método | Ruta                | Rol           | Descripción                                                     |
| ------ | ------------------- | ------------- | --------------------------------------------------------------- |
| GET    | `/api/services`     | cualquiera    | Servicios activos. `includeInactive=true` solo aplica a admin   |
| GET    | `/api/services/:id` | cualquiera    | Detalle                                                         |
| POST   | `/api/services`     | administrador | Crea un servicio; el `slug` se genera del nombre si no se envía |
| PATCH  | `/api/services/:id` | administrador | Edita campos; el `slug` es inmutable                            |

## Reportes y alertas

| Método | Ruta                      | Rol           | Descripción                                                                                     |
| ------ | ------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/api/reports/agents`     | administrador | Citas agendadas por agente y día, con dinero agendado, cobrado y pendiente                      |
| GET    | `/api/reports/agents/pdf` | administrador | El mismo reporte en PDF (KPIs, gráfica diaria y tabla por agente). Acepta los mismos parámetros |
| GET    | `/api/alerts?date=`       | cualquiera    | No confirmadas, solapes, completadas sin pagar y reprogramadas. Sin fecha usa hoy               |

`/api/reports/agents` acepta `period=day|week|month` con `date`, o `from` y `to` (máximo 93 días), y opcionalmente `agentId`. La semana va de domingo a sábado. El dinero excluye las citas canceladas.

`/api/alerts` devuelve `{ date, count, items }`. Cada item trae `type`, `level`, `count` y `appointmentIds`; los textos los traduce la interfaz. Las completadas sin pagar incluyen días anteriores a la fecha consultada.
