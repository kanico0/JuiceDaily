-- ─────────────────────────────────────────────────────────────
-- 0001_monetization.sql — Subscriptions + server-authoritative
-- scan quota schema for Juicing Daily.
--
-- Design:
--   * RLS: users may SELECT their own rows only. All writes go
--     through SECURITY DEFINER functions called by Edge Functions
--     (service role); clients can never mutate quota directly.
--   * Quota windows advance lazily using the server clock.
--   * Reservation → commit/release accounting prevents double
--     spends from retries, double taps, and concurrent requests.
-- ─────────────────────────────────────────────────────────────

-- ── Subscriptions (authorization cache / audit record) ───────

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

create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ── Scan quotas ──────────────────────────────────────────────

create table if not exists public.scan_quotas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  period_start timestamptz not null default now(),
  period_end timestamptz not null default now() + interval '1 month',
  scan_limit integer not null default 5,
  used integer not null default 0,
  reserved integer not null default 0,
  daily_used integer not null default 0,
  daily_period_start date not null default current_date,
  anchor_day integer,
  updated_at timestamptz not null default now()
);

alter table public.scan_quotas enable row level security;

create policy "scan_quotas_select_own"
  on public.scan_quotas for select
  using (auth.uid() = user_id);

-- ── Scan usage events (reservation ledger) ───────────────────

create table if not exists public.scan_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  image_hash text,
  plan_at_time_of_scan text not null check (plan_at_time_of_scan in ('free', 'pro')),
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released', 'failed')),
  quota_period_start timestamptz not null,
  provider text,
  estimated_provider_cost numeric,
  failure_category text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, request_id)
);

alter table public.scan_usage_events enable row level security;

create policy "scan_usage_events_select_own"
  on public.scan_usage_events for select
  using (auth.uid() = user_id);

create index if not exists scan_usage_events_user_created
  on public.scan_usage_events (user_id, created_at desc);

-- ── RevenueCat webhook events (idempotency ledger) ───────────

create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  event_type text not null,
  app_user_id text,
  environment text,
  payload jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.revenuecat_webhook_events enable row level security;
-- No client policies: service role only.

-- ─────────────────────────────────────────────────────────────
-- Quota functions (SECURITY DEFINER, service-role only)
-- ─────────────────────────────────────────────────────────────

-- Quota limits: keep configurable server-side.
create or replace function public._quota_limit_for_plan (p_plan text)
returns integer
language sql immutable
as $$
  select case when p_plan = 'pro' then 60 else 5 end
$$;

create or replace function public._pro_daily_limit ()
returns integer
language sql immutable
as $$
  select 10
$$;

-- Lazily advance an expired quota window using the server clock.
-- Also refreshes the plan from the subscriptions cache.
create or replace function public.resolve_quota (p_user_id uuid)
returns public.scan_quotas
language plpgsql security definer
set search_path = public
as $$
declare
  q public.scan_quotas;
  v_plan text;
begin
  select case when s.is_active then 'pro' else 'free' end
    into v_plan
    from public.subscriptions s
   where s.user_id = p_user_id;
  if v_plan is null then v_plan := 'free'; end if;

  insert into public.scan_quotas (user_id, plan, scan_limit)
  values (p_user_id, v_plan, public._quota_limit_for_plan(v_plan))
  on conflict (user_id) do nothing;

  select * into q from public.scan_quotas where user_id = p_user_id for update;

  -- Plan change (upgrade keeps used scans; limit changes in place).
  if q.plan is distinct from v_plan then
    q.plan := v_plan;
    q.scan_limit := public._quota_limit_for_plan(v_plan);
  end if;

  -- Advance the monthly window while it is expired (server clock).
  while q.period_end <= now() loop
    q.period_start := q.period_end;
    q.period_end := q.period_end + interval '1 month';
    q.used := 0;
    q.reserved := 0;
  end loop;

  -- Advance the daily window.
  if q.daily_period_start < current_date then
    q.daily_period_start := current_date;
    q.daily_used := 0;
  end if;

  update public.scan_quotas
     set plan = q.plan,
         scan_limit = q.scan_limit,
         period_start = q.period_start,
         period_end = q.period_end,
         used = q.used,
         reserved = q.reserved,
         daily_used = q.daily_used,
         daily_period_start = q.daily_period_start,
         updated_at = now()
   where user_id = p_user_id;

  select * into q from public.scan_quotas where user_id = p_user_id;
  return q;
