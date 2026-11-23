drop function if exists public.revoke_license(text);
create or replace function public.revoke_license(p_key text)
returns table (license_id uuid, license_key text, game_key text, previous_status text, new_status text)
language plpgsql
security definer
set search_path = public
as $$
declare v_license public.licenses%rowtype;
begin
    select * into v_license
    from public.licenses
    where key = trim(p_key)
    for update;

    if v_license.id is null then
        raise exception 'license not found';
    end if;

    if v_license.status = 'banned' then
        return query select v_license.id, v_license.key, v_license.game, v_license.status, v_license.status;
        return;
    end if;

    update public.licenses
    set status = 'banned'
    where id = v_license.id
    returning * into v_license;

    return query select v_license.id, v_license.key, v_license.game, 'active'::text, v_license.status;
end;
$$;
grant execute on function public.revoke_license(text) to service_role;

drop function if exists public.extend_license(text, integer);
create or replace function public.extend_license(p_key text, p_days integer)
returns table (license_id uuid, license_key text, game_key text, added_days integer, total_duration_days integer, expires_at timestamptz, status text)
language plpgsql
security definer
set search_path = public
as $$
declare v_license public.licenses%rowtype;
begin
    if p_days is null or p_days < 1 or p_days > 3650 then
        raise exception 'days must be between 1 and 3650';
    end if;

    select * into v_license
    from public.licenses
    where key = trim(p_key)
    for update;

    if v_license.id is null then
        raise exception 'license not found';
    end if;
    if v_license.status = 'banned' then
        raise exception 'cannot extend a revoked license';
    end if;

    update public.licenses as l
    set duration_days = l.duration_days + p_days,
        expires_at = case
            when l.expires_at is null then null
            else greatest(l.expires_at, now()) + make_interval(days => p_days)
        end
    where l.id = v_license.id
    returning * into v_license;

    return query select v_license.id, v_license.key, v_license.game, p_days,
        v_license.duration_days, v_license.expires_at, v_license.status;
end;
$$;
grant execute on function public.extend_license(text, integer) to service_role;
