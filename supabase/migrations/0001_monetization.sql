-- ─────────────────────────────────────────────────────────────
-- 0001_monetization.sql — Juicing Daily monetization schema
--
-- Tables:
--   subscriptions              — server authorization cache / audit
--   scan_quotas                — server-authoritative quota windows
--   scan_usage_events          — reservation/commit audit trail
--   revenuecat_webhook_events  — webhook idempotency ledger
--
-- Security model:
--   - RLS enabled on all tables.
--   - Users may SELECT their own subscription + quota rows (display).
--   - ALL writes happen through Edge Functions using the service
--     role key, or SECURITY DEFINER functions. Clients can never
--     write quota or subscription state.
-- ─────────────────────────────────────────────────────────────

-- ── subscriptions ────────────────────────────────────────────

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entitlement text not null default 'pro',
  is_active boolean not null default false,
  store text check (store in ('app_store', 'play_store', 'promotional')),
  plan text check (plan in ('pro_monthly', 'pro_annual')),
  product_id text,
  original_transaction_id text,
  purchase_date timestamptz,
  expiration_date timestamptz,
  will_renew boolean,
  billing_issue_detected_at timestamptz,
  environment text not null default 'production' check (environment in ('sandbox', 'production')),
  last_revenuecat_event_id text,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);
-- No insert/update/delete policies: writes only via service role.

-- ── scan_quotas ──────────────────────────────────────────────

create table if not exists public.scan_quotas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  scan_limit integer not null default 5,
  used integer not null default 0 check (used >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  daily_used integer not null default 0 check (daily_used >= 0),
  daily_period_start date not null default (now() at time zone 'utc')::date,
  anchor_day integer check (anchor_day between 1 and 31),
  updated_at timestamptz not null default now()
);
alter table public.scan_quotas enable row level security;
drop policy if exists "scan_quotas_select_own" on public.scan_quotas;
create policy "scan_quotas_select_own"
  on public.scan_quotas for select
  using (auth.uid() = user_id);
-- ── scan_usage_events ────────────────────────────────────────

create table if not exists public.scan_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  image_hash text,
  plan_at_time_of_scan text not null check (plan_at_time_of_scan in ('free', 'pro')),
  status text not null check (status in ('reserved', 'committed', 'released', 'failed')),
  quota_period_start timestamptz not null,
  provider text,
  estimated_provider_cost numeric(10, 6),
  failure_category text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, request_id)
);
create index if not exists scan_usage_events_user_created_idx
  on public.scan_usage_events (user_id, created_at desc);
alter table public.scan_usage_events enable row level security;
drop policy if exists "scan_usage_events_select_own" on public.scan_usage_events;
create policy "scan_usage_events_select_own"
  on public.scan_usage_events for select
  using (auth.uid() = user_id);
-- ── revenuecat_webhook_events (idempotency ledger) ───────────

create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  event_type text not null,
  app_user_id text,
  environment text,
  processed_at timestamptz not null default now(),
  status text not null default 'processed' check (status in ('processed', 'skipped', 'failed')),
  detail text
);
alter table public.revenuecat_webhook_events enable row level security;
-- No policies: service role only.

-- ─────────────────────────────────────────────────────────────
-- Quota logic (server-side, atomic).
-- Config is centralized here; change limits without app release.
-- ─────────────────────────────────────────────────────────────

create or replace function public.quota_limits ()
returns table (free_limit integer, pro_limit integer, pro_daily_limit integer)
language sql immutable as $$
  select 5, 60, 10
$$;
-- Advances a window start forward one month at a time until it
-- contains `now()`. Clamps end-of-month anchors (e.g. Jan 31 → Feb 28).
create or replace function public.advance_window (
  p_start timestamptz,
  p_anchor_day integer
) returns timestamptz
language plpgsql immutable as $$
declare
  v_start timestamptz := p_start;
  v_next timestamptz;
begin
  loop
    v_next := (date_trunc('month', v_start) + interval '1 month')
      + make_interval(days => least(
          coalesce(p_anchor_day, extract(day from v_start)::int),
          extract(day from (date_trunc('month', v_start) + interval '2 month' - interval '1 day'))::int
        ) - 1)
      + (v_start - date_trunc('day', v_start));
    exit when v_next > now();
    v_start := v_next;
  end loop;
  return v_start;
end;
$$;
-- Resolves (creating or lazily advancing) the caller's quota row and
-- returns the current state. SECURITY DEFINER so RLS does not block
-- the upsert; user identity comes from the argument set by the
-- calling Edge Function (service role) — never from client input.
create or replace function public.resolve_quota (p_user_id uuid)
returns public.scan_quotas
language plpgsql security definer set search_path = public as $$
declare
  q public.scan_quotas;
  sub public.subscriptions;
  v_is_pro boolean := false;
  v_limits record;
  v_anchor timestamptz;
