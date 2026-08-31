-- ─────────────────────────────────────────────────────────────
-- 0018_quota_4_per_month.sql — Launch quota policy (1.0.21)
--
-- REWRITTEN. The first draft of this migration was UNSAFE and was
-- never deployed. It overloaded the single `scan_quotas.used`
-- counter for two policies with different reset semantics:
--
--   Free  = 1 successful AI Snap per DURABLE USER LIFETIME
--   Pro   = 4 successful AI Snaps per MONTHLY window
--
-- Because Pro monthly windows reset `used` to 0, this lifecycle
-- silently restored a consumed Free introductory Snap:
--
--   Free consumes intro Snap        used = 1
--   → upgrades to Pro              used = 1 (carried, 1 of 4)
--   → new Pro monthly window       used = 0   ← reset
--   → returns to Free              used = 0   ← intro Snap restored (BUG)
--
-- This is not hypothetical: production contains a user with
-- ELEVEN committed Free Snaps in the authoritative ledger whose
-- current `used` counter reads 0.
--
-- ── New architecture ────────────────────────────────────────
--
-- Free lifetime consumption is now represented INDEPENDENTLY of
-- the Pro monthly counter, by a dedicated durable marker:
--
--   public.scan_quotas.free_lifetime_consumed boolean
--
--   * MONOTONIC: false → true only. Nothing in this schema ever
--     sets it back to false.
--   * Not affected by monthly window advance, plan change,
--     upgrade, downgrade, expiration, logout, or reinstall.
--   * Set exactly once, inside commit_scan(), and only when the
--     committed usage event was reserved as a FREE scan.
--
-- `used` is EXCLUSIVELY the Pro monthly counter. A successful Free
-- introductory Snap sets the marker and does NOT increment it, so
-- the two allowances never interfere:
--
--   Free intro consumed → upgrade to Pro ⇒ the FULL 4 Pro Snaps
--
-- The customer receives 1 Free introductory Snap + 4 Pro Snaps per
-- monthly window. That is deliberately NOT "5 Pro Snaps", and there
-- is NO combined Free+Pro cap.
--
-- Free-plan PRESENTATION is derived from the marker rather than
-- from `used`, via _present_quota(). Storage therefore stays
-- truthful for Pro while Free eligibility can never be revived
-- by a Pro reset. This also fixes the inverse defect: a Pro-only
-- user with used = 2 who downgrades to Free previously presented
-- as 2 used of 1 (0 remaining) and was wrongly denied the
-- introductory Snap they had never consumed.
--
-- ── Historical backfill (authoritative, not heuristic) ──────
--
-- public.scan_usage_events is an immutable per-request ledger:
--   plan_at_time_of_scan  text NOT NULL CHECK (in ('free','pro'))
--   status                text NOT NULL ('reserved'|'committed'
--                                        |'released'|'failed')
--   unique (user_id, request_id)
--
-- Both scan paths (reserve_scan for durable users and
-- reserve_guest_scan for anonymous users) write this ledger, and
-- both converge on commit_scan() for success. A successful FREE
-- Snap is therefore exactly:
--
--   status = 'committed' AND plan_at_time_of_scan = 'free'
--
-- The backfill reads that and nothing else. It does NOT consult
-- the `used` counter, which may have been reset.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Durable, monotonic Free lifetime marker ────────────────
alter table public.scan_quotas
  add column if not exists free_lifetime_consumed boolean not null default false;

comment on column public.scan_quotas.free_lifetime_consumed is
  'Monotonic (false->true only). True once this user has completed a '
  'successful FREE AI Snap. Independent of the Pro monthly `used` '
  'counter so Pro monthly resets can never restore the Free '
  'introductory allowance. Set only by commit_scan().';

-- ── 2. Backfill from the authoritative usage ledger ───────────
-- Conservative and exact: only a committed, free-at-reservation
-- usage event marks the lifetime allowance as consumed.
update public.scan_quotas q
   set free_lifetime_consumed = true,
       updated_at = now()
 where q.free_lifetime_consumed = false
   and exists (
     select 1
       from public.scan_usage_events e
      where e.user_id = q.user_id
        and e.status = 'committed'
        and e.plan_at_time_of_scan = 'free'
   );

