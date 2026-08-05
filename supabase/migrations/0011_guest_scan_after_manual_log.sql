-- ─────────────────────────────────────────────────────────────
-- 0011_guest_scan_after_manual_log.sql — Allow a guest who has
-- only logged a manual juice (status = 'completed', scanCompletedAt
-- IS NULL) to reserve a scan journey.
--
-- Root cause: reserve_guest_journey only allowed reservation from
-- 'available' status. A guest who manually logged juice had status
-- 'completed' with scanCompletedAt NULL, so the scan reservation
-- failed with 'journey_already_used', which the client mapped to
-- 'account_required' — blocking the first produce scan.
--
-- Fix: allow reservation from 'completed' status when
-- scan_completed_at IS NULL. This lets the guest scan after a
-- manual log. The journey is reset to 'scan_reserved' so the
-- existing finalize/release lifecycle works unchanged.
-- ─────────────────────────────────────────────────────────────

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

  -- Allow reservation from 'available' OR from 'completed' when the
  -- completion was via manual log only (scan_completed_at IS NULL).
  -- A guest who manually logged juice has not used their complimentary
  -- scan and must be allowed to reserve one.
  if g.status = 'completed' and g.scan_completed_at is null and p_journey_type = 'scan' then
    -- Reset to scan_reserved so the existing finalize/release lifecycle works.
    update public.guest_first_use_state
       set status = 'scan_reserved',
           journey_id = p_journey_id,
           scan_request_id = p_journey_id,
           scan_reserved_at = now(),
           updated_at = now()
     where user_id = p_user_id;

    select * into g from public.guest_first_use_state where user_id = p_user_id;

    return jsonb_build_object('ok', true, 'code', 'reserved',
                              'journey_id', g.journey_id, 'status', g.status);
  end if;

  -- Only 'available' can start a new journey (for manual type, or scan
  -- when not in the manual-log-only completed state above).
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

-- Revoke public access (same as original migration).
revoke execute on function public.reserve_guest_journey (uuid, text, text) from public, anon, authenticated;
