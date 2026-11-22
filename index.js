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
    SlashCommandBuilder
} = require('discord.js');

// ==================== 1. SERVIDOR KEEP-ALIVE PARA RENDER + UPTIME ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.status(200).send('DrakoStore Bot Online');
});

app.listen(PORT, () => console.log(`[HTTP] Keep-alive activo en puerto ${PORT}`));

// ==================== 2. CONFIGURACION DEL BOT ====================
const COLOR_GREEN = 0x00E87B;
const WEB_URL = process.env.WEB_URL || 'https://drakostore.xyz';
const BANNER_URL = process.env.BANNER_URL || '';

const GAMES = {
    'free-fire': 'Free Fire (Internal)',
    'cs2': 'Counter-Strike 2 (Internal)',
    'roblox': 'Roblox (Internal)',
    'robrun': 'ROB RUN (Kernel)',
    'minecraft': 'Minecraft Java (Kernel)'
};

const keyStock = {
    'free-fire': [],
    'cs2': [],
    'roblox': [],
    'robrun': [],
    'minecraft': []
};

const claimedUsers = new Set();     // Evita que un usuario reclame 2 veces
const activeTickets = new Map();    // channelId -> { userId, gameKey }
const spamTracker = new Map();      // userId -> [timestamps]

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ==================== 3. REGISTRO DE SLASH COMMANDS ====================
const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Construye todo el servidor DrakoStore (canales, roles y paneles)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('addkeys')
        .setDescription('Agrega keys de prueba de 1 dia al stock del bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('juego')
                .setDescription('Juego al que pertenecen las keys')
                .setRequired(true)
                .addChoices(
                    { name: 'Free Fire', value: 'free-fire' },
                    { name: 'Counter-Strike 2', value: 'cs2' },
                    { name: 'Roblox', value: 'roblox' },
                    { name: 'ROB RUN', value: 'robrun' },
                    { name: 'Minecraft Java', value: 'minecraft' }
                )
        )
        .addStringOption(opt =>
            opt.setName('keys')
                .setDescription('Pega las keys separadas por comas (ej: KEY-1, KEY-2, KEY-3)')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('stock')
        .setDescription('Muestra cuantas keys de prueba quedan disponibles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`[BOT] Conectado como ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('[BOT] Comandos slash registrados correctamente.');
    } catch (err) {
        console.error('[ERROR] Registrando comandos:', err);
    }
});

// ==================== 4. BIENVENIDA AUTOMATICA ====================
client.on('guildMemberAdd', async (member) => {
    const ch = member.guild.channels.cache.find(c => c.name.includes('bienvenida'));
    if (!ch) return;

    const embed = new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle(`Bienvenido a DrakoStore, ${member.user.username}`)
        .setDescription(
            `Explora nuestras herramientas **Kernel e Internal para Windows**.

` +
            `• Reclama **1 día gratis** siguiendo nuestras redes en el canal de pruebas.
` +
            `• Catálogo web oficial: ${WEB_URL}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: 'DrakoStore • Soporte 24/7' })
        .setTimestamp();

    if (BANNER_URL) embed.setImage(BANNER_URL);
    ch.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

// ==================== 5. AUTO-MODERACION + DETECCION DE CAPTURA ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const isAdmin = message.member.permissions.has(PermissionFlagsBits.ManageMessages);

    // A) Si es un ticket de prueba gratis y el usuario sube una imagen (captura)
    if (activeTickets.has(message.channel.id) && message.attachments.size > 0) {
        const attachment = message.attachments.find(a => a.contentType?.startsWith('image/'));
        if (attachment) {
            const ticketInfo = activeTickets.get(message.channel.id);
            const reviewCh = message.guild.channels.cache.find(c => c.name === 'staff-aprobaciones');

            if (reviewCh) {
                const reviewEmbed = new EmbedBuilder()
                    .setColor(COLOR_GREEN)
                    .setTitle('Nueva captura para 1 Día Gratis')
                    .addFields(
                        { name: 'Usuario', value: `<@${ticketInfo.userId}> (\`${message.author.tag}\`)`, inline: true },
                        { name: 'Juego', value: GAMES[ticketInfo.gameKey], inline: true },
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
                await message.reply('Captura recibida. El staff la está revisando; en cuanto se apruebe te enviaré tu key de 1 día por privado.');
            }
        }
        return;
    }

    if (isAdmin) return;

    // B) Anti-links / Anti-invitaciones
    const linkRegex = /(https?:\/\/|discord\.gg\/|discord\.com\/invite\/)/i;
    if (linkRegex.test(message.content)) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send(`${message.author}, no está permitido enviar enlaces aquí.`);
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
    }

    // C) Anti-spam basico (5 mensajes en menos de 4 segundos)
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

