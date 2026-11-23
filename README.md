# DrakoStore Bot v3.1

Bot diseñado para dejar el código público en GitHub y configurar todo desde **Render (Environment)**.

## Novedades de la v3.1
- **Jerarquía de roles automática (`/setup` y `/update`):** Crea, ordena y asigna sin duplicados:
  1. `👑 Owner` (separado arriba, permisos de Administrador, auto-asignado al dueño).
  2. `🤝 Partner` (separado).
  3. `🤖 Bots` (separado, auto-asignado a todos los bots existentes y nuevos).
  4. `💎 Clientes` (separado, migra `Cliente VIP` si existía).
  5. `Miembro` (`hoist: false`, auto-asignado a usuarios normales para que los no clientes aparezcan bajo **En línea**).
- **`/setup` y `/update` inteligentes (sin duplicados):** Verifican qué roles, categorías y canales ya existen. No crean nada por encima; solo crean lo que falte, corrigen permisos y **editan los mensajes existentes** con tus nuevas imágenes o textos.
- **Canales de Tienda profesionales:** Cada juego tiene espacio para **Banner/GIF superior**, descripción, estado con hora dinámica, lista de funciones, bloque de precios (`$1.50`, `$6`, `$12`, `$25`), **captura del menú abajo** y 4 botones interactivos (`Comprar`, `Prueba gratis`, `Funciones`, `Pagos`).
- **Guía VIP (`📖｜guide`):** Formato completo para clientes en Windows (Kernel e Internal) con banner superior y botón directo de Ticket de Soporte.
- **Canal de voz 24/7 (`🟢 Soporte en línea`):** Bloqueado para usuarios, el bot se mantiene conectado permanentemente.
- **Sistema de 1 Día Gratis:** Detecta la captura en el ticket, la envía a `#staff-aprobaciones` y al aprobar manda la key por DM.

## Cómo agregar tus imágenes/GIFs sin tocar código
1. Sube tus imágenes o GIFs a un canal privado de tu Discord (o Imgur), haz clic derecho -> **Copiar enlace**.
2. Pégalos en Render -> **Environment** usando las variables de `.env.example` (por ejemplo `GUIDE_BANNER_URL`, `IMG_CS2_BANNER`, `IMG_CS2_MENU`).
3. Cuando Render reinicie, ejecuta `/update` en tu servidor y el bot actualizará todos los embeds al instante sin borrar ni duplicar canales.

## Pruebas gratis y Supabase

El límite de **una prueba aprobada por usuario y servidor** se guarda en Supabase; no depende de la memoria del proceso de Render. La migración `migrations/20261123030500_trial_claims.sql` crea la tabla `trial_claims`, activa RLS y añade índices únicos para impedir duplicados incluso si dos administradores aprueban al mismo tiempo.

La aprobación usa la función SQL `approve_trial`, que crea la licencia y marca la solicitud como aprobada dentro de una operación atómica. Si el bot se reinicia, las solicitudes pendientes y las pruebas aprobadas permanecen registradas.

Para desplegar una copia nueva:

1. Crea la tabla `licenses` con las columnas que usa el bot (`id`, `key`, `game`, `duration_days`, `status`, `discord_user_id`, `hwid`, `activated_at`, `expires_at` y `created_at`).
2. Ejecuta la migración de `migrations/20261123030500_trial_claims.sql` en el proyecto Supabase.
3. Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` únicamente en Render. Nunca publiques la clave `service_role` en GitHub, el navegador o el loader.
4. Configura las URLs de los loaders y las imágenes indicadas en `.env.example`.

Una solicitud rechazada puede volver a intentarse. Una solicitud cancelada también puede volver a crearse. Una solicitud aprobada queda bloqueada permanentemente para ese usuario dentro de ese servidor.

## Permisos de Owner y gestión de licencias

Las acciones sensibles requieren el rol exacto `👑 Owner` o ser el dueño del servidor. Tener permisos de Administrador no es suficiente. Esta protección se valida dentro del código antes de ejecutar la operación.

Solo Owner puede:

- Ejecutar `/genkey`.
- Ejecutar `/resethwid`.
- Aprobar o rechazar pruebas gratuitas.
- Cerrar tickets con el botón `Cerrar Ticket`.
- Ejecutar `/revoke key:<key>` para bloquear una licencia.
- Ejecutar `/adddays key:<key> dias:<cantidad>` para ampliar una licencia entre 1 y 3650 días.

`/revoke` cambia el estado de la licencia a `banned`. `/adddays` aumenta `duration_days` y, si la licencia ya estaba activada, también extiende `expires_at`. Una licencia revocada no se puede ampliar con ese comando.
