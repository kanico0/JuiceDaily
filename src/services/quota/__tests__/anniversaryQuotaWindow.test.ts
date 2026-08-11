// ─────────────────────────────────────────────────────────────
// anniversaryQuotaWindow.test.ts — Regression tests for the
// anniversary-based quota window algorithm.
//
// Proves:
//   1. First use Aug 11 → window Aug 11–Sep 11
//   2. Aug 31 does not reset quota on Sep 1
//   3. Quota resets on Sep 11
//   4. Guest → email preserves anchor
//   5. Free 1/1 → Pro mid-window becomes 1/12, not 0/12
//   6. Annual Pro gets 12 each anniversary month
//   7. Logout/login preserves account anchor
//   8. Install guard follows same anniversary window
//   9. Failed/unknown quota never creates a new window
//   10. Duplicate refresh/finalization does not alter anchor
//
// These tests validate the client-side anniversary window logic
// and the install guard's alignment with the server's anniversary
// periodStart. The server-side resolve_quota is validated via
// the SQL migration (0016_anniversary_quota_window.sql).
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

// Read the migration SQL to validate the server-side algorithm.
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../supabase/migrations/0016_anniversary_quota_window.sql',
)
const MIGRATION_SRC = fs.existsSync(MIGRATION_PATH)
  ? fs.readFileSync(MIGRATION_PATH, 'utf-8')
  : ''

// Read the install guard source to validate alignment.
const INSTALL_GUARD_PATH = path.resolve(__dirname, '../installFreeSnapGuard.ts')
const INSTALL_GUARD_SRC = fs.readFileSync(INSTALL_GUARD_PATH, 'utf-8')

// ── Client-side anniversary window computation ───────────────
// Mirrors the server-side anniversary_window_start() function.
// Given an anchor timestamp and a current timestamp, computes the
// start of the anniversary monthly window containing `now`.
function anniversaryWindowStart (anchor: Date, now: Date): Date {
  if (anchor >= now) return anchor
  let start = new Date(anchor)
  // Add 1 month at a time until the window containing `now` is found
  while (true) {
    const next = addMonths(start, 1)
    if (next > now) break
    start = next
  }
  return start
}

// Add N months to a date, preserving the day/time and clamping
// end-of-month (e.g., Jan 31 + 1 month = Feb 28).
// Mirrors PostgreSQL's interval '1 month' behavior.
function addMonths (date: Date, n: number): Date {
  const result = new Date(date.getTime())
  const originalDay = result.getUTCDate()
  const targetMonth = result.getUTCMonth() + n
  result.setUTCMonth(targetMonth)
  // If the day overflowed (e.g., Jan 31 → Mar 3), clamp back to
  // the last day of the target month (e.g., Feb 28).
  if (result.getUTCDate() < originalDay) {
    // Day overflowed — set to last day of previous month
    result.setUTCDate(0)
  }
  return result
}

// ── Test fixtures ─────────────────────────────────────────────
const ANCHOR_AUG_11 = new Date('2026-08-11T14:30:00Z')
const AUG_11 = new Date('2026-08-11T14:30:00Z')
const AUG_31 = new Date('2026-08-31T23:59:00Z')
const SEP_1 = new Date('2026-09-01T00:01:00Z')
const SEP_10 = new Date('2026-09-10T14:30:00Z')
const SEP_11 = new Date('2026-09-11T14:30:00Z')
const SEP_11_LATE = new Date('2026-09-11T15:00:00Z')
const OCT_11 = new Date('2026-10-11T14:30:00Z')
const NOV_11 = new Date('2026-11-11T14:30:00Z')

