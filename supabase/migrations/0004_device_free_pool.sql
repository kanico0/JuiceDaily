-- ─────────────────────────────────────────────────────────────
-- 0004_device_free_pool.sql — Device-shared free Juice Snap
-- allowance using Google Play Integrity Device Recall.
--
-- This migration adds:
--   * Extensions to scan_usage_events for device pool tracking
--   * device_scan_reservations table for idempotent device pool
--     accounting
--   * support_exceptions table for admin-only bonus scans
--   * SECURITY DEFINER functions for device pool reservation,
--     commit, and rollback
--   * Row Level Security on all new tables
--
-- No raw device fingerprint is stored. The device pool is
-- identified by the Play Integrity Device Recall bits, which are
-- validated server-side from a Play Integrity token. The token
-- itself is never persisted after verification.
-- ─────────────────────────────────────────────────────────────

-- ── Extend scan_usage_events with device pool fields ─────────

alter table public.scan_usage_events
  add column if not exists device_provider text,
  add column if not exists device_usage_before integer,
  add column if not exists device_usage_after integer,
  add column if not exists integrity_status text
    check (integrity_status in ('verified', 'unavailable', 'failed', 'mock', 'skipped')),
  add column if not exists enforcement_mode text
    check (enforcement_mode in ('off', 'observe', 'enforce')),
  add column if not exists reservation_status text
    check (reservation_status in ('requested', 'account_reserved', 'device_reserved', 'ai_started', 'succeeded', 'failed', 'rolled_back')),
  add column if not exists rollback_status text
    check (rollback_status in ('pending', 'completed', 'failed', 'not_required'));

-- ── Device scan reservations ─────────────────────────────────
-- Tracks the device pool state for each scan request.
--
-- IMPORTANT: device_recall_state_key is NOT a stable device
-- identifier. It is a request-scoped audit value derived from
-- the Device Recall bits and timestamps observed at the time of
-- the request. It cannot be used to join multiple accounts on
-- the same physical device — Google Device Recall does not
-- provide a stable device identifier.
--
-- The authoritative device-shared signal is the Device Recall
-- bits themselves, read from each verified Play Integrity token.
-- This table exists for idempotency and audit, not for
-- cross-account device grouping.

create table if not exists public.device_scan_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_recall_state_key text not null,
  quota_period_start timestamptz not null,
  quota_period_end timestamptz not null,
  device_usage_before integer not null default 0,
  device_usage_after integer not null,
  reservation_status text not null default 'requested'
    check (reservation_status in ('requested', 'device_reserved', 'committed', 'released', 'failed')),
  integrity_status text not null default 'skipped'
    check (integrity_status in ('verified', 'unavailable', 'failed', 'mock', 'skipped')),
  enforcement_mode text not null default 'off'
    check (enforcement_mode in ('off', 'observe', 'enforce')),
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.device_scan_reservations enable row level security;

-- No client policies: service role only.
-- Clients cannot read or write device scan reservations.

-- Index for audit lookups by user within a period
create index if not exists device_scan_reservations_user_period
  on public.device_scan_reservations (user_id, quota_period_start);

create index if not exists device_scan_reservations_user_created
  on public.device_scan_reservations (user_id, created_at desc);

-- ── Support exceptions (admin-only) ──────────────────────────
-- Allows privileged admins to grant bonus AI scans to a specific
-- user for legitimate shared-device or support cases.

create table if not exists public.support_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bonus_scans integer not null check (bonus_scans > 0 and bonus_scans <= 20),
  scans_used integer not null default 0 check (scans_used >= 0),
  reason text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  is_active boolean not null default true
);

alter table public.support_exceptions enable row level security;

-- No client policies: service role only.
-- Clients cannot read, create, or modify support exceptions.

create index if not exists support_exceptions_user_active
  on public.support_exceptions (user_id) where is_active = true;

-- ── Device pool quota functions ──────────────────────────────

-- Count committed device scans for a user within the
-- current UTC calendar month. This is per-USER, not per-device,
-- because Google Device Recall does not provide a stable device
-- identifier. The authoritative device-shared count comes from
-- the Device Recall bits in each verified token.
create or replace function public.count_user_device_scans (
  p_user_id uuid,
  p_period_start timestamptz default null
)
returns integer
language sql security definer
set search_path = public
as $$
  select count(*)::integer
    from public.device_scan_reservations
   where user_id = p_user_id
     and reservation_status = 'committed'
     and (p_period_start is null or quota_period_start = p_period_start)
