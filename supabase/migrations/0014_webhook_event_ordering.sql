-- ─────────────────────────────────────────────────────────────
-- 0014_webhook_event_ordering.sql — Add event timestamp for
-- stale-event protection and relax status CHECK to allow 'pending'.
--
-- The original 0001 schema created revenuecat_webhook_events with:
--   status text check (status in ('processed', 'skipped', 'failed'))
--   detail text
--
-- The Edge Function was written against a different in-memory schema
-- (payload jsonb, processed boolean) that was never migrated.
-- This migration aligns the table to support the corrected Edge
-- Function contract:
--   - detail (text): sanitized JSON string for diagnostics
--   - status (text): 'pending' | 'processed' | 'skipped' | 'failed'
--   - event_timestamp_ms (bigint): RevenueCat event timestamp for
--     stale-event ordering protection
--
-- No existing data is lost. The CHECK constraint is replaced to
-- allow 'pending' (inserted but not yet fully processed).
-- ─────────────────────────────────────────────────────────────

-- ── Add event_timestamp_ms for stale-event protection ─────────
alter table public.revenuecat_webhook_events
  add column if not exists event_timestamp_ms bigint;

-- ── Relax status CHECK to allow 'pending' ─────────────────────
-- The original constraint only allowed terminal states. We need
-- 'pending' for the insert-then-update pattern (insert as pending,
-- update to processed/skipped/failed after handling).
alter table public.revenuecat_webhook_events
  drop constraint if exists revenuecat_webhook_events_status_check;

alter table public.revenuecat_webhook_events
  add constraint revenuecat_webhook_events_status_check
  check (status in ('pending', 'processed', 'skipped', 'failed'));

-- ── Backfill any existing rows (all are already processed) ────
update public.revenuecat_webhook_events
   set status = 'processed'
 where status is null or status = '';