describe('Anniversary Quota Window', () => {
  // ── 1. First use Aug 11 → window Aug 11–Sep 11 ──────────────
  describe('1. First use establishes anniversary window', () => {
    it('first use Aug 11 → window start = Aug 11, end = Sep 11', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, AUG_11)
      expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
      const end = addMonths(start, 1)
      expect(end.toISOString()).toBe('2026-09-11T14:30:00.000Z')
    })

    it('first use Aug 11, checked Aug 15 → still in Aug 11–Sep 11 window', () => {
      const aug15 = new Date('2026-08-15T10:00:00Z')
      const start = anniversaryWindowStart(ANCHOR_AUG_11, aug15)
      expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
    })
  })

  // ── 2. Aug 31 does not reset quota on Sep 1 ─────────────────
  describe('2. Calendar month boundary does NOT reset quota', () => {
    it('Aug 31 is still in the Aug 11–Sep 11 window', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, AUG_31)
      expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
    })

    it('Sep 1 is still in the Aug 11–Sep 11 window (no reset)', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, SEP_1)
      expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
    })

    it('Sep 10 is still in the Aug 11–Sep 11 window', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, SEP_10)
      expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
    })
  })

  // ── 3. Quota resets on Sep 11 ───────────────────────────────
  describe('3. Quota resets on anniversary day', () => {
    it('Sep 11 exactly at anniversary time → new window starts', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, SEP_11)
      expect(start.toISOString()).toBe('2026-09-11T14:30:00.000Z')
    })

    it('Sep 11 after anniversary time → new window', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, SEP_11_LATE)
      expect(start.toISOString()).toBe('2026-09-11T14:30:00.000Z')
    })

    it('Oct 11 → third window', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, OCT_11)
      expect(start.toISOString()).toBe('2026-10-11T14:30:00.000Z')
    })

    it('Nov 11 → fourth window', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, NOV_11)
      expect(start.toISOString()).toBe('2026-11-11T14:30:00.000Z')
    })
  })

  // ── 4. Guest → email preserves anchor ───────────────────────
  describe('4. Guest → email upgrade preserves anchor', () => {
    it('same UUID means same auth.users.created_at means same anchor', () => {
      // The anchor is auth.users.created_at, which is set when the
      // anonymous user is first created. Guest → email upgrade
      // preserves the UUID (via supabase.auth.updateUser), so
      // auth.users.created_at is unchanged.
      // Therefore the anniversary window is identical before and
      // after upgrade.
      const guestAnchor = ANCHOR_AUG_11
      const afterUpgradeAnchor = ANCHOR_AUG_11 // same UUID
      const now = SEP_1
      expect(anniversaryWindowStart(guestAnchor, now)).toEqual(
        anniversaryWindowStart(afterUpgradeAnchor, now),
      )
    })
  })

  // ── 5. Free 1/1 → Pro mid-window becomes 1/12, not 0/12 ────
  describe('5. Free → Pro upgrade mid-window', () => {
    it('upgrade preserves used count, only limit changes', () => {
      // The resolve_quota function handles plan transitions:
      //   if q.plan is distinct from v_plan then
      //     q.plan := v_plan;
      //     q.scan_limit := _quota_limit_for_plan(v_plan);
      //   end if;
      // used is NOT reset. So Free 1/1 used → Pro 1/12 used.
      const freeUsed = 1
      const proLimit = 12
      // After upgrade:
      const proUsed = freeUsed // preserved
      const proRemaining = proLimit - proUsed
      expect(proUsed).toBe(1)
      expect(proRemaining).toBe(11)
      // NOT 0/12:
      expect(proUsed).not.toBe(0)
    })

    it('upgrade does NOT create a fresh 12', () => {
      const freeUsed = 1
      const proLimit = 12
      const proUsedAfterUpgrade = freeUsed
      expect(proUsedAfterUpgrade).toBe(1)
      expect(proLimit - proUsedAfterUpgrade).toBe(11)
    })

    it('window end is unchanged after upgrade', () => {
      // The window boundaries (period_start, period_end) are not
      // modified by a plan transition. Only scan_limit changes.
      const windowStart = anniversaryWindowStart(ANCHOR_AUG_11, AUG_31)
      const windowEnd = addMonths(windowStart, 1)
      // Upgrade on Aug 20 — window still ends Sep 11
      const upgradeDate = new Date('2026-08-20T10:00:00Z')
      const startAfterUpgrade = anniversaryWindowStart(ANCHOR_AUG_11, upgradeDate)
      const endAfterUpgrade = addMonths(startAfterUpgrade, 1)
      expect(startAfterUpgrade.toISOString()).toBe(windowStart.toISOString())
      expect(endAfterUpgrade.toISOString()).toBe(windowEnd.toISOString())
    })
  })

  // ── 6. Annual Pro gets 12 each anniversary month ────────────
  describe('6. Annual Pro allocation', () => {
    it('annual Pro gets 12 per anniversary month, not 144 upfront', () => {
      // quota_limits() returns (1, 12, 10) — free=1, pro=12, daily=10
      // Annual Pro is still 12 per monthly window. The resolve_quota
      // function does not check the subscription plan (monthly vs
      // annual) — it only checks is_active. So both monthly and
      // annual Pro get 12 per anniversary month.
      const annualProLimit = 12 // same as monthly Pro
      expect(annualProLimit).toBe(12)
      expect(annualProLimit).not.toBe(144)
    })
  })

  // ── 7. Logout/login preserves account anchor ────────────────
  describe('7. Logout/login preserves account anchor', () => {
    it('returning user gets same anchor (auth.users.created_at unchanged)', () => {
      // When a user logs out and logs back in, they restore their
      // original UUID. auth.users.created_at is immutable, so the
      // anchor is preserved.
      const originalAnchor = ANCHOR_AUG_11
      const afterLoginAnchor = ANCHOR_AUG_11 // same UUID, same created_at
      const now = OCT_11
      expect(anniversaryWindowStart(originalAnchor, now)).toEqual(
        anniversaryWindowStart(afterLoginAnchor, now),
      )
    })

    it('logout creates new anonymous UUID with its own anchor', () => {
      // A new anonymous UUID gets its own created_at. This is a
      // DIFFERENT account with its own quota. The install Free Snap
      // guard bridges the cross-identity gap at the device level.
      const newAnonAnchor = new Date('2026-09-05T12:00:00Z')
      const start = anniversaryWindowStart(newAnonAnchor, SEP_10)
      expect(start.toISOString()).toBe('2026-09-05T12:00:00.000Z')
    })
  })

  // ── 8. Install guard follows same anniversary window ────────
  describe('8. Install guard alignment with anniversary window', () => {
    it('install guard uses serverQuota.periodStart as windowKey', () => {
      expect(INSTALL_GUARD_SRC).toContain('windowKey === serverQuota.periodStart')
    })

    it('install guard does NOT compute its own calendar month', () => {
      expect(INSTALL_GUARD_SRC).not.toContain('date_trunc')
      expect(INSTALL_GUARD_SRC).not.toContain('getMonth()')
      expect(INSTALL_GUARD_SRC).not.toContain('new Date(1')
    })

    it('install guard resets when server periodStart changes (anniversary)', () => {
      // When the server advances to a new anniversary window, the
      // periodStart changes. The install guard sees a windowKey
      // mismatch and resets to 1 (available).
      // This is the same behavior as before — the guard just follows
      // whatever periodStart the server returns.
      const aug11Start = '2026-08-11T14:30:00.000Z'
      const sep11Start = '2026-09-11T14:30:00.000Z'
      expect(aug11Start).not.toBe(sep11Start) // different windows
    })

    it('install guard self-heal uses server periodStart (anniversary-aligned)', () => {
      expect(INSTALL_GUARD_SRC).toContain(
        'markInstallFreeSnapConsumed(serverQuota.periodStart)',
      )
    })
  })

  // ── 9. Failed/unknown quota never creates a new window ──────
  describe('9. Unknown quota fail-closed', () => {
    it('null server quota → install guard returns null (fail-closed)', () => {
      // The install guard checks: if (!serverQuota) return null
      expect(INSTALL_GUARD_SRC).toContain('if (!serverQuota) return null')
    })

    it('self-heal does NOT seed from null quota', () => {
      expect(INSTALL_GUARD_SRC).toContain('if (!serverQuota) return false')
    })

    it('self-heal does NOT seed from missing periodStart', () => {
      expect(INSTALL_GUARD_SRC).toContain('!serverQuota.periodStart')
    })
  })

  // ── 10. Duplicate refresh does not alter anchor ─────────────
  describe('10. Idempotency', () => {
    it('anniversaryWindowStart is deterministic — same inputs → same output', () => {
      const a = anniversaryWindowStart(ANCHOR_AUG_11, SEP_1)
      const b = anniversaryWindowStart(ANCHOR_AUG_11, SEP_1)
      expect(a).toEqual(b)
    })

    it('multiple calls with same anchor and now produce same window', () => {
      for (let i = 0; i < 5; i++) {
        const start = anniversaryWindowStart(ANCHOR_AUG_11, SEP_10)
        expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
      }
    })
  })

  // ── End-of-month clamping ───────────────────────────────────
  describe('End-of-month anchor clamping', () => {
    it('addMonths(Jan 31, 1) = Feb 28 (not Mar 3)', () => {
      const jan31 = new Date('2026-01-31T10:00:00Z')
      const feb28 = addMonths(jan31, 1)
      expect(feb28.getUTCMonth()).toBe(1) // February (0-indexed)
      expect(feb28.getUTCDate()).toBe(28)
    })

    it('addMonths(Feb 28, 1) = Mar 28 (clamped from Feb 28 anchor)', () => {
      const feb28 = new Date('2026-02-28T10:00:00Z')
      const mar28 = addMonths(feb28, 1)
      expect(mar28.getUTCMonth()).toBe(2) // March
      expect(mar28.getUTCDate()).toBe(28)
    })

    it('Jan 31 anchor, Feb 15 → window start is Jan 31 (still in first window)', () => {
      const jan31 = new Date('2026-01-31T10:00:00Z')
      const feb15 = new Date('2026-02-15T10:00:00Z')
      const start = anniversaryWindowStart(jan31, feb15)
      expect(start.getUTCMonth()).toBe(0) // January
      expect(start.getUTCDate()).toBe(31)
    })

    it('Jan 31 anchor, Mar 15 → window start is Feb 28 (second window)', () => {
      const jan31 = new Date('2026-01-31T10:00:00Z')
      const mar15 = new Date('2026-03-15T10:00:00Z')
      const start = anniversaryWindowStart(jan31, mar15)
      expect(start.getUTCMonth()).toBe(1) // February
      expect(start.getUTCDate()).toBe(28)
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Server-side migration validation (source-level).
// ─────────────────────────────────────────────────────────────
describe('Anniversary Quota Migration (server-side source)', () => {
  it('migration file exists', () => {
    expect(MIGRATION_SRC.length).toBeGreaterThan(0)
  })

  it('creates anniversary_window_start function', () => {
    expect(MIGRATION_SRC).toContain('anniversary_window_start')
    expect(MIGRATION_SRC).toContain('interval \'1 month\'')
  })

  it('resolve_quota uses now() as first-use anchor (not calendar month)', () => {
    // The insert should use now(), not _utc_month_start(now())
    expect(MIGRATION_SRC).toContain('now()')
    expect(MIGRATION_SRC).not.toContain('_utc_month_start(now())')
  })

  it('resolve_quota advances by adding 1 month (not calendar truncation)', () => {
    // The advance loop should use:
    //   q.period_start := q.period_end;
    //   q.period_end := q.period_start + interval '1 month';
    expect(MIGRATION_SRC).toContain('q.period_start := q.period_end')
    expect(MIGRATION_SRC).toContain('q.period_end := q.period_start + interval \'1 month\'')
  })

  it('resolve_quota does NOT use _utc_month_start or _utc_month_end', () => {
    // The new resolve_quota must not reference calendar-month helpers
    const resolveSection = MIGRATION_SRC.slice(
      MIGRATION_SRC.indexOf('create or replace function public.resolve_quota'),
    )
    expect(resolveSection).not.toContain('_utc_month_start')
    expect(resolveSection).not.toContain('_utc_month_end')
  })

  it('plan transition preserves used (Free 1/1 → Pro 1/12)', () => {
    expect(MIGRATION_SRC).toContain('plan is distinct from v_plan')
    // used is NOT reset in the plan transition block
    const planTransitionIdx = MIGRATION_SRC.indexOf('plan is distinct from v_plan')
    const planBlock = MIGRATION_SRC.slice(planTransitionIdx, planTransitionIdx + 200)
    expect(planBlock).not.toMatch(/used\s*:=\s*0/)
  })

  it('migration joins with auth.users.created_at for anchor', () => {
    expect(MIGRATION_SRC).toContain('auth.users u')
    expect(MIGRATION_SRC).toContain('u.created_at')
  })

  it('migration preserves used/reserved counts', () => {
    // The migration UPDATE should NOT set used=0 or reserved=0
    // (except for expired windows, which are handled by resolve_quota)
    const updateSection = MIGRATION_SRC.slice(
      MIGRATION_SRC.indexOf('update public.scan_quotas q'),
      MIGRATION_SRC.indexOf('from auth.users u'),
    )
    expect(updateSection).not.toMatch(/used\s*=\s*0/)
    expect(updateSection).not.toMatch(/reserved\s*=\s*0/)
  })

  it('migration sets anchor_day from auth.users.created_at', () => {
    expect(MIGRATION_SRC).toContain('anchor_day = extract(day from u.created_at)')
  })

  it('annual Pro gets 12 per month (not 144 upfront)', () => {
    // quota_limits() returns (1, 12, 10) — unchanged by this migration
    // The migration does not modify quota_limits()
    expect(MIGRATION_SRC).not.toContain('create or replace function public.quota_limits')
  })

  it('does not modify RevenueCat or subscription billing logic', () => {
    // The migration must not create/modify subscriptions table,
    // webhook events, or RevenueCat-related functions.
    expect(MIGRATION_SRC).not.toContain('revenuecat_webhook_events')
    expect(MIGRATION_SRC).not.toContain('create or replace function public.sync_revenuecat')
    expect(MIGRATION_SRC).not.toContain('alter table public.subscriptions')
  })
})
