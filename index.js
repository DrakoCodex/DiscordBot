require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const path = require('path');
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
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    res.status(200).send('DrakoStore Bot v3.5.0 Online 24/7');
});

app.listen(PORT, () => console.log(`[HTTP] Keep-alive activo en puerto ${PORT}`));

// ==================== 2. CONFIGURACION (VIA ENVIRONMENT DE RENDER) ====================
const COLOR_GREEN = 0x00E87B;
const WEB_URL = (process.env.WEB_URL || 'https://drakostore.xyz').replace(/\/$/, '');

function validUrl(value) {
    if (!value) return '';
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
    } catch {
        console.warn('[CONFIG] Se ignoró una URL inválida en la configuración.');
        return '';
    }
}

const ASSET_BASE_URL = (process.env.PUBLIC_ASSET_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const bundledAssetUrl = name => ASSET_BASE_URL ? `${ASSET_BASE_URL}/assets/${name}` : '';
const BANNER_URL = validUrl(process.env.BANNER_URL) || bundledAssetUrl('welcome.jpg');
const STATUS_BANNER_URL = validUrl(process.env.STATUS_BANNER_URL) || bundledAssetUrl('status.jpg') || BANNER_URL;
const GUIDE_BANNER_URL = validUrl(process.env.GUIDE_BANNER_URL) || bundledAssetUrl('guide.jpg');
const HOW_TO_BUY_BANNER_URL = validUrl(process.env.HOW_TO_BUY_BANNER_URL) || bundledAssetUrl('how-to-buy.jpg');
const RULES_BANNER_URL = validUrl(process.env.RULES_BANNER_URL) || bundledAssetUrl('rules.jpg');
const VOICE_CHANNEL_NAME = '🟢 Soporte en línea';
const STAFF_CATEGORY_NAME = '🔒 OWNER · STAFF';

// ==================== SUPABASE LICENCIAS (KEY SYSTEM AUTOMATICO) ====================
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://soykyouvyromdkqvkewp.supabase.co').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DEFAULT_LOADER_URL = process.env.LOADER_URL || `${WEB_URL}/descargas`;

const GAME_PREFIXES = {
    'free-fire': 'FF',
    'cs2': 'CS2',
    'roblox': 'RBX',
    'robrun': 'RR',
    'minecraft': 'MC'
};

const GAME_LOADER_ENV = {
    'free-fire': 'LOADER_FF_URL',
    'cs2': 'LOADER_CS2_URL',
    'roblox': 'LOADER_ROBLOX_URL',
    'robrun': 'LOADER_ROBRUN_URL',
    'minecraft': 'LOADER_MC_URL'
};

const GAME_STATUSES = {
    online: { label: 'En línea · Online', emoji: '🟢', color: 0x2ECC71 },
    maintenance: { label: 'En mantenimiento · Maintenance', emoji: '🟠', color: 0xF39C12 },
    outdated: { label: 'Desactualizado · Outdated', emoji: '🔴', color: 0xE74C3C }
};

function normalizeGameChannelName(name) {
    return name.replace(/^(?:(?:🟢|🟠|🔴)(?:�)?|�)｜/u, '');
}

function setGameChannelStatusName(name, emoji) {
    return name.replace(/^(?:(?:🟢|🟠|🔴)(?:�)?|�)(?=｜)/u, emoji);
}

const PLAN_LABELS = {
    1: '1 Día ($1.50 USD)',
    7: '7 Días ($6 USD)',
    30: '30 Días ($12 USD)',
    90: '90 Días ($25 USD)'
};

function getLoaderUrl(gameKey) {
    const envName = GAME_LOADER_ENV[gameKey];
    return (envName && process.env[envName]) || DEFAULT_LOADER_URL;
}

function generateRandomKey(gameKey) {
    const prefix = GAME_PREFIXES[gameKey] || 'DS';
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}-${part1}-${part2}-${part3}`;
}

async function createLicenseInSupabase({ gameKey, durationDays, discordUserId = null }) {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Falta configurar SUPABASE_SERVICE_ROLE_KEY en Render (Environment).');
    }

    const key = generateRandomKey(gameKey);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/licenses`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            key,
            game: gameKey,
            duration_days: durationDays,
            status: 'active',
            discord_user_id: discordUserId
        })
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Error Supabase (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data[0] : { key, game: gameKey, duration_days: durationDays };
}

async function resetHwidInSupabase(key) {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Falta configurar SUPABASE_SERVICE_ROLE_KEY en Render (Environment).');
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/licenses?key=eq.${encodeURIComponent(key.trim())}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ hwid: null })
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Error Supabase (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data[0] : null;
}

async function supabaseRequest(path, options = {}) {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Falta configurar SUPABASE_SERVICE_ROLE_KEY en Render (Environment).');
    }

    const res = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Error Supabase (${res.status}): ${errText.slice(0, 300)}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

async function loadGameStatuses(guildId) {
    const defaults = Object.fromEntries(Object.keys(GAMES).map(gameKey => [gameKey, {
        status: 'online', note: '', updated_by: null, updated_at: null
    }]));
    const rows = await supabaseRequest(`/rest/v1/game_statuses?select=game_key,status,note,updated_by,updated_at&guild_id=eq.${encodeURIComponent(guildId)}&limit=10`);
    for (const row of Array.isArray(rows) ? rows : []) {
        if (Object.hasOwn(defaults, row.game_key) && Object.hasOwn(GAME_STATUSES, row.status)) {
            defaults[row.game_key] = row;
        }
    }
    return defaults;
}

async function saveGameStatus({ guildId, gameKey, status, note, userId }) {
    if (!Object.hasOwn(GAMES, gameKey)) throw new Error('Juego no válido.');
    if (!Object.hasOwn(GAME_STATUSES, status)) throw new Error('Estado no válido.');
    const rows = await supabaseRequest('/rest/v1/game_statuses?on_conflict=guild_id,game_key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
            guild_id: guildId,
            game_key: gameKey,
            status,
            note: String(note || '').trim().slice(0, 200),
            updated_by: userId,
            updated_at: new Date().toISOString()
        })
    });
    return Array.isArray(rows) ? rows[0] : rows;
}

async function createTrialClaim(guildId, discordUserId, gameKey) {
    const rows = await supabaseRequest('/rest/v1/rpc/create_trial_claim', {
        method: 'POST',
        body: JSON.stringify({
            p_guild_id: guildId,
            p_discord_user_id: discordUserId,
            p_game_key: gameKey
        })
    });
    return Array.isArray(rows) ? rows[0] : rows;
}

