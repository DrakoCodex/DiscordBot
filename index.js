require('dotenv').config();
const express = require('express');
const {
    Client,
    GatewayIntentBits,
    Partials,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    REST,
    Routes,
    SlashCommandBuilder,
    ActivityType
} = require('discord.js');
const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require('@discordjs/voice');

// ==================== 1. KEEP-ALIVE PARA RENDER + UPTIMEROBOT ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.status(200).send('DrakoStore Bot v3.1 Online 24/7');
});

app.listen(PORT, () => console.log(`[HTTP] Keep-alive activo en puerto ${PORT}`));

// ==================== 2. CONFIGURACION (VIA ENVIRONMENT DE RENDER) ====================
const COLOR_GREEN = 0x00E87B;
const WEB_URL = (process.env.WEB_URL || 'https://drakostore.xyz').replace(/\/$/, '');
const BANNER_URL = process.env.BANNER_URL || '';
const STATUS_BANNER_URL = process.env.STATUS_BANNER_URL || BANNER_URL;
const GUIDE_BANNER_URL = process.env.GUIDE_BANNER_URL || BANNER_URL;
const VOICE_CHANNEL_NAME = '🟢 Soporte en línea';

// Jerarquia de roles en la barra derecha (de arriba hacia abajo)
// hoist: true = seccion separada | hoist: false = aparece en "En linea" (usuarios no clientes)
const ROLE_CONFIGS = [
    {
        key: 'owner',
        name: '👑 Owner',
        legacyNames: ['Owner'],
        color: 0xF5B700,
        hoist: true,
        mentionable: false,
        permissions: [PermissionFlagsBits.Administrator]
    },
    {
        key: 'partner',
        name: '🤝 Partner',
        legacyNames: ['Partner', 'Patner'],
        color: 0x00D4FF,
        hoist: true,
        mentionable: false
    },
    {
        key: 'bots',
        name: '🤖 Bots',
        legacyNames: ['Bots', 'Bot'],
        color: 0x5865F2,
        hoist: true,
        mentionable: false
    },
    {
        key: 'clientes',
        name: '💎 Clientes',
        legacyNames: ['Clientes', 'Cliente VIP', 'Cliente'],
        color: COLOR_GREEN,
        hoist: true,
        mentionable: false
    },
    {
        key: 'miembro',
        name: 'Miembro',
        legacyNames: [],
        color: 0x8EA398,
        hoist: false,
        mentionable: false
    }
];