-- ── 3. Pro monthly limit: 12 → 4 (Free stays 1) ───────────────
create or replace function public._quota_limit_for_plan (p_plan text)
returns integer as $$
  select case when p_plan = 'pro' then 4 else 1 end
$$ language sql immutable;

update public.scan_quotas
   set scan_limit = 4, updated_at = now()
 where plan = 'pro' and scan_limit <> 4;

update public.scan_quotas
   set scan_limit = 1, updated_at = now()
 where plan = 'free' and scan_limit <> 1;

-- ── 3b. Rebuild `used` as a PURE Pro current-window counter ───
-- Legacy `used` is CONTAMINATED: it counted Free successes too, so
-- it cannot be trusted as a Pro-only counter. It is therefore
-- discarded and rebuilt from the authoritative ledger.
--
-- Reconstruction rule (per user):
--   count(scan_usage_events
--         where status = 'committed'
--           and plan_at_time_of_scan = 'pro'
--           and quota_period_start falls inside the user's CURRENT
--               canonical anniversary quota window)
--
-- CANONICAL ATTRIBUTION: a Snap belongs to the window in which it
-- was RESERVED, recorded on the event as quota_period_start. This
-- is the rule already used by count_user_device_scans() (migration
-- 0004), and it is the rule admission control enforces — a
-- reservation is admitted against the counters of the window that
-- is current at reservation time. Using the reservation window
-- keeps admission, finalization, the live `used` counter, this
-- reconstruction, and rollover behaviour all internally consistent.
--
-- Window boundaries use the EXISTING canonical anchor
-- (auth.users.created_at → anniversary_window_start/end from
-- migration 0016). No new anchor is invented, and the quota window
-- remains independent of the store renewal date.
--
-- Verified on production before writing this migration:
--   * 0 committed events with a NULL completed_at
--   * 0 events with completed_at < created_at
--   * 0 NULL quota_period_start
--   * every committed Pro event's quota_period_start is EXACTLY
--     equal to that user's current canonical window start, so
--     reservation-window and completion-window attribution agree
--     on all existing data (no straddling events exist yet)
--   * the only real Pro user reconstructs to exactly their legacy
--     value (2 → 2), so no legitimate Pro usage is lost
--   * all 13 Free-contaminated rows reconstruct to 0
-- => reconstruction is authoritative and unambiguous.
update public.scan_quotas q
   set used = coalesce((
         select count(*)
           from public.scan_usage_events e
          where e.user_id = q.user_id
            and e.status = 'committed'
            and e.plan_at_time_of_scan = 'pro'
            and e.quota_period_start >= public.anniversary_window_start(u.created_at, now())
            and e.quota_period_start <  public.anniversary_window_end(
                  u.created_at,
                  public.anniversary_window_start(u.created_at, now()))
       ), 0),
       updated_at = now()
  from auth.users u
 where u.id = q.user_id;

-- ── 4. Presentation normaliser ────────────────────────────────
-- For FREE users, `used` is presented as a pure function of the
-- durable marker, NOT of the stored Pro monthly counter. This is
-- the single place that reconciles the two models, so every RPC
-- that returns a quota snapshot agrees.
--
-- Storage is left untouched: `used` continues to hold the true
-- Pro monthly count.
create or replace function public._present_quota (q public.scan_quotas)
returns public.scan_quotas
language plpgsql immutable as $$
begin
  if q.plan = 'free' then
    q.used := case when q.free_lifetime_consumed then 1 else 0 end;
  end if;
  return q;
end;
$$;

