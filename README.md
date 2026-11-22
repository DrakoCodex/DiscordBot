# DrakoStore Bot v2 (Open Source Ready)

Bot diseñado para dejar el repositorio público en GitHub de forma segura (todas las credenciales se cargan desde **Environment** en Render).

## Qué hace este bot
1. **`/setup`**: Construye toda la estructura del servidor:
   - `📌 INICIO · START`: `👋｜welcome`, `📊｜status`, `💳｜how-to-buy`, `⭐｜vouches`, `📖｜guide`, `📜｜rules`
   - `🛒 TIENDA · SHOP`: `🟢｜free-fire`, `🟢｜cs2`, `🟢｜roblox`, `🟢｜robrun`, `🟢｜minecraft` (con precios, tipo Kernel/Internal y botón de prueba gratis)
   - `📢 NOVEDADES · NEWS`: `📢｜announcements`, `🚀｜updates`
   - `💬 COMUNIDAD · COMMUNITY`: `🎫｜support` (panel de 1 Día Gratis + Ticket de Compra), `💬｜general`
   - Canal de voz bloqueado **`🟢 Soporte en línea`**: el bot se conecta automáticamente y permanece **24/7** (con reconexión automática).
   - Categoría privada `🔒 STAFF`: `staff-aprobaciones` para aprobar capturas con un clic.
2. **Estado en vivo (`📊｜status`)**: Publica el tablero dividido en **PC · Kernel** y **PC · Internals** con menciones clicables a cada canal de juego.
3. **1 Día Gratis automático**: El usuario abre su ticket, sube captura siguiendo tus redes/likes, el bot la manda a `#staff-aprobaciones` y al darle a **Aprobar**, le envía una key al privado (DM).
4. **Auto-Moderación**: Anti-enlaces, anti-spam y bienvenida automática.
5. **Keep-Alive HTTP**: Puerto Express abierto para UptimeRobot.

## Variables de entorno en Render
- `DISCORD_TOKEN`: Token del bot
- `CLIENT_ID`: Application ID del bot
- `GUILD_ID`: ID de tu servidor de Discord
- `WEB_URL`: `https://drakostore.xyz`
- `BANNER_URL`: (Opcional) URL de tu banner/GIF verde para bienvenida y paneles
- `STATUS_BANNER_URL`: (Opcional) URL del banner superior para el canal de status

## Permisos en Discord Developer Portal
Activa en **Bot -> Privileged Gateway Intents**:
- Server Members Intent
- Message Content Intent