const GAMES = {
    'free-fire': {
        name: 'Free Fire',
        slug: 'free-fire',
        type: 'Internal',
        channelName: '🟢｜free-fire',
        topic: 'DrakoStore · Free Fire Internal (Windows / Emulador) · Precios y compra',
        tagline: 'DEDICADO A JUGADORES DE EMULADOR EN WINDOWS',
        desc: 'Suite Internal optimizada para **MSI App Player y BlueStacks 5** en Windows. Precisión suave, cero caídas de FPS y modo StreamProof.',
        bannerEnv: 'IMG_FF_BANNER',
        menuEnv: 'IMG_FF_MENU',
        shortFeatures: [
            '🎯 **Aimbot** — Legit o Competitivo, selección de hueso (cabeza, cuello, pecho), FOV visible y suavizado.',
            '👁️ **ESP Completo** — Cajas 2D/3D, esqueleto, vida, distancia y alerta de enemigos cercanos.',
            '🛡️ **StreamProof** — Oculto ante OBS, Discord y capturas de pantalla.'
        ],
        fullFeatures: [
            '• Aimbot configurable por hueso con suavizado humano (Smooth)',
            '• Control de retroceso (No Recoil) y FOV personalizable',
            '• ESP de jugadores (Cajas, Skeleton, Vida, Arma, Distancia)',
            '• ESP de botín y cajas de suministro',
            '• Bypass optimizado para MSI App Player y BlueStacks 5 (Windows)',
            '• Modo StreamProof (invisible en OBS y transmisiones)',
            '• Guardado de perfiles Legit / Competitivo'
        ]
    },
    'cs2': {
        name: 'Counter-Strike 2',
        slug: 'cs2',
        type: 'Internal',
        channelName: '🟢｜cs2',
        topic: 'DrakoStore · Counter-Strike 2 Internal (Windows) · Precios y compra',
        tagline: 'PRECISIÓN INTERNAL PARA PREMIER Y MATCHMAKING',
        desc: 'Arquitectura **Internal** diseñada para rendimiento fluido en Windows 10/11. Aimbot Legit, RCS automático y visuales nítidos sin pérdida de FPS.',
        bannerEnv: 'IMG_CS2_BANNER',
        menuEnv: 'IMG_CS2_MENU',
        shortFeatures: [
            '🎯 **Aimbot Legit** — Configuración por arma, curvas suaves, verificación de visibilidad y RCS automático.',
            '🔫 **Triggerbot** — Disparo automático con tecla y retardo humano en milisegundos.',
            '👁️ **ESP & Radar** — Cajas, esqueleto, vida, chaleco, armas, temporizador C4 y lista de espectadores.'
        ],
        fullFeatures: [
            '• Aimbot Internal por arma con suavizado natural',
            '• RCS (Recoil Control System) en ejes X e Y',
            '• Triggerbot con delay configurable',
            '• Box ESP, Skeleton, barra de salud y armadura',
            '• Temporizador de bomba C4 y armas en suelo',
            '• Radar 2D en pantalla y lista de espectadores',
            '• Configs guardables en 1 clic + modo StreamProof'
        ]
    },
    'roblox': {
        name: 'Roblox',
        slug: 'roblox',
        type: 'Internal',
        channelName: '🟢｜roblox',
        topic: 'DrakoStore · Roblox Internal (Windows) · Precios y compra',
        tagline: 'EJECUTOR INTERNAL LUAU DE ALTA ESTABILIDAD',
        desc: 'Motor **Internal** para Windows con alta compatibilidad UNC, sin key systems molestos ni anuncios, y con Script Hub listo para usar.',
        bannerEnv: 'IMG_ROBLOX_BANNER',
        menuEnv: 'IMG_ROBLOX_MENU',
        shortFeatures: [
            '⚡ **Motor Internal** — Alta compatibilidad UNC, inyección instantánea y soporte multi-pestaña.',
            '👁️ **Hub Integrado** — ESP universal, Aimbot para shooters, Speed, Fly y Noclip.',
            '🛡️ **Sin Key System** — Acceso directo con tu licencia, tecla de pánico y desbloqueador de FPS.'
        ],
        fullFeatures: [
            '• Alta compatibilidad UNC para scripts complejos en Luau',
            '• Inyección Internal rápida con bajo uso de CPU',
            '• Editor con pestañas múltiples y Auto-Execute',
            '• Script Hub verificado para los juegos más populares',
            '• ESP universal, Aimbot y cámara libre',
            '• Sin acortadores ni publicidad externa',
            '• Tecla de pánico para ocultar el menú al instante'
        ]
    },
    'robrun': {
        name: 'ROB RUN',
        slug: 'robrun',
        type: 'Kernel',
        channelName: '🟢｜robrun',
        topic: 'DrakoStore · ROB RUN Kernel (Windows) · Precios y compra',
        tagline: 'DEDICADO A JUGADORES QUE BUSCAN MÁXIMA SEGURIDAD',
        desc: 'Suite **100% Nivel Kernel (Ring 0)** para ROB RUN en Windows. Lectura directa desde driver propio, visuales limpios y puntería precisa.',
        bannerEnv: 'IMG_ROBRUN_BANNER',
        menuEnv: 'IMG_ROBRUN_MENU',
        shortFeatures: [
            '🎯 **Aimbot Kernel** — Puntería silenciosa o suave, FOV visible y selección de zona objetivo.',
            '👁️ **ESP Total** — Jugadores, distancia, vida, equipamiento y ubicación de botín.',
            '⚡ **Driver Ring 0** — Carga limpia desde el loader sin sacrificar tus FPS.'
        ],
        fullFeatures: [
            '• Arquitectura Kernel (Ring 0) para Windows 10 y 11',
            '• Aimbot preciso con ajuste de FOV y suavizado',
            '• Reducción de dispersión y estabilidad al apuntar',
            '• ESP de jugadores con cajas, distancia y vida',
            '• ESP de loot y puntos clave del mapa',
            '• Guardado instantáneo de configuraciones',
            '• Compatible con pantalla completa y ventana sin bordes'
        ]
    },
    'minecraft': {
        name: 'Minecraft Java',
        slug: 'minecraft',
        type: 'Kernel',
        channelName: '🟢｜minecraft',
        topic: 'DrakoStore · Minecraft Java Kernel (Windows) · Precios y compra',
        tagline: 'GHOST CLIENT KERNEL PARA PVP COMPETITIVO',
        desc: 'Cliente fantasma a **Nivel Kernel (Ring 0)** diseñado para servidores PvP en Windows. Módulos legítimos indetectables y limpieza total.',
        bannerEnv: 'IMG_MC_BANNER',
        menuEnv: 'IMG_MC_MENU',
        shortFeatures: [
            '🎯 **Combate PvP** — AutoClicker aleatorizado, AimAssist suave, Reach y Velocity legítimos.',
            '👁️ **Visuales & Mundo** — NameTags con armadura, ChestESP, PlayerESP y trayectorias.',
            '🛡️ **Sigilo Kernel** — FastBridge inteligente y botón Self-Destruct en 1 clic.'
        ],
        fullFeatures: [
            '• Ejecución a nivel Kernel para máxima discreción en PvP',
            '• AutoClicker con patrones de aleatorización realistas',
            '• AimAssist suave y TriggerBot con cooldown',
            '• Reach y Velocity ajustables al milímetro',
            '• NameTags (armadura, corazones, encantamientos) y ChestESP',
            '• FastBridge / Eagle inteligente',
            '• Self-Destruct: limpia rastros de memoria en 1 clic'
        ]
    }
};

// Stock en memoria para pruebas de 1 dia (se carga con /addkeys)
const keyStock = {
    'free-fire': [],
    'cs2': [],
    'roblox': [],
    'robrun': [],
    'minecraft': []
};

const claimedUsers = new Set();
const activeTrialTickets = new Map();
const spamTracker = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel]
});

// ==================== 3. CONEXION 24/7 AL CANAL DE VOZ ====================
function connectToSupportVoice(guild) {
    if (!guild) return;
    const voiceChannel = guild.channels.cache.find(
        c => c.type === ChannelType.GuildVoice && c.name === VOICE_CHANNEL_NAME
    );
    if (!voiceChannel) return;

    const existing = getVoiceConnection(guild.id);
    if (existing && existing.joinConfig.channelId === voiceChannel.id) return;

    try {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true
        });

        console.log(`[VOICE] Conectado 24/7 en "${voiceChannel.name}"`);

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5000)
                ]);
            } catch {
                try { connection.destroy(); } catch {}
                setTimeout(() => connectToSupportVoice(guild), 5000);
            }
        });
    } catch (err) {
        console.error('[VOICE ERROR]', err.message);
    }
}