$$;

-- Reserve a device scan slot. Idempotent per request_id.
-- Does NOT block based on database count — the authoritative
-- device-shared count comes from the Device Recall bits in the
-- verified Play Integrity token, evaluated in the Edge Function.
-- This function creates an audit record for idempotency only.
-- Returns json { ok, code, reservation_id }.
create or replace function public.reserve_device_scan (
  p_request_id text,
  p_user_id uuid,
  p_device_recall_state_key text,
  p_device_used integer default 0,
  p_enforcement_mode text default 'off',
  p_integrity_status text default 'skipped'
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_existing public.device_scan_reservations;
begin
  v_period_start := public._utc_month_start(now());
  v_period_end := public._utc_month_end(now());

  -- Idempotency: same request_id
  select * into v_existing
    from public.device_scan_reservations
   where request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'ok', v_existing.reservation_status in ('device_reserved', 'committed'),
      'code', 'duplicate_request',
      'reservation_id', v_existing.id
    );
  end if;

  -- Create the device reservation (audit record)
  insert into public.device_scan_reservations
    (request_id, user_id, device_recall_state_key, quota_period_start, quota_period_end,
     device_usage_before, reservation_status, integrity_status, enforcement_mode)
  values
    (p_request_id, p_user_id, p_device_recall_state_key, v_period_start, v_period_end,
     p_device_used, 'device_reserved', p_integrity_status, p_enforcement_mode);

  return jsonb_build_object(
    'ok', true,
    'code', 'device_reserved',
    'device_usage_before', p_device_used
  );
end;
$$;

-- Commit a device scan reservation (AI analysis succeeded).
create or replace function public.commit_device_scan (
  p_request_id text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_res public.device_scan_reservations;
begin
  select * into v_res
    from public.device_scan_reservations
   where request_id = p_request_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_res.reservation_status = 'committed' then
    return jsonb_build_object('ok', true, 'code', 'already_committed');
  end if;

  if v_res.reservation_status <> 'device_reserved' then
    return jsonb_build_object('ok', false, 'code', 'not_reserved');
  end if;

  update public.device_scan_reservations
     set reservation_status = 'committed',
         device_usage_after = v_res.device_usage_before + 1,
         completed_at = now()
   where id = v_res.id;

  return jsonb_build_object('ok', true, 'code', 'committed');
end;
$$;

-- Release a device scan reservation (AI failure / rollback).
-- Idempotent: releasing an already-released reservation is a no-op.
create or replace function public.release_device_scan (
  p_request_id text,
  p_failure_reason text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_res public.device_scan_reservations;
begin
  select * into v_res
    from public.device_scan_reservations
   where request_id = p_request_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_res.reservation_status in ('released', 'failed') then
    -- Idempotent: already released
    return jsonb_build_object('ok', true, 'code', 'already_released');
  end if;

  if v_res.reservation_status = 'committed' then
    -- Cannot release a committed scan (AI succeeded)
    return jsonb_build_object('ok', false, 'code', 'already_committed');
  end if;

  update public.device_scan_reservations
     set reservation_status = 'released',
         failure_reason = p_failure_reason,
         completed_at = now()
   where id = v_res.id;

  return jsonb_build_object('ok', true, 'code', 'released');
end;
$$;

-- ── Support exception consumption ────────────────────────────

-- Check and consume a support exception bonus scan.
-- Returns json { ok, bonus_remaining }.
create or replace function public.consume_support_exception (
  p_user_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_exc public.support_exceptions;
begin
  select * into v_exc
    from public.support_exceptions
   where user_id = p_user_id
     and is_active = true
     and scans_used < bonus_scans
     and expires_at > now()
   order by created_at asc
   limit 1
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_exception');
  end if;

  update public.support_exceptions
     set scans_used = scans_used + 1
   where id = v_exc.id;

  return jsonb_build_object(
    'ok', true,
    'code', 'consumed',
    'bonus_remaining', v_exc.bonus_scans - (v_exc.scans_used + 1)
  );
end;
$$;

-- ── Lock down all device pool functions ──────────────────────

revoke execute on function public.count_user_device_scans (uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.reserve_device_scan (text, uuid, text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.commit_device_scan (text) from public, anon, authenticated;
revoke execute on function public.release_device_scan (text, text) from public, anon, authenticated;
revoke execute on function public.consume_support_exception (uuid) from public, anon, authenticated;
