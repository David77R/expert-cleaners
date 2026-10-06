# Cómo trabajamos

Scrum ligero con sprints de una semana, pensado para un equipo pequeño y un cliente que valida en cada entrega.

## Roles

| Rol           | Quién                               | Responsabilidad                                    |
| ------------- | ----------------------------------- | -------------------------------------------------- |
| Product Owner | Staff de Expert Cleaners            | Decide prioridades y acepta o rechaza lo entregado |
| Desarrollo    | David                               | Construye, prueba y documenta                      |
| Scrum Master  | David (rotativo si crece el equipo) | Mantiene el ritmo y quita bloqueos                 |

## Ceremonias

| Ceremonia         | Cuándo                | Duración | Resultado                                  |
| ----------------- | --------------------- | -------- | ------------------------------------------ |
| Planning          | Lunes                 | 45 min   | Sprint backlog con criterios de aceptación |
| Daily (asíncrono) | Cada día              | 5 min    | Qué hice, qué haré, qué me bloquea         |
| Review (demo)     | Viernes               | 30 min   | Demo al staff y feedback por escrito       |
| Retrospectiva     | Viernes, tras la demo | 20 min   | 1 mejora concreta para el siguiente sprint |

## Definition of Ready

Una historia entra al sprint solo si tiene: valor claro para el agente, criterios de aceptación verificables, dependencias identificadas y las reglas "Por confirmar" del Documento Maestro resueltas o marcadas con una regla genérica.

## Definition of Done

- Typecheck, lint y pruebas pasan en CI (`npm run check`).
- Las reglas de negocio nuevas tienen pruebas automatizadas.
- Cada cambio de datos relevante deja entrada en el historial.
- Hay migración si cambió el esquema.
- La documentación y el diagrama afectados están actualizados.
- El Product Owner vio la demo y la aceptó.

## Flujo del tablero

`Backlog` → `Listo para el sprint` → `En progreso` → `En revisión` → `Hecho`, más una columna `Bloqueado` y otra `Pendiente de Expert Cleaners` para decisiones de negocio.

## Convenciones

- Ramas: `feat/…`, `fix/…`, `docs/…`.
- Commits: Conventional Commits (`feat(appointments): …`).
- Etiquetas de épica: Calendario, Mapa, Clientes, Reportes, Facturación, Plataforma.
