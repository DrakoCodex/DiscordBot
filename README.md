# DrakoStore Bot v3.4

Bot diseñado para dejar el código público en GitHub y configurar todo desde **Render (Environment)**.

## Novedades de la v3.2
- **Roles con colores y jerarquía automática:** `👑 Owner` rojo (Administrador y auto-asignado al dueño), `🛡️ Staff` morado, `🤝 Partner`, `🤖 Bots` azul (auto-asignado a bots), `💎 Clientes` celeste y `Miembro` negro (`hoist: false`, para no clientes).
- **Área privada `🔒 OWNER · STAFF`:** solo Owner, Staff y el bot pueden verla. Staff puede gestionar los canales de esa categoría y utilizar `🤖｜bot-commands`; ahí puede ejecutar `/genkey` y `/update`. `/setup`, revocación, ampliación y reseteo de keys siguen reservados al Owner.
- **Sin hilos nuevos:** el bot aplica denegaciones de creación de hilos en las categorías y canales sincronizados. Discord siempre permite eludirlo a miembros con `Administrator`.
- **`/setup` y `/update` idempotentes:** comprueban categorías, roles y canales existentes; sincronizan los paneles sin duplicarlos y se ejecutan también al arrancar el bot.
- **Canales de Tienda profesionales:** Cada juego tiene espacio para **Banner/GIF superior**, descripción, estado con hora dinámica, lista de funciones, bloque de precios (`$1.50`, `$6`, `$12`, `$25`), **captura del menú abajo** y 4 botones interactivos (`Comprar`, `Prueba gratis`, `Funciones`, `Pagos`).
- **Guía VIP (`📖｜guide`):** Formato completo para clientes en Windows (Kernel e Internal) con banner superior y botón directo de Ticket de Soporte.
- **Canal de voz 24/7 (`🟢 Soporte en línea`):** Bloqueado para usuarios, el bot se mantiene conectado permanentemente.
- **Sistema de 1 Día Gratis:** Detecta la captura en el ticket, la envía a `#staff-aprobaciones` y al aprobar manda la key por DM.

## Imágenes y assets
Los banners de bienvenida, guía, compra y reglas están incluidos en `assets/` y se sirven desde `/assets/` en el servicio web de Render. Render proporciona la base pública automáticamente; se puede sobrescribir con `PUBLIC_ASSET_BASE_URL`. Las imágenes de productos siguen configurándose con URLs de `.env.example`.

## Pruebas gratis y Supabase

El límite de **una prueba aprobada por usuario y servidor** se guarda en Supabase; no depende de la memoria del proceso de Render. La migración `migrations/20261123030500_trial_claims.sql` crea la tabla `trial_claims`, activa RLS y añade índices únicos para impedir duplicados incluso si dos administradores aprueban al mismo tiempo.

La aprobación usa la función SQL `approve_trial`, que crea la licencia y marca la solicitud como aprobada dentro de una operación atómica. Si el bot se reinicia, las solicitudes pendientes y las pruebas aprobadas permanecen registradas.

Para desplegar una copia nueva:

1. Crea la tabla `licenses` con las columnas que usa el bot (`id`, `key`, `game`, `duration_days`, `status`, `discord_user_id`, `hwid`, `activated_at`, `expires_at` y `created_at`).
2. Ejecuta la migración de `migrations/20261123030500_trial_claims.sql` en el proyecto Supabase.
3. Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` únicamente en Render. Nunca publiques la clave `service_role` en GitHub, el navegador o el loader.
4. Configura las URLs de los loaders y las imágenes indicadas en `.env.example`.

Una solicitud rechazada puede volver a intentarse. Una solicitud cancelada también puede volver a crearse. Una solicitud aprobada queda bloqueada permanentemente para ese usuario dentro de ese servidor.

## Permisos de Owner y Staff y gestión de licencias

Las acciones sensibles requieren el rol exacto `👑 Owner` o ser el dueño del servidor. Tener permisos de Administrador no es suficiente. Esta protección se valida dentro del código antes de ejecutar la operación.

Solo Owner puede:

- Ejecutar `/resethwid`.
- Ejecutar `/revoke key:<key>` para bloquear una licencia.
- Ejecutar `/adddays key:<key> dias:<cantidad>` para ampliar una licencia entre 1 y 3650 días.

Owner y Staff pueden ejecutar `/genkey` desde la categoría privada. Owner y Staff pueden ejecutar `/update` desde esa categoría; solo Owner puede ejecutar `/setup`. Staff puede gestionar los canales de la categoría, pero no recibe permisos globales de Administrador.

Owner y Staff pueden aprobar o rechazar pruebas gratuitas y cerrar tickets. `/revoke` cambia el estado de la licencia a `banned`. `/adddays` aumenta `duration_days` y, si la licencia ya estaba activada, también extiende `expires_at`. Una licencia revocada no se puede ampliar con ese comando.
