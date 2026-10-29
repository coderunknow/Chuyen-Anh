-- rc5: remote diagnostics storage for the Chuyên Anh standalone app.
--
-- Architecture: index.html (GitHub Pages) → Vercel function `api/telemetry.js`
-- → this schema through the single SECURITY DEFINER entry point
-- `public.telemetry_ingest(jsonb, text)`.
--
-- Why this shape:
--   * The tables live in the `telemetry` schema, which is NOT one of the schemas
--     PostgREST exposes (`public`, `graphql_public`). A browser can therefore not
--     address them at all.
--   * RLS is enabled and no policy is defined, so even a direct PostgREST request
--     from an `anon`/`authenticated` session is denied even if a grant were
--     reintroduced by accident.
--   * The only public-schema object is one function, executable by `service_role`
--     only. It validates the payload again, enforces two rate limits in the same
--     transaction as the insert, and deletes expired rows on a schedule it keeps
--     itself.
--
-- Retention: every row carries `retention_expires_at` (90 days) and the ingest
-- function purges expired rows at most once an hour; `telemetry.purge_expired()`
-- is exposed for a maintainer to call directly from the SQL editor.
--
-- Reproducible: `python -m unittest tests.test_telemetry_api` reads this file and
-- asserts the security invariants below, and the deployed project was migrated
-- with exactly this text.

create schema if not exists telemetry;

do $$
begin
  execute 'revoke all on schema telemetry from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema telemetry from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema telemetry from authenticated';
  end if;
end
$$;

create table if not exists telemetry.reports (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  product text not null,
  contract integer not null,
  app_version text not null,
  event_count integer not null,
  events jsonb not null,
  environment jsonb not null default '{}'::jsonb,
  retention_expires_at timestamptz not null default now() + interval '90 days'
);

-- One row per rate-limit bucket and fixed window. Kept in this schema for the
-- same reason as the reports: no browser role can reach it.
create table if not exists telemetry.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists reports_retention_idx on telemetry.reports (retention_expires_at);
create index if not exists rate_limits_window_idx on telemetry.rate_limits (window_start);

alter table telemetry.reports enable row level security;
alter table telemetry.rate_limits enable row level security;
-- No policies on purpose: the only writer is the SECURITY DEFINER function below,
-- and it runs as the function owner, so RLS never blocks repository maintenance.

do $$
begin
  execute 'revoke all on telemetry.reports from public';
  execute 'revoke all on telemetry.rate_limits from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on telemetry.reports from anon';
    execute 'revoke all on telemetry.rate_limits from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on telemetry.reports from authenticated';
    execute 'revoke all on telemetry.rate_limits from authenticated';
  end if;
end
$$;

-- Deletes reports past their retention date (and stale rate-limit windows).
-- Returns the number of reports removed. Safe to call by hand at any time.
create or replace function telemetry.purge_expired()
returns integer
language plpgsql
security definer
set search_path = telemetry, pg_temp
as $$
declare
  removed integer;
begin
  delete from telemetry.reports where retention_expires_at < now();
  get diagnostics removed = row_count;
  delete from telemetry.rate_limits where window_start < now() - interval '2 days';
  return removed;
end
$$;

revoke all on function telemetry.purge_expired() from public;

-- The single entry point. Validation here is deliberately redundant with the
-- Vercel function: the function is reachable with the service key, and a bug in
-- the caller must not be able to store an unbounded or malformed row.
create or replace function public.telemetry_ingest(payload jsonb, client_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = telemetry, public, pg_temp
as $$
declare
  v_window timestamptz := to_timestamp((floor(extract(epoch from now()) / 600) * 600)::double precision);
  per_client_limit constant integer := 10;
  global_limit constant integer := 120;
  max_bytes constant integer := 16384;
  max_events constant integer := 50;
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

  if client_key is not null and length(client_key) between 8 and 64 then
    insert into telemetry.rate_limits (bucket, window_start, hits)
    values ('client:' || client_key, v_window, 1)
    on conflict (bucket, window_start) do update set hits = telemetry.rate_limits.hits + 1
    returning hits into v_client_hits;
    if v_client_hits > per_client_limit then
      return jsonb_build_object('status', 'rate_limited', 'scope', 'client');
    end if;
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

  -- Retention is enforced by writes, not by hope: at most one purge per hour,
  -- claimed through the same rate-limit table so concurrent ingests do not all
  -- scan the report table.
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
    -- Never echo the payload or the SQL error text: it can quote stored values.
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