// ==================== 6. INTERACCIONES (SLASH, BOTONES Y MENUS) ====================
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setup') {
                await interaction.deferReply({ ephemeral: true });
                await buildServer(interaction.guild);
                return interaction.editReply('Servidor **DrakoStore** construido con éxito. Ya puedes agregar keys con `/addkeys`.');
            }

            if (interaction.commandName === 'addkeys') {
                const game = interaction.options.getString('juego');
                const rawKeys = interaction.options.getString('keys')
                    .split(',')
                    .map(k => k.trim())
                    .filter(Boolean);

                keyStock[game].push(...rawKeys);
                return interaction.reply({
                    content: `Se agregaron **${rawKeys.length}** keys a **${GAMES[game]}**. Stock total: **${keyStock[game].length}**.`,
                    ephemeral: true
                });
            }

            if (interaction.commandName === 'stock') {
                const lines = Object.entries(GAMES)
                    .map(([k, name]) => `• **${name}:** ${keyStock[k].length} keys`)
                    .join('
');
                return interaction.reply({ content: `**Stock de keys de prueba (1 día):**
${lines}`, ephemeral: true });
            }
        }

        if (interaction.isButton() && interaction.customId === 'open_trial_menu') {
            if (claimedUsers.has(interaction.user.id)) {
                return interaction.reply({ content: 'Ya reclamaste tu prueba gratuita de 1 día anteriormente.', ephemeral: true });
            }

            const select = new StringSelectMenuBuilder()
                .setCustomId('select_trial_game')
                .setPlaceholder('Elige el juego para tu prueba de 24h')
                .addOptions(
                    Object.entries(GAMES).map(([value, label]) => ({ label, value }))
                );

            return interaction.reply({
                content: 'Selecciona el juego que deseas probar gratis por 1 día:',
                components: [new ActionRowBuilder().addComponents(select)],
                ephemeral: true
            });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'select_trial_game') {
            await interaction.deferReply({ ephemeral: true });
            const gameKey = interaction.values[0];
            const guild = interaction.guild;

            const category = guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && c.name.includes('SOPORTE')
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

            activeTickets.set(ticketChannel.id, { userId: interaction.user.id, gameKey });

            const embed = new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle(`Prueba 1 Día Gratis — ${GAMES[gameKey]}`)
                .setDescription(
                    `Hola ${interaction.user}, para recibir tu key de 24 horas automáticamente por privado:

` +
                    `1. Sígueme en mis redes y dale **like** a mis últimos videos.
` +
                    `2. **Envía aquí mismo la captura de pantalla** como prueba.

` +
                    `En cuanto el staff presione aprobar, el bot te enviará tu key por mensaje directo.`
                );

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed] });
            return interaction.editReply(`Canal creado: ${ticketChannel}. Sube ahí tu captura.`);
        }

        if (interaction.isButton() && interaction.customId.startsWith('approve_')) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Solo el staff puede aprobar pruebas.', ephemeral: true });
            }

            const [, userId, gameKey, ticketChannelId] = interaction.customId.split('_');

            if (keyStock[gameKey].length === 0) {
                return interaction.reply({
                    content: `No quedan keys en stock para **${GAMES[gameKey]}**. Usa \`/addkeys\` primero.`,
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
                    `Gracias por apoyar a **DrakoStore**.

` +
                    `**Juego:** ${GAMES[gameKey]}
` +
                    `**Tu Key (24 horas):**
\`\`\`${key}\`\`\`
` +
                    `¿Te gustó? Renueva desde **$1.50 USD** en ${WEB_URL}`
                )
                .setTimestamp();

            try {
                await user.send({ embeds: [dmEmbed] });
            } catch {
                keyStock[gameKey].unshift(key);
                claimedUsers.delete(userId);
                return interaction.reply({
                    content: `No pude enviarle DM a <@${userId}> (tiene los mensajes privados cerrados). Pídele que los active en el ticket.`,
                    ephemeral: true
                });
            }

            await interaction.update({
                content: `Aprobado por ${interaction.user}. Key enviada por privado a <@${userId}>.`,
                components: []
            });

            const tCh = interaction.guild.channels.cache.get(ticketChannelId);
            if (tCh) {
                await tCh.send(`¡Aprobado <@${userId}>! Revisa tus mensajes privados (DM), ya tienes tu key. Este canal se cerrará en 10 segundos.`);
                activeTickets.delete(ticketChannelId);
                setTimeout(() => tCh.delete().catch(() => {}), 10000);
            }
        }

        if (interaction.isButton() && interaction.customId.startsWith('reject_')) {
            const [, userId, ticketChannelId] = interaction.customId.split('_');
            await interaction.update({ content: `Rechazado por ${interaction.user}.`, components: [] });

            const tCh = interaction.guild.channels.cache.get(ticketChannelId);
            if (tCh) {
                await tCh.send(`<@${userId}>, tu captura no pudo ser verificada. Asegúrate de mostrar que sigues la cuenta y diste like, y vuelve a subirla.`);
            }
        }
    } catch (err) {
        console.error('[ERROR INTERACCION]', err);
    }
});