// ==================== 4. SLASH COMMANDS ====================
const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Crea o verifica todos los canales, roles y paneles sin duplicar nada')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('update')
        .setDescription('Actualiza los embeds, imagenes y permisos de todos los canales ya creados')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('addkeys')
        .setDescription('Agrega keys de prueba de 1 dia al stock del bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('juego')
                .setDescription('Juego de las keys')
                .setRequired(true)
                .addChoices(
                    { name: 'Free Fire (Internal)', value: 'free-fire' },
                    { name: 'Counter-Strike 2 (Internal)', value: 'cs2' },
                    { name: 'Roblox (Internal)', value: 'roblox' },
                    { name: 'ROB RUN (Kernel)', value: 'robrun' },
                    { name: 'Minecraft Java (Kernel)', value: 'minecraft' }
                )
        )
        .addStringOption(opt =>
            opt.setName('keys')
                .setDescription('Keys separadas por comas (ej: KEY-1, KEY-2)')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('stock')
        .setDescription('Muestra cuantas keys de prueba quedan disponibles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

client.once('clientReady', async () => {
    console.log(`[BOT] Conectado como ${client.user.tag}`);

    client.user.setPresence({
        activities: [{ name: 'drakostore.xyz | 1 Día Gratis', type: ActivityType.Watching }],
        status: 'online'
    });

    if (process.env.CLIENT_ID && process.env.GUILD_ID) {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            console.log('[BOT] Slash commands registrados (/setup, /update, /addkeys, /stock).');
        } catch (err) {
            console.error('[ERROR] Registrando comandos:', err);
        }

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
            connectToSupportVoice(guild);
            setInterval(() => connectToSupportVoice(guild), 120000);
        }
    }
});

// ==================== 5. BIENVENIDA AUTOMATICA Y AUTO-ROLES ====================
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) {
        const botRole = member.guild.roles.cache.find(r => r.name === '🤖 Bots');
        if (botRole && botRole.editable) {
            await member.roles.add(botRole).catch(() => {});
        }
        return;
    }

    const memberRole = member.guild.roles.cache.find(r => r.name === 'Miembro');
    if (memberRole && memberRole.editable) {
        await member.roles.add(memberRole).catch(() => {});
    }

    const ch = member.guild.channels.cache.find(c => c.name.includes('welcome'));
    if (!ch) return;

    const embed = new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle(`Bienvenido a DrakoStore, ${member.user.username}`)
        .setDescription(
            `Herramientas **Kernel e Internal para Windows** desde **$1.50 USD**.\n\n` +
            `• Revisa el estado en vivo y los juegos disponibles.\n` +
            `• Reclama **1 día gratis** en soporte subiendo tu captura.\n` +
            `• Web oficial: ${WEB_URL}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: 'DrakoStore • Soporte en línea 24/7' })
        .setTimestamp();

    if (BANNER_URL) embed.setImage(BANNER_URL);
    ch.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

// ==================== 6. AUTO-MODERACION + CAPTURAS DE PRUEBA GRATIS ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const isAdmin = message.member.permissions.has(PermissionFlagsBits.ManageMessages);

    // A) Detectar captura dentro de un ticket de 1 Dia Gratis
    if (activeTrialTickets.has(message.channel.id) && message.attachments.size > 0) {
        const attachment = message.attachments.find(a => a.contentType?.startsWith('image/'));
        if (attachment) {
            const ticketInfo = activeTrialTickets.get(message.channel.id);
            const reviewCh = message.guild.channels.cache.find(c => c.name === 'staff-aprobaciones');

            if (reviewCh) {
                const game = GAMES[ticketInfo.gameKey];
                const reviewEmbed = new EmbedBuilder()
                    .setColor(COLOR_GREEN)
                    .setTitle('Nueva captura para 1 Día Gratis')
                    .addFields(
                        { name: 'Usuario', value: `<@${ticketInfo.userId}> (\`${message.author.tag}\`)`, inline: true },
                        { name: 'Juego', value: `${game.name} (${game.type})`, inline: true },
                        { name: 'Stock actual', value: `${keyStock[ticketInfo.gameKey].length} keys`, inline: true }
                    )
                    .setImage(attachment.url)
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_${ticketInfo.userId}_${ticketInfo.gameKey}_${message.channel.id}`)
                        .setLabel('Aprobar y Enviar Key')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_${ticketInfo.userId}_${message.channel.id}`)
                        .setLabel('Rechazar')
                        .setStyle(ButtonStyle.Danger)
                );

                await reviewCh.send({ embeds: [reviewEmbed], components: [row] });
                await message.reply('Captura recibida. El staff la está revisando; al aprobarse te enviaré tu key de 24 horas por mensaje privado.');
            }
        }
        return;
    }

    if (isAdmin) return;

    // B) Anti-links / Anti-invitaciones
    const linkRegex = /(https?:\/\/|discord\.gg\/|discord\.com\/invite\/)/i;
    if (linkRegex.test(message.content)) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send(`${message.author}, no está permitido enviar enlaces en el servidor.`);
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
    }

    // C) Anti-spam (5 mensajes en menos de 4 segundos)
    const now = Date.now();
    const timestamps = (spamTracker.get(message.author.id) || []).filter(t => now - t < 4000);
    timestamps.push(now);
    spamTracker.set(message.author.id, timestamps);

    if (timestamps.length >= 5) {
        spamTracker.set(message.author.id, []);
        await message.delete().catch(() => {});
        await message.member.timeout(60 * 1000, 'AutoMod: Spam detectado').catch(() => {});
        const warn = await message.channel.send(`${message.author} fue silenciado 1 minuto por spam.`);
        setTimeout(() => warn.delete().catch(() => {}), 5000);
    }
});

