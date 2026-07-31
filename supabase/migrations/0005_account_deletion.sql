-- ─────────────────────────────────────────────────────────────
-- 0005_account_deletion.sql — Account deletion support,
-- deletion-request tracking, and external deletion jobs.
--
-- Design:
--   * account_deletion_operations: tracks each deletion attempt
--     with an immutable operation ID, status, and audit trail.
--   * account_deletion_requests: stores unauthenticated web-form
--     requests for manual review (never auto-deletes).
--   * external_deletion_jobs: queues RevenueCat customer deletion
--     for server-side processing when credentials are available.
--   * Raises support_exceptions bonus_scans limit to 100 to
--     accommodate reviewer grants (50 scans).
-- ─────────────────────────────────────────────────────────────

-- ── Raise support_exceptions bonus_scans limit ───────────────
-- Original constraint limited to 20; reviewer grants need 50.
alter table public.support_exceptions
  drop constraint if exists support_exceptions_bonus_scans_check;
alter table public.support_exceptions
  add constraint support_exceptions_bonus_scans_check
  check (bonus_scans > 0 and bonus_scans <= 100);
-- ── Account deletion operations ──────────────────────────────
-- Tracks each server-side deletion attempt with idempotency.
--
-- user_id is nullable with ON DELETE SET NULL so the operation
-- record survives Auth-user deletion for audit and external-job
-- reconciliation. No email, access token, or private content is
-- retained — only the UUID (which becomes NULL after Auth deletion),
-- status, timestamps, and step audit trail.
create table if not exists public.account_deletion_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'partial_failure', 'failed')),
  steps_completed text[] not null default '{}',
  steps_failed text[] not null default '{}',
  error_detail text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.account_deletion_operations enable row level security;
-- No client policies: service role only.

-- Partial unique index: only enforces uniqueness for non-null
-- user_id values. After Auth deletion (user_id becomes NULL),
-- multiple NULLs are allowed, preserving completed operation
-- records without blocking new operations for other users.
create unique index if not exists account_deletion_operations_user_id_unique
  on public.account_deletion_operations (user_id)
  where user_id is not null;
-- ── Account deletion requests (web form) ─────────────────────
-- Unauthenticated requests from the website deletion form.
-- Never auto-deletes; requires manual review and verification.
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'completed', 'rejected')),
  request_ip text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);
alter table public.account_deletion_requests enable row level security;
-- No client policies: service role only (web form uses anon key
-- through the request-account-deletion Edge Function which has
-- its own rate limiting and validation).

create index if not exists account_deletion_requests_email_hash
  on public.account_deletion_requests (email_hash, created_at desc);
-- ── External deletion jobs ───────────────────────────────────
-- Queues RevenueCat customer deletion for server-side processing.
--
-- user_id is a non-FK minimized subject reference: the canonical
-- UUID must survive Auth-user deletion so the backend can
-- reconcile with RevenueCat. No FK to auth.users means no cascade.
-- No email or PII beyond the UUID is stored.
create table if not exists public.external_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null check (provider in ('revenuecat')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, provider)
);
alter table public.external_deletion_jobs enable row level security;
-- No client policies: service role only.

-- ── Deletion function (SECURITY INVOKER, service-role only) ──
-- Performs the full account deletion sequence:
--   1. Record the operation (idempotent).
--   2. Delete user-owned data (cascaded by FK).
--   3. Queue RevenueCat deletion job.
--   4. Delete the Supabase Auth user (admin API, done by Edge Function).
--   5. Mark operation as completed.
--
-- This function handles steps 1-3 and 5. Step 4 (auth.admin.deleteUser)
-- is done by the Edge Function after this function returns, because
-- the service-role Supabase client in the Edge Function has admin
-- auth capabilities that the SQL function does not.
--
-- SECURITY INVOKER is sufficient because the Edge Function calls
-- this RPC with the service_role, which has BYPASSRLS and ALL
-- privileges on all public tables. If a non-privileged role
-- somehow gains EXECUTE permission, the function will fail because
-- the caller lacks DELETE/INSERT/UPDATE grants on the target tables.
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
    values (p_user_id, 'in_progress')
    on conflict (user_id) do nothing
    returning * into v_op;

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
-- Lock down function execution: service role only.
revoke execute on function public.begin_account_deletion (uuid) from public, anon, authenticated;
grant execute on function public.begin_account_deletion (uuid) to service_role;
-- ── Insert deletion request function (for web form) ──────────
-- Called by the request-account-deletion Edge Function using the
-- service-role client. Stores a deletion request for manual review.
--
-- SECURITY INVOKER is sufficient because the Edge Function calls
-- this RPC with the service_role, which has BYPASSRLS and INSERT
-- on account_deletion_requests. No anon or authenticated access
-- is needed — the Edge Function applies its own rate limiting,
-- CORS, and email validation before calling this function.
create or replace function public.create_deletion_request (
  p_email_hash text,
  p_note text default null,
  p_request_ip text default null
)
returns jsonb
language plpgsql security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.account_deletion_requests (email_hash, note, request_ip)
  values (p_email_hash, p_note, p_request_ip)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'request_id', v_id);
end;
$$;
-- Lock down: service role only. The Edge Function uses the
-- service-role client (not anon), so anon does not need execute.
revoke execute on function public.create_deletion_request (text, text, text) from public, anon, authenticated;
grant execute on function public.create_deletion_request (text, text, text) to service_role;
