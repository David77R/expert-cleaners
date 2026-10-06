# Arquitectura

## Contexto del sistema

```mermaid
flowchart LR
  agent["Agente / Admin<br/>(navegador)"] -->|HTTPS| app["Next.js 16<br/>App Router + Route Handlers"]
  app -->|"SQL (Drizzle)"| pg[("Postgres<br/>Supabase")]
  app -->|"Auth (JWT en cookies)"| auth["Supabase Auth"]
  app -.->|"Sprint 3"| ors["OpenRouteService<br/>geocodificación y rutas"]
  app -.->|"Sprint 3"| tiles["Leaflet + tiles OSM/CARTO"]
  app -.->|"Sprint 4"| storage["Supabase Storage<br/>fotos de citas"]
```

## Capas

```mermaid
flowchart TB
  ui["UI: src/app, src/components"] --> api["Route Handlers: src/app/api"]
  api --> actions["Despachador de acciones: src/server/actions.ts"]
  actions --> svc["Servicios con transacción: src/server/appointments.ts"]
  svc --> rules["Reglas puras de dominio: src/domain"]
  svc --> db["Drizzle + schema: src/db"]
```

La regla de dependencia apunta hacia abajo: `src/domain` no importa nada de Next ni de la base de datos, por eso se prueba sin infraestructura.

## Modelo de datos

```mermaid
erDiagram
  profiles ||--o{ appointments : "agenda"
  customers ||--o{ addresses : "tiene"
  customers ||--o{ appointments : "solicita"
  customers ||--o{ customer_notes : "historial"
  addresses ||--o{ appointments : "se recoge o atiende en"
  services ||--o{ appointments : "catálogo"
  technicians ||--o{ appointments : "ejecuta"
  appointments ||--o{ appointment_history : "auditoría"
  appointments ||--o{ appointment_photos : "fotos"
  profiles ||--o{ appointment_history : "autor"

  appointments {
    uuid id PK
    text code UK "SVC-2001"
    date date
    int start_min
    int duration_min
    enum status
    enum payment_status
    enum invoice_status
    int price_cents
    jsonb destination_address "solo recogida/entrega"
    jsonb billing_address "opcional"
    jsonb specs
  }
  services {
    uuid id PK
    bool two_addresses
    jsonb fields "campos dinámicos"
    text detailed_specs "solo agentes"
  }
```

Decisiones de modelado: `destination_address` y `billing_address` son instantáneas JSON dentro de la cita (una dirección puntual no ensucia el perfil del cliente); el dinero se guarda en centavos; el estado de la cita, el pago y la factura son tres columnas independientes.

## Estados de una cita

```mermaid
stateDiagram-v2
  [*] --> not_confirmed: crear
  not_confirmed --> confirmed: confirmar
  not_confirmed --> rescheduled: reprogramar (motivo obligatorio)
  confirmed --> rescheduled: reprogramar (motivo obligatorio)
  rescheduled --> confirmed: confirmar
  rescheduled --> rescheduled: reprogramar otra vez
  not_confirmed --> cancelled: cancelar (motivo obligatorio)
  confirmed --> cancelled: cancelar
  rescheduled --> cancelled: cancelar
  confirmed --> completed: completar
  rescheduled --> completed: completar
  not_confirmed --> completed: completar
  cancelled --> [*]
  completed --> [*]
```

El pago (`unpaid` → `paid`) y la factura (`not_generated` → `generated` → `sent`) avanzan por separado y no dependen de este diagrama.

## Mover una cita con drag & drop

```mermaid
sequenceDiagram
  actor A as Agente
  participant UI as Calendario
  participant API as POST /api/appointments/:id/actions
  participant S as moveAppointment
  participant DB as Postgres

  A->>UI: arrastra el bloque
  UI->>A: "¿Mover cita?" (no se guarda aún)
  A->>UI: confirma
  UI->>API: { action: "move", startMin, technicianId }
  API->>S: runAction (Zod valida)
  S->>DB: transacción: UPDATE cita + INSERT historial
  S->>DB: busca conflictos del técnico ese día
  S-->>API: { appointment, conflicts }
  API-->>UI: 200 con advertencia si hay solapamiento
  UI->>A: guarda igual y muestra WARNING (nunca bloquea)
```

## Reglas de negocio implementadas

| Regla                                                         | Dónde vive                                 | Prueba                                   |
| ------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| Una cita nueva empieza como no confirmada y no pagada         | `createAppointment`                        | `appointments.test.ts`                   |
| Cancelar conserva la cita y exige motivo (`other` pide texto) | `resolveCancelReason`, `cancelAppointment` | `domain.test.ts`, `appointments.test.ts` |
| Reprogramar exige motivo                                      | `rescheduleSchema`, `requireReason`        | `appointments.test.ts`                   |
| Solapamiento del mismo técnico es advertencia, nunca bloqueo  | `findConflicts`                            | `domain.test.ts`, `appointments.test.ts` |
| Toda acción relevante escribe quién, qué, desde y hacia       | `persist`                                  | `appointments.test.ts`                   |
| Recogida y entrega exigen dirección de entrega                | `createAppointment`                        | `appointments.test.ts`                   |
| Campos obligatorios por servicio                              | `createAppointment`                        | `appointments.test.ts`                   |
| Pago, factura y estado son independientes                     | columnas separadas                         | `appointments.test.ts`                   |
| La IA nunca mueve citas                                       | no existe ninguna ruta que lo haga solo    | revisión de diseño                       |