-- ── 4b. Reservation integrity helpers ─────────────────────────
--
-- `reserved` is a CACHE of "how many live reservations are
-- attributable to the CURRENT canonical window". It is derived from
-- the authoritative ledger rather than trusted as a free-running
-- scalar, because a scalar cannot survive a window advance: a
-- request reserved in window W and finalized in W+1 would otherwise
-- have its accounting applied to the wrong window.
--
-- Stale-reservation TTL. A reservation older than this is treated
-- as abandoned and swept to 'released' so it can never permanently
-- block a user (for Free, a single stuck reservation would
-- otherwise block the lifetime Snap forever). analyze-scan performs
-- a single synchronous vision call and is bounded by the Edge
-- Function wall-clock limit, so a live request can never approach
-- this TTL.
create or replace function public._reservation_ttl ()
returns interval as $$ select interval '15 minutes' $$ language sql immutable;

-- Sweep abandoned reservations for one user. Idempotent, and only
-- ever moves 'reserved' → 'released' (never touches a committed
-- event, never consumes quota).
create or replace function public._expire_stale_reservations (p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.scan_usage_events
     set status = 'released',
         completed_at = now(),
         failure_category = coalesce(failure_category, 'reservation_expired')
   where user_id = p_user_id
     and status = 'reserved'
     and created_at < now() - public._reservation_ttl();
end;
$$;

-- Live reservations attributable to a specific canonical window.
create or replace function public._live_reservations_in_window (
  p_user_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.scan_usage_events
   where user_id = p_user_id
     and status = 'reserved'
     and quota_period_start >= p_window_start
     and quota_period_start <  p_window_end
$$;

-- Live reservations for a user in ANY window. The Free introductory
-- allowance is a LIFETIME allowance, so its concurrency guard must
-- not be window-scoped: a Free reservation that straddles a rollover
-- must still block a second Free attempt.
create or replace function public._live_reservations_any_window (p_user_id uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.scan_usage_events
   where user_id = p_user_id
     and status = 'reserved'
$$;

-- ── 5. resolve_quota ──────────────────────────────────────────
-- Differences from 0016:
--   * free_lifetime_consumed is never written here (monotonic)
--   * abandoned reservations are swept before anything is counted
--   * `reserved` is DERIVED from the ledger for the current window,
--     so a rollover can neither forget nor mis-attribute an
--     in-flight reservation
--   * the returned snapshot is passed through _present_quota()
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
  -- Plan comes from the server-side subscription record only.
  -- Client/RevenueCat state is never consulted here.
  select case when s.is_active then 'pro' else 'free' end
    into v_plan
    from public.subscriptions s
   where s.user_id = p_user_id;
  if v_plan is null then v_plan := 'free'; end if;

  -- Immutable per-account anniversary anchor.
  select created_at into v_anchor from auth.users where id = p_user_id;
  if v_anchor is null then
    v_anchor := now();
  end if;

  v_window_start := public.anniversary_window_start(v_anchor, now());
  v_window_end := public.anniversary_window_end(v_anchor, v_window_start);

  -- Sweep abandoned reservations BEFORE anything is counted, so a
  -- stuck reservation can never permanently consume capacity.
  perform public._expire_stale_reservations(p_user_id);

  -- First activation.
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

  -- Plan change: swap the limit in place, preserve the Pro counter.
  if q.plan is distinct from v_plan then
    q.plan := v_plan;
    q.scan_limit := public._quota_limit_for_plan(v_plan);
  end if;

  if q.period_start <> v_window_start then
    if q.period_end <= now() then
      q.period_start := v_window_start;
      q.period_end := v_window_end;
      -- `used` is the PRO MONTHLY counter, scoped to a single
      -- window, so it resets on every window advance regardless of
      -- the plan held at this instant.
      --
      -- The reset MUST be unconditional: a user who was Pro in
      -- window W, downgraded to Free, then let the window roll to
      -- W+1 while Free, must not carry W's Pro count into W+1 when
      -- they re-upgrade. Free presentation does not read `used`
      -- (see _present_quota), so this is safe for Free users.
      --
      -- free_lifetime_consumed is NEVER reset here.
      q.used := 0;
    else
      -- Boundary snap only (migration), never a usage reset.
      q.period_start := v_window_start;
      q.period_end := v_window_end;
    end if;
  end if;

  -- ── Derive `reserved` from the authoritative ledger ─────────
  -- Never carried forward as a scalar across a window advance and
  -- never blindly zeroed. A reservation stamped to a PREVIOUS
  -- window is deliberately not counted here: it was admitted
  -- against that window's budget and, per commit_scan below, it
  -- will consume that window's budget — not this one.
  q.reserved := public._live_reservations_in_window(
    p_user_id, q.period_start, q.period_end);

  if q.daily_period_start < current_date then
    q.daily_period_start := current_date;
    q.daily_used := 0;
  end if;

  -- free_lifetime_consumed is deliberately absent from this UPDATE.
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

  return public._present_quota(q);
end;
$$;

-- ── 6. commit_scan — the single consumption chokepoint ────────
-- Both the durable path (reserve_scan) and the guest path
-- (reserve_guest_scan) converge here on success, so this is the
-- only place that may consume either allowance.
--
-- The EVENT's plan_at_time_of_scan is the canonical authority for
-- finalization semantics. The account's plan *right now* is
-- deliberately NOT consulted, so a plan change between reservation
-- and finalization cannot re-route the accounting:
--
--   event plan = 'free' → set free_lifetime_consumed
--                       → DO NOT touch the Pro monthly counter
--   event plan = 'pro'  → increment the Pro monthly counter
--                       → DO NOT touch free_lifetime_consumed
--
-- The two allowances are fully independent. A consumed Free
-- introductory Snap never occupies one of the four Pro monthly
-- slots: a Free user who upgrades still receives the full 4.
-- (1 Free introductory Snap + 4 Pro Snaps — not "5 Pro Snaps",
-- and there is no combined Free+Pro cap.)
--
-- Idempotency is unchanged and protects both allowances: the early
-- return on status <> 'reserved' means a duplicate finalize can
-- neither double-increment the Pro counter nor re-apply the marker.
--
-- ── Window attribution across a rollover ─────────────────────
-- A Snap belongs to the window in which it was RESERVED
-- (ev.quota_period_start). If a request is reserved in window W and
-- finalizes after the rollover into W+1, its success is charged to
-- W — the window whose budget admitted it — and must NOT consume
-- W+1's budget. Otherwise W+1 could accumulate more than 4
-- successes (proven reproducible before this fix).
--
-- Because `reserved` is derived per-window by resolve_quota, a
-- straddling event is not part of the current window's reserved
-- count, so its release/commit must not decrement that count
-- either.
create or replace function public.commit_scan (
  p_user_id uuid,
  p_request_id text,
  p_estimated_cost numeric default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  ev public.scan_usage_events;
  q public.scan_quotas;
  v_in_current_window boolean;
begin
  select * into ev from public.scan_usage_events
    where user_id = p_user_id and request_id = p_request_id for update;

  if not found or ev.status <> 'reserved' then
    return; -- already committed/released → idempotent no-op
  end if;

  update public.scan_usage_events
    set status = 'committed', completed_at = now(),
        estimated_provider_cost = p_estimated_cost
    where id = ev.id;

  select * into q from public.scan_quotas where user_id = p_user_id for update;
  if not found then
    return;
  end if;

  v_in_current_window := ev.quota_period_start >= q.period_start
                     and ev.quota_period_start <  q.period_end;

  if ev.plan_at_time_of_scan = 'free' then
    -- FREE success: consume the LIFETIME allowance only. The marker
    -- is not windowed, so it is set regardless of which window the
    -- reservation belonged to. `used` and `daily_used` are Pro-only
    -- counters and are deliberately left untouched.
    update public.scan_quotas
      set reserved = case when v_in_current_window
                          then greatest(0, reserved - 1) else reserved end,
          free_lifetime_consumed = true,   -- monotonic
          updated_at = now()
      where user_id = p_user_id;
  else
    -- PRO success: consume one Pro monthly slot, but ONLY from the
    -- window that admitted it. A straddling success is recorded in
    -- the ledger against its own window and leaves the current
    -- window's budget untouched.
    --
    -- daily_used is a same-day rate limiter rather than a monthly
    -- quota, so it always reflects activity performed today.
    update public.scan_quotas
      set used = case when v_in_current_window then used + 1 else used end,
          reserved = case when v_in_current_window
                          then greatest(0, reserved - 1) else reserved end,
          daily_used = daily_used + 1,
          updated_at = now()
      where user_id = p_user_id;
  end if;
end;
$$;

-- ── 6b. release_scan / release_guest_scan — window-scoped ─────
-- Releasing a reservation must free capacity in the window that
-- reserved it. Decrementing the current window's `reserved` for a
-- straddling event would free a slot that was never taken there,
-- which (proven before this fix) let a new window admit and
-- successfully finalize FIVE Pro Snaps.
create or replace function public.release_scan (
  p_user_id uuid,
  p_request_id text,
  p_failure_category text default 'technical_failure'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  ev public.scan_usage_events;
  q public.scan_quotas;
begin
  select * into ev from public.scan_usage_events
    where user_id = p_user_id and request_id = p_request_id for update;

  if not found or ev.status <> 'reserved' then
    return; -- idempotent no-op
  end if;

  update public.scan_usage_events
    set status = 'released', completed_at = now(),
        failure_category = p_failure_category
    where id = ev.id;

  select * into q from public.scan_quotas where user_id = p_user_id for update;
  if not found then
    return;
  end if;

  if ev.quota_period_start >= q.period_start
     and ev.quota_period_start < q.period_end then
    update public.scan_quotas
       set reserved = greatest(0, reserved - 1), updated_at = now()
     where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.release_guest_scan (
  p_user_id uuid,
  p_request_id text,
  p_failure_category text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ev public.scan_usage_events;
  q public.scan_quotas;
begin
  select * into ev from public.scan_usage_events
   where user_id = p_user_id and request_id = p_request_id for update;
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

  update public.scan_usage_events
     set status = 'released', failure_category = p_failure_category,
         completed_at = now()
   where id = ev.id;

  select * into q from public.scan_quotas where user_id = p_user_id for update;
  if found and ev.quota_period_start >= q.period_start
           and ev.quota_period_start <  q.period_end then
    update public.scan_quotas
       set reserved = greatest(0, reserved - 1), updated_at = now()
     where user_id = p_user_id;
  end if;

  q := public.resolve_quota(p_user_id);
  return jsonb_build_object('ok', true, 'code', 'released', 'quota', to_jsonb(q));
end;
$$;

-- ── 7. reserve_scan — Free gate uses the marker ───────────────
-- Fail-closed. For Free users the durable marker is the authority,
-- NOT `used` (which a Pro window may have reset). `reserved >= 1`
-- additionally serialises concurrent Free attempts: combined with
-- the FOR UPDATE row lock, at most one Free reservation can exist
-- at a time, so two concurrent requests can never both commit a
-- lifetime Snap.
create or replace function public.reserve_scan (
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

  if q.plan = 'free' then
    if q.free_lifetime_consumed then
      return jsonb_build_object('ok', false, 'code', 'free_lifetime_consumed',
                                'quota', to_jsonb(public._present_quota(q)));
    end if;
    -- LIFETIME-scoped concurrency guard. The Free allowance is not
    -- windowed, so a live Free reservation must block a second
    -- attempt even if it was reserved in a PREVIOUS window and has
    -- straddled a rollover. Abandoned reservations were already
    -- swept by resolve_quota, so this cannot block permanently.
    if public._live_reservations_any_window(p_user_id) >= 1 then
      return jsonb_build_object('ok', false, 'code', 'monthly_limit_reached',
                                'quota', to_jsonb(public._present_quota(q)));
    end if;
  else
    if q.used + q.reserved >= q.scan_limit then
      return jsonb_build_object('ok', false, 'code', 'monthly_limit_reached',
                                'quota', to_jsonb(public._present_quota(q)));
    end if;
    if q.daily_used >= public._pro_daily_limit() then
      return jsonb_build_object('ok', false, 'code', 'daily_limit_reached',
                                'quota', to_jsonb(public._present_quota(q)));
    end if;
  end if;

  update public.scan_quotas
     set reserved = reserved + 1, updated_at = now()
   where user_id = p_user_id;

  insert into public.scan_usage_events
    (request_id, user_id, image_hash, plan_at_time_of_scan, status, quota_period_start, provider)
  values
    (p_request_id, p_user_id, p_image_hash, q.plan, 'reserved', q.period_start, 'anthropic');

  select * into q from public.scan_quotas where user_id = p_user_id;
  return jsonb_build_object('ok', true, 'code', 'reserved',
                            'quota', to_jsonb(public._present_quota(q)));
end;
$$;

-- ── 8. reserve_guest_scan — same Free gate ────────────────────
-- Guests are always Free. The same durable marker applies, so a
-- guest who already consumed the introductory Snap on this
-- account cannot obtain another by any client-side means.
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

  select * into q from public.scan_quotas where user_id = p_user_id for update;

  if q.plan = 'free' then
    if q.free_lifetime_consumed then
      return jsonb_build_object('ok', false, 'code', 'free_lifetime_consumed',
                                'quota', to_jsonb(public._present_quota(q)));
    end if;
    -- LIFETIME-scoped concurrency guard (see reserve_scan).
    if public._live_reservations_any_window(p_user_id) >= 1 then
      return jsonb_build_object('ok', false, 'code', 'monthly_limit_reached',
                                'quota', to_jsonb(public._present_quota(q)));
    end if;
  elsif q.used + q.reserved >= q.scan_limit then
    return jsonb_build_object('ok', false, 'code', 'monthly_limit_reached',
                              'quota', to_jsonb(public._present_quota(q)));
  end if;

  update public.scan_quotas
     set reserved = reserved + 1, updated_at = now()
   where user_id = p_user_id;

  insert into public.scan_usage_events
    (request_id, user_id, image_hash, plan_at_time_of_scan, status, quota_period_start, provider)
  values
    (p_request_id, p_user_id, p_image_hash, q.plan, 'reserved', q.period_start, 'anthropic');

  select * into q from public.scan_quotas where user_id = p_user_id;
  return jsonb_build_object('ok', true, 'code', 'reserved',
                            'quota', to_jsonb(public._present_quota(q)));
end;
$$;

-- ── 9. Lock down: service role only ───────────────────────────
revoke execute on function public.resolve_quota (uuid) from public, anon, authenticated;
revoke execute on function public.commit_scan (uuid, text, numeric) from public, anon, authenticated;
revoke execute on function public.release_scan (uuid, text, text) from public, anon, authenticated;
revoke execute on function public.release_guest_scan (uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reserve_scan (uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reserve_guest_scan (uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public._present_quota (public.scan_quotas) from public, anon, authenticated;
revoke execute on function public._expire_stale_reservations (uuid) from public, anon, authenticated;
revoke execute on function public._live_reservations_in_window (uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public._live_reservations_any_window (uuid) from public, anon, authenticated;

grant execute on function public.resolve_quota (uuid) to service_role;
grant execute on function public.commit_scan (uuid, text, numeric) to service_role;
grant execute on function public.release_scan (uuid, text, text) to service_role;
grant execute on function public.release_guest_scan (uuid, text, text) to service_role;
grant execute on function public.reserve_scan (uuid, text, text) to service_role;
grant execute on function public.reserve_guest_scan (uuid, text, text, text) to service_role;
grant execute on function public._present_quota (public.scan_quotas) to service_role;
grant execute on function public._expire_stale_reservations (uuid) to service_role;
grant execute on function public._live_reservations_in_window (uuid, timestamptz, timestamptz) to service_role;
grant execute on function public._live_reservations_any_window (uuid) to service_role;