// ==================== 7. CONSTRUCTOR AUTOMATICO DEL SERVIDOR ====================
async function buildServer(guild) {
    await guild.roles.create({ name: 'Cliente VIP', color: COLOR_GREEN }).catch(() => {});
    await guild.roles.create({ name: 'Miembro', color: 0x8EA398 }).catch(() => {});

    const catInfo = await guild.channels.create({ name: '📌・INFORMACIÓN', type: ChannelType.GuildCategory });
    const chBienvenida = await guild.channels.create({ name: '👋・bienvenida', type: ChannelType.GuildText, parent: catInfo.id });
    const chReglas = await guild.channels.create({ name: '📜・reglas', type: ChannelType.GuildText, parent: catInfo.id });
    const chPrecios = await guild.channels.create({ name: '💚・precios-y-web', type: ChannelType.GuildText, parent: catInfo.id });
    await guild.channels.create({ name: '⭐・vouches', type: ChannelType.GuildText, parent: catInfo.id });

    const catSoporte = await guild.channels.create({ name: '🎫・SOPORTE Y PRUEBAS', type: ChannelType.GuildCategory });
    const chPrueba = await guild.channels.create({ name: '🎁・1-dia-gratis', type: ChannelType.GuildText, parent: catSoporte.id });
    await guild.channels.create({ name: '💬・chat-general', type: ChannelType.GuildText, parent: catSoporte.id });

    const catStaff = await guild.channels.create({
        name: '🔒・STAFF',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }]
    });
    await guild.channels.create({ name: 'staff-aprobaciones', type: ChannelType.GuildText, parent: catStaff.id });

    for (const ch of [chBienvenida, chReglas, chPrecios, chPrueba]) {
        await ch.permissionOverwrites.edit(guild.id, { SendMessages: false });
    }

    await chReglas.send({
        embeds: [
            new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('Reglas de DrakoStore')
                .setDescription(
                    '1. Respeto total hacia miembros y staff.
' +
                    '2. Prohibido enviar enlaces, spam o publicidad.
' +
                    '3. Las pruebas gratis son 1 por persona (cuentas falsas serán rechazadas).
' +
                    '4. Todas las compras se realizan únicamente mediante ticket oficial.'
                )
        ]
    });

    await chPrecios.send({
        embeds: [
            new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('Precios Oficiales — Windows (Kernel & Internal)')
                .setDescription(
                    '**Juegos:** Free Fire · CS2 · Roblox · ROB RUN · Minecraft Java

' +
                    '• **1 Día:** `$1.50 USD`
' +
                    '• **7 Días:** `$6 USD`
' +
                    '• **30 Días:** `$12 USD`
' +
                    '• **90 Días:** `$25 USD`

' +
                    `**Métodos:** Yape · Plin · Binance Pay · PayPal
**Web oficial:** ${WEB_URL}`
                )
        ]
    });

    const trialEmbed = new EmbedBuilder()
        .setColor(COLOR_GREEN)
        .setTitle('Reclama 1 Día de Prueba Gratis')
        .setDescription(
            '¿Quieres probar antes de comprar?

' +
            '1. Presiona el botón verde de abajo y elige tu juego.
' +
            '2. Sube tu captura siguiendo nuestras redes y dando like a los videos.
' +
            '3. Al aprobarse, **el bot te enviará tu key de 24h al privado**.'
        );
    if (BANNER_URL) trialEmbed.setImage(BANNER_URL);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_trial_menu')
            .setLabel('Pedir 1 Día Gratis')
            .setStyle(ButtonStyle.Success)
    );

    await chPrueba.send({ embeds: [trialEmbed], components: [row] });
}

client.login(process.env.DISCORD_TOKEN);