// ==================== 7. HELPERS PARA CREAR TICKETS ====================
async function createTrialTicket(interaction, gameKey) {
    if (claimedUsers.has(interaction.user.id)) {
        return interaction.editReply('Ya reclamaste tu prueba gratuita de 1 día anteriormente.');
    }

    const game = GAMES[gameKey];
    const guild = interaction.guild;
    const category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.includes('COMUNIDAD')
    );

    const ticketChannel = await guild.channels.create({
        name: `prueba-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`,
        type: ChannelType.GuildText,
        parent: category?.id,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
                id: interaction.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
            }
        ]
    });

    activeTrialTickets.set(ticketChannel.id, { userId: interaction.user.id, gameKey });

    const embed = new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle(`🎁 Prueba 1 Día Gratis — ${game.name} (${game.type})`)
        .setDescription(
            `Hola ${interaction.user}, sigue estos 2 pasos para recibir tu key de 24 horas por privado:\n\n` +
            `1. Sígueme en mis redes y dale **like** a mis videos.\n` +
            `2. **Sube aquí mismo la captura de pantalla**.\n\n` +
            `En cuanto sea aprobada, el bot te enviará tu key automáticamente por DM.`
        );

    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Secondary)
    );

    await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeRow] });
    return interaction.editReply(`Canal creado: ${ticketChannel}. Sube ahí tu captura.`);
}

async function createGeneralTicket(interaction, tipo, gameKey = null) {
    const guild = interaction.guild;
    const category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.includes('COMUNIDAD')
    );

    const prefix = tipo === 'compra' ? 'compra' : 'soporte';
    const ticketChannel = await guild.channels.create({
        name: `${prefix}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`,
        type: ChannelType.GuildText,
        parent: category?.id,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
                id: interaction.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
            }
        ]
    });

    const gameLine = gameKey && GAMES[gameKey]
        ? `• **Juego seleccionado:** ${GAMES[gameKey].name} (${GAMES[gameKey].type})\n`
        : `• **Juego:** Free Fire / CS2 / Roblox / ROB RUN / Minecraft\n`;

    const embed = new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle(tipo === 'compra' ? '🛒 Ticket de Compra — DrakoStore' : '🛠️ Ticket de Soporte — DrakoStore')
        .setDescription(
            tipo === 'compra'
                ? `Hola ${interaction.user}, indícanos los datos de tu pedido:\n\n` +
                  gameLine +
                  `• **Plan:** 1 Día ($1.50) · 7 Días ($6) · 30 Días ($12) · 90 Días ($25)\n` +
                  `• **Método de pago:** Yape / Plin / Binance Pay / PayPal\n\n` +
                  `Un administrador te atenderá en breve.`
                : `Hola ${interaction.user}, cuéntanos en qué podemos ayudarte (instalación, licencia, dudas o soporte técnico) y adjunta capturas si es necesario.`
        );

    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Secondary)
    );

    await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeRow] });
    return interaction.editReply(`Ticket creado: ${ticketChannel}`);
}

