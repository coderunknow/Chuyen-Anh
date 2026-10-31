-- Chuyên Anh — rc8 telemetry rate-limit & client_key hardening migration.
-- Non-destructive upgrade on top of 20261029_telemetry_ingest.sql:
--   1. Rejects malformed non-null client_key values (must be a 32-hex HMAC digest).
--   2. Closes the null client_key per-client rate-limit bypass by bucketing
--      missing-IP calls under 'client:missing' with a strict cap (5 / 10 min)
--      instead of letting keyless callers consume the entire global 120 budget.
--   3. Re-asserts explicit search_path and least-privilege role grants.

create or replace function public.telemetry_ingest(payload jsonb, client_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = telemetry, public, pg_temp
as $$
declare
  v_window timestamptz := to_timestamp((floor(extract(epoch from now()) / 600) * 600)::double precision);
  per_client_limit constant integer := 10;
  missing_key_limit constant integer := 5;
  global_limit constant integer := 120;
  max_bytes constant integer := 16384;
  max_events constant integer := 50;
  v_bucket text;
  v_bucket_limit integer;
  v_client_hits integer;
  v_global_hits integer;
  v_purge_hits integer;
  v_stored_id uuid;
  v_app_version text;
  v_environment jsonb;
  v_events jsonb;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    return jsonb_build_object('status', 'invalid', 'reason', 'payload-not-object');
  end if;

  if octet_length(payload::text) > max_bytes then
    return jsonb_build_object('status', 'invalid', 'reason', 'payload-too-large');
  end if;

  if coalesce(payload ->> 'contract', '') <> '1' then
    return jsonb_build_object('status', 'invalid', 'reason', 'unsupported-contract');
  end if;

  v_app_version := payload ->> 'appVersion';
  if v_app_version is null or length(v_app_version) > 40 or v_app_version !~ '^v[0-9]+\.[0-9]+\.[0-9]+(-[a-z]+[0-9]+)?$' then
    return jsonb_build_object('status', 'invalid', 'reason', 'bad-app-version');
  end if;

  v_events := payload -> 'events';
  if v_events is null or jsonb_typeof(v_events) <> 'array' then
    return jsonb_build_object('status', 'invalid', 'reason', 'events-not-array');
  end if;
  if jsonb_array_length(v_events) > max_events then
    return jsonb_build_object('status', 'invalid', 'reason', 'too-many-events');
  end if;

  if client_key is not null and client_key !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('status', 'invalid', 'reason', 'invalid-client-key');
  end if;

  v_environment := payload -> 'environment';
  if v_environment is null or jsonb_typeof(v_environment) <> 'object' then
    v_environment := '{}'::jsonb;
  end if;

  -- Global budget first: a flood is refused before it can consume a client slot.
  insert into telemetry.rate_limits (bucket, window_start, hits)
  values ('global', v_window, 1)
  on conflict (bucket, window_start) do update set hits = telemetry.rate_limits.hits + 1
  returning hits into v_global_hits;
  if v_global_hits > global_limit then
    return jsonb_build_object('status', 'rate_limited', 'scope', 'global');
  end if;

  -- Every request is subject to a per-bucket limit even if upstream had no peer IP.
  if client_key is null then
    v_bucket := 'client:missing';
    v_bucket_limit := missing_key_limit;
  else
    v_bucket := 'client:' || client_key;
    v_bucket_limit := per_client_limit;
  end if;

  insert into telemetry.rate_limits (bucket, window_start, hits)
  values (v_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = telemetry.rate_limits.hits + 1
  returning hits into v_client_hits;
  if v_client_hits > v_bucket_limit then
    return jsonb_build_object('status', 'rate_limited', 'scope', 'client');
  end if;

  insert into telemetry.reports (product, contract, app_version, event_count, events, environment)
  values (
    coalesce(nullif(left(payload ->> 'product', 40), ''), 'Chuyen-Anh'),
    1,
    v_app_version,
    jsonb_array_length(v_events),
    v_events,
    v_environment
  )
  returning id into v_stored_id;

  insert into telemetry.rate_limits (bucket, window_start, hits)
  values ('purge', to_timestamp((floor(extract(epoch from now()) / 3600) * 3600)::double precision), 1)
  on conflict (bucket, window_start) do update set hits = telemetry.rate_limits.hits + 1
  returning hits into v_purge_hits;
  if v_purge_hits = 1 then
    perform telemetry.purge_expired();
  end if;

  return jsonb_build_object('status', 'ok', 'id', v_stored_id);
exception
  when others then
    return jsonb_build_object('status', 'invalid', 'reason', 'rejected');
end
$$;

revoke all on function public.telemetry_ingest(jsonb, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.telemetry_ingest(jsonb, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.telemetry_ingest(jsonb, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.telemetry_ingest(jsonb, text) to service_role';
  end if;
end
$$;
