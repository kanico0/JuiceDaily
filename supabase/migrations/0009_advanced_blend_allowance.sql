-- ─────────────────────────────────────────────────────────────
-- 0009_advanced_blend_allowance.sql — Freemium Advanced Blend
-- analysis allowance for Juicing Daily.
--
-- Design:
--   * Simple Blends (1–4 distinct canonical ingredients): always
--     free, unlimited, no consumption.
--   * Advanced Blends (5+ distinct canonical ingredients): free
--     users get 3 lifetime complimentary analyses; Pro users
--     unlimited.
--   * Reservation → finalize/release pattern: allowance is
--     reserved before nutrition calculation, finalized on
--     success, or released on failure/cancel. This prevents
--     consumption when the calculation fails and prevents
--     double-spends from concurrent requests.
--   * Server-authoritative Pro check: reads subscriptions table
--     (kept in sync by RevenueCat webhook). Client RevenueCat
--     state is advisory only.
--   * Canonical ingredient validation: the server receives the
--     full ingredient ID list, validates each against a known
--     produce registry, lowercases, deduplicates, and counts
--     distinct valid IDs. The client cannot lie about blend size.
--   * RLS: users may SELECT their own rows only. All writes go
--     through SECURITY DEFINER functions called by Edge Functions
--     (service role); clients can never mutate allowance directly.
--   * Idempotency: unique(user_id, request_id) on usage events
--     prevents double-spends from retries and concurrent requests.
--   * Race protection: SELECT ... FOR UPDATE row lock on allowance.
--   * Subscription expiration: when a Pro subscription expires,
--     the allowance count is preserved (free tier resumes with
--     whatever complimentary analyses remain).
-- ─────────────────────────────────────────────────────────────

-- ── Advanced Blend allowance (lifetime, per-user) ───────────

create table if not exists public.advanced_blend_allowance (
  user_id uuid primary key references auth.users (id) on delete cascade,
  used integer not null default 0,
  reserved integer not null default 0,
  allowance_limit integer not null default 3,
  updated_at timestamptz not null default now()
);

alter table public.advanced_blend_allowance enable row level security;

create policy "advanced_blend_allowance_select_own"
  on public.advanced_blend_allowance for select
  using (auth.uid() = user_id);

-- ── Advanced Blend usage events (idempotency ledger) ────────
-- Tracks every reservation, finalization, and release.

create table if not exists public.advanced_blend_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  canonical_ingredient_ids text[] not null default '{}',
  ingredient_count integer not null,
  blend_type text not null check (blend_type in ('simple', 'advanced')),
  plan_at_time text not null check (plan_at_time in ('free', 'pro')),
  status text not null default 'reserved'
    check (status in ('reserved', 'finalized', 'released')),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (user_id, request_id)
);

alter table public.advanced_blend_usage_events enable row level security;

create policy "advanced_blend_usage_events_select_own"
  on public.advanced_blend_usage_events for select
  using (auth.uid() = user_id);

create index if not exists advanced_blend_usage_events_user_created
  on public.advanced_blend_usage_events (user_id, created_at desc);

create index if not exists advanced_blend_usage_events_status
  on public.advanced_blend_usage_events (user_id, status);

-- ─────────────────────────────────────────────────────────────
-- Helper: resolve plan from subscriptions table (server-authoritative)
-- ─────────────────────────────────────────────────────────────

create or replace function public._resolve_blend_plan (
  p_user_id uuid
)
returns text
language sql security definer
set search_path = public
as $$
  select case when s.is_active then 'pro' else 'free' end
    from public.subscriptions s
   where s.user_id = p_user_id
   limit 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- Helper: resolve or create the allowance row for a user.
-- ─────────────────────────────────────────────────────────────

create or replace function public.resolve_advanced_blend_allowance (
  p_user_id uuid
)
returns public.advanced_blend_allowance
language plpgsql security definer
set search_path = public
as $$
declare
  a public.advanced_blend_allowance;
begin
  insert into public.advanced_blend_allowance (user_id, used, reserved, allowance_limit)
  values (p_user_id, 0, 0, 3)
  on conflict (user_id) do nothing;

  select * into a from public.advanced_blend_allowance where user_id = p_user_id;
  return a;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Reserve an Advanced Blend allowance.
