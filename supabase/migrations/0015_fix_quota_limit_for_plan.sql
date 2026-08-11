-- ─────────────────────────────────────────────────────────────
-- 0015_fix_quota_limit_for_plan.sql — Fix _quota_limit_for_plan
-- to return Free=1, Pro=12 (matching quota_limits() from 0013).
--
-- Root cause: migration 0013 updated quota_limits() but
-- resolve_quota() calls _quota_limit_for_plan() (from migration
-- 0006), which still returned 5/60. New scan_quotas rows created
-- by resolve_quota() inherited the stale limits.
-- ─────────────────────────────────────────────────────────────

create or replace function public._quota_limit_for_plan (p_plan text)
returns integer as $$
  select case when p_plan = 'pro' then 12 else 1 end
$$;

-- ── Update any rows that were created with the stale limit ────

update public.scan_quotas
   set scan_limit = 1, updated_at = now()
 where plan = 'free' and scan_limit <> 1;

update public.scan_quotas
   set scan_limit = 12, updated_at = now()
 where plan = 'pro' and scan_limit <> 12;
