-- ─────────────────────────────────────────────────────────────
-- 0017_advanced_blend_anonymous_guard.sql — Defense-in-depth:
-- the Advanced Blend allowance reservation function refuses
-- anonymous accounts.
--
-- Rationale: the analyze-blend Edge Function already rejects
-- anonymous users (403 account_required) from the VERIFIED JWT's
-- is_anonymous flag (added in the same fix). This migration adds
-- an independent layer so that even a future misconfigured caller
-- with service-role access cannot reserve Advanced Blend allowance
-- for an anonymous user.
--
-- This mirrors the existing _is_anonymous_user guard in
-- reserve_scan (0002_anonymous_scan_guard.sql).
--
-- Notes:
--   * The check reads auth.users.is_anonymous — a server-trusted
--     column maintained by GoGoTrue — NOT user-editable metadata.
--   * execute rights remain revoked from public/anon/authenticated
--     (0009), so clients cannot call this RPC directly.
-- ─────────────────────────────────────────────────────────────

-- Recreate reserve_advanced_blend with the permanent-account guard
-- as the FIRST check — an anonymous attempt writes nothing: no
-- allowance row, no usage event, no reservation.
--
-- Drop first: CREATE OR REPLACE cannot change the function if the
-- return type differs. The migration runs in a transaction, so
-- callers never observe a missing function.

drop function if exists public.reserve_advanced_blend (
  uuid, text, text[], integer
);

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
  -- ── Defense in depth: permanent (non-anonymous) accounts only.
  -- This mirrors the guard in reserve_scan (0002). An anonymous
  -- user cannot reserve or consume Advanced Blend allowance.
  if public._is_anonymous_user(p_user_id) then
    return jsonb_build_object(
      'ok', false,
      'code', 'account_required',
      'allowed', false,
      'message', 'A verified account is required before using Advanced Blend'
    );
  end if;

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

-- Re-assert client lockdown after create-or-replace.
revoke execute on function public.reserve_advanced_blend (uuid, text, text[], integer) from public, anon, authenticated;
grant execute on function public.reserve_advanced_blend (uuid, text, text[], integer) to service_role;