async function getPendingTrialByChannel(channelId) {
    const params = new URLSearchParams({
        select: 'id,guild_id,discord_user_id,game_key,status,ticket_channel_id,evidence_url,review_message_id',
        ticket_channel_id: `eq.${channelId}`,
        status: 'eq.pending',
        limit: '1'
    });
    const rows = await supabaseRequest(`/rest/v1/trial_claims?${params}`);
    return Array.isArray(rows) ? rows[0] || null : null;
}

async function updateTrialClaim(claimId, values) {
    return supabaseRequest(`/rest/v1/trial_claims?id=eq.${encodeURIComponent(claimId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...values, updated_at: new Date().toISOString() })
    });
}

async function approveTrialClaim(claimId, moderatorId) {
    const rows = await supabaseRequest('/rest/v1/rpc/approve_trial', {
        method: 'POST',
        body: JSON.stringify({ p_claim_id: claimId, p_moderator_id: moderatorId })
    });
    return Array.isArray(rows) ? rows[0] : rows;
}

async function revokeLicenseInSupabase(key) {
    const rows = await supabaseRequest('/rest/v1/rpc/revoke_license', {
        method: 'POST',
        body: JSON.stringify({ p_key: key.trim() })
    });
    return Array.isArray(rows) ? rows[0] : rows;
}

async function extendLicenseInSupabase(key, days) {
    const rows = await supabaseRequest('/rest/v1/rpc/extend_license', {
        method: 'POST',
        body: JSON.stringify({ p_key: key.trim(), p_days: days })
    });
    return Array.isArray(rows) ? rows[0] : rows;
}

function isOwner(interaction) {
    return Boolean(
        interaction.guild?.ownerId === interaction.user.id ||
        interaction.member?.roles?.cache?.some(role => role.name === '👑 Owner')
    );
}

function isStaff(interaction) {
    return Boolean(interaction.member?.roles?.cache?.some(role =>
        ['🛡️ Staff', 'Staff'].includes(role.name)
    ));
}

function isOwnerOrStaff(interaction) {
    return isOwner(interaction) || isStaff(interaction);
}

function isStaffOpsChannel(interaction) {
    return interaction.channel?.parent?.name === STAFF_CATEGORY_NAME;
}

// Jerarquia de roles en la barra derecha (de arriba hacia abajo)
// hoist: true = seccion separada | hoist: false = aparece en "En linea" (usuarios no clientes)
const ROLE_CONFIGS = [
    {
        key: 'owner',
        name: '👑 Owner',
        legacyNames: ['Owner'],
        color: 0xFF0000,
        hoist: true,
        mentionable: false,
        permissions: [PermissionFlagsBits.Administrator]
    },
    {
        key: 'staff',
        name: '🛡️ Staff',
        legacyNames: ['Staff'],
        color: 0x9B59B6,
        hoist: true,
        mentionable: false
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
        color: 0x3498DB,
        hoist: true,
        mentionable: false
    },
    {
        key: 'clientes',
        name: '💎 Clientes',
        legacyNames: ['Clientes', 'Cliente VIP', 'Cliente'],
        color: 0x00FFFF,
        hoist: true,
        mentionable: false
    },
    {
        key: 'miembro',
        name: 'Miembro',
        legacyNames: [],
        color: 0x111111,
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

// Las keys se generan automaticamente en Supabase (tabla licenses)

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
        .setDescription('Actualiza los embeds, imagenes y permisos de todos los canales ya creados'),

    new SlashCommandBuilder()
        .setName('setstatus')
        .setDescription('Cambia el estado público de un juego')
        .addStringOption(opt =>
            opt.setName('juego')
                .setDescription('Juego que quieres actualizar')
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
            opt.setName('estado')
                .setDescription('Estado visible para los clientes')
                .setRequired(true)
                .addChoices(
                    { name: 'En línea · verde', value: 'online' },
                    { name: 'En mantenimiento · naranja', value: 'maintenance' },
                    { name: 'Desactualizado · rojo', value: 'outdated' }
                )
        )
        .addStringOption(opt =>
            opt.setName('nota')
                .setDescription('Nota opcional para clientes (máximo 200 caracteres)')
                .setMaxLength(200)
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('genkey')
        .setDescription('Genera una key en Supabase segun juego y plan y la entrega con el link del loader')
        .addStringOption(opt =>
            opt.setName('juego')
                .setDescription('Juego para el que sirve la key')
                .setRequired(true)
                .addChoices(
                    { name: 'Free Fire (Internal)', value: 'free-fire' },
                    { name: 'Counter-Strike 2 (Internal)', value: 'cs2' },
                    { name: 'Roblox (Internal)', value: 'roblox' },
                    { name: 'ROB RUN (Kernel)', value: 'robrun' },
                    { name: 'Minecraft Java (Kernel)', value: 'minecraft' }
                )
        )
        .addIntegerOption(opt =>
            opt.setName('plan')
                .setDescription('Duracion de la licencia')
                .setRequired(true)
                .addChoices(
                    { name: '1 Día ($1.50 USD)', value: 1 },
                    { name: '7 Días ($6 USD)', value: 7 },
                    { name: '30 Días ($12 USD)', value: 30 },
                    { name: '90 Días ($25 USD)', value: 90 }
                )
        )
        .addUserOption(opt =>
            opt.setName('cliente')
                .setDescription('Cliente al que se entrega (opcional, le asigna rol Clientes)')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('resethwid')
        .setDescription('Resetea el HWID de una key en Supabase para que el cliente pueda usarla en otra PC')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('key')
                .setDescription('Key exacta a resetear (ej: CS2-A1B2-C3D4-E5F6)')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('revoke')
        .setDescription('Revoca una licencia y bloquea su uso inmediatamente')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('key')
                .setDescription('Key exacta a revocar')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('adddays')
        .setDescription('Añade días a una licencia existente')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('key')
                .setDescription('Key exacta a ampliar')
                .setRequired(true)
        )
        .addIntegerOption(opt =>
            opt.setName('dias')
                .setDescription('Cantidad de días a añadir (1-3650)')
                .setMinValue(1)
                .setMaxValue(3650)
                .setRequired(true)
        )
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
            console.log('[BOT] Slash commands registrados (/setup, /update, /setstatus, /genkey, /resethwid, /revoke, /adddays).');
        } catch (err) {
            console.error('[ERROR] Registrando comandos:', err);
        }

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
            try {
                const summary = await syncServer(guild);
                console.log(`[SYNC] Inicio aplicado: ${summary.created} canales nuevos, ${summary.updated} canales verificados, ${summary.rolesCreated} roles nuevos.`);
            } catch (err) {
                console.error('[SYNC ERROR] Sincronización al inicio falló:', err);
            }
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
    const trialClaim = message.attachments.size > 0 ? await getPendingTrialByChannel(message.channel.id).catch(err => {
        console.error('[TRIAL LOOKUP ERROR]', err.message);
        return null;
    }) : null;
    if (trialClaim && message.attachments.size > 0) {
        const attachment = message.attachments.find(a => a.contentType?.startsWith('image/'));
        if (attachment) {
            if (trialClaim.evidence_url) {
                await message.reply('Ya recibimos una captura para este ticket. El staff está revisando la primera enviada.');
                return;
            }

            const reviewCh = message.guild.channels.cache.find(c => c.name === 'staff-aprobaciones');
            if (reviewCh) {
                const game = GAMES[trialClaim.game_key];
                const reviewEmbed = new EmbedBuilder()
                    .setColor(COLOR_GREEN)
                    .setTitle('Nueva captura para 1 Día Gratis')
                    .addFields(
                        { name: 'Usuario', value: `<@${trialClaim.discord_user_id}> (\`${message.author.tag}\`)`, inline: true },
                        { name: 'Juego', value: `${game.name} (${game.type})`, inline: true },
                        { name: 'Solicitud', value: `\`${trialClaim.id}\``, inline: false }
                    )
                    .setImage(attachment.url)
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_trial_${trialClaim.id}_${message.channel.id}`)
                        .setLabel('Aprobar y Enviar Key')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_trial_${trialClaim.id}_${message.channel.id}`)
                        .setLabel('Rechazar')
                        .setStyle(ButtonStyle.Danger)
                );

                const reviewMessage = await reviewCh.send({ embeds: [reviewEmbed], components: [row] });
                await updateTrialClaim(trialClaim.id, {
                    evidence_url: attachment.url,
                    review_message_id: reviewMessage.id
                });
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
async function ensureGameOnlineForInteraction(interaction, gameKey) {
    let gameStatuses;
    try {
        gameStatuses = await loadGameStatuses(interaction.guildId);
    } catch (err) {
        console.error('[GAME STATUS CHECK ERROR]', err.message);
        await interaction.editReply('❌ No se pudo comprobar el estado del juego. Inténtalo de nuevo en unos segundos.');
        return false;
    }
    const state = gameStatuses[gameKey] || { status: 'online', note: '' };
    if (state.status === 'online') return true;
    const appearance = GAME_STATUSES[state.status] || GAME_STATUSES.online;
    const safeNote = String(state.note || '').replace(/@/g, '@\u200b');
    const note = safeNote ? `\nNota: ${safeNote}` : '';
    await interaction.editReply(`${appearance.emoji} **${GAMES[gameKey].name} está ${appearance.label.toLowerCase()}.**${note}`);
    return false;
}

