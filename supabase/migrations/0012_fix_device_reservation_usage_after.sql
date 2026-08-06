begin;

create or replace function public.reserve_device_scan(
  p_request_id text,
  p_user_id uuid,
  p_device_recall_state_key text,
  p_device_used integer default 0,
  p_enforcement_mode text default 'off',
  p_integrity_status text default 'skipped'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_existing public.device_scan_reservations;
begin
  v_period_start := public._utc_month_start(now());
  v_period_end := public._utc_month_end(now());

  -- Idempotency: return the existing result for the same request.
  select *
    into v_existing
    from public.device_scan_reservations
   where request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'ok',
      v_existing.reservation_status in ('device_reserved', 'committed'),
      'code',
      'duplicate_request',
      'reservation_id',
      v_existing.id
    );
  end if;

  -- Record the current device usage at reservation time.
  -- device_usage_after remains unchanged until the scan commits.
  insert into public.device_scan_reservations (
    request_id,
    user_id,
    device_recall_state_key,
    quota_period_start,
    quota_period_end,
    device_usage_before,
    device_usage_after,
    reservation_status,
    integrity_status,
    enforcement_mode
  )
  values (
    p_request_id,
    p_user_id,
    p_device_recall_state_key,
    v_period_start,
    v_period_end,
    p_device_used,
    p_device_used,
    'device_reserved',
    p_integrity_status,
    p_enforcement_mode
  );

  return jsonb_build_object(
    'ok',
    true,
    'code',
    'device_reserved',
    'device_usage_before',
    p_device_used
  );
end;
$function$;

commit;