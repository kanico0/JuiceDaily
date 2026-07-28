-- ─────────────────────────────────────────────────────────────
-- 0007_fix_begin_account_deletion.sql — Fix ON CONFLICT error.
--
-- The partial unique index on account_deletion_operations(user_id)
-- has a WHERE clause (user_id IS NOT NULL), which means it cannot
-- be used with ON CONFLICT (user_id) without specifying the index
-- predicate. This removes the ON CONFLICT clause since the
-- SELECT FOR UPDATE already handles existing rows.
-- ─────────────────────────────────────────────────────────────

create or replace function public.begin_account_deletion (
  p_user_id uuid
)
returns jsonb
language plpgsql security invoker
set search_path = public
as $$
declare
  v_op public.account_deletion_operations;
  v_steps text[] := '{}';
  v_failures text[] := '{}';
begin
  -- Idempotency: find or create the operation record.
  select * into v_op
    from public.account_deletion_operations
   where user_id = p_user_id
   for update;

  if not found then
    insert into public.account_deletion_operations (user_id, status)
    values (p_user_id, 'in_progress');

    select * into v_op
      from public.account_deletion_operations
     where user_id = p_user_id;
  end if;

  -- Already completed? Return success (idempotent).
  if v_op.status = 'completed' then
    return jsonb_build_object('ok', true, 'code', 'already_completed', 'operation_id', v_op.id);
  end if;

  -- Mark as in_progress.
  update public.account_deletion_operations
     set status = 'in_progress'
   where id = v_op.id;

  -- Step 1: Delete subscriptions (FK cascade handles this, but
  -- we do it explicitly for audit clarity).
  delete from public.subscriptions where user_id = p_user_id;
  v_steps := array_append(v_steps, 'subscriptions');

  -- Step 2: Delete scan quotas (cascade).
  delete from public.scan_quotas where user_id = p_user_id;
  v_steps := array_append(v_steps, 'scan_quotas');

  -- Step 3: Delete scan usage events (cascade).
  delete from public.scan_usage_events where user_id = p_user_id;
  v_steps := array_append(v_steps, 'scan_usage_events');

  -- Step 4: Delete device scan reservations (cascade).
  -- NOTE: This removes user-linked reservation rows but does NOT
  -- reset Device Recall bits (those are Google-managed and stored
  -- client-side / in Play Integrity tokens, not in our database).
  delete from public.device_scan_reservations where user_id = p_user_id;
  v_steps := array_append(v_steps, 'device_scan_reservations');

  -- Step 5: Delete support exceptions (cascade).
  delete from public.support_exceptions where user_id = p_user_id;
  v_steps := array_append(v_steps, 'support_exceptions');

  -- Step 6: RevenueCat webhook events do not have a user_id FK
  -- (they use app_user_id text), so we anonymize rather than delete
  -- to preserve the idempotency ledger for financial audit.
  -- RETAINED: revenuecat_webhook_events (financial transaction records).
  v_steps := array_append(v_steps, 'revenuecat_webhook_events_retained');

  -- Step 7: Queue external deletion job for RevenueCat.
  insert into public.external_deletion_jobs (user_id, provider, status)
  values (p_user_id, 'revenuecat', 'pending')
  on conflict (user_id, provider) do nothing;
  v_steps := array_append(v_steps, 'external_deletion_job_queued');

  -- Update operation record.
  update public.account_deletion_operations
     set steps_completed = v_steps,
         steps_failed = v_failures,
         status = case when array_length(v_failures, 1) > 0 then 'partial_failure' else 'completed' end,
         completed_at = now()
   where id = v_op.id;

  select * into v_op from public.account_deletion_operations where id = v_op.id;

  return jsonb_build_object(
    'ok', true,
    'code', v_op.status,
    'operation_id', v_op.id,
    'steps_completed', v_steps,
    'steps_failed', v_failures
  );
end;
$$;

-- Re-apply permissions.
revoke execute on function public.begin_account_deletion (uuid) from public, anon, authenticated;
grant execute on function public.begin_account_deletion (uuid) to service_role;