async function createTrialTicket(interaction, gameKey) {
    const game = GAMES[gameKey];
    const guild = interaction.guild;
    if (!await ensureGameOnlineForInteraction(interaction, gameKey)) return;
    const claim = await createTrialClaim(guild.id, interaction.user.id, gameKey);

    if (claim.claim_status === 'approved') {
        return interaction.editReply('Ya reclamaste tu prueba gratuita de 1 día anteriormente.');
    }

    if (!claim.was_created && claim.existing_ticket_channel_id) {
        return interaction.editReply(`Ya tienes una solicitud pendiente: <#${claim.existing_ticket_channel_id}>`);
    }

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

    await updateTrialClaim(claim.claim_id, { ticket_channel_id: ticketChannel.id });

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
    if (gameKey && !await ensureGameOnlineForInteraction(interaction, gameKey)) return;
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
                if (interaction.commandName === 'setup' && !isOwner(interaction)) {
                    return interaction.reply({ content: 'Solo el Owner puede ejecutar /setup.', ephemeral: true });
                }
                if (interaction.commandName === 'update' && !isOwnerOrStaff(interaction)) {
                    return interaction.reply({ content: 'Solo Owner o Staff pueden ejecutar /update.', ephemeral: true });
                }
                if (!isStaffOpsChannel(interaction)) {
                    return interaction.reply({ content: `Usa este comando dentro de la categoría privada ${STAFF_CATEGORY_NAME}.`, ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const summary = await syncServer(interaction.guild);
                connectToSupportVoice(interaction.guild);
                return interaction.editReply(
                    `✅ **Sincronización completada (${interaction.commandName === 'setup' ? 'Setup' : 'Update'})**\n` +
                    `• Roles creados: **${summary.rolesCreated}** | verificados/actualizados: **${summary.rolesUpdated}**\n` +
                    `• Canales creados: **${summary.created}** | verificados/actualizados: **${summary.updated}**\n` +
                    `• Jerarquía de roles: **👑 Owner → 🛡️ Staff → 🤝 Partner → 🤖 Bots → 💎 Clientes → Miembro**\n` +
                    `• Paneles e imágenes actualizados sin duplicados.\n` +
                    `• Bot conectado a **${VOICE_CHANNEL_NAME}**.`
                );
            }

            if (interaction.commandName === 'setstatus') {
                if (!isOwnerOrStaff(interaction)) {
                    return interaction.reply({ content: 'Solo Owner o Staff pueden cambiar estados.', ephemeral: true });
                }
                if (!isStaffOpsChannel(interaction)) {
                    return interaction.reply({ content: `Usa /setstatus dentro de la categoría privada ${STAFF_CATEGORY_NAME}.`, ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });
                const gameKey = interaction.options.getString('juego');
                const status = interaction.options.getString('estado');
                const note = interaction.options.getString('nota') || '';
                try {
                    const statuses = await loadGameStatuses(interaction.guildId);
                    const savedStatus = await saveGameStatus({
                        guildId: interaction.guildId,
                        gameKey,
                        status,
                        note,
                        userId: interaction.user.id
                    });
                    statuses[gameKey] = savedStatus || {
                        status,
                        note: String(note || '').trim().slice(0, 200),
                        updated_by: interaction.user.id,
                        updated_at: new Date().toISOString()
                    };
                    await refreshStatusPanels(interaction.guild, statuses);
                    const statusInfo = GAME_STATUSES[status];
                    return interaction.editReply(
                        `${statusInfo.emoji} **${GAMES[gameKey].name}: ${statusInfo.label}.** ` +
                        (note ? `Nota: ${note}` : 'Panel y canal actualizados.')
                    );
                } catch (err) {
                    console.error('[GAME STATUS ERROR]', err.message);
                    return interaction.editReply('❌ No se pudo guardar o publicar el estado. Revisa la conexión a Supabase e inténtalo de nuevo.');
                }
            }

            if (interaction.commandName === 'genkey') {
                if (!isOwnerOrStaff(interaction)) {
                    return interaction.reply({ content: 'Solo Owner o Staff pueden generar licencias.', ephemeral: true });
                }
                if (!isStaffOpsChannel(interaction)) {
                    return interaction.reply({ content: `Usa /genkey dentro de la categoría privada ${STAFF_CATEGORY_NAME}.`, ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const gameKey = interaction.options.getString('juego');
                const durationDays = interaction.options.getInteger('plan');
                const targetUser = interaction.options.getUser('cliente');
                const game = GAMES[gameKey];
                const loaderUrl = getLoaderUrl(gameKey);

                try {
                    const lic = await createLicenseInSupabase({
                        gameKey,
                        durationDays,
                        discordUserId: targetUser?.id || null
                    });

                    // Si se menciono un cliente, asignarle el rol 💎 Clientes automaticamente
                    if (targetUser && interaction.guild) {
                        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                        const clientRole = interaction.guild.roles.cache.find(r => r.name === '💎 Clientes');
                        if (member && clientRole && clientRole.editable && !member.roles.cache.has(clientRole.id)) {
                            await member.roles.add(clientRole).catch(() => {});
                        }
                    }

                    const embed = new EmbedBuilder()
                        .setColor(COLOR_GREEN)
                        .setTitle(`🔑 Licencia Generada — ${game.name} (${game.type})`)
                        .setDescription(
                            `${targetUser ? `Hola ${targetUser}, aquí tienes tu licencia lista para usar:\n\n` : ''}` +
                            `**🎮 Juego:** ${game.name} (\`${game.type}\`)\n` +
                            `**⏳ Plan:** ${PLAN_LABELS[durationDays] || `${durationDays} días`}\n` +
                            `**🔑 Tu Key:**\n\`\`\`${lic.key}\`\`\`\n` +
                            `**📥 Descargar Loader:** ${loaderUrl}\n\n` +
                            `• Los días empiezan a contar desde que activas la key por primera vez.\n` +
                            `• \`1 key = 1 PC\` (bloqueo automático por HWID).`
                        )
                        .setFooter({ text: 'DrakoStore • Licencia generada en Supabase' })
                        .setTimestamp();

                    return interaction.editReply({
                        content: targetUser ? `${targetUser}` : undefined,
                        embeds: [embed]
                    });
                } catch (err) {
                    console.error('[GENKEY ERROR]', err);
                    return interaction.editReply(`❌ No se pudo generar la key: \`${err.message}\``);
                }
            }

            if (interaction.commandName === 'resethwid') {
                if (!isOwner(interaction)) {
                    return interaction.reply({ content: 'Solo el Owner puede resetear HWIDs.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const key = interaction.options.getString('key').trim();
                try {
                    const updated = await resetHwidInSupabase(key);
                    if (!updated) {
                        return interaction.editReply(`❌ No se encontró la key \`${key}\` en Supabase.`);
                    }
                    return interaction.editReply(`✅ HWID reseteado correctamente para la key \`${updated.key}\` (${GAMES[updated.game]?.name || updated.game}). Ya puede activarse en una nueva PC.`);
                } catch (err) {
                    console.error('[RESETHWID ERROR]', err);
                    return interaction.editReply(`❌ Error al resetear HWID: \`${err.message}\``);
                }
            }

            if (interaction.commandName === 'revoke') {
                if (!isOwner(interaction)) {
                    return interaction.reply({ content: 'Solo el Owner puede revocar licencias.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const key = interaction.options.getString('key').trim();
                try {
                    const revoked = await revokeLicenseInSupabase(key);
                    if (!revoked) return interaction.editReply('❌ No se encontró esa licencia.');
                    return interaction.editReply(`✅ Licencia \`${revoked.license_key}\` revocada. Estado: \`${revoked.new_status}\`.`);
                } catch (err) {
                    console.error('[REVOKE ERROR]', err);
                    return interaction.editReply('❌ No se pudo revocar la licencia. Revisa la key e inténtalo de nuevo.');
                }
            }

            if (interaction.commandName === 'adddays') {
                if (!isOwner(interaction)) {
                    return interaction.reply({ content: 'Solo el Owner puede ampliar licencias.', ephemeral: true });
                }
                await interaction.deferReply({ ephemeral: true });
                const key = interaction.options.getString('key').trim();
                const days = interaction.options.getInteger('dias');
                try {
                    const extended = await extendLicenseInSupabase(key, days);
                    if (!extended) return interaction.editReply('❌ No se encontró esa licencia.');
                    const expiry = extended.expires_at ? ` Nueva fecha de vencimiento: <t:${Math.floor(new Date(extended.expires_at).getTime() / 1000)}:F>.` : '';
                    return interaction.editReply(`✅ Se añadieron **${extended.added_days} días** a \`${extended.license_key}\`. Duración total: **${extended.total_duration_days} días**.${expiry}`);
                } catch (err) {
                    console.error('[ADDDAYS ERROR]', err);
                    return interaction.editReply('❌ No se pudo ampliar la licencia. Comprueba que exista y no esté revocada.');
                }
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
            if (!isOwnerOrStaff(interaction)) {
                return interaction.reply({ content: 'Solo Owner o Staff pueden cerrar tickets.', ephemeral: true });
            }
            await interaction.reply('Cerrando ticket en 5 segundos...');
            const trialClaim = await getPendingTrialByChannel(interaction.channel.id).catch(() => null);
            if (trialClaim) {
                await updateTrialClaim(trialClaim.id, { status: 'cancelled' }).catch(err => {
                    console.error('[TRIAL CLOSE ERROR]', err.message);
                });
            }
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            return;
        }

        // --- STAFF: APROBAR Y GENERAR KEY 1 DIA ATOMICAMENTE EN SUPABASE ---
        if (interaction.isButton() && interaction.customId.startsWith('approve_trial_')) {
            if (!isOwnerOrStaff(interaction)) {
                return interaction.reply({ content: 'Solo Owner o Staff pueden aprobar pruebas.', ephemeral: true });
            }

            const [, , claimId, ticketChannelId] = interaction.customId.split('_');

            let lic;
            try {
                lic = await approveTrialClaim(claimId, interaction.user.id);
            } catch (err) {
                console.error('[APPROVE SUPABASE ERROR]', err);
                return interaction.reply({
                    content: `❌ No se pudo generar la key en Supabase: \`${err.message}\``,
                    ephemeral: true
                });
            }

            if (lic.result_status === 'already_approved') {
                return interaction.update({
                    content: 'Esta solicitud ya había sido aprobada por otro administrador.',
                    components: []
                });
            }

            const user = await client.users.fetch(lic.discord_user_id);
            const loaderUrl = getLoaderUrl(lic.game_key);
            const dmEmbed = new EmbedBuilder()
                .setColor(COLOR_GREEN)
                .setTitle('🎁 Tu prueba de 1 Día Gratis fue aprobada')
                .setDescription(
                    `Gracias por suscribirte y apoyar a **DrakoStore**.\n\n` +
                    `**🎮 Juego:** ${GAMES[lic.game_key].name} (${GAMES[lic.game_key].type})\n` +
                    `**🔑 Tu Key (24 horas):**\n\`\`\`${lic.key}\`\`\`\n` +
                    `**📥 Descargar Loader:** ${loaderUrl}\n\n` +
                    `Renueva desde **$1.50 USD** en ${WEB_URL}/juego?id=${lic.game_key}`
                )
                .setTimestamp();

            let dmSent = true;
            try {
                await user.send({ embeds: [dmEmbed] });
            } catch {
                dmSent = false;
            }

            await interaction.update({
                content: dmSent
                    ? `✅ Aprobado por ${interaction.user}. Key \`${lic.key}\` generada en Supabase y enviada al privado de <@${lic.discord_user_id}>.`
                    : `✅ Aprobado por ${interaction.user}. Key \`${lic.key}\` generada en Supabase y entregada en el ticket (el usuario tenía los DMs cerrados).`,
                components: []
            });

            const tCh = interaction.guild.channels.cache.get(ticketChannelId);
            if (tCh) {
                if (dmSent) {
                    await tCh.send(`¡Aprobado <@${lic.discord_user_id}>! Ya envié tu key de 24 horas y el link del loader por mensaje privado (DM). Este canal se cerrará en 10 segundos.`);
                    setTimeout(() => tCh.delete().catch(() => {}), 10000);
                } else {
                    await tCh.send({ content: `¡Aprobado <@${lic.discord_user_id}>! Como tienes los mensajes privados desactivados, te dejo tu key aquí:`, embeds: [dmEmbed] });
                }
            }
        }

        // --- STAFF: RECHAZAR ---
        if (interaction.isButton() && interaction.customId.startsWith('reject_trial_')) {
            if (!isOwnerOrStaff(interaction)) {
                return interaction.reply({ content: 'Solo Owner o Staff pueden rechazar pruebas.', ephemeral: true });
            }

            const [, , claimId, ticketChannelId] = interaction.customId.split('_');
            const claimRows = await supabaseRequest(`/rest/v1/trial_claims?id=eq.${encodeURIComponent(claimId)}&select=discord_user_id&limit=1`);
            const userId = claimRows?.[0]?.discord_user_id;
            if (!userId) return interaction.reply({ content: 'La solicitud ya no existe.', ephemeral: true });
            await updateTrialClaim(claimId, {
                status: 'rejected',
                moderator_id: interaction.user.id,
                rejection_reason: 'Captura rechazada por el staff',
                rejected_at: new Date().toISOString()
            });
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

    // Reordenar jerarquia de arriba hacia abajo: Owner > Staff > Partner > Bots > Clientes > Miembro
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

    // Auto-asignar roles: Owner al dueno, Bots a bots, Miembro (no cliente) a humanos
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

async function ensureCategory(guild, name, overwrites = null, stats, legacyNames = []) {
    let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
    if (!cat && legacyNames.length) {
        cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && legacyNames.includes(c.name));
    }
    if (!cat) {
        const opts = { name, type: ChannelType.GuildCategory };
        if (overwrites) opts.permissionOverwrites = overwrites;
        cat = await guild.channels.create(opts);
        stats.created++;
    } else {
        if (cat.name !== name) await cat.setName(name).catch(() => {});
        if (overwrites) await cat.permissionOverwrites.set(overwrites).catch(() => {});
        stats.updated++;
    }
    return cat;
}

async function ensureChannel(guild, name, type, parentId, { readOnly = false, topic = null, overwrites = null } = {}, stats) {
    let ch = guild.channels.cache.find(c => c.type === type && c.name === name);
    if (!ch && normalizeGameChannelName(name) !== name) {
        const stableName = normalizeGameChannelName(name);
        ch = guild.channels.cache.find(c =>
            c.type === type && normalizeGameChannelName(c.name) === stableName
        );
    }
    if (ch && normalizeGameChannelName(name) !== name) {
        const stableName = normalizeGameChannelName(name);
        const malformedDuplicates = guild.channels.cache.filter(c =>
            c.id !== ch.id && c.type === type &&
            /^(?:🟢|🟠|🔴)�｜/u.test(c.name) &&
            normalizeGameChannelName(c.name) === stableName
        );
        for (const duplicate of malformedDuplicates.values()) {
            try {
                await duplicate.delete('Remove malformed duplicate game status channel');
                console.log(`[STATUS] Canal duplicado malformado eliminado: ${duplicate.name}`);
            } catch (err) {
                console.warn(`[STATUS] No se pudo quitar el canal duplicado ${duplicate.name}: ${err.message}`);
            }
        }
    }

    if (!ch) {
        const opts = { name, type };
        if (parentId) opts.parent = parentId;
        if (topic && type === ChannelType.GuildText) opts.topic = topic;
        if (overwrites) opts.permissionOverwrites = overwrites;
        ch = await guild.channels.create(opts);
        stats.created++;
    } else {
        if (ch.name !== name) await ch.setName(name).catch(() => {});
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

async function disableThreadCreation(guild) {
    await guild.channels.fetch();
    const supportedTypes = [
        ChannelType.GuildCategory,
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildForum
    ];
    const threadPermissions = [
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.CreatePrivateThreads
    ].filter(Boolean);

    for (const channel of guild.channels.cache.values()) {
        if (!supportedTypes.includes(channel.type)) continue;
        await channel.permissionOverwrites.edit(guild.id, {
            CreatePublicThreads: false,
            CreatePrivateThreads: false
        }).catch(err => console.warn(`[THREADS] No se pudieron bloquear hilos en ${channel.name}: ${err.message}`));

        for (const overwrite of channel.permissionOverwrites.cache.values()) {
            if (overwrite.id === guild.id) continue;
            if (!threadPermissions.some(permission => overwrite.allow.has(permission))) continue;
            await channel.permissionOverwrites.edit(overwrite.id, {
                CreatePublicThreads: false,
                CreatePrivateThreads: false
            }).catch(err => console.warn(`[THREADS] No se pudo quitar permiso de hilos en ${channel.name}: ${err.message}`));
        }
    }
}

const IS_COMPONENTS_V2 = 1 << 15; // 32768 - Discord Components V2

// Edita el mensaje existente del bot en el canal o envia uno nuevo si no existe
async function upsertBotMessage(channel, payload) {
    try {
        const messages = await channel.messages.fetch({ limit: 15 });
        const existing = messages.find(m => m.author.id === client.user.id);
        if (existing) {
            const wantsV2 = Boolean(payload.flags && (payload.flags & IS_COMPONENTS_V2));
            const isV2 = Boolean(existing.flags?.bitfield && (existing.flags.bitfield & IS_COMPONENTS_V2));
            if (wantsV2 !== isV2) {
                // Discord no permite cambiar de Embed clasico a Components V2 editando: reemplazamos el mensaje
                await existing.delete().catch(() => {});
                return channel.send(payload);
            }
            await existing.edit(payload);
            return existing;
        }
    } catch {}
    return channel.send(payload);
}

function buildGamePayload(key, g, gameStatus = { status: 'online', note: '', updated_at: null }) {
    const unixNow = Math.floor(Date.now() / 1000);
    const topBanner = validUrl(process.env[g.bannerEnv]);
    const menuImg = validUrl(process.env[g.menuEnv]);
    const status = GAME_STATUSES[gameStatus.status] || GAME_STATUSES.online;
    const updatedUnix = gameStatus.updated_at ? Math.floor(new Date(gameStatus.updated_at).getTime() / 1000) : unixNow;
    const safeNote = String(gameStatus.note || '').replace(/@/g, '@\u200b');
    const isAvailable = gameStatus.status === 'online';

    const containerItems = [];

    // 1) Banner/GIF superior dentro del mismo contenedor
    if (topBanner) {
        containerItems.push({
            type: 12, // MediaGallery
            items: [{ media: { url: topBanner } }]
        });
        containerItems.push({ type: 14, divider: true, spacing: 1 });
    }

    // 2) Titulo, descripcion y estado en vivo
    containerItems.push({
        type: 10, // TextDisplay
        content:
            `### ${status.emoji} DrakoStore · ${g.name}\n` +
            `${g.desc}\n` +
            `-# 🛡️ ${g.tagline}\n\n` +
            `${status.emoji} **${status.label}** · \`Windows · ${g.type}\` · 🔄 <t:${updatedUnix}:R>` +
            (safeNote ? `\n> ${safeNote}` : '')
    });

    containerItems.push({ type: 14, divider: true, spacing: 1 });

    // 3) Funciones resumidas
    containerItems.push({
        type: 10,
        content:
            `**✨ Funciones · Features**\n` +
            `${g.shortFeatures.join('\n')}`
    });

    containerItems.push({ type: 14, divider: true, spacing: 1 });

    // 4) Planes y precios
    containerItems.push({
        type: 10,
        content:
            `**💰 Planes · Plans**\n` +
            `\`1 día  · day  \` **$1.50 USD**\n` +
            `\`7 días · days \` **$6 USD** ⭐\n` +
            `\`30 días · days\` **$12 USD**\n` +
            `\`90 días · days\` **$25 USD**\n` +
            `🎁 **Prueba gratis 1 día · 1-day free trial**`
    });

    // 5) Captura del menu dentro del mismo contenedor
    if (menuImg) {
        containerItems.push({ type: 14, divider: true, spacing: 1 });
        containerItems.push({
            type: 12,
            items: [{ media: { url: menuImg } }]
        });
    }

    containerItems.push({ type: 14, divider: true, spacing: 1 });

    // 6) Botones interactivos DENTRO del contenedor
    containerItems.push({
        type: 1, // ActionRow
        components: [
            {
                type: 2,
                style: ButtonStyle.Success,
                custom_id: `buy_direct_${key}`,
                label: 'Comprar · Buy',
                emoji: { name: '🛒' },
                disabled: !isAvailable
            },
            {
                type: 2,
                style: ButtonStyle.Primary,
                custom_id: `trial_direct_${key}`,
                label: 'Prueba gratis · Free trial',
                emoji: { name: '🎁' },
                disabled: !isAvailable
            }
        ]
    });

    containerItems.push({
        type: 1, // ActionRow
        components: [
            {
                type: 2,
                style: ButtonStyle.Secondary,
                custom_id: `info_features_${key}`,
                label: 'Funciones · Features',
                emoji: { name: '📋' }
            },
            {
                type: 2,
                style: ButtonStyle.Secondary,
                custom_id: 'info_payments',
                label: 'Pagos · Payment',
                emoji: { name: '💳' }
            }
        ]
    });

    // 7) Footer compacto debajo de los botones (dentro de la tarjeta)
    containerItems.push({
        type: 10,
        content: `-# ⚡ ${g.type} (Windows) · 1 key = 1 PC · auto-updates · ${WEB_URL}/juego?id=${g.slug}`
    });

    return {
        flags: IS_COMPONENTS_V2,
        components: [
            {
                type: 17, // Container
                accent_color: status.color,
                components: containerItems
            }
        ]
    };
}

function buildStatusOverviewPayload(gameChannels, gameStatuses) {
    const entries = Object.entries(GAMES).map(([key, game]) => {
        const state = gameStatuses[key] || { status: 'online', note: '', updated_at: null };
        const appearance = GAME_STATUSES[state.status] || GAME_STATUSES.online;
        const channel = gameChannels[key];
        const note = String(state.note || '').replace(/@/g, '@\u200b');
        return { key, game, state, appearance, channel, note };
    });
    const overall = entries.some(entry => entry.state.status === 'outdated')
        ? GAME_STATUSES.outdated
        : entries.some(entry => entry.state.status === 'maintenance')
            ? GAME_STATUSES.maintenance
            : GAME_STATUSES.online;
    const unixNow = Math.floor(Date.now() / 1000);
    const pcRows = entries.filter(entry => entry.game.type === 'Internal').map(entry =>
        `${entry.appearance.emoji} **${entry.game.name}** — ${entry.channel || entry.game.channelName}` +
        (entry.note ? ` · ${entry.note}` : '')
    );
    const kernelRows = entries.filter(entry => entry.game.type === 'Kernel').map(entry =>
        `${entry.appearance.emoji} **${entry.game.name}** — ${entry.channel || entry.game.channelName}` +
        (entry.note ? ` · ${entry.note}` : '')
    );
    return {
        flags: IS_COMPONENTS_V2,
        components: [{
            type: 17,
            accent_color: overall.color,
            components: [
                ...(STATUS_BANNER_URL ? [
                    { type: 12, items: [{ media: { url: STATUS_BANNER_URL } }] },
                    { type: 14, divider: true, spacing: 1 }
                ] : []),
                { type: 10, content: `### ${overall.emoji} DrakoStore · Estado del servicio\n${overall.label}\n-# 🔄 Revisado <t:${unixNow}:R>` },
                { type: 14, divider: true, spacing: 1 },
                { type: 10, content: `**💉 PC · Internals (Windows)**\n${pcRows.join('\n')}` },
                { type: 14, divider: true, spacing: 1 },
                { type: 10, content: `**⚡ PC · Kernel (Windows)**\n${kernelRows.join('\n')}` },
                { type: 14, divider: true, spacing: 1 },
                { type: 10, content: `-# 🟢 En línea · 🟠 En mantenimiento · 🔴 Desactualizado · ${WEB_URL}` }
            ]
        }]
    };
}

async function refreshStatusPanels(guild, gameStatuses) {
    await guild.channels.fetch();
    const gameChannels = {};
    for (const [key, game] of Object.entries(GAMES)) {
        const state = gameStatuses[key] || { status: 'online', note: '' };
        const appearance = GAME_STATUSES[state.status] || GAME_STATUSES.online;
        const desiredName = setGameChannelStatusName(game.channelName, appearance.emoji);
        const stableName = normalizeGameChannelName(game.channelName);
        const channel = guild.channels.cache.find(ch =>
            ch.type === ChannelType.GuildText && ch.name === desiredName
        ) || guild.channels.cache.find(ch =>
            ch.type === ChannelType.GuildText &&
            normalizeGameChannelName(ch.name) === stableName
        );
        if (!channel) continue;
        if (channel.name !== desiredName) await channel.setName(desiredName);
        gameChannels[key] = channel;
        await upsertBotMessage(channel, buildGamePayload(key, game, state));
    }
    const statusChannel = guild.channels.cache.find(ch => ch.name === '📊｜status');
    if (statusChannel) {
        await upsertBotMessage(statusChannel, buildStatusOverviewPayload(gameChannels, gameStatuses));
    }
}

async function syncServer(guild) {
    await guild.channels.fetch();
    const stats = { created: 0, updated: 0, rolesCreated: 0, rolesUpdated: 0 };

    const gameStatuses = await loadGameStatuses(guild.id);
    const roles = await syncRoles(guild, stats);

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
        const state = gameStatuses[key] || { status: 'online', note: '' };
        const appearance = GAME_STATUSES[state.status] || GAME_STATUSES.online;
        const channelName = setGameChannelStatusName(g.channelName, appearance.emoji);
        const ch = await ensureChannel(guild, channelName, ChannelType.GuildText, catShop.id, { readOnly: true, topic: g.topic }, stats);
        gameChannels[key] = ch;
        await upsertBotMessage(ch, buildGamePayload(key, g, state));
    }

    // 4) NOVEDADES · NEWS
    const catNews = await ensureCategory(guild, '📢 NOVEDADES · NEWS', null, stats);
    await ensureChannel(guild, '📢｜announcements', ChannelType.GuildText, catNews.id, { readOnly: true, topic: 'Anuncios oficiales de DrakoStore' }, stats);
    const chUpdates = await ensureChannel(guild, '🚀｜updates', ChannelType.GuildText, catNews.id, { readOnly: true, topic: 'Registro de actualizaciones y parches' }, stats);

    // 5) COMUNIDAD · COMMUNITY
    const catComm = await ensureCategory(guild, '💬 COMUNIDAD · COMMUNITY', null, stats);
    const chSupport = await ensureChannel(guild, '🎫｜support', ChannelType.GuildText, catComm.id, { readOnly: true, topic: 'Abre ticket de compra, soporte o reclama 1 día gratis' }, stats);
    await ensureChannel(guild, '💬｜general', ChannelType.GuildText, catComm.id, { topic: 'Chat general de la comunidad DrakoStore' }, stats);

    // 6) OWNER · STAFF PRIVADO
    const staffChannelPermissions = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels
    ];
    const staffOverwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...[roles.owner, roles.staff].filter(Boolean).map(role => ({
            id: role.id,
            allow: staffChannelPermissions
        })),
        { id: client.user.id, allow: staffChannelPermissions }
    ];
    const catStaff = await ensureCategory(
        guild,
        STAFF_CATEGORY_NAME,
        staffOverwrites,
        stats,
        ['🔒 STAFF']
    );
    await ensureChannel(guild, 'staff-aprobaciones', ChannelType.GuildText, catStaff.id, { topic: 'Panel privado para aprobar capturas de 1 día gratis' }, stats);
    await ensureChannel(guild, '🤖｜bot-commands', ChannelType.GuildText, catStaff.id, { topic: 'Comandos privados del bot: /update, /genkey y /setstatus' }, stats);
    await ensureChannel(guild, '🚀｜staff-updates', ChannelType.GuildText, catStaff.id, { topic: 'Registro interno de cambios y despliegues' }, stats);

    await disableThreadCreation(guild);

    // ==================== ACTUALIZAR PANELES PRINCIPALES (COMPONENTS V2 UNIFICADO) ====================

    // A) PANEL DE ESTADO EN VIVO
    await upsertBotMessage(chStatus, buildStatusOverviewPayload(gameChannels, gameStatuses));

    // B) HOW TO BUY
    const buyItems = [];
    if (HOW_TO_BUY_BANNER_URL) {
        buyItems.push({ type: 12, items: [{ media: { url: HOW_TO_BUY_BANNER_URL } }] });
        buyItems.push({ type: 14, divider: true, spacing: 1 });
    }
    buyItems.push(
        {
            type: 10,
            content:
                `### 💳 Cómo comprar · How to buy\n` +
                `Precios unificados para todos los juegos en Windows.`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 10,
            content:
                `**💰 Planes · Plans**\n` +
                `\`1 día  · day  \` **$1.50 USD**\n` +
                `\`7 días · days \` **$6 USD** ⭐\n` +
                `\`30 días · days\` **$12 USD**\n` +
                `\`90 días · days\` **$25 USD**`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 10,
            content:
                `**💳 Métodos aceptados:** Yape · Plin · Binance Pay (USDT) · PayPal\n` +
                `**📋 Paso a paso:** Entra al canal del juego o a ${chSupport}, abre tu ticket, envía el comprobante y recibe tu key al instante.`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: ButtonStyle.Success,
                    custom_id: 'open_buy_ticket',
                    label: 'Ticket de Compra',
                    emoji: { name: '🛒' }
                },
                {
                    type: 2,
                    style: ButtonStyle.Primary,
                    custom_id: 'open_trial_menu',
                    label: 'Pedir 1 Día Gratis',
                    emoji: { name: '🎁' }
                }
            ]
        },
        {
            type: 10,
            content: `-# ⚡ Entrega inmediata · 1 key = 1 PC · ${WEB_URL}`
        }
    );
    await upsertBotMessage(chBuy, {
        flags: IS_COMPONENTS_V2,
        components: [{ type: 17, accent_color: COLOR_GREEN, components: buyItems }]
    });

    // C) GUIDE (ESTILO ZONA CLIENTES VIP)
    const guideItems = [];
    if (GUIDE_BANNER_URL) {
        guideItems.push({ type: 12, items: [{ media: { url: GUIDE_BANNER_URL } }] });
        guideItems.push({ type: 14, divider: true, spacing: 1 });
    }
    guideItems.push(
        {
            type: 10,
            content:
                `### 📖 Zona Clientes — Guía de Inicio\n` +
                `Gracias por confiar en **DrakoStore**. Aquí tienes todo para empezar en Windows, sea cual sea tu producto.`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 10,
            content:
                `🔑 **1 · Recibe tu key y el programa**\n` +
                `Cuando confirmamos tu pago (o aprobamos tu prueba de 1 día gratis), el bot te envía tu **key por mensaje privado (DM)**.\n` +
                `• Mantén abiertos los mensajes directos del servidor.\n` +
                `• Los días cuentan desde que activas la key por primera vez.`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 10,
            content:
                `💻 **2 · Instalación en Windows (Internal y Kernel)**\n` +
                `1. Descarga el loader oficial desde el enlace de tu ticket.\n` +
                `2. Clic derecho → **Ejecutar como administrador**.\n` +
                `3. Pega tu key. El loader valida la licencia, se actualiza solo y en los **Kernel** carga el driver automáticamente.\n` +
                `4. Pon el juego en **Ventana sin bordes** y presiona **INSERT** para abrir o cerrar el menú.`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 10,
            content:
                `🔄 **Actualizaciones**\n` +
                `Los programas se actualizan solos al abrirlos. Revisa siempre ${chStatus} y las novedades en ${chUpdates}.\n\n` +
                `🛠️ **Si algo no anda**\n` +
                `• Abre siempre el loader como **Administrador**.\n` +
                `• Agrega la carpeta del programa como exclusión en Windows Defender.\n` +
                `• Usa el juego en Ventana o Ventana sin bordes para ver el menú.\n` +
                `• **Kernel:** si el driver no carga, reinicia tu PC e inténtalo de nuevo.\n\n` +
                `🔒 **Tu key es personal:** \`1 key = 1 PC\`. No la compartas. Si cambias de equipo, abre un ticket de soporte abajo.\n` +
                `⭐ Cuéntanos tu experiencia en ${chVouches}.`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: ButtonStyle.Secondary,
                    custom_id: 'open_support_ticket',
                    label: 'Ticket de Soporte',
                    emoji: { name: '🎫' }
                }
            ]
        },
        {
            type: 10,
            content: `-# DrakoStore • Customer Guide (Windows)`
        }
    );
    await upsertBotMessage(chGuide, {
        flags: IS_COMPONENTS_V2,
        components: [{ type: 17, accent_color: COLOR_GREEN, components: guideItems }]
    });

    // D) RULES
    const rulesItems = [];
    if (RULES_BANNER_URL) {
        rulesItems.push({ type: 12, items: [{ media: { url: RULES_BANNER_URL } }] });
        rulesItems.push({ type: 14, divider: true, spacing: 1 });
    }
    rulesItems.push(
        {
            type: 10,
            content: `### 📜 Reglas de DrakoStore`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 10,
            content:
                `1. **Respeto total** hacia miembros y staff.\n` +
                `2. **Prohibido enviar enlaces**, spam o publicidad externa.\n` +
                `3. La **prueba de 1 día gratis** es única por persona.\n` +
                `4. Todas las compras y soporte se atienden únicamente mediante **ticket**.`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 10,
            content: `-# El incumplimiento puede conllevar silencio o expulsión automática.`
        }
    );
    await upsertBotMessage(chRules, {
        flags: IS_COMPONENTS_V2,
        components: [{ type: 17, accent_color: COLOR_GREEN, components: rulesItems }]
    });

    // E) PANEL DE SOPORTE Y PRUEBA GRATIS
    const supportItems = [];
    if (BANNER_URL) {
        supportItems.push({ type: 12, items: [{ media: { url: BANNER_URL } }] });
        supportItems.push({ type: 14, divider: true, spacing: 1 });
    }
    supportItems.push(
        {
            type: 10,
            content:
                `### 🎫 Centro de Soporte, Compras y 1 Día Gratis\n` +
                `Selecciona el botón según lo que necesites y el bot creará tu canal privado al instante.`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 10,
            content:
                `🎁 **¿Quieres 1 Día Gratis?**\n` +
                `Presiona **Pedir 1 Día Gratis**, elige tu juego y sube tu captura siguiendo nuestras redes y dando like. Al aprobarse, **el bot te enviará la key por privado**.\n\n` +
                `🛒 **¿Listo para comprar?**\n` +
                `Presiona **Ticket de Compra** para pagar con Yape, Plin, Binance o PayPal.\n\n` +
                `🛠️ **¿Necesitas ayuda técnica?**\n` +
                `Presiona **Soporte Técnico** y un administrador te asistirá.`
        },
        { type: 14, divider: true, spacing: 1 },
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: ButtonStyle.Success,
                    custom_id: 'open_trial_menu',
                    label: 'Pedir 1 Día Gratis',
                    emoji: { name: '🎁' }
                },
                {
                    type: 2,
                    style: ButtonStyle.Primary,
                    custom_id: 'open_buy_ticket',
                    label: 'Ticket de Compra',
                    emoji: { name: '🛒' }
                },
                {
                    type: 2,
                    style: ButtonStyle.Secondary,
                    custom_id: 'open_support_ticket',
                    label: 'Soporte Técnico',
                    emoji: { name: '🛠️' }
                }
            ]
        },
        {
            type: 10,
            content: `-# DrakoStore • Soporte en línea 24/7 · ${WEB_URL}`
        }
    );
    await upsertBotMessage(chSupport, {
        flags: IS_COMPONENTS_V2,
        components: [{ type: 17, accent_color: COLOR_GREEN, components: supportItems }]
    });

    return stats;
}

client.login(process.env.DISCORD_TOKEN);