--
-- Atomically increments `reserved` on the allowance row (with
-- FOR UPDATE lock) only if used + reserved < allowance_limit.
-- Creates a usage event with status='reserved'.
--
-- Idempotent: if the same (user_id, request_id) already exists,
-- returns the existing reservation status without re-reserving.
--
-- For Simple Blends: no reservation needed, returns immediately.
-- For Pro users: no allowance consumption, returns immediately.
--
-- Parameters:
--   p_user_id        — authenticated user UUID
--   p_request_id     — stable client-generated ID (hash of canonical ingredient set)
--   p_canonical_ids  — server-validated, lowercased, deduplicated ingredient IDs
--   p_ingredient_count — count of p_canonical_ids (server-computed)
--
-- Returns jsonb: { ok, code, allowed, remaining, used, reserved, limit, plan, blend_type, request_id }
-- ─────────────────────────────────────────────────────────────

create or replace function public.reserve_advanced_blend (
  p_user_id uuid,
  p_request_id text,
  p_canonical_ids text[],
  p_ingredient_count integer
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  a public.advanced_blend_allowance;
  existing public.advanced_blend_usage_events;
  v_plan text;
  v_blend_type text;
  v_remaining integer;
begin
  -- ── Idempotency: same request_id already processed?
  select * into existing
    from public.advanced_blend_usage_events
   where user_id = p_user_id and request_id = p_request_id;
  if found then
    a := public.resolve_advanced_blend_allowance(p_user_id);
    v_remaining := a.allowance_limit - a.used;
    v_plan := public._resolve_blend_plan(p_user_id);
    if v_plan is null then v_plan := 'free'; end if;

    -- If previously finalized, return success (re-opening is free).
    -- If previously reserved, return the reservation (still holds the unit).
    -- If previously released, treat as a new request (re-reserve).
    if existing.status = 'finalized' then
      return jsonb_build_object(
        'ok', true,
        'code', 'already_finalized',
        'allowed', true,
        'remaining', v_remaining,
        'used', a.used,
        'reserved', a.reserved,
        'limit', a.allowance_limit,
        'plan', v_plan,
        'blend_type', existing.blend_type,
        'request_id', p_request_id
      );
    end if;

    if existing.status = 'reserved' then
      return jsonb_build_object(
        'ok', true,
        'code', 'already_reserved',
        'allowed', true,
        'remaining', v_remaining,
        'used', a.used,
        'reserved', a.reserved,
        'limit', a.allowance_limit,
        'plan', v_plan,
        'blend_type', existing.blend_type,
        'request_id', p_request_id
      );
    end if;

    -- status = 'released' → fall through to re-reserve
  end if;

  -- ── Determine plan from subscriptions table (server-authoritative).
  v_plan := public._resolve_blend_plan(p_user_id);
  if v_plan is null then v_plan := 'free'; end if;

  -- ── Determine blend type from server-validated ingredient count.
  v_blend_type := case when p_ingredient_count >= 5 then 'advanced' else 'simple' end;

  -- ── Simple blends: always allowed, no reservation needed.
  if v_blend_type = 'simple' then
    insert into public.advanced_blend_usage_events
      (request_id, user_id, canonical_ingredient_ids, ingredient_count, blend_type, plan_at_time, status, finalized_at)
    values
      (p_request_id, p_user_id, p_canonical_ids, p_ingredient_count, 'simple', v_plan, 'finalized', now())
    on conflict (user_id, request_id) do update set status = 'finalized', finalized_at = now();

    a := public.resolve_advanced_blend_allowance(p_user_id);
    return jsonb_build_object(
      'ok', true,
      'code', 'simple_blend_allowed',
      'allowed', true,
      'remaining', a.allowance_limit - a.used,
      'used', a.used,
      'reserved', a.reserved,
      'limit', a.allowance_limit,
      'plan', v_plan,
      'blend_type', 'simple',
      'request_id', p_request_id
    );
  end if;

  -- ── Advanced blends: Pro users always allowed, no consumption.
  if v_plan = 'pro' then
    insert into public.advanced_blend_usage_events
      (request_id, user_id, canonical_ingredient_ids, ingredient_count, blend_type, plan_at_time, status, finalized_at)
    values
      (p_request_id, p_user_id, p_canonical_ids, p_ingredient_count, 'advanced', 'pro', 'finalized', now())
    on conflict (user_id, request_id) do update set status = 'finalized', finalized_at = now();

    a := public.resolve_advanced_blend_allowance(p_user_id);
    return jsonb_build_object(
      'ok', true,
      'code', 'pro_advanced_allowed',
      'allowed', true,
      'remaining', null,
      'used', a.used,
      'reserved', a.reserved,
      'limit', a.allowance_limit,
      'plan', 'pro',
      'blend_type', 'advanced',
      'request_id', p_request_id
    );
  end if;

  -- ── Advanced blends: Free users — reserve an allowance unit.
  a := public.resolve_advanced_blend_allowance(p_user_id);

  -- Lock the row for atomic check-and-reserve.
  select * into a from public.advanced_blend_allowance where user_id = p_user_id for update;

  -- Check: used + reserved must be < allowance_limit.
  if a.used + a.reserved >= a.allowance_limit then
    return jsonb_build_object(
      'ok', false,
      'code', 'advanced_blend_limit_reached',
      'allowed', false,
      'remaining', 0,
      'used', a.used,
      'reserved', a.reserved,
      'limit', a.allowance_limit,
      'plan', 'free',
      'blend_type', 'advanced',
      'request_id', p_request_id
    );
  end if;

  -- Reserve one unit.
  update public.advanced_blend_allowance
     set reserved = reserved + 1, updated_at = now()
   where user_id = p_user_id;

  -- Record the reservation event.
  insert into public.advanced_blend_usage_events
    (request_id, user_id, canonical_ingredient_ids, ingredient_count, blend_type, plan_at_time, status)
  values
    (p_request_id, p_user_id, p_canonical_ids, p_ingredient_count, 'advanced', 'free', 'reserved')
  on conflict (user_id, request_id) do update set status = 'reserved';

  select * into a from public.advanced_blend_allowance where user_id = p_user_id;
  return jsonb_build_object(
    'ok', true,
    'code', 'advanced_blend_reserved',
    'allowed', true,
    'remaining', a.allowance_limit - a.used - a.reserved,
    'used', a.used,
    'reserved', a.reserved,
    'limit', a.allowance_limit,
    'plan', 'free',
    'blend_type', 'advanced',
    'request_id', p_request_id
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Finalize a reservation (commit the allowance consumption).
--
-- Moves a reserved unit to used: increments `used`, decrements
-- `reserved`, sets usage event status='finalized'.
-- Idempotent: finalizing an already-finalized event is a no-op.
-- ─────────────────────────────────────────────────────────────

create or replace function public.finalize_advanced_blend (
  p_user_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  a public.advanced_blend_allowance;
  ev public.advanced_blend_usage_events;
  v_plan text;
begin
  select * into ev
    from public.advanced_blend_usage_events
   where user_id = p_user_id and request_id = p_request_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'reservation_not_found');
  end if;

  -- Already finalized — idempotent success.
  if ev.status = 'finalized' then
    a := public.resolve_advanced_blend_allowance(p_user_id);
    v_plan := public._resolve_blend_plan(p_user_id);
    if v_plan is null then v_plan := 'free'; end if;
    return jsonb_build_object(
      'ok', true,
      'code', 'already_finalized',
      'remaining', a.allowance_limit - a.used,
      'used', a.used,
      'reserved', a.reserved,
      'limit', a.allowance_limit,
      'plan', v_plan,
      'blend_type', ev.blend_type
    );
  end if;

  -- Only reserved events can be finalized.
  if ev.status != 'reserved' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state', 'status', ev.status);
  end if;

  -- For free Advanced Blends: move reserved → used.
  if ev.plan_at_time = 'free' and ev.blend_type = 'advanced' then
    select * into a from public.advanced_blend_allowance where user_id = p_user_id for update;

    update public.advanced_blend_allowance
       set used = used + 1,
           reserved = greatest(reserved - 1, 0),
           updated_at = now()
     where user_id = p_user_id;
  end if;

  -- Mark event as finalized.
  update public.advanced_blend_usage_events
     set status = 'finalized', finalized_at = now()
   where user_id = p_user_id and request_id = p_request_id;

  a := public.resolve_advanced_blend_allowance(p_user_id);
  v_plan := public._resolve_blend_plan(p_user_id);
  if v_plan is null then v_plan := 'free'; end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'finalized',
    'remaining', a.allowance_limit - a.used,
    'used', a.used,
    'reserved', a.reserved,
    'limit', a.allowance_limit,
    'plan', v_plan,
    'blend_type', ev.blend_type
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Release a reservation (cancel without consumption).
--
-- Decrements `reserved`, sets usage event status='released'.
-- Used when the nutrition calculation fails or the user cancels.
-- Idempotent: releasing an already-released event is a no-op.
-- ─────────────────────────────────────────────────────────────

create or replace function public.release_advanced_blend (
  p_user_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  a public.advanced_blend_allowance;
  ev public.advanced_blend_usage_events;
begin
  select * into ev
    from public.advanced_blend_usage_events
   where user_id = p_user_id and request_id = p_request_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'reservation_not_found');
  end if;

  -- Already released or finalized — idempotent.
  if ev.status in ('released', 'finalized') then
    a := public.resolve_advanced_blend_allowance(p_user_id);
    return jsonb_build_object(
      'ok', true,
      'code', ev.status,
      'remaining', a.allowance_limit - a.used,
      'used', a.used,
      'reserved', a.reserved,
      'limit', a.allowance_limit
    );
  end if;

  -- Only reserved events can be released.
  if ev.status != 'reserved' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state', 'status', ev.status);
  end if;

  -- For free Advanced Blends: release the reserved unit.
  if ev.plan_at_time = 'free' and ev.blend_type = 'advanced' then
    select * into a from public.advanced_blend_allowance where user_id = p_user_id for update;

    update public.advanced_blend_allowance
       set reserved = greatest(reserved - 1, 0),
           updated_at = now()
     where user_id = p_user_id;
  end if;

  update public.advanced_blend_usage_events
     set status = 'released'
   where user_id = p_user_id and request_id = p_request_id;

  a := public.resolve_advanced_blend_allowance(p_user_id);
  return jsonb_build_object(
    'ok', true,
    'code', 'released',
    'remaining', a.allowance_limit - a.used,
    'used', a.used,
    'reserved', a.reserved,
    'limit', a.allowance_limit
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Fetch allowance snapshot (for display, no consumption).
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_advanced_blend_allowance (
  p_user_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  a public.advanced_blend_allowance;
  v_plan text;
begin
  a := public.resolve_advanced_blend_allowance(p_user_id);
  v_plan := public._resolve_blend_plan(p_user_id);
  if v_plan is null then v_plan := 'free'; end if;

  return jsonb_build_object(
    'plan', v_plan,
    'used', a.used,
    'reserved', a.reserved,
    'limit', a.allowance_limit,
    'remaining', a.allowance_limit - a.used
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Security: revoke execution from all roles except service role.
-- Only the Supabase service role (used by Edge Functions) may
-- call these functions. Clients cannot directly mutate allowance
-- or usage-event records.
-- ─────────────────────────────────────────────────────────────

revoke execute on function public.resolve_advanced_blend_allowance (uuid) from public, anon, authenticated;
revoke execute on function public.reserve_advanced_blend (uuid, text, text[], integer) from public, anon, authenticated;
revoke execute on function public.finalize_advanced_blend (uuid, text) from public, anon, authenticated;
revoke execute on function public.release_advanced_blend (uuid, text) from public, anon, authenticated;
revoke execute on function public.get_advanced_blend_allowance (uuid) from public, anon, authenticated;
revoke execute on function public._resolve_blend_plan (uuid) from public, anon, authenticated;

-- Grant execute to the service role (used by Edge Functions).
-- The service_role bypasses RLS and can call SECURITY DEFINER functions.
grant execute on function public.resolve_advanced_blend_allowance (uuid) to service_role;
grant execute on function public.reserve_advanced_blend (uuid, text, text[], integer) to service_role;
grant execute on function public.finalize_advanced_blend (uuid, text) to service_role;
grant execute on function public.release_advanced_blend (uuid, text) to service_role;
grant execute on function public.get_advanced_blend_allowance (uuid) to service_role;
grant execute on function public._resolve_blend_plan (uuid) to service_role;
