-- ─────────────────────────────────────────────────────────────
-- 0003_utc_calendar_quota.sql — Migrate scan quota windows from
-- rolling 1-month periods to UTC calendar-month alignment.
--
-- This migration is a prerequisite for the device-shared free
-- pool (0004_device_free_pool.sql), which uses Device Recall
-- month/year timestamps that align to UTC calendar months.
--
-- Changes:
--   * resolve_quota() now snaps period_start to the first day of
--     the current UTC month and period_end to the first day of
--     the next UTC month.
--   * All existing rows are updated to calendar-month boundaries.
--   * Users whose rolling period hasn't ended keep their current
--     usage count; the window simply shifts to calendar alignment.
--   * Users whose rolling period has ended but whose UTC month
--     hasn't reset yet get advanced to the current UTC month
--     with used = 0.
-- ─────────────────────────────────────────────────────────────

-- ── Helper: UTC calendar-month start ─────────────────────────

create or replace function public._utc_month_start (p_ts timestamptz default now())
returns timestamptz
language sql immutable
as $$
  select date_trunc('month', p_ts at time zone 'utc') at time zone 'utc'
$$;
create or replace function public._utc_month_end (p_ts timestamptz default now())
returns timestamptz
language sql immutable
as $$
  select (date_trunc('month', p_ts at time zone 'utc') + interval '1 month') at time zone 'utc'
$$;
-- ── Migrate existing rows to UTC calendar-month boundaries ───
--
-- For each existing quota row:
--   * If the current period_end is still in the future, snap
--     period_start to the UTC month start of period_start and
--     period_end to the UTC month end of period_start. This
--     preserves the current usage count while aligning the
--     window to calendar boundaries.
--   * If the current period has already expired, advance to the
--     current UTC month with used = 0 and reserved = 0.

update public.scan_quotas
   set period_start = public._utc_month_start(period_start),
       period_end = public._utc_month_end(period_start),
       updated_at = now()
 where period_end > now();
update public.scan_quotas
   set period_start = public._utc_month_start(now()),
       period_end = public._utc_month_end(now()),
       used = 0,
       reserved = 0,
       updated_at = now()
 where period_end <= now();
-- ── Replace resolve_quota to use UTC calendar-month windows ──

create or replace function public.resolve_quota (p_user_id uuid)
returns public.scan_quotas
language plpgsql security definer
set search_path = public
as $$
declare
  q public.scan_quotas;
  v_plan text;
  v_month_start timestamptz;
  v_month_end timestamptz;
begin
  select case when s.is_active then 'pro' else 'free' end
    into v_plan
    from public.subscriptions s
   where s.user_id = p_user_id;
  if v_plan is null then v_plan := 'free'; end if;

  v_month_start := public._utc_month_start(now());
  v_month_end := public._utc_month_end(now());

  insert into public.scan_quotas (user_id, plan, scan_limit, period_start, period_end)
  values (p_user_id, v_plan, public._quota_limit_for_plan(v_plan), v_month_start, v_month_end)
  on conflict (user_id) do nothing;

  select * into q from public.scan_quotas where user_id = p_user_id for update;

  -- Plan change (upgrade keeps used scans; limit changes in place).
  if q.plan is distinct from v_plan then
    q.plan := v_plan;
    q.scan_limit := public._quota_limit_for_plan(v_plan);
  end if;

  -- Advance the monthly window to the current UTC calendar month.
  -- If period_end has passed, keep advancing month by month until
  -- the window covers now(). Each advance resets used and reserved.
  while q.period_end <= now() loop
    q.period_start := public._utc_month_start(q.period_end);
    q.period_end := public._utc_month_end(q.period_end);
    q.used := 0;
    q.reserved := 0;
  end loop;

  -- Safety: if period_start is not aligned to UTC month start
  -- (from legacy data), snap it now without resetting usage.
  if q.period_start <> public._utc_month_start(q.period_start) then
    q.period_start := public._utc_month_start(q.period_start);
    q.period_end := public._utc_month_end(q.period_start);
  end if;

  -- Advance the daily window.
  if q.daily_period_start < current_date then
    q.daily_period_start := current_date;
    q.daily_used := 0;
  end if;

  update public.scan_quotas
     set plan = q.plan,
         scan_limit = q.scan_limit,
         period_start = q.period_start,
         period_end = q.period_end,
         used = q.used,
         reserved = q.reserved,
         daily_used = q.daily_used,
         daily_period_start = q.daily_period_start,
         updated_at = now()
   where user_id = p_user_id;

  return q;
end;
$$;