// ==================== 8. INTERACCIONES ====================
client.on('interactionCreate', async (interaction) => {
    try {
        // --- SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setup' || interaction.commandName === 'update') {
                await interaction.deferReply({ ephemeral: true });
                const summary = await syncServer(interaction.guild);
                connectToSupportVoice(interaction.guild);
                return interaction.editReply(
                    `✅ **Sincronización completada (${interaction.commandName === 'setup' ? 'Setup' : 'Update'})**\n` +
                    `• Roles creados: **${summary.rolesCreated}** | verificados/actualizados: **${summary.rolesUpdated}**\n` +
                    `• Canales creados: **${summary.created}** | verificados/actualizados: **${summary.updated}**\n` +
                    `• Jerarquía de roles: **👑 Owner → 🤝 Partner → 🤖 Bots → 💎 Clientes → En línea (no clientes)**\n` +
                    `• Paneles e imágenes actualizados sin duplicados.\n` +
                    `• Bot conectado a **${VOICE_CHANNEL_NAME}**.`
                );
            }

            if (interaction.commandName === 'addkeys') {
                const gameKey = interaction.options.getString('juego');
                const rawKeys = interaction.options.getString('keys')
                    .split(',')
                    .map(k => k.trim())
                    .filter(Boolean);

                keyStock[gameKey].push(...rawKeys);
                return interaction.reply({
                    content: `Se agregaron **${rawKeys.length}** keys a **${GAMES[gameKey].name}**. Stock total: **${keyStock[gameKey].length}**.`,
                    ephemeral: true
                });
            }

            if (interaction.commandName === 'stock') {
                const lines = Object.entries(GAMES)
                    .map(([k, g]) => `• **${g.name} (${g.type}):** ${keyStock[k].length} keys`)
                    .join('\n');
                return interaction.reply({ content: `**Stock de keys de prueba (1 día):**\n${lines}`, ephemeral: true });
            }
        }

        // --- BOTONES DE INFORMACION EN CANALES DE TIENDA ---
        if (interaction.isButton() && interaction.customId.startsWith('info_features_')) {
            const gameKey = interaction.customId.replace('info_features_', '');
            const g = GAMES[gameKey];
            if (!g) return;

            const embed = new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle(`✨ Funciones completas — ${g.name} (${g.type})`)
                .setDescription(g.fullFeatures.join('\n'))
                .setFooter({ text: `Más info y video demo en ${WEB_URL}/juego?id=${g.slug}` });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (interaction.isButton() && interaction.customId === 'info_payments') {
            const embed = new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('💳 Métodos de Pago y Precios')
                .setDescription(
                    `**Precios unificados (todos los juegos):**\n` +
                    `\`1 día  · day  \` **$1.50 USD**\n` +
                    `\`7 días · days \` **$6 USD** ⭐\n` +
                    `\`30 días · days\` **$12 USD**\n` +
                    `\`90 días · days\` **$25 USD**\n\n` +
                    `**Métodos aceptados en ticket:**\n` +
                    `• **Yape / Plin** (Perú - al instante)\n` +
                    `• **Binance Pay** (USDT sin comisión)\n` +
                    `• **PayPal** (Internacional)\n` +
                    `• **Cripto / Transferencia**`
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- BOTON: PRUEBA DIRECTA DESDE CANAL DE JUEGO ---
        if (interaction.isButton() && interaction.customId.startsWith('trial_direct_')) {
            await interaction.deferReply({ ephemeral: true });
            const gameKey = interaction.customId.replace('trial_direct_', '');
            return createTrialTicket(interaction, gameKey);
        }

        // --- BOTON: COMPRA DIRECTA DESDE CANAL DE JUEGO ---
        if (interaction.isButton() && interaction.customId.startsWith('buy_direct_')) {
            await interaction.deferReply({ ephemeral: true });
            const gameKey = interaction.customId.replace('buy_direct_', '');
            return createGeneralTicket(interaction, 'compra', gameKey);
        }

        // --- BOTON: MENU GENERAL DE PRUEBA GRATIS ---
        if (interaction.isButton() && interaction.customId === 'open_trial_menu') {
            if (claimedUsers.has(interaction.user.id)) {
                return interaction.reply({ content: 'Ya reclamaste tu prueba gratuita de 1 día anteriormente.', ephemeral: true });
            }

            const select = new StringSelectMenuBuilder()
                .setCustomId('select_trial_game')
                .setPlaceholder('Elige el juego para tu prueba de 24h')
                .addOptions(
                    Object.entries(GAMES).map(([value, g]) => ({
                        label: `${g.name} (${g.type})`,
                        value
                    }))
                );

            return interaction.reply({
                content: 'Selecciona el juego que deseas probar gratis por 1 día:',
                components: [new ActionRowBuilder().addComponents(select)],
                ephemeral: true
            });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'select_trial_game') {
            await interaction.deferReply({ ephemeral: true });
            return createTrialTicket(interaction, interaction.values[0]);
        }

        // --- BOTON: TICKET COMPRA O SOPORTE GENERAL ---
        if (interaction.isButton() && interaction.customId === 'open_buy_ticket') {
            await interaction.deferReply({ ephemeral: true });
            return createGeneralTicket(interaction, 'compra');
        }

        if (interaction.isButton() && interaction.customId === 'open_support_ticket') {
            await interaction.deferReply({ ephemeral: true });
            return createGeneralTicket(interaction, 'soporte');
        }

        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            await interaction.reply('Cerrando ticket en 5 segundos...');
            activeTrialTickets.delete(interaction.channel.id);
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            return;
        }

        // --- STAFF: APROBAR Y ENVIAR KEY POR PRIVADO ---
        if (interaction.isButton() && interaction.customId.startsWith('approve_')) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Solo administradores pueden aprobar pruebas.', ephemeral: true });
            }

            const [, userId, gameKey, ticketChannelId] = interaction.customId.split('_');

            if (keyStock[gameKey].length === 0) {
                return interaction.reply({
                    content: `No quedan keys en stock para **${GAMES[gameKey].name}**. Usa \`/addkeys\` primero.`,
                    ephemeral: true
                });
            }

            const key = keyStock[gameKey].shift();
            claimedUsers.add(userId);

            const user = await client.users.fetch(userId);
            const dmEmbed = new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('🎁 Tu prueba de 1 Día Gratis fue aprobada')
                .setDescription(
                    `Gracias por apoyar a **DrakoStore**.\n\n` +
                    `**Juego:** ${GAMES[gameKey].name} (${GAMES[gameKey].type})\n` +
                    `**Tu Key (24 horas):**\n\`\`\`${key}\`\`\`\n` +
                    `Renueva desde **$1.50 USD** en ${WEB_URL}/juego?id=${gameKey}`
                )
                .setTimestamp();

            try {
                await user.send({ embeds: [dmEmbed] });
            } catch {
                keyStock[gameKey].unshift(key);
                claimedUsers.delete(userId);
                return interaction.reply({
                    content: `No pude enviar DM a <@${userId}> (tiene los mensajes privados desactivados).`,
                    ephemeral: true
                });
            }

            await interaction.update({
                content: `✅ Aprobado por ${interaction.user}. Key enviada al privado de <@${userId}>.`,
                components: []
            });

            const tCh = interaction.guild.channels.cache.get(ticketChannelId);
            if (tCh) {
                await tCh.send(`¡Aprobado <@${userId}>! Ya envié tu key por mensaje privado (DM). Este canal se cerrará en 10 segundos.`);
                activeTrialTickets.delete(ticketChannelId);
                setTimeout(() => tCh.delete().catch(() => {}), 10000);
            }
        }

        // --- STAFF: RECHAZAR ---
        if (interaction.isButton() && interaction.customId.startsWith('reject_')) {
            const [, userId, ticketChannelId] = interaction.customId.split('_');
            await interaction.update({ content: `❌ Rechazado por ${interaction.user}.`, components: [] });

            const tCh = interaction.guild.channels.cache.get(ticketChannelId);
            if (tCh) {
                await tCh.send(`<@${userId}>, tu captura no se pudo verificar. Asegúrate de mostrar que sigues la cuenta y diste like, y vuelve a subirla.`);
            }
        }
    } catch (err) {
        console.error('[ERROR INTERACCION]', err);
    }
});

