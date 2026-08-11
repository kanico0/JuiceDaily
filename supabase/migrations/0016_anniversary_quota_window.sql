-- ─────────────────────────────────────────────────────────────
-- 0016_anniversary_quota_window.sql — Migrate scan quota windows
-- from UTC calendar-month alignment to user-anniversary alignment.
--
-- Product requirement:
--   RawLifeFlow's monthly AI Snap usage window must be anchored to
--   the date the user first began using the app, not the first/last
--   day of the calendar month.
--
--   Example: first use 2026-08-11
--     Aug 11 → Sep 11
--     Sep 11 → Oct 11
--     Oct 11 → Nov 11
--
-- Month-end correctness:
--   Each window is computed from the immutable original anchor
--   (auth.users.created_at), NOT by chaining previous period_end +
--   interval '1 month'. This prevents permanent drift for anchors
--   on the 28th, 29th, 30th, or 31st.
--
--   Example: anchor Jan 31
--     Jan 31 → Feb 28 (clamped, Feb has no 31st)
--     Feb 28 → Mar 31 (returns to 31st — NOT Mar 28)
--     Mar 31 → Apr 30 (clamped, Apr has no 31st)
--     Apr 30 → May 31 (returns to 31st)
--
-- Anchor source:
--   auth.users.created_at — the immutable server timestamp when the
--   Supabase user (anonymous or durable) was first created.
--
-- Migration safety:
--   used/reserved counts are preserved when the old calendar window
--   and the new anniversary window overlap (both contain now()).
--   Users do not gain or lose already-consumed quota.
--
-- What does NOT change:
--   - Google Play subscription billing dates
--   - RevenueCat subscription periods
--   - Purchase renewal dates
--   - Free 1 / Pro 12 policy
--   - Annual Pro = 12 per anniversary month (not 144 upfront)
--   - Plan transition behavior (upgrade preserves used)
-- ─────────────────────────────────────────────────────────────

-- ── Helper: add N months to an anchor with day clamping ──────
-- Computes the target year/month by adding N months to the anchor's
-- year/month, then uses the ANCHOR's day-of-month clamped to the
-- last day of the target month. This prevents drift: Jan 31 + 1
-- month = Feb 28, but Jan 31 + 2 months = Mar 31 (not Mar 28).

create or replace function public._add_months_from_anchor (
  p_anchor timestamptz,
  p_n int
) returns timestamptz
language plpgsql immutable as $$
declare
  v_anchor_day int;
  v_anchor_time interval;
  v_total_months int;
  v_year int;
  v_month int;
  v_last_day int;
begin
  v_anchor_day := extract(day from p_anchor)::int;
  v_anchor_time := p_anchor - date_trunc('day', p_anchor);
  v_total_months := extract(month from p_anchor)::int + p_n;
  v_year := extract(year from p_anchor)::int + (v_total_months - 1) / 12;
  v_month := ((v_total_months - 1) % 12) + 1;
  v_last_day := extract(day from (make_date(v_year, v_month, 1)::timestamptz + interval '1 month' - interval '1 day'))::int;
  return make_date(v_year, v_month, least(v_anchor_day, v_last_day))::timestamptz + v_anchor_time;
end;
$$;

-- ── Helper: anniversary window start containing p_now ─────────
-- Given an anchor timestamp, computes the start of the anniversary
-- monthly window that contains p_now. Each window is computed
-- independently from the anchor (not chained) to handle end-of-month
-- clamping correctly.

create or replace function public.anniversary_window_start (
  p_anchor timestamptz,
  p_now timestamptz default now()
) returns timestamptz
language plpgsql immutable as $$
declare
  v_months int;
  v_candidate timestamptz;
begin
  if p_anchor >= p_now then
    return p_anchor;
  end if;

  v_months := (extract(year from p_now)::int - extract(year from p_anchor)::int) * 12
              + (extract(month from p_now)::int - extract(month from p_anchor)::int);

  v_candidate := public._add_months_from_anchor(p_anchor, v_months);
  if v_candidate > p_now then
    v_candidate := public._add_months_from_anchor(p_anchor, v_months - 1);
  end if;

  return v_candidate;
end;
$$;

-- ── Helper: anniversary window end ────────────────────────────
-- Given an anchor and a window start, computes the END of that
-- window (the start of the next window). Uses the anchor's day
-- for clamping, NOT the window start's day, to prevent drift.

create or replace function public.anniversary_window_end (
  p_anchor timestamptz,
  p_window_start timestamptz
) returns timestamptz
language plpgsql immutable as $$
declare
  v_anchor_day int;
  v_anchor_time interval;
  v_total_months int;
  v_year int;
  v_month int;
  v_last_day int;
begin
  v_anchor_day := extract(day from p_anchor)::int;
  v_anchor_time := p_anchor - date_trunc('day', p_anchor);
  -- Next month from the window start's month
  v_total_months := extract(month from p_window_start)::int + 1;
  v_year := extract(year from p_window_start)::int + (v_total_months - 1) / 12;
  v_month := ((v_total_months - 1) % 12) + 1;
  v_last_day := extract(day from (make_date(v_year, v_month, 1)::timestamptz + interval '1 month' - interval '1 day'))::int;
  return make_date(v_year, v_month, least(v_anchor_day, v_last_day))::timestamptz + v_anchor_time;