begin
  select * into v_limits from public.quota_limits();

  select * into sub from public.subscriptions where user_id = p_user_id;
  if found and sub.is_active
     and (sub.expiration_date is null or sub.expiration_date > now()) then
    v_is_pro := true;
  end if;

  select * into q from public.scan_quotas where user_id = p_user_id for update;

  if not found then
    -- First activation: anchor Free window to first quota activation.
    v_anchor := now();
    insert into public.scan_quotas (
      user_id, plan, period_start, period_end, scan_limit,
      anchor_day, daily_period_start
    ) values (
      p_user_id,
      case when v_is_pro then 'pro' else 'free' end,
      v_anchor,
      v_anchor + interval '1 month',
      case when v_is_pro then v_limits.pro_limit else v_limits.free_limit end,
      extract(day from v_anchor)::int,
      (now() at time zone 'utc')::date
    ) returning * into q;
    return q;
  end if;

  -- Lazily advance expired monthly windows (server clock only).
  if q.period_end <= now() then
    q.period_start := public.advance_window(q.period_start, q.anchor_day);
    q.period_end := q.period_start + interval '1 month';
    q.used := 0;
    q.reserved := 0;
  end if;

  -- Advance the daily window.
  if q.daily_period_start <> (now() at time zone 'utc')::date then
    q.daily_period_start := (now() at time zone 'utc')::date;
    q.daily_used := 0;
  end if;

  -- Plan transitions: change LIMIT mid-window, preserve `used`
  -- (upgrade: 1 used of 1 → 11 remaining of 12; downgrade: used>=1 → 0 free left).
  -- Limits are read from quota_limits() — see 0013_quota_1_12.sql for current values.
  if v_is_pro and q.plan = 'free' then
    q.plan := 'pro';
    q.scan_limit := v_limits.pro_limit;
  elsif not v_is_pro and q.plan = 'pro' then
    q.plan := 'free';
    q.scan_limit := v_limits.free_limit;
  end if;

  update public.scan_quotas set
    plan = q.plan,
    period_start = q.period_start,
    period_end = q.period_end,
    scan_limit = q.scan_limit,
    used = q.used,
    reserved = q.reserved,
    daily_used = q.daily_used,
    daily_period_start = q.daily_period_start,
    updated_at = now()
  where user_id = p_user_id
  returning * into q;

  return q;
end;
$$;
-- Atomically reserve one scan. Returns the usage-event row on
-- success; raises on quota exhaustion. Idempotent per request_id.
create or replace function public.reserve_scan (
  p_user_id uuid,
  p_request_id text,
  p_image_hash text default null
) returns public.scan_usage_events
language plpgsql security definer set search_path = public as $$
declare
  q public.scan_quotas;
  ev public.scan_usage_events;
  v_limits record;
begin
  select * into v_limits from public.quota_limits();

  -- Idempotency: same request replayed → return existing event, no new spend.
  select * into ev from public.scan_usage_events
    where user_id = p_user_id and request_id = p_request_id;
  if found then
    return ev;
  end if;

  q := public.resolve_quota(p_user_id);

  -- Lock the row for the atomic check-and-reserve.
  select * into q from public.scan_quotas where user_id = p_user_id for update;

  if q.used + q.reserved >= q.scan_limit then
    raise exception 'QUOTA_MONTHLY_EXCEEDED';
  end if;

  if q.plan = 'pro' and q.daily_used >= v_limits.pro_daily_limit then
    raise exception 'QUOTA_DAILY_EXCEEDED';
  end if;

  update public.scan_quotas
    set reserved = reserved + 1, updated_at = now()
    where user_id = p_user_id;

  insert into public.scan_usage_events (
    request_id, user_id, image_hash, plan_at_time_of_scan,
    status, quota_period_start, provider
  ) values (
    p_request_id, p_user_id, p_image_hash, q.plan,
    'reserved', q.period_start, 'anthropic'
  ) returning * into ev;

  return ev;
end;
$$;
-- Commit a completed, usable scan (counts against quota).
create or replace function public.commit_scan (
  p_user_id uuid,
  p_request_id text,
  p_estimated_cost numeric default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  ev public.scan_usage_events;
begin
  select * into ev from public.scan_usage_events
    where user_id = p_user_id and request_id = p_request_id for update;

  if not found or ev.status <> 'reserved' then
    return; -- already committed/released → idempotent no-op
  end if;

  update public.scan_usage_events
    set status = 'committed', completed_at = now(),
        estimated_provider_cost = p_estimated_cost
    where id = ev.id;

  update public.scan_quotas
    set used = used + 1,
        reserved = greatest(0, reserved - 1),
        daily_used = daily_used + 1,
        updated_at = now()
    where user_id = p_user_id;
end;
$$;
-- Release a reservation after a technical failure (no quota consumed).
create or replace function public.release_scan (
  p_user_id uuid,
  p_request_id text,
  p_failure_category text default 'technical_failure'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  ev public.scan_usage_events;
begin
  select * into ev from public.scan_usage_events
    where user_id = p_user_id and request_id = p_request_id for update;

  if not found or ev.status <> 'reserved' then
    return; -- idempotent no-op
  end if;

  update public.scan_usage_events
    set status = 'released', completed_at = now(),
        failure_category = p_failure_category
    where id = ev.id;

  update public.scan_quotas
    set reserved = greatest(0, reserved - 1), updated_at = now()
    where user_id = p_user_id;
end;
$$;
-- Lock down function execution: only the service role may call these.
revoke execute on function public.resolve_quota (uuid) from public, anon, authenticated;
revoke execute on function public.reserve_scan (uuid, text, text) from public, anon, authenticated;
revoke execute on function public.commit_scan (uuid, text, numeric) from public, anon, authenticated;
revoke execute on function public.release_scan (uuid, text, text) from public, anon, authenticated;
