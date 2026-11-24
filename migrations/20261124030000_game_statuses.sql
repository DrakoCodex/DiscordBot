create table if not exists public.game_statuses (
    guild_id text not null,
    game_key text not null check (game_key = any (array['free-fire', 'cs2', 'roblox', 'robrun', 'minecraft']::text[])),
    status text not null default 'online' check (status = any (array['online', 'maintenance', 'outdated']::text[])),
    note text not null default '' check (char_length(note) <= 200),
    updated_by text not null,
    updated_at timestamptz not null default now(),
    primary key (guild_id, game_key)
);

alter table public.game_statuses enable row level security;
revoke all on table public.game_statuses from anon, authenticated;
grant select, insert, update, delete on table public.game_statuses to service_role;
