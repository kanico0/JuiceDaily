-- ─────────────────────────────────────────────────────────────
-- 0014_webhook_event_ordering.sql — Add event timestamp for
-- stale-event protection, relax status CHECK for pending retry,
-- and add atomic subscription update RPC.
--
-- Changes to revenuecat_webhook_events:
--   - Add event_timestamp_ms (bigint) for event ordering
--   - Relax status CHECK to allow 'pending' (insert-then-update pattern)
--
-- Changes to subscriptions:
--   - Add last_revenuecat_event_timestamp_ms (bigint) for atomic
--     stale-event protection via row-level lock in apply_revenuecat_event()
--
-- New RPC: apply_revenuecat_event()
--   Atomically applies a subscription state update only if the
--   incoming event timestamp is >= the last applied timestamp.
--   Prevents race conditions between concurrent webhook invocations.
-- ─────────────────────────────────────────────────────────────

-- ── Add event_timestamp_ms to webhook events ──────────────────
alter table public.revenuecat_webhook_events
  add column if not exists event_timestamp_ms bigint;

-- ── Relax status CHECK to allow 'pending' ─────────────────────
alter table public.revenuecat_webhook_events
  drop constraint if exists revenuecat_webhook_events_status_check;

alter table public.revenuecat_webhook_events
  add constraint revenuecat_webhook_events_status_check
  check (status in ('pending', 'processed', 'skipped', 'failed'));

-- ── Backfill any existing rows ────────────────────────────────
update public.revenuecat_webhook_events
   set status = 'processed'
 where status is null or status = '';

-- ── Add last_revenuecat_event_timestamp_ms to subscriptions ───
-- Used by apply_revenuecat_event() for atomic stale-event protection.
-- Preserves last_revenuecat_event_id for diagnostics.
alter table public.subscriptions
  add column if not exists last_revenuecat_event_timestamp_ms bigint;

-- ── Atomic subscription update RPC ────────────────────────────
-- Applies a subscription state update only if the incoming event
-- timestamp is >= the last applied timestamp. Uses SELECT ... FOR UPDATE
-- to prevent race conditions between concurrent webhook invocations.
--
-- Returns:
--   { applied: true }  — subscription state was updated
--   { applied: false, reason: 'stale_event' } — event was older than last applied
create or replace function public.apply_revenuecat_event (
  p_user_id uuid,
  p_event_id text,
  p_event_timestamp_ms bigint,
  p_is_active boolean,
  p_store text,
  p_plan text,
  p_product_id text,
  p_original_transaction_id text,
  p_purchase_date timestamptz,
  p_expiration_date timestamptz,
  p_will_renew boolean,
  p_billing_issue_detected_at timestamptz,
  p_environment text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.subscriptions;
  v_last_ts bigint;
begin
  -- Lock the subscription row for the duration of this transaction.
  -- If no row exists, there's no stale-event risk — insert below.
  select * into v_existing
    from public.subscriptions
   where user_id = p_user_id
     for update;

  -- ── Stale-event protection ──────────────────────────────
  -- If the existing row has a newer event timestamp, this event
  -- is stale and must NOT overwrite current state.
  if found then
    v_last_ts := v_existing.last_revenuecat_event_timestamp_ms;
    if v_last_ts is not null and p_event_timestamp_ms is not null then
      if p_event_timestamp_ms < v_last_ts then
        return jsonb_build_object('applied', false, 'reason', 'stale_event');
      end if;
    end if;
  end if;

  -- ── Apply the subscription state ────────────────────────
  insert into public.subscriptions (
    user_id, entitlement, is_active, store, plan, product_id,
    original_transaction_id, purchase_date, expiration_date,
    will_renew, billing_issue_detected_at, environment,
    last_revenuecat_event_id, last_revenuecat_event_timestamp_ms,
    updated_at
  ) values (
    p_user_id, 'pro', p_is_active, p_store, p_plan, p_product_id,
    p_original_transaction_id, p_purchase_date, p_expiration_date,
    p_will_renew, p_billing_issue_detected_at, p_environment,
    p_event_id, p_event_timestamp_ms,
    now()
  )
  on conflict (user_id) do update set
    is_active = excluded.is_active,
    store = excluded.store,
    plan = excluded.plan,
    product_id = excluded.product_id,
    original_transaction_id = excluded.original_transaction_id,
    purchase_date = excluded.purchase_date,
    expiration_date = excluded.expiration_date,
    will_renew = excluded.will_renew,
    billing_issue_detected_at = excluded.billing_issue_detected_at,
    environment = excluded.environment,
    last_revenuecat_event_id = excluded.last_revenuecat_event_id,
    last_revenuecat_event_timestamp_ms = excluded.last_revenuecat_event_timestamp_ms,
    updated_at = now();

  return jsonb_build_object('applied', true);
end;
$$;

-- Lock down: service role only.
revoke execute on function public.apply_revenuecat_event from public, anon, authenticated;
grant execute on function public.apply_revenuecat_event to service_role;