end;
$$;

-- Atomically reserve one scan. Idempotent per (user, request_id).
-- Returns json { ok, code, quota }.
create or replace function public.reserve_scan (
  p_user_id uuid,
  p_request_id text,
  p_image_hash text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  q public.scan_quotas;
  existing public.scan_usage_events;
begin
  -- Idempotency: replaying the same request never spends twice.
  select * into existing
    from public.scan_usage_events
   where user_id = p_user_id and request_id = p_request_id;
  if found then
    q := public.resolve_quota(p_user_id);
    return jsonb_build_object('ok', existing.status in ('reserved', 'committed'),
                              'code', 'duplicate_request',
                              'quota', to_jsonb(q));
  end if;

  q := public.resolve_quota(p_user_id);

  -- Lock the row for the atomic check-and-reserve.
  select * into q from public.scan_quotas where user_id = p_user_id for update;

  if q.used + q.reserved >= q.scan_limit then
    return jsonb_build_object('ok', false, 'code', 'monthly_limit_reached', 'quota', to_jsonb(q));
  end if;

  if q.plan = 'pro' and q.daily_used >= public._pro_daily_limit() then
    return jsonb_build_object('ok', false, 'code', 'daily_limit_reached', 'quota', to_jsonb(q));
  end if;

  update public.scan_quotas
     set reserved = reserved + 1, updated_at = now()
   where user_id = p_user_id;

  insert into public.scan_usage_events
    (request_id, user_id, image_hash, plan_at_time_of_scan, status, quota_period_start, provider)
  values
    (p_request_id, p_user_id, p_image_hash, q.plan, 'reserved', q.period_start, 'anthropic');

  select * into q from public.scan_quotas where user_id = p_user_id;
  return jsonb_build_object('ok', true, 'code', 'reserved', 'quota', to_jsonb(q));
end;
$$;

-- Commit a completed scan (usable result returned to the user).
create or replace function public.commit_scan (
  p_user_id uuid,
  p_request_id text,
  p_estimated_cost numeric default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  q public.scan_quotas;
  ev public.scan_usage_events;
begin
  select * into ev
    from public.scan_usage_events
   where user_id = p_user_id and request_id = p_request_id
   for update;

  if not found or ev.status <> 'reserved' then
    q := public.resolve_quota(p_user_id);
    return jsonb_build_object('ok', ev.status = 'committed', 'code', 'not_reserved', 'quota', to_jsonb(q));
  end if;

  update public.scan_usage_events
     set status = 'committed',
         estimated_provider_cost = p_estimated_cost,
         completed_at = now()
   where id = ev.id;

  update public.scan_quotas
     set used = used + 1,
         reserved = greatest(0, reserved - 1),
         daily_used = daily_used + 1,
         updated_at = now()
   where user_id = p_user_id;

  select * into q from public.scan_quotas where user_id = p_user_id;
  return jsonb_build_object('ok', true, 'code', 'committed', 'quota', to_jsonb(q));
end;
$$;

-- Release a reservation after a technical failure (no credit spent).
create or replace function public.release_scan (
  p_user_id uuid,
  p_request_id text,
  p_failure_category text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  q public.scan_quotas;
  ev public.scan_usage_events;
begin
  select * into ev
    from public.scan_usage_events
   where user_id = p_user_id and request_id = p_request_id
   for update;

  if not found or ev.status <> 'reserved' then
    q := public.resolve_quota(p_user_id);
    return jsonb_build_object('ok', false, 'code', 'not_reserved', 'quota', to_jsonb(q));
  end if;

  update public.scan_usage_events
     set status = 'released',
         failure_category = p_failure_category,
         completed_at = now()
   where id = ev.id;

  update public.scan_quotas
     set reserved = greatest(0, reserved - 1),
         updated_at = now()
   where user_id = p_user_id;

  select * into q from public.scan_quotas where user_id = p_user_id;
  return jsonb_build_object('ok', true, 'code', 'released', 'quota', to_jsonb(q));
end;
$$;

-- Lock down function execution: service role only.
revoke execute on function public.resolve_quota (uuid) from public, anon, authenticated;
revoke execute on function public.reserve_scan (uuid, text, text) from public, anon, authenticated;
revoke execute on function public.commit_scan (uuid, text, numeric) from public, anon, authenticated;
revoke execute on function public.release_scan (uuid, text, text) from public, anon, authenticated;
