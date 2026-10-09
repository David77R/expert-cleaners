# ADR 0005 — PDF generados en el servidor con pdf-lib

- Estado: aceptada
- Fecha: 2026-10-07

## Contexto

El agente necesita generar la factura de una cita, enviarla a cualquier dirección de facturación y volver a descargarla igual que la primera vez. La estructura legal de la factura (impuestos, numeración oficial, datos fiscales y marca) sigue pendiente de validar con el cliente, así que el formato tiene que cambiar sin tocar el resto del sistema.

## Decisión

El PDF se genera en el servidor con `pdf-lib`, a partir de un objeto `InvoiceData` que construye una función pura (`buildInvoice`, en `src/domain/invoice.ts`). La ruta `GET /api/appointments/:id/invoice` devuelve el PDF una vez que la factura está generada.

El reporte por agente usa el mismo motor (`GET /api/reports/agents/pdf`). Las utilidades comunes (colores, limpieza de texto, saltos de línea, encabezado y pie) viven en `src/server/pdf-kit.ts`.

## Por qué

- `pdf-lib` es TypeScript puro, no necesita navegador ni binarios, y funciona igual en desarrollo, en tests y en un despliegue serverless. Puppeteer o Chromium obligarían a un entorno pesado para un documento de una página.
- Separar los datos (`buildInvoice`) del dibujo (`renderInvoicePdf`) permite probar las reglas sin generar PDFs y cambiar el diseño sin tocar las reglas.
- La misma factura produce siempre los mismos bytes: la fecha de emisión sale del historial (cuando se generó) y no de la hora de la descarga.
- La factura nunca incluye las notas de la cita, que son internas y pueden traer códigos de acceso.

## Consecuencias

- Las fuentes estándar del PDF solo cubren Latin-1. Los acentos y la ñ funcionan; cualquier otro carácter (por ejemplo un emoji) se sustituye por `?` en lugar de romper la generación. El texto se limpia antes de medirlo, porque medir un carácter no soportado lanza un error. Si hiciera falta soportar más, se embebe una fuente TrueType.
- El número de factura se deriva del código de la cita (`SVC-2031` → `INV-2031`). Cuando el cliente defina la numeración oficial, solo cambia `invoiceNumber`.
- No hay líneas de impuestos ni datos fiscales del emisor hasta que el cliente los confirme. El PDF actual muestra un solo concepto y un total.
- El PDF no se guarda: se regenera en cada descarga. Si en el futuro se exige conservar la copia exacta enviada, se guardará en Supabase Storage al marcarla como enviada.
