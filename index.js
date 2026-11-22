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
    res.status(200).send('DrakoStore Bot v2 Online 24/7');
});

app.listen(PORT, () => console.log(`[HTTP] Keep-alive activo en puerto ${PORT}`));

// ==================== 2. CONFIGURACION (TODO VIA ENV) ====================
const COLOR_GREEN = 0x00E87B;
const WEB_URL = (process.env.WEB_URL || 'https://drakostore.xyz').replace(/\/$/, '');
const BANNER_URL = process.env.BANNER_URL || '';
const STATUS_BANNER_URL = process.env.STATUS_BANNER_URL || BANNER_URL;
const VOICE_CHANNEL_NAME = '🟢 Soporte en línea';

const GAMES = {
    'free-fire': {
        name: 'Free Fire',
        slug: 'free-fire',
        type: 'Internal',
        channelName: '🟢｜free-fire',
        desc: 'Optimizado para MSI App Player y BlueStacks 5 en Windows. Aimbot suave, ESP limpio y modo StreamProof.'
    },
    'cs2': {
        name: 'Counter-Strike 2',
        slug: 'cs2',
        type: 'Internal',
        channelName: '🟢｜cs2',
        desc: 'Internal para Windows enfocado en Premier y Matchmaking. Aimbot Legit, RCS y visuales sin pérdida de FPS.'
    },
    'roblox': {
        name: 'Roblox',
        slug: 'roblox',
        type: 'Internal',
        channelName: '🟢｜roblox',
        desc: 'Ejecutor Internal Luau estable para Windows, sin key systems molestos y con Script Hub integrado.'
    },
    'robrun': {
        name: 'ROB RUN',
        slug: 'robrun',
        type: 'Kernel',
        channelName: '🟢｜robrun',
        desc: 'Arquitectura Kernel para Windows con Aimbot silencioso, ESP total de jugadores y botín.'
    },
    'minecraft': {
        name: 'Minecraft Java',
        slug: 'minecraft',
        type: 'Kernel',
        channelName: '🟢｜minecraft',
        desc: 'Ghost Client Kernel competitivo para Windows. AutoClicker, AimAssist, visuales y Self-Destruct limpio.'
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
const activeTrialTickets = new Map(); // channelId -> { userId, gameKey }
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

// ==================== 3. CONEXION 24/7 AL CANAL DE VOZ "🟢 Soporte en línea" ====================
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
        .setDescription('Construye todo el servidor DrakoStore (canales, tienda, status y voz 24/7)')
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

client.once('ready', async () => {
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
            console.log('[BOT] Slash commands registrados.');
        } catch (err) {
            console.error('[ERROR] Registrando comandos:', err);
        }

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
            connectToSupportVoice(guild);
            // Verificacion periodica cada 2 minutos para asegurar presencia 24/7 en voz
            setInterval(() => connectToSupportVoice(guild), 120000);
        }
    }
});

// ==================== 5. BIENVENIDA AUTOMATICA ====================
client.on('guildMemberAdd', async (member) => {
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

// ==================== 7. INTERACCIONES (SLASH, TICKETS Y APROBACION) ====================
client.on('interactionCreate', async (interaction) => {
    try {
        // --- SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setup') {
                await interaction.deferReply({ ephemeral: true });
                await buildServer(interaction.guild);
                connectToSupportVoice(interaction.guild);
                return interaction.editReply('Servidor **DrakoStore** construido completo y bot conectado a **🟢 Soporte en línea**. Usa `/addkeys` para cargar stock.');
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

        // --- BOTON: PEDIR 1 DIA GRATIS (DESDE SUPPORT O DESDE CANAL DE JUEGO) ---
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

        // --- BOTON: TICKET DE COMPRA ---
        if (interaction.isButton() && interaction.customId === 'open_buy_ticket') {
            await interaction.deferReply({ ephemeral: true });
            const guild = interaction.guild;
            const category = guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && c.name.includes('COMUNIDAD')
            );

            const ticketChannel = await guild.channels.create({
                name: `compra-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`,
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

            const embed = new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('Ticket de Compra — DrakoStore')
                .setDescription(
                    `Hola ${interaction.user}, indícanos:\n\n` +
                    `• **Juego:** Free Fire / CS2 / Roblox / ROB RUN / Minecraft\n` +
                    `• **Plan:** 1 Día ($1.50) · 7 Días ($6) · 30 Días ($12) · 90 Días ($25)\n` +
                    `• **Método de pago:** Yape / Plin / Binance Pay / PayPal\n\n` +
                    `Un administrador te atenderá en breve.`
                );

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Cerrar Ticket')
                    .setStyle(ButtonStyle.Secondary)
            );

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeRow] });
            return interaction.editReply(`Ticket de compra creado: ${ticketChannel}`);
        }

        // --- BOTON: CERRAR TICKET ---
        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            await interaction.reply('Cerrando ticket en 5 segundos...');
            activeTrialTickets.delete(interaction.channel.id);
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            return;
        }

        // --- MENU: CREAR TICKET DE 1 DIA GRATIS ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_trial_game') {
            await interaction.deferReply({ ephemeral: true });
            const gameKey = interaction.values[0];
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
                .setTitle(`Prueba 1 Día Gratis — ${game.name} (${game.type})`)
                .setDescription(
                    `Hola ${interaction.user}, sigue estos 2 pasos para recibir tu key de 24 horas por privado:\n\n` +
                    `1. Sígueme en mis redes y dale **like** a mis videos.\n` +
                    `2. **Sube aquí mismo la captura de pantalla**.\n\n` +
                    `En cuanto sea aprobada, el bot te enviará tu key automáticamente por DM.`
                );

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed] });
            return interaction.editReply(`Canal creado: ${ticketChannel}. Sube ahí tu captura.`);
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
                .setTitle('Tu prueba de 1 Día Gratis fue aprobada')
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
                content: `Aprobado por ${interaction.user}. Key enviada al privado de <@${userId}>.`,
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
            await interaction.update({ content: `Rechazado por ${interaction.user}.`, components: [] });

            const tCh = interaction.guild.channels.cache.get(ticketChannelId);
            if (tCh) {
                await tCh.send(`<@${userId}>, tu captura no se pudo verificar. Asegúrate de mostrar que sigues la cuenta y diste like, y vuelve a subirla.`);
            }
        }
    } catch (err) {
        console.error('[ERROR INTERACCION]', err);
    }
});

