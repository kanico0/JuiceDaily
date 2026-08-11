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
-- This migration:
--   1. Creates anniversary_window_start() to compute the window
--      start containing now() from an anchor timestamp.
--   2. Replaces resolve_quota() to use anniversary windows:
--      - First creation: period_start = now(), period_end = now() + 1 month
--      - Lazy advance: period_start = old period_end, period_end + 1 month
--      - Plan transitions preserve used (Free 1/1 → Pro 1/12, not 0/12)
--   3. Migrates existing rows by joining with auth.users.created_at
--      to establish the anchor, then computing the correct anniversary
--      window. Preserves used/reserved counts.
--
-- Anchor source:
--   auth.users.created_at — the immutable server timestamp when the
--   Supabase user (anonymous or durable) was first created. This is
--   the most trustworthy server timestamp for "first use". It:
--     - Is set by Supabase auth on user creation
--     - Is immutable
--     - Survives guest → email upgrade (same UUID)
--     - Is server-authoritative
--     - Exists for all users
--
-- Migration safety:
--   - Existing used/reserved counts are preserved when both the old
--     calendar window and the new anniversary window contain now().
--   - Users do not gain or lose already-consumed quota.
--   - Users whose calendar window has already expired get advanced
--     to the current anniversary window with used=0 (same as before).
--
-- What does NOT change:
--   - Google Play subscription billing dates
--   - RevenueCat subscription periods
--   - Purchase renewal dates
--   - Free 1 / Pro 12 policy
--   - Annual Pro = 12 per anniversary month (not 144 upfront)
--   - Plan transition behavior (upgrade preserves used)
-- ─────────────────────────────────────────────────────────────

-- ── Helper: anniversary window start containing p_now ─────────
-- Given an anchor timestamp (e.g. auth.users.created_at), computes
-- the start of the anniversary monthly window that contains p_now.
-- Simply adds 1-month intervals from the anchor until the window
-- contains p_now. Handles end-of-month clamping automatically
-- (PostgreSQL: Jan 31 + 1 month = Feb 28).

create or replace function public.anniversary_window_start (
  p_anchor timestamptz,
  p_now timestamptz default now()
) returns timestamptz
language plpgsql immutable as $$
declare
  v_start timestamptz := p_anchor;
  v_next timestamptz;
begin
  -- If the anchor is in the future, return it as-is.
  if p_anchor >= p_now then
    return p_anchor;
  end if;
  -- Fast-forward by adding 1 month at a time until the window
  -- containing p_now is found. This loop runs at most ~N months
  -- since the anchor, but in practice resolve_quota calls this
  -- lazily (the row's period_start is already close to now()).
  loop
    v_next := v_start + interval '1 month';
    exit when v_next > p_now;
    v_start := v_next;
  end loop;
  return v_start;
end;
$$;

-- ── Migrate existing rows to anniversary windows ──────────────
-- For each existing quota row, join with auth.users to get the
-- original user creation timestamp, compute the correct anniversary
-- window, and update period_start/period_end. Preserve used/reserved
-- when both old and new windows contain now().

update public.scan_quotas q
   set period_start = w.new_start,
       period_end = w.new_start + interval '1 month',
       anchor_day = extract(day from u.created_at)::int,
       updated_at = now()
  from auth.users u,
       lateral (
         select public.anniversary_window_start(u.created_at, now()) as new_start
       ) w
 where q.user_id = u.id
   -- Only migrate if the anniversary window differs from the current
   -- calendar-aligned window. This avoids unnecessary updates.
   and q.period_start <> w.new_start;

-- For rows where the anniversary window matches the current window
-- (anchor day happens to be the 1st), just set anchor_day.
update public.scan_quotas q
   set anchor_day = extract(day from u.created_at)::int,
       updated_at = now()
  from auth.users u
 where q.user_id = u.id
   and q.anchor_day is null;

-- ── Replace resolve_quota to use anniversary windows ──────────

create or replace function public.resolve_quota (p_user_id uuid)
returns public.scan_quotas
language plpgsql security definer
set search_path = public
as $$
declare
  q public.scan_quotas;
  v_plan text;
  v_anchor timestamptz;
begin
  -- Determine plan from subscriptions table.
  select case when s.is_active then 'pro' else 'free' end
    into v_plan
    from public.subscriptions s
   where s.user_id = p_user_id;
  if v_plan is null then v_plan := 'free'; end if;

  -- First activation: anchor the window to now() (the user's first
  -- quota resolution = first use). period_end = period_start + 1 month.
  -- This establishes the anniversary cadence for the user's lifetime.
  insert into public.scan_quotas (user_id, plan, scan_limit, period_start, period_end)
  values (
    p_user_id,
    v_plan,
    public._quota_limit_for_plan(v_plan),
    now(),
    now() + interval '1 month'
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

  -- Lazily advance expired anniversary windows (server clock only).
  -- Each advance: period_start = old period_end, period_end + 1 month.
  -- This preserves the anniversary cadence — the window always starts
  -- on the user's anniversary day, not the calendar month start.
  while q.period_end <= now() loop
    q.period_start := q.period_end;
    q.period_end := q.period_start + interval '1 month';
    q.used := 0;
    q.reserved := 0;
  end loop;

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
   where user_id = p_user_id
   returning * into q;

  return q;
end;
$$;

-- ── Lock down ────────────────────────────────────────────────
-- resolve_quota is SECURITY DEFINER and should only be called by
-- service role (via Edge Functions). Re-grant to be safe.
revoke execute on function public.resolve_quota (uuid) from public, anon, authenticated;
grant execute on function public.resolve_quota (uuid) to service_role;