// ==================== 9. SINCRONIZACION INTELIGENTE (SETUP / UPDATE SIN DUPLICAR) ====================
async function ensureRole(guild, cfg, stats) {
    let role = guild.roles.cache.find(r => !r.managed && r.name === cfg.name);
    if (!role && cfg.legacyNames?.length) {
        const lowerLegacy = cfg.legacyNames.map(n => n.toLowerCase());
        role = guild.roles.cache.find(r => !r.managed && lowerLegacy.includes(r.name.toLowerCase()));
    }

    if (!role) {
        const createOpts = {
            name: cfg.name,
            color: cfg.color,
            hoist: cfg.hoist,
            mentionable: cfg.mentionable
        };
        if (cfg.permissions) createOpts.permissions = cfg.permissions;
        role = await guild.roles.create(createOpts).catch(() => null);
        if (role) stats.rolesCreated++;
    } else {
        if (role.editable) {
            const needsEdit =
                role.name !== cfg.name ||
                role.color !== cfg.color ||
                role.hoist !== cfg.hoist ||
                role.mentionable !== cfg.mentionable;

            if (needsEdit) {
                const editOpts = {
                    name: cfg.name,
                    color: cfg.color,
                    hoist: cfg.hoist,
                    mentionable: cfg.mentionable
                };
                if (cfg.permissions) editOpts.permissions = cfg.permissions;
                await role.edit(editOpts).catch(() => {});
            }
        }
        stats.rolesUpdated++;
    }
    return role;
}

async function syncRoles(guild, stats) {
    await guild.roles.fetch();
    const roles = {};

    for (const cfg of ROLE_CONFIGS) {
        roles[cfg.key] = await ensureRole(guild, cfg, stats);
    }

    // Reordenar jerarquia de arriba hacia abajo: Owner > Partner > Bots > Clientes > Miembro
    await guild.roles.fetch();
    const botMaxPos = guild.members.me?.roles.highest?.position ?? 1;
    const orderedEditable = ROLE_CONFIGS
        .map(cfg => roles[cfg.key])
        .filter(r => r && r.editable && r.position < botMaxPos);

    if (orderedEditable.length > 0 && botMaxPos > 1) {
        const positionUpdates = orderedEditable.map((role, idx) => ({
            role: role.id,
            position: Math.max(1, botMaxPos - 1 - idx)
        }));
        await guild.roles.setPositions(positionUpdates).catch(() => {});
    }

    // Auto-asignar roles: Owner al dueno, Bots a bots, Miembro (hoist: false) a humanos
    await guild.members.fetch().catch(() => {});

    if (roles.owner && roles.owner.editable) {
        const ownerMember = guild.members.cache.get(guild.ownerId);
        if (ownerMember && !ownerMember.roles.cache.has(roles.owner.id)) {
            await ownerMember.roles.add(roles.owner).catch(() => {});
        }
    }

    for (const member of guild.members.cache.values()) {
        if (member.user.bot) {
            if (roles.bots && roles.bots.editable && !member.roles.cache.has(roles.bots.id)) {
                await member.roles.add(roles.bots).catch(() => {});
            }
        } else {
            if (roles.miembro && roles.miembro.editable && !member.roles.cache.has(roles.miembro.id)) {
                await member.roles.add(roles.miembro).catch(() => {});
            }
        }
    }

    return roles;
}

async function ensureCategory(guild, name, overwrites = null, stats) {
    let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
    if (!cat) {
        const opts = { name, type: ChannelType.GuildCategory };
        if (overwrites) opts.permissionOverwrites = overwrites;
        cat = await guild.channels.create(opts);
        stats.created++;
    } else {
        if (overwrites) await cat.permissionOverwrites.set(overwrites).catch(() => {});
        stats.updated++;
    }
    return cat;
}

async function ensureChannel(guild, name, type, parentId, { readOnly = false, topic = null, overwrites = null } = {}, stats) {
    let ch = guild.channels.cache.find(c => c.type === type && c.name === name);

    if (!ch) {
        const opts = { name, type };
        if (parentId) opts.parent = parentId;
        if (topic && type === ChannelType.GuildText) opts.topic = topic;
        if (overwrites) opts.permissionOverwrites = overwrites;
        ch = await guild.channels.create(opts);
        stats.created++;
    } else {
        if (parentId && ch.parentId !== parentId) {
            await ch.setParent(parentId, { lockPermissions: false }).catch(() => {});
        }
        if (topic && type === ChannelType.GuildText && ch.topic !== topic) {
            await ch.setTopic(topic).catch(() => {});
        }
        if (overwrites) {
            await ch.permissionOverwrites.set(overwrites).catch(() => {});
        }
        stats.updated++;
    }

    if (readOnly && type === ChannelType.GuildText && !overwrites) {
        await ch.permissionOverwrites.edit(guild.id, { SendMessages: false }).catch(() => {});
    }

    return ch;
}

// Edita el mensaje existente del bot en el canal o envia uno nuevo si no existe
async function upsertBotMessage(channel, payload) {
    try {
        const messages = await channel.messages.fetch({ limit: 15 });
        const existing = messages.find(m => m.author.id === client.user.id);
        if (existing) {
            await existing.edit(payload);
            return existing;
        }
    } catch {}
    return channel.send(payload);
}

function buildGamePayload(key, g) {
    const unixNow = Math.floor(Date.now() / 1000);
    const topBanner = process.env[g.bannerEnv] || '';
    const menuImg = process.env[g.menuEnv] || '';
    const embeds = [];

    // Embed superior dedicado al GIF/Banner (si esta configurado en Render)
    if (topBanner) {
        embeds.push(new EmbedBuilder().setColor(COLOR_GREEN).setImage(topBanner));
    }

    const mainEmbed = new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle(`🟢 DrakoStore · ${g.name}`)
        .setDescription(
            `🛡️ **${g.tagline}**\n` +
            `${g.desc}\n\n` +
            `✅ **Funcionando · Working** · \`Windows · ${g.type}\` · 🔄 <t:${unixNow}:R>\n\n` +
            `✨ **Funciones · Features**\n` +
            `${g.shortFeatures.join('\n')}\n\n` +
            `💰 **Planes · Plans**\n` +
            `\`1 día  · day  \` **$1.50 USD**\n` +
            `\`7 días · days \` **$6 USD** ⭐\n` +
            `\`30 días · days\` **$12 USD**\n` +
            `\`90 días · days\` **$25 USD**\n` +
            `🎁 **Prueba gratis 1 día · 1-day free trial**\n\n` +
            `🌐 **Ver demo en vivo:** ${WEB_URL}/juego?id=${g.slug}`
        )
        .setFooter({ text: `⚡ ${g.type} (Windows) · 1 key = 1 PC · auto-updates` });

    if (menuImg) {
        mainEmbed.setImage(menuImg);
    }

    embeds.push(mainEmbed);

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`buy_direct_${key}`)
            .setLabel('Comprar · Buy')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`trial_direct_${key}`)
            .setLabel('Prueba gratis · Free trial')
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`info_features_${key}`)
            .setLabel('Funciones · Features')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('info_payments')
            .setLabel('Pagos · Payment')
            .setEmoji('💳')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds, components: [row1, row2] };
}

