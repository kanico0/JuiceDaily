-- ─────────────────────────────────────────────────────────────
-- 0011_quota_1_12.sql — Update scan quota limits to Free=1, Pro=12
--
-- Policy change:
--   FREE: 1 successful AI Snap per monthly quota window
--   PRO:  12 successful AI Snaps per monthly quota window
--   Annual Pro: 12 per monthly synthetic window (not 144 upfront)
--   Pro daily safety limit: 10 (unchanged — anti-abuse safeguard, not marketed)
--
-- The initial guest/free Snap is INCLUDED in the allowance.
-- Usage carries forward on upgrade (1 used of 1 Free → 1 used of 12 Pro).
-- Technical failures do not consume quota (release_scan still works).
-- Manual produce selection and manual juice logging remain free and unlimited.
--
-- This migration only updates the quota_limits() function and the
-- default scan_limit on the scan_quotas table. Existing quota rows
-- will pick up the new limit on their next resolve_quota() call
-- (plan transitions update scan_limit automatically).
-- ─────────────────────────────────────────────────────────────

-- ── Update quota_limits() to return new limits ────────────────

create or replace function public.quota_limits ()
returns table (free_limit integer, pro_limit integer, pro_daily_limit integer)
language sql immutable as $$
  select 1, 12, 10
$$;

-- ── Update default scan_limit for new quota rows ──────────────
-- Existing rows get their limit updated on next resolve_quota() call.

alter table public.scan_quotas
  alter column scan_limit set default 1;

-- ── Update existing free rows to new limit immediately ────────
-- Pro rows will get 12 on their next resolve_quota() call.
-- This is safe because used <= scan_limit is not enforced as a
-- constraint (only used >= 0 is). If a free user had used 5 of 5,
-- they now have used 5 of 1, which correctly blocks further scans.

update public.scan_quotas
   set scan_limit = 1, updated_at = now()
 where plan = 'free';

update public.scan_quotas
   set scan_limit = 12, updated_at = now()
 where plan = 'pro';

-- ── Update the comment on the resolve_quota function ──────────
-- The plan-transition comment in resolve_quota referenced 5/60.
-- The function itself reads from quota_limits() so it automatically
-- uses the new values. No function body change needed.