end;
$$;

-- ── Migrate existing rows to anniversary windows ──────────────
-- For each existing quota row, join with auth.users to get the
-- original user creation timestamp, compute the correct anniversary
-- window, and update period_start/period_end.
--
-- used/reserved preservation rule:
--   - If the old calendar window and the new anniversary window
--     overlap (both contain now()), preserve used/reserved.
--   - If they do NOT overlap, the old usage was from a different
--     period and the new window starts fresh (used=0, reserved=0).
--   - This ensures a user who already consumed their Free Snap
--     before migration remains exhausted after migration.

update public.scan_quotas q
   set period_start = w.w_start,
       period_end = public.anniversary_window_end(u.created_at, w.w_start),
       anchor_day = extract(day from u.created_at)::int,
       used = case
         -- Preserve if old and new windows overlap
         when q.period_start < public.anniversary_window_end(u.created_at, w.w_start)
              and q.period_end > w.w_start
         then q.used
         else 0
       end,
       reserved = case
         when q.period_start < public.anniversary_window_end(u.created_at, w.w_start)
              and q.period_end > w.w_start
         then q.reserved
         else 0
       end,
       updated_at = now()
  from auth.users u,
       lateral (select public.anniversary_window_start(u.created_at, now()) as w_start) w
 where q.user_id = u.id;

-- For rows where anchor_day is still null (edge case), set it.
update public.scan_quotas q
   set anchor_day = extract(day from u.created_at)::int,
       updated_at = now()
  from auth.users u
 where q.user_id = u.id
   and q.anchor_day is null;

-- ── Add anchor_at column to scan_quotas ───────────────────────
-- Stores auth.users.created_at so the client can seed the install
-- anchor from the true first-use timestamp, not from periodStart
-- (which is the current window start and may have drifted for
-- end-of-month anchors).

alter table public.scan_quotas
  add column if not exists anchor_at timestamptz;

-- Backfill anchor_at for existing rows from auth.users.created_at.
update public.scan_quotas q
   set anchor_at = u.created_at
  from auth.users u
 where q.user_id = u.id
   and q.anchor_at is null;

-- ── Replace resolve_quota to use anniversary windows ──────────
-- Key changes from the calendar-month version (0003):
--   1. Joins with auth.users to get the immutable created_at anchor
--   2. Computes the current window from the anchor using
--      anniversary_window_start (not _utc_month_start)
--   3. Computes period_end using anniversary_window_end (not
--      _utc_month_end) — each window is derived from the anchor,
--      NOT chained from the previous period_end
--   4. Lazy rollover compares stored period_start with the computed
--      anniversary window — if they differ and the stored window
--      has expired, advance to the computed window with used=0

create or replace function public.resolve_quota (p_user_id uuid)
returns public.scan_quotas
language plpgsql security definer
set search_path = public
as $$
declare
  q public.scan_quotas;
  v_plan text;
  v_anchor timestamptz;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  -- Determine plan from subscriptions table.
  select case when s.is_active then 'pro' else 'free' end
    into v_plan
    from public.subscriptions s
   where s.user_id = p_user_id;
  if v_plan is null then v_plan := 'free'; end if;

  -- Get the user's immutable creation timestamp as the anchor.
  select created_at into v_anchor from auth.users where id = p_user_id;
  if v_anchor is null then
    v_anchor := now();
  end if;

  -- Compute the current anniversary window from the anchor.
  v_window_start := public.anniversary_window_start(v_anchor, now());
  v_window_end := public.anniversary_window_end(v_anchor, v_window_start);

  -- First activation: create quota row with the anniversary window.
  insert into public.scan_quotas (user_id, plan, scan_limit, period_start, period_end, anchor_at)
  values (
    p_user_id,
    v_plan,
    public._quota_limit_for_plan(v_plan),
    v_window_start,
    v_window_end,
    v_anchor
  )
  on conflict (user_id) do nothing;

  select * into q from public.scan_quotas where user_id = p_user_id for update;

  -- Plan change (upgrade keeps used scans; limit changes in place).
  -- Example: Free 1/1 used → Pro 1/12 used / 11 remaining.
  -- Example: Pro 5/12 used → Free 1/1 used / 0 remaining.
  if q.plan is distinct from v_plan then
    q.plan := v_plan;
    q.scan_limit := public._quota_limit_for_plan(v_plan);
  end if;

  -- Check if the stored window matches the computed anniversary window.
  -- If they differ, either the window has expired (advance with reset)
  -- or the boundaries need snapping (migration, no reset).
  if q.period_start <> v_window_start then
    if q.period_end <= now() then
      -- Window has expired: advance to the current anniversary window.
      q.period_start := v_window_start;
      q.period_end := v_window_end;
      q.used := 0;
      q.reserved := 0;
    else
      -- Window hasn't expired but boundaries are wrong (migration).
      -- Snap to the correct boundaries without resetting usage.
      q.period_start := v_window_start;
      q.period_end := v_window_end;
    end if;
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
         anchor_at = v_anchor,
         updated_at = now()
   where user_id = p_user_id
   returning * into q;

  return q;
end;
$$;

-- ── Lock down ────────────────────────────────────────────────
revoke execute on function public.resolve_quota (uuid) from public, anon, authenticated;
grant execute on function public.resolve_quota (uuid) to service_role;
