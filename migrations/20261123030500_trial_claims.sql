create table if not exists public.trial_claims (
    id uuid primary key default gen_random_uuid(),
    guild_id text not null,
    discord_user_id text not null,
    game_key text not null check (game_key in ('free-fire', 'cs2', 'roblox', 'robrun', 'minecraft')),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
    ticket_channel_id text,
    evidence_url text,
    review_message_id text,
    license_id uuid references public.licenses(id),
    moderator_id text,
    rejection_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    approved_at timestamptz,
    rejected_at timestamptz
);

create unique index if not exists trial_claims_one_active_per_user
    on public.trial_claims (guild_id, discord_user_id)
    where status in ('pending', 'approved');

create unique index if not exists trial_claims_one_channel
    on public.trial_claims (ticket_channel_id)
    where ticket_channel_id is not null;

create index if not exists trial_claims_pending_by_channel
    on public.trial_claims (ticket_channel_id)
    where status = 'pending';

create index if not exists trial_claims_user_history
    on public.trial_claims (guild_id, discord_user_id, created_at desc);

alter table public.trial_claims enable row level security;

revoke all on table public.trial_claims from anon, authenticated;
grant select, insert, update on table public.trial_claims to service_role;

drop function if exists public.create_trial_claim(text, text, text);
create or replace function public.create_trial_claim(
    p_guild_id text,
    p_discord_user_id text,
    p_game_key text
)
returns table (
    claim_id uuid,
    claim_status text,
    claim_game_key text,
    existing_ticket_channel_id text,
    was_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_claim public.trial_claims%rowtype;
    v_inserted integer;
begin
    if p_guild_id is null or p_guild_id = '' then
        raise exception 'guild_id is required';
    end if;
    if p_discord_user_id is null or p_discord_user_id = '' then
        raise exception 'discord_user_id is required';
    end if;
    if p_game_key is null or p_game_key not in ('free-fire', 'cs2', 'roblox', 'robrun', 'minecraft') then
        raise exception 'invalid game_key';
    end if;

    insert into public.trial_claims (guild_id, discord_user_id, game_key)
    values (p_guild_id, p_discord_user_id, p_game_key)
    on conflict do nothing;

    get diagnostics v_inserted = row_count;

    select * into v_claim
    from public.trial_claims
    where guild_id = p_guild_id
      and discord_user_id = p_discord_user_id
      and status in ('pending', 'approved')
    order by created_at desc
    limit 1;

    if v_claim.id is null then
        raise exception 'could not create or find trial claim';
    end if;

    return query select
        v_claim.id,
        v_claim.status,
        v_claim.game_key,
        v_claim.ticket_channel_id,
        v_inserted = 1;
end;
$$;

grant execute on function public.create_trial_claim(text, text, text) to service_role;

drop function if exists public.approve_trial(uuid, text);
create or replace function public.approve_trial(
    p_claim_id uuid,
    p_moderator_id text
)
returns table (
    claim_id uuid,
    license_id uuid,
    license_key text,
    game_key text,
    discord_user_id text,
    result_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_claim public.trial_claims%rowtype;
    v_license public.licenses%rowtype;
    v_key text;
begin
    select * into v_claim
    from public.trial_claims
    where id = p_claim_id
    for update;

    if v_claim.id is null then
        raise exception 'trial claim not found';
    end if;

    if v_claim.status = 'approved' then
        select * into v_license from public.licenses where id = v_claim.license_id;
        return query select v_claim.id, v_license.id, v_license.key, v_claim.game_key,
            v_claim.discord_user_id, 'already_approved'::text;
        return;
    end if;

    if v_claim.status <> 'pending' then
        raise exception 'trial claim is not pending';
    end if;

    loop
        v_key := upper(v_claim.game_key) || '-' ||
            upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
            upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
            upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
        begin
            insert into public.licenses (key, game, duration_days, status, discord_user_id)
            values (v_key, v_claim.game_key, 1, 'active', v_claim.discord_user_id)
            returning * into v_license;
            exit;
        exception when unique_violation then
            -- Regenerar en la improbable colisión de una key.
        end;
    end loop;

    update public.trial_claims
    set status = 'approved',
        license_id = v_license.id,
        moderator_id = p_moderator_id,
        approved_at = now(),
        updated_at = now()
    where id = v_claim.id;

    return query select v_claim.id, v_license.id, v_license.key, v_claim.game_key,
        v_claim.discord_user_id, 'approved'::text;
end;
$$;

grant execute on function public.approve_trial(uuid, text) to service_role;
