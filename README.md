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

