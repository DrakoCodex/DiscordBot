# DrakoStore Discord Bot

Bot todo-en-uno para **DrakoStore** (`https://drakostore.xyz`) listo para desplegar en **Render** con **UptimeRobot**.

## Funciones incluidas
- `/setup`: Construye automáticamente categorías, canales, roles, permisos, reglas, precios y panel interactivo de **1 Día Gratis**.
- `/addkeys`: Agrega keys de prueba de 1 día por juego (`free-fire`, `cs2`, `roblox`, `robrun`, `minecraft`).
- `/stock`: Revisa cuántas keys de prueba quedan disponibles.
- **Pruebas gratis con captura**: El usuario abre un ticket desde el panel, sube la captura siguiendo tus redes y dando like, y el bot la envía a `#staff-aprobaciones` con botones de **Aprobar y Enviar Key** (por DM) o **Rechazar**.
- **Auto-Moderación**: Bloquea enlaces/invitaciones a usuarios normales, frena spam rápido y da bienvenida automática.
- **Keep-Alive HTTP**: Servidor Express integrado para mantenerlo activo 24/7 con UptimeRobot.

## Despliegue rápido (GitHub + Render + UptimeRobot)
1. En **Discord Developer Portal** -> **Bot**, activa **Server Members Intent** y **Message Content Intent**.
2. Invita el bot a tu servidor con permiso **Administrator**.
3. Sube estos archivos a un repositorio privado en **GitHub**.
4. En **Render.com**, crea un **Web Service** conectado al repo:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variables:** agrega `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `WEB_URL` y (opcional) `BANNER_URL`.
5. Copia la URL pública de Render y crea un monitor HTTP(s) cada 5 minutos en **UptimeRobot.com**.
6. En tu servidor de Discord ejecuta `/setup` y luego `/addkeys` para cargar tus keys de prueba.
