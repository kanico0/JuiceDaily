-- ─────────────────────────────────────────────────────────────
-- 0002_anonymous_scan_guard.sql — Defense-in-depth: the quota
-- reservation function itself refuses anonymous accounts.
--
-- Rationale: the analyze-scan Edge Function already rejects
-- anonymous users (403 account_required) from the VERIFIED JWT's
-- is_anonymous flag. This migration adds an independent layer so
-- that even a future misconfigured caller with service-role access
-- cannot reserve quota for an anonymous user.
--
-- Notes:
--   * The check reads auth.users.is_anonymous — a server-trusted
--     column maintained by GoTrue — NOT user-editable metadata and
--     NOT the JWT role (Supabase anonymous users legitimately use
--     the 'authenticated' role and must not be treated as
--     unauthenticated).
--   * resolve_quota stays available for permanent users only via
--     the Edge Functions; execute rights remain revoked from
--     public/anon/authenticated (0001), so clients cannot call any
--     quota RPC directly.
--   * commit_scan / release_scan operate only on existing
--     reservations; since anonymous users can never reserve, no
--     additional check is needed there.
-- ─────────────────────────────────────────────────────────────

create or replace function public._is_anonymous_user (p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select u.is_anonymous from auth.users u where u.id = p_user_id),
    true  -- unknown users are treated as not-permanent
  )
$$;

revoke execute on function public._is_anonymous_user (uuid) from public, anon, authenticated;

-- Recreate reserve_scan with the permanent-account guard as the
-- FIRST check — an anonymous attempt writes nothing: no quota row,
-- no reservation, no usage event.
--
-- Drop first: the deployed function's return type differs from the
-- repo definition and CREATE OR REPLACE cannot change return types.
-- The migration runs in a transaction, so callers never observe a
-- missing function.
drop function if exists public.reserve_scan (uuid, text, text);

create function public.reserve_scan (
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
  -- Defense in depth: permanent (non-anonymous) accounts only.
  if public._is_anonymous_user(p_user_id) then
    return jsonb_build_object('ok', false, 'code', 'account_required', 'quota', null);
  end if;

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

-- Re-assert client lockdown after create-or-replace.
revoke execute on function public.reserve_scan (uuid, text, text) from public, anon, authenticated;
