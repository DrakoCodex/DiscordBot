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
    v_prefix text;
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

    v_prefix := case v_claim.game_key
        when 'free-fire' then 'FF'
        when 'cs2' then 'CS2'
        when 'roblox' then 'RBX'
        when 'robrun' then 'RR'
        when 'minecraft' then 'MC'
        else null
    end;
    if v_prefix is null then
        raise exception 'unsupported game key: %', v_claim.game_key;
    end if;

    loop
        v_key := v_prefix || '-' ||
            upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
            upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
            upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
        begin
            insert into public.licenses (key, game, duration_days, status, discord_user_id)
            values (v_key, v_claim.game_key, 1, 'active', v_claim.discord_user_id)
            returning * into v_license;
            exit;
        exception when unique_violation then
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
