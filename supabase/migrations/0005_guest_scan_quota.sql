-- ─────────────────────────────────────────────────────────────
-- 0005_guest_scan_quota.sql — Guest scan quota accounting.
--
-- The first successful anonymous scan must increment the same
-- scan_quotas table used after registration.  Since reserve_scan
-- (0002_anonymous_scan_guard.sql) blocks anonymous users, we need
-- a parallel function that authorizes via the guest journey
-- reservation instead of the durable-account check.
--
-- Flow:
--   1. Client reserves guest journey (scan_reserved) via guest-journey EF
--   2. analyze-scan EF calls reserve_guest_scan (this function)
--   3. On success: commit_scan (existing) + finalize_guest_scan
--   4. On failure: release_guest_scan (this function) + release_guest_journey
--
-- The scan_quotas row is keyed to the Supabase UUID, which is
-- preserved across anonymous-to-email upgrade, so the count
-- carries forward after registration.
-- ─────────────────────────────────────────────────────────────

-- ── Reserve a scan quota for a guest (anonymous) user ────────
-- Same logic as reserve_scan but authorizes via the guest journey
-- state (must be scan_reserved) instead of the durable-account check.

create or replace function public.reserve_guest_scan (
  p_user_id uuid,
  p_request_id text,
  p_image_hash text default null,
  p_journey_id text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  q public.scan_quotas;
  existing public.scan_usage_events;
  g public.guest_first_use_state;
begin
  -- Verify the guest journey is in scan_reserved state for this journey.
  select * into g from public.guest_first_use_state
   where user_id = p_user_id for update;

  if not found or g.status <> 'scan_reserved' or g.journey_id <> p_journey_id then
    return jsonb_build_object('ok', false, 'code', 'guest_journey_not_reserved', 'quota', null);
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

-- ── Release a guest scan reservation on failure ──────────────
-- Same logic as release_scan but for guest-initiated reservations.

create or replace function public.release_guest_scan (
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
   where user_id = p_user_id and request_id = p_request_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'reservation_not_found');
  end if;

  if ev.status in ('released', 'committed') then
    q := public.resolve_quota(p_user_id);
    return jsonb_build_object('ok', true, 'code', ev.status, 'quota', to_jsonb(q));
  end if;

  if ev.status <> 'reserved' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state', 'status', ev.status);
  end if;

  select * into q from public.scan_quotas where user_id = p_user_id for update;

  update public.scan_quotas
     set reserved = greatest(reserved - 1, 0), updated_at = now()
   where user_id = p_user_id;

  update public.scan_usage_events
     set status = 'released', failure_category = p_failure_category
   where user_id = p_user_id and request_id = p_request_id;

  select * into q from public.scan_quotas where user_id = p_user_id;
  return jsonb_build_object('ok', true, 'code', 'released', 'quota', to_jsonb(q));
end;
$$;

-- ── Lock down: service role only ─────────────────────────────

revoke execute on function public.reserve_guest_scan (uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.release_guest_scan (uuid, text, text) from public, anon, authenticated;

grant execute on function public.reserve_guest_scan (uuid, text, text, text) to service_role;
grant execute on function public.release_guest_scan (uuid, text, text) to service_role;
