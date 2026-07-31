-- ─────────────────────────────────────────────────────────────
-- 0003_guest_first_use.sql — Server-authoritative guest journey
-- tracking for RawLifeFlow: Juicing Daily.
--
-- Allows exactly one independent juice experience before
-- registration.  A "journey" is either:
--   * one photo-scan-based juice + its associated log, or
--   * one manually entered juice + its associated log.
--
-- The row is keyed to the Supabase user UUID, which is preserved
-- across anonymous-to-email upgrade, so the guest state survives
-- registration and prevents a second free journey.
--
-- All RPCs are SECURITY DEFINER, callable only by Edge Functions
-- (service role).  Clients can never mutate guest state directly.
-- ─────────────────────────────────────────────────────────────

-- ── Guest first-use state ─────────────────────────────────────

create table if not exists public.guest_first_use_state (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  status            text not null default 'available'
                    check (status in ('available', 'scan_reserved', 'scan_completed',
                                      'log_reserved', 'completed')),
  journey_id        text,
  scan_request_id   text,
  scan_reserved_at  timestamptz,
  scan_completed_at timestamptz,
  log_completed_at  timestamptz,
  log_operation_id  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.guest_first_use_state enable row level security;

-- Clients may read their own row (display-only).
create policy "guest_first_use_select_own"
  on public.guest_first_use_state for select
  using (auth.uid() = user_id);

-- ── Index for quick lookups ───────────────────────────────────

create index if not exists guest_first_use_state_status
  on public.guest_first_use_state (status);

-- ── Helper: is the user anonymous? ────────────────────────────
-- Reuse the function from 0002 if it exists, otherwise create.

-- _is_anonymous_user is already defined in 0002_anonymous_scan_guard.sql

-- ── RPC: get_guest_journey_status ─────────────────────────────
-- Returns the current guest journey state for a user.
-- Creates an 'available' row if none exists (lazy init).

create or replace function public.get_guest_journey_status (
  p_user_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  g public.guest_first_use_state;
begin
  -- Lazy-create the row so every user has one.
  insert into public.guest_first_use_state (user_id, status)
  values (p_user_id, 'available')
  on conflict (user_id) do nothing;

  select * into g from public.guest_first_use_state where user_id = p_user_id;

  return jsonb_build_object(
    'status', g.status,
    'journey_id', g.journey_id,
    'scan_request_id', g.scan_request_id,
    'log_operation_id', g.log_operation_id,
    'scan_completed_at', g.scan_completed_at,
    'log_completed_at', g.log_completed_at
  );
end;
$$;

-- ── RPC: reserve_guest_journey ────────────────────────────────
-- Atomically reserves the guest journey for a user.
-- Only succeeds if the current status is 'available'.
-- Returns { ok, journey_id, status }.
-- Idempotent: if the same journey_id is replayed, returns ok=true
-- with the existing reservation.

create or replace function public.reserve_guest_journey (
  p_user_id uuid,
  p_journey_id text,
  p_journey_type text  -- 'scan' or 'manual'
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  g public.guest_first_use_state;
  expected_status text;
begin
  -- Lazy-create the row.
  insert into public.guest_first_use_state (user_id, status)
  values (p_user_id, 'available')
  on conflict (user_id) do nothing;

  select * into g from public.guest_first_use_state
   where user_id = p_user_id
   for update;

  -- Idempotent: same journey_id replay.
  if g.journey_id = p_journey_id and g.status in ('scan_reserved', 'scan_completed', 'log_reserved', 'completed') then
    return jsonb_build_object('ok', true, 'code', 'duplicate_request',
                              'journey_id', g.journey_id, 'status', g.status);
  end if;

  -- Only 'available' can start a new journey.
  if g.status <> 'available' then
    return jsonb_build_object('ok', false, 'code', 'journey_already_used',
                              'status', g.status);
  end if;

  -- Reserve based on journey type.
  if p_journey_type = 'scan' then
    update public.guest_first_use_state
       set status = 'scan_reserved',
           journey_id = p_journey_id,
           scan_request_id = p_journey_id,
           scan_reserved_at = now(),
           updated_at = now()
     where user_id = p_user_id;
  elsif p_journey_type = 'manual' then
    update public.guest_first_use_state
       set status = 'log_reserved',
           journey_id = p_journey_id,
           log_operation_id = p_journey_id,
           updated_at = now()
     where user_id = p_user_id;
  else
    return jsonb_build_object('ok', false, 'code', 'invalid_journey_type');
  end if;

  select * into g from public.guest_first_use_state where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'code', 'reserved',
                            'journey_id', g.journey_id, 'status', g.status);
end;
$$;

-- ── RPC: finalize_guest_scan ──────────────────────────────────
-- Marks the guest scan as completed (photo identified successfully).
-- Transitions: scan_reserved → scan_completed.
-- Idempotent: if already scan_completed or later, returns ok=true.

create or replace function public.finalize_guest_scan (
  p_user_id uuid,
  p_journey_id text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  g public.guest_first_use_state;
begin
  select * into g from public.guest_first_use_state
   where user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- Idempotent: already completed or further.
  if g.status in ('scan_completed', 'log_reserved', 'completed') and g.journey_id = p_journey_id then
    return jsonb_build_object('ok', true, 'code', 'duplicate_request', 'status', g.status);
  end if;

  if g.status <> 'scan_reserved' or g.journey_id <> p_journey_id then
    return jsonb_build_object('ok', false, 'code', 'not_reserved', 'status', g.status);
  end if;

  update public.guest_first_use_state
     set status = 'scan_completed',
         scan_completed_at = now(),
         updated_at = now()
   where user_id = p_user_id;

  select * into g from public.guest_first_use_state where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'code', 'scan_completed', 'status', g.status);
end;
$$;

-- ── RPC: finalize_guest_log ───────────────────────────────────
-- Marks the guest journey as fully completed (juice logged).
-- Transitions: scan_completed → completed (scan-based journey)
--              log_reserved → completed (manual journey)
-- Idempotent: if already completed, returns ok=true.

create or replace function public.finalize_guest_log (
  p_user_id uuid,
  p_journey_id text,
  p_log_operation_id text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  g public.guest_first_use_state;
begin
  select * into g from public.guest_first_use_state
   where user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- Idempotent: already completed.
  if g.status = 'completed' and g.journey_id = p_journey_id then
    return jsonb_build_object('ok', true, 'code', 'duplicate_request', 'status', g.status);
  end if;

  -- Scan-based journey: scan_completed → completed.
  if g.status = 'scan_completed' and g.journey_id = p_journey_id then
    update public.guest_first_use_state
       set status = 'completed',
           log_operation_id = p_log_operation_id,
           log_completed_at = now(),
           updated_at = now()
     where user_id = p_user_id;

    select * into g from public.guest_first_use_state where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'code', 'completed', 'status', g.status);
  end if;

  -- Manual journey: log_reserved → completed.
  if g.status = 'log_reserved' and g.journey_id = p_journey_id then
    update public.guest_first_use_state
       set status = 'completed',
           log_operation_id = p_log_operation_id,
           log_completed_at = now(),
           updated_at = now()
     where user_id = p_user_id;

    select * into g from public.guest_first_use_state where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'code', 'completed', 'status', g.status);
  end if;

  return jsonb_build_object('ok', false, 'code', 'invalid_state', 'status', g.status);
end;
$$;

-- ── RPC: release_guest_journey ────────────────────────────────
-- Releases a reservation after failure or cancellation.
-- Transitions: scan_reserved → available, log_reserved → available.
-- Does NOT reverse a completed journey.
-- Idempotent: releasing an already-available row is a no-op.

create or replace function public.release_guest_journey (
  p_user_id uuid,
  p_journey_id text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  g public.guest_first_use_state;
begin
  select * into g from public.guest_first_use_state
   where user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- Cannot release a completed journey.
  if g.status in ('completed', 'scan_completed') then
    return jsonb_build_object('ok', false, 'code', 'cannot_release_completed', 'status', g.status);
  end if;

  -- Only release if the journey_id matches and status is a reservation.
  if g.journey_id = p_journey_id and g.status in ('scan_reserved', 'log_reserved') then
    update public.guest_first_use_state
       set status = 'available',
           journey_id = null,
           scan_request_id = null,
           scan_reserved_at = null,
           log_operation_id = null,
           updated_at = now()
     where user_id = p_user_id;

    return jsonb_build_object('ok', true, 'code', 'released', 'status', 'available');
  end if;

  -- Already available or different journey.
  return jsonb_build_object('ok', true, 'code', 'no_op', 'status', g.status);
end;
$$;

-- ── Lock down: service role only for all write RPCs ───────────

revoke execute on function public.get_guest_journey_status (uuid) from public, anon, authenticated;
revoke execute on function public.reserve_guest_journey (uuid, text, text) from public, anon, authenticated;
revoke execute on function public.finalize_guest_scan (uuid, text) from public, anon, authenticated;
revoke execute on function public.finalize_guest_log (uuid, text, text) from public, anon, authenticated;
revoke execute on function public.release_guest_journey (uuid, text) from public, anon, authenticated;
