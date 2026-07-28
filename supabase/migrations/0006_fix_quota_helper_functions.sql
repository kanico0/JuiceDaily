-- ─────────────────────────────────────────────────────────────
-- 0006_fix_quota_helper_functions.sql — Creates missing helper
-- functions that were defined in local 0001 but absent on the
-- remote database (which was provisioned with a different 0001
-- variant that used quota_limits() instead).
--
-- Without these functions, resolve_quota and reserve_scan error
-- with "function does not exist" when called.
--
-- This migration is additive and non-destructive:
--   * CREATE OR REPLACE is idempotent.
--   * Values match local 0001 definitions exactly.
--   * No data is modified.
-- ─────────────────────────────────────────────────────────────

-- Quota limit per plan: free = 5, pro = 60.
create or replace function public._quota_limit_for_plan (p_plan text)
returns integer
language sql immutable
as $$
  select case when p_plan = 'pro' then 60 else 5 end
$$;

-- Pro daily scan limit.
create or replace function public._pro_daily_limit ()
returns integer
language sql immutable
as $$
  select 10
$$;