// ==================== 8. CONSTRUCTOR COMPLETO DEL SERVIDOR ====================
async function buildServer(guild) {
    await guild.roles.create({ name: 'Cliente VIP', color: COLOR_GREEN }).catch(() => {});
    await guild.roles.create({ name: 'Miembro', color: 0x8EA398 }).catch(() => {});

    // 1) CANAL DE VOZ 24/7 ARRIBA/VISIBLE: "🟢 Soporte en línea" (bloqueado para usuarios)
    await guild.channels.create({
        name: VOICE_CHANNEL_NAME,
        type: ChannelType.GuildVoice,
        permissionOverwrites: [
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
    });

    // 2) CATEGORIA: INICIO · START
    const catStart = await guild.channels.create({ name: '📌 INICIO · START', type: ChannelType.GuildCategory });
    const chWelcome = await guild.channels.create({ name: '👋｜welcome', type: ChannelType.GuildText, parent: catStart.id });
    const chStatus = await guild.channels.create({ name: '📊｜status', type: ChannelType.GuildText, parent: catStart.id });
    const chBuy = await guild.channels.create({ name: '💳｜how-to-buy', type: ChannelType.GuildText, parent: catStart.id });
    await guild.channels.create({ name: '⭐｜vouches', type: ChannelType.GuildText, parent: catStart.id });
    const chGuide = await guild.channels.create({ name: '📖｜guide', type: ChannelType.GuildText, parent: catStart.id });
    const chRules = await guild.channels.create({ name: '📜｜rules', type: ChannelType.GuildText, parent: catStart.id });

    // 3) CATEGORIA: TIENDA · SHOP (1 canal por cada juego)
    const catShop = await guild.channels.create({ name: '🛒 TIENDA · SHOP', type: ChannelType.GuildCategory });
    const gameChannels = {};
    for (const [key, g] of Object.entries(GAMES)) {
        const ch = await guild.channels.create({
            name: g.channelName,
            type: ChannelType.GuildText,
            parent: catShop.id
        });
        await ch.permissionOverwrites.edit(guild.id, { SendMessages: false });
        gameChannels[key] = ch;

        const gameEmbed = new EmbedBuilder()
            .setColor(COLOR_GREEN)
            .setTitle(`${g.name} — Windows (${g.type})`)
            .setDescription(
                `${g.desc}\n\n` +
                `**Estado:** 🟢 Indetectable\n` +
                `**Arquitectura:** \`${g.type}\`\n\n` +
                `**Precios Oficiales:**\n` +
                `• 1 Día: \`$1.50 USD\`\n` +
                `• 7 Días: \`$6 USD\`\n` +
                `• 30 Días: \`$12 USD\`\n` +
                `• 90 Días: \`$25 USD\`\n\n` +
                `🔗 **Ver gameplay y funciones:** ${WEB_URL}/juego?id=${g.slug}`
            )
            .setFooter({ text: 'DrakoStore • Prueba 1 día gratis disponible' });

        const gameButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_trial_menu')
                .setLabel('Probar 1 Día Gratis')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('open_buy_ticket')
                .setLabel('Comprar Acceso')
                .setStyle(ButtonStyle.Secondary)
        );

        await ch.send({ embeds: [gameEmbed], components: [gameButtons] });
    }

    // 4) CATEGORIA: NOVEDADES · NEWS
    const catNews = await guild.channels.create({ name: '📢 NOVEDADES · NEWS', type: ChannelType.GuildCategory });
    const chAnnouncements = await guild.channels.create({ name: '📢｜announcements', type: ChannelType.GuildText, parent: catNews.id });
    const chUpdates = await guild.channels.create({ name: '🚀｜updates', type: ChannelType.GuildText, parent: catNews.id });

    // 5) CATEGORIA: COMUNIDAD · COMMUNITY
    const catComm = await guild.channels.create({ name: '💬 COMUNIDAD · COMMUNITY', type: ChannelType.GuildCategory });
    const chSupport = await guild.channels.create({ name: '🎫｜support', type: ChannelType.GuildText, parent: catComm.id });
    await guild.channels.create({ name: '💬｜general', type: ChannelType.GuildText, parent: catComm.id });

    // 6) CATEGORIA PRIVADA: STAFF
    const catStaff = await guild.channels.create({
        name: '🔒 STAFF',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }]
    });
    await guild.channels.create({ name: 'staff-aprobaciones', type: ChannelType.GuildText, parent: catStaff.id });

    // Solo lectura para canales informativos
    for (const ch of [chWelcome, chStatus, chBuy, chGuide, chRules, chAnnouncements, chUpdates, chSupport]) {
        await ch.permissionOverwrites.edit(guild.id, { SendMessages: false });
    }

    // --- EMBED: STATUS EN VIVO (ESTILO LIMPIO POR ARQUITECTURA) ---
    const unixNow = Math.floor(Date.now() / 1000);
    const statusEmbed = new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle('✅ Todo funcionando · All working')
        .setDescription(
            `🔄 Actualizado <t:${unixNow}:R>\n` +
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
        .setFooter({ text: 'DrakoStore • Live Status' });

    if (STATUS_BANNER_URL) statusEmbed.setImage(STATUS_BANNER_URL);
    await chStatus.send({ embeds: [statusEmbed] });

    // --- EMBED: HOW TO BUY ---
    await chBuy.send({
        embeds: [
            new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('💳 Cómo comprar · How to buy')
                .setDescription(
                    `**Precios unificados para todos los juegos (Windows):**\n` +
                    `• **1 Día:** \`$1.50 USD\`\n` +
                    `• **7 Días:** \`$6 USD\`\n` +
                    `• **30 Días:** \`$12 USD\`\n` +
                    `• **90 Días:** \`$25 USD\`\n\n` +
                    `**Métodos aceptados:** Yape · Plin · Binance Pay (USDT) · PayPal\n` +
                    `**Paso a paso:** Ve a ${chSupport}, abre un ticket de compra, envía tu comprobante y recibe tu key al instante.`
                )
        ]
    });

    // --- EMBED: GUIDE ---
    await chGuide.send({
        embeds: [
            new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('📖 Guía rápida de inicio')
                .setDescription(
                    `1. Descarga el loader oficial que te enviaremos en tu ticket.\n` +
                    `2. Desactiva temporalmente la protección en tiempo real si Windows bloquea el driver.\n` +
                    `3. Introduce tu key personal y abre tu juego.\n` +
                    `4. Si necesitas ayuda, abre un ticket en ${chSupport}.`
                )
        ]
    });

    // --- EMBED: RULES ---
    await chRules.send({
        embeds: [
            new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('📜 Reglas de DrakoStore')
                .setDescription(
                    `1. Respeto total hacia miembros y staff.\n` +
                    `2. Prohibido enviar enlaces, spam o publicidad externa.\n` +
                    `3. La prueba de 1 día gratis es única por persona.\n` +
                    `4. Todas las compras se atienden únicamente en ${chSupport}.`
                )
        ]
    });

    // --- PANEL EN 🎫｜support (1 DIA GRATIS + COMPRA) ---
    const supportEmbed = new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle('🎫 Centro de Soporte y Prueba Gratis')
        .setDescription(
            `**🎁 ¿Quieres 1 Día Gratis?**\n` +
            `Haz clic en **Pedir 1 Día Gratis**, elige tu juego y sube tu captura siguiendo nuestras redes y dando like. Al aprobarse, **el bot te enviará la key por privado**.\n\n` +
            `**💳 ¿Listo para comprar?**\n` +
            `Haz clic en **Abrir Ticket de Compra** para pagar con Yape, Plin, Binance o PayPal.`
        );
    if (BANNER_URL) supportEmbed.setImage(BANNER_URL);

    const supportRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_trial_menu')
            .setLabel('Pedir 1 Día Gratis')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('open_buy_ticket')
            .setLabel('Abrir Ticket de Compra')
            .setStyle(ButtonStyle.Primary)
    );

    await chSupport.send({ embeds: [supportEmbed], components: [supportRow] });
}

client.login(process.env.DISCORD_TOKEN);
