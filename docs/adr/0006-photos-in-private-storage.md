# ADR 0006 — Fotos en un bucket privado con URLs firmadas

- Estado: aceptada
- Fecha: 2026-10-07

## Contexto

Los agentes y técnicos adjuntan fotos a una cita (estado del lugar, antes y después). Pueden mostrar el interior de una casa, así que no deben ser accesibles con solo conocer una dirección. El tamaño de lo que se sube también tiene que estar acotado, porque el cuerpo de una petición a una función serverless suele tener un tope cercano a 4,5 MB.

## Decisión

- Las fotos se guardan en un bucket privado de Supabase Storage (`appointment-photos`). La base de datos solo guarda la ruta, el tipo y el tamaño (`appointment_photos`).
- Solo el servidor toca el bucket, con la clave de servicio (`SUPABASE_SERVICE_ROLE_KEY`, nunca con prefijo `NEXT_PUBLIC_`). El navegador recibe URLs firmadas que vencen en una hora.
- El servidor depende de una interfaz pequeña (`PhotoStorage`: guardar, borrar, firmar). La implementación de Supabase vive en `src/server/storage.ts` y los tests usan una en memoria.
- Se aceptan JPG, PNG y WebP de hasta 4 MB, con un máximo de 20 por cita. El tipo se decide leyendo los primeros bytes del archivo y no el `Content-Type` que declara el cliente.
- Ruta del archivo: `appointments/<id de la cita>/<id de la foto>.<ext>`. El nombre original del archivo nunca se usa.

## Por qué

- Un bucket público expondría fotos privadas a quien obtenga el enlace. Con URLs firmadas el enlace caduca.
- Pasar por el servidor permite validar el contenido, aplicar permisos y dejar rastro en el historial de la cita, cosas que una subida directa desde el navegador no garantiza.
- La interfaz de almacenamiento permite probar la lógica completa con PGlite sin una cuenta de Supabase y cambiar de proveedor sin tocar las reglas.
- El límite de 4 MB cabe en el tope de una función serverless. Como las cámaras de los teléfonos producen archivos más grandes, la interfaz deberá reducir la foto en el navegador antes de enviarla.

## Consecuencias

- El orden de operaciones es: validar, guardar el archivo y después registrar la fila y el historial en una transacción. Si el registro falla, se borra el archivo. Al eliminar, la fila se borra primero y el archivo después; si el almacenamiento falla en ese último paso queda un archivo huérfano que se registra en los logs, sin afectar al usuario.
- Los formatos HEIC y similares no se aceptan por ahora. Si los teléfonos del equipo los producen, la conversión se hace en el navegador.
- No hay antivirus ni reescritura de la imagen. La firma del archivo descarta lo que no es una foto, pero no un archivo de imagen malicioso; al ser un bucket privado servido con su tipo real, el riesgo se limita a quien tenga la URL firmada.
- Las fotos no se borran del bucket cuando se cancela una cita. Cuando el cliente defina su política de retención se puede añadir una limpieza programada.

## Interfaz de fotos en el panel de la cita

- El navegador reduce cada foto antes de enviarla (`src/lib/image-resize.ts`, con los números en `src/domain/photo-resize.ts`). Una foto de un formato aceptado, de hasta 1,5 MB y 2048 px de lado largo se envía tal cual. Las demás se redibujan en un canvas y se guardan como JPEG, probando primero bajar la calidad y después el tamaño, hasta quedar por debajo de 3,5 MB.
- El objetivo de 3,5 MB deja margen frente al máximo de 4 MB del servidor y al cuerpo de ~4,5 MB de una función serverless. Si ningún intento llega, se muestra un aviso en lugar de enviar el archivo.
- Las fotos se suben una por una. Cada archivo tiene su propio estado y su propio error, de modo que una foto ilegible o rechazada no cancela las demás.
- Las miniaturas usan `<img>` y no `next/image`: las URLs firmadas caducan y el optimizador de imágenes las guardaría en caché y las serviría sin firma. Por eso la regla `@next/next/no-img-element` está desactivada solo en `photo-gallery.tsx`.
- Si falta `SUPABASE_SERVICE_ROLE_KEY`, el panel sigue abriendo y la sección de fotos muestra que el almacenamiento aún no está conectado.
- Si el navegador no puede decodificar un formato (por ejemplo HEIC fuera de Safari), el archivo se rechaza con un mensaje claro.