async function syncServer(guild) {
    await guild.channels.fetch();
    const stats = { created: 0, updated: 0, rolesCreated: 0, rolesUpdated: 0 };

    await syncRoles(guild, stats);

    // 1) CANAL DE VOZ 24/7 BLOQUEADO
    await ensureChannel(
        guild,
        VOICE_CHANNEL_NAME,
        ChannelType.GuildVoice,
        null,
        {
            overwrites: [
                {
                    id: guild.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                    deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                }
            ]
        },
        stats
    );

    // 2) INICIO · START
    const catStart = await ensureCategory(guild, '📌 INICIO · START', null, stats);
    await ensureChannel(guild, '👋｜welcome', ChannelType.GuildText, catStart.id, { readOnly: true, topic: 'Bienvenidas automáticas de DrakoStore' }, stats);
    const chStatus = await ensureChannel(guild, '📊｜status', ChannelType.GuildText, catStart.id, { readOnly: true, topic: 'Estado en vivo de todos los servicios' }, stats);
    const chBuy = await ensureChannel(guild, '💳｜how-to-buy', ChannelType.GuildText, catStart.id, { readOnly: true, topic: 'Precios unificados y métodos de pago' }, stats);
    const chVouches = await ensureChannel(guild, '⭐｜vouches', ChannelType.GuildText, catStart.id, { topic: 'Reseñas reales de clientes de DrakoStore' }, stats);
    const chGuide = await ensureChannel(guild, '📖｜guide', ChannelType.GuildText, catStart.id, { readOnly: true, topic: 'Instalación, problemas comunes y cómo pedir ayuda' }, stats);
    const chRules = await ensureChannel(guild, '📜｜rules', ChannelType.GuildText, catStart.id, { readOnly: true, topic: 'Reglas del servidor DrakoStore' }, stats);

    // 3) TIENDA · SHOP
    const catShop = await ensureCategory(guild, '🛒 TIENDA · SHOP', null, stats);
    const gameChannels = {};
    for (const [key, g] of Object.entries(GAMES)) {
        const ch = await ensureChannel(guild, g.channelName, ChannelType.GuildText, catShop.id, { readOnly: true, topic: g.topic }, stats);
        gameChannels[key] = ch;
        await upsertBotMessage(ch, buildGamePayload(key, g));
    }

    // 4) NOVEDADES · NEWS
    const catNews = await ensureCategory(guild, '📢 NOVEDADES · NEWS', null, stats);
    await ensureChannel(guild, '📢｜announcements', ChannelType.GuildText, catNews.id, { readOnly: true, topic: 'Anuncios oficiales de DrakoStore' }, stats);
    const chUpdates = await ensureChannel(guild, '🚀｜updates', ChannelType.GuildText, catNews.id, { readOnly: true, topic: 'Registro de actualizaciones y parches' }, stats);

    // 5) COMUNIDAD · COMMUNITY
    const catComm = await ensureCategory(guild, '💬 COMUNIDAD · COMMUNITY', null, stats);
    const chSupport = await ensureChannel(guild, '🎫｜support', ChannelType.GuildText, catComm.id, { readOnly: true, topic: 'Abre ticket de compra, soporte o reclama 1 día gratis' }, stats);
    await ensureChannel(guild, '💬｜general', ChannelType.GuildText, catComm.id, { topic: 'Chat general de la comunidad DrakoStore' }, stats);

    // 6) STAFF PRIVADO
    const catStaff = await ensureCategory(
        guild,
        '🔒 STAFF',
        [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }],
        stats
    );
    await ensureChannel(guild, 'staff-aprobaciones', ChannelType.GuildText, catStaff.id, { topic: 'Panel privado para aprobar capturas de 1 día gratis' }, stats);

    // ==================== ACTUALIZAR PANELES PRINCIPALES ====================

    // A) STATUS EN VIVO
    const unixNow = Math.floor(Date.now() / 1000);
    const statusEmbeds = [];
    if (STATUS_BANNER_URL) {
        statusEmbeds.push(new EmbedBuilder().setColor(COLOR_GREEN).setImage(STATUS_BANNER_URL));
    }
    statusEmbeds.push(
        new EmbedBuilder()
            .setColor(COLOR_GREEN)
            .setTitle('✅ Todo funcionando · All working')
            .setDescription(
                `🔄 <t:${unixNow}:R>\n` +
                `──────────────────────────\n\n` +
                `**💉 PC · Internals (Windows)**\n` +
                `✅ **Free Fire** — ${gameChannels['free-fire']}\n` +
                `✅ **Counter-Strike 2** — ${gameChannels['cs2']}\n` +
                `✅ **Roblox** — ${gameChannels['roblox']}\n\n` +
                `──────────────────────────\n\n` +
                `**⚡ PC · Kernel (Windows)**\n` +
                `✅ **ROB RUN** — ${gameChannels['robrun']}\n` +
                `✅ **Minecraft Java** — ${gameChannels['minecraft']}\n\n` +
                `──────────────────────────\n` +
                `🌐 Catálogo oficial: ${WEB_URL}`
            )
            .setFooter({ text: 'DrakoStore • Live Status' })
    );
    await upsertBotMessage(chStatus, { embeds: statusEmbeds });

    // B) HOW TO BUY
    await upsertBotMessage(chBuy, {
        embeds: [
            new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('💳 Cómo comprar · How to buy')
                .setDescription(
                    `**Precios unificados para todos los juegos (Windows):**\n` +
                    `\`1 día  · day  \` **$1.50 USD**\n` +
                    `\`7 días · days \` **$6 USD** ⭐\n` +
                    `\`30 días · days\` **$12 USD**\n` +
                    `\`90 días · days\` **$25 USD**\n\n` +
                    `**Métodos aceptados:** Yape · Plin · Binance Pay (USDT) · PayPal\n` +
                    `**Paso a paso:** Entra al canal del juego o a ${chSupport}, abre tu ticket, envía el comprobante y recibe tu key al instante.`
                )
        ]
    });

    // C) GUIDE (ESTILO ZONA CLIENTES VIP)
    const guideEmbeds = [];
    if (GUIDE_BANNER_URL) {
        guideEmbeds.push(new EmbedBuilder().setColor(COLOR_GREEN).setImage(GUIDE_BANNER_URL));
    }
    guideEmbeds.push(
        new EmbedBuilder()
            .setColor(COLOR_GREEN)
            .setTitle('📖 Zona Clientes — Guía de Inicio')
            .setDescription(
                `Gracias por confiar en **DrakoStore**. Aquí tienes todo para empezar en Windows, sea cual sea tu producto.\n\n` +
                `🔑 **1 · Recibe tu key y el programa**\n` +
                `Cuando confirmamos tu pago (o aprobamos tu prueba de 1 día gratis), el bot te envía tu **key por mensaje privado (DM)**.\n` +
                `• Mantén abiertos los mensajes directos del servidor.\n` +
                `• Los días cuentan desde que activas la key por primera vez.\n\n` +
                `💻 **2 · Instalación en Windows (Internal y Kernel)**\n` +
                `1. Descarga el loader oficial desde el enlace de tu ticket.\n` +
                `2. Clic derecho → **Ejecutar como administrador**.\n` +
                `3. Pega tu key. El loader valida la licencia, se actualiza solo y en los **Kernel** carga el driver automáticamente.\n` +
                `4. Pon el juego en **Ventana sin bordes** y presiona **INSERT** para abrir o cerrar el menú.\n\n` +
                `🔄 **Actualizaciones**\n` +
                `Los programas se actualizan solos al abrirlos. Revisa siempre ${chStatus} y las novedades en ${chUpdates}.\n\n` +
                `🛠️ **Si algo no anda**\n` +
                `• Abre siempre el loader como **Administrador**.\n` +
                `• Agrega la carpeta del programa como exclusión en Windows Defender.\n` +
                `• Usa el juego en Ventana o Ventana sin bordes para ver el menú.\n` +
                `• **Kernel:** si el driver no carga, reinicia tu PC e inténtalo de nuevo.\n\n` +
                `🔒 **Tu key es personal**\n` +
                `\`1 key = 1 PC\`. No la compartas. Si cambias de equipo, abre un ticket de soporte abajo.\n` +
                `⭐ Cuéntanos tu experiencia en ${chVouches}.`
            )
            .setFooter({ text: 'DrakoStore • Customer Guide (Windows)' })
    );

    const guideRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_support_ticket')
            .setLabel('Ticket de Soporte')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Secondary)
    );
    await upsertBotMessage(chGuide, { embeds: guideEmbeds, components: [guideRow] });

    // D) RULES
    await upsertBotMessage(chRules, {
        embeds: [
            new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('📜 Reglas de DrakoStore')
                .setDescription(
                    `1. Respeto total hacia miembros y staff.\n` +
                    `2. Prohibido enviar enlaces, spam o publicidad externa.\n` +
                    `3. La prueba de 1 día gratis es única por persona.\n` +
                    `4. Todas las compras y soporte se atienden únicamente mediante ticket.`
                )
        ]
    });

    // E) PANEL DE SOPORTE Y PRUEBA GRATIS
    const supportEmbeds = [];
    if (BANNER_URL) {
        supportEmbeds.push(new EmbedBuilder().setColor(COLOR_GREEN).setImage(BANNER_URL));
    }
    supportEmbeds.push(
        new EmbedBuilder()
            .setColor(COLOR_GREEN)
            .setTitle('🎫 Centro de Soporte, Compras y 1 Día Gratis')
            .setDescription(
                `🎁 **¿Quieres 1 Día Gratis?**\n` +
                `Presiona **Pedir 1 Día Gratis**, elige tu juego y sube tu captura siguiendo nuestras redes y dando like. Al aprobarse, **el bot te enviará la key por privado**.\n\n` +
                `🛒 **¿Listo para comprar?**\n` +
                `Presiona **Ticket de Compra** para pagar con Yape, Plin, Binance o PayPal.\n\n` +
                `🛠️ **¿Necesitas ayuda técnica?**\n` +
                `Presiona **Soporte Técnico** y un administrador te asistirá.`
            )
    );

    const supportRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_trial_menu')
            .setLabel('Pedir 1 Día Gratis')
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('open_buy_ticket')
            .setLabel('Ticket de Compra')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('open_support_ticket')
            .setLabel('Soporte Técnico')
            .setEmoji('🛠️')
            .setStyle(ButtonStyle.Secondary)
    );
    await upsertBotMessage(chSupport, { embeds: supportEmbeds, components: [supportRow] });

    return stats;
}

client.login(process.env.DISCORD_TOKEN);
