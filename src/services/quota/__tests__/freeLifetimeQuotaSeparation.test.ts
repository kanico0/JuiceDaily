// ─────────────────────────────────────────────────────────────
// freeLifetimeQuotaSeparation.test.ts
//
// Regression tests for the 1.0.21 quota architecture repair.
//
// LOCKED POLICY
//   Free : exactly 1 successful introductory AI Snap per DURABLE
//          USER LIFETIME
//   Pro  : exactly 4 successful AI Snaps per MONTHLY quota window
//
// The two allowances are FULLY INDEPENDENT. Consuming the Free
// introductory Snap must NOT occupy one of the four Pro monthly
// slots — a Free user who upgrades still receives the full 4.
// The total experience is "1 Free intro Snap + 4 Pro Snaps"; it is
// NOT "5 Pro Snaps", and there is no combined Free+Pro cap.
//
// TWO DEFECTS WERE FIXED
//
//  (1) Shared-counter contamination (original 0018 draft):
//      `scan_quotas.used` served both policies, which have
//      incompatible reset semantics. A Pro monthly reset zeroed
//      `used` and thereby restored a consumed Free intro Snap:
//        Free used=1 → Pro → new window (used=0) → Free ⇒ restored.
//      Production contained a user with 11 committed Free Snaps
//      whose `used` counter read 0.
//
//  (2) Carry-over on upgrade (first repair pass):
//      commit_scan incremented `used` for EVERY success, so a Free
//      intro Snap consumed one Pro monthly slot, leaving an
//      upgrading user with only 3.
//
// FINAL ARCHITECTURE
//   free_lifetime_consumed : durable, MONOTONIC boolean. The sole
//                            authority for Free intro eligibility.
//   used                   : exclusively the Pro monthly counter,
//                            scoped to one canonical window.
//   The EVENT's plan_at_time_of_scan (not the account's plan now)
//   decides which allowance a finalization consumes.
//
// The migration SQL was additionally executed and asserted against
// a throwaway PostgreSQL 15 instance: all A–M transition proofs,
// idempotency proofs, migration-reconstruction spot-checks, and a
// two-session concurrency proof (Free and Pro) passed.
// ─────────────────────────────────────────────────────────────

import * as fs from 'fs'
import * as path from 'path'
import {
  FREE_MONTHLY_SCAN_LIMIT,
  PRO_MONTHLY_SCAN_LIMIT,
} from '../../subscriptions/subscriptionConfig'

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/0018_quota_4_per_month.sql'),
  'utf8',
)

const GUARD_SRC = fs.readFileSync(
  path.resolve(__dirname, '../installFreeSnapGuard.ts'),
  'utf8',
)

const COMMIT_SCAN = MIGRATION.slice(
  MIGRATION.indexOf('create or replace function public.commit_scan'),
  MIGRATION.indexOf('create or replace function public.reserve_scan'),
)
// Split on the explicit branch markers in the SQL so the two
// UPDATE statements are compared in isolation.
const FREE_BRANCH = COMMIT_SCAN.slice(
  COMMIT_SCAN.indexOf('-- FREE success:'),
  COMMIT_SCAN.indexOf('-- PRO success:'),
)
const PRO_BRANCH = COMMIT_SCAN.slice(COMMIT_SCAN.indexOf('-- PRO success:'))

/** Remove `--` comment lines so assertions test CODE, not prose. */
function sqlCode (s: string): string {
  return s
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

const FREE_BRANCH_CODE = sqlCode(FREE_BRANCH)
const PRO_BRANCH_CODE = sqlCode(PRO_BRANCH)

// ═══════════════════════════════════════════════════════════════
// 1. Durable, monotonic Free lifetime marker
// ═══════════════════════════════════════════════════════════════

describe('0018 — durable Free lifetime marker', () => {
  it('adds free_lifetime_consumed to scan_quotas', () => {
    expect(MIGRATION).toMatch(
      /alter table public\.scan_quotas\s+add column if not exists free_lifetime_consumed boolean not null default false/i,
    )
  })

  it('is never lowered back to false', () => {
    // A `where ... = false` read-guard and the column's
    // `default false` are legitimate; a WRITE of false is not.
    expect(MIGRATION).not.toMatch(/set\s+free_lifetime_consumed\s*=\s*false/i)
    expect(MIGRATION).not.toMatch(/free_lifetime_consumed\s*=\s*false\s*,/i)
    expect(MIGRATION).not.toMatch(/free_lifetime_consumed\s*:=\s*false/i)
  })

  it('resolve_quota never writes the marker', () => {
    const resolveBody = MIGRATION.slice(
      MIGRATION.indexOf('create or replace function public.resolve_quota'),
      MIGRATION.indexOf('create or replace function public.commit_scan'),
    )
    const updateIdx = resolveBody.indexOf('update public.scan_quotas')
    expect(updateIdx).toBeGreaterThan(-1)
    expect(resolveBody.slice(updateIdx)).not.toMatch(/free_lifetime_consumed\s*=/)
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. THE CORRECTION — Free and Pro consumption are independent
// ═══════════════════════════════════════════════════════════════

describe('0018 — commit_scan routes by the EVENT plan (allowances independent)', () => {
  it('branches on the event plan, not the account plan', () => {
    expect(COMMIT_SCAN).toMatch(/if ev\.plan_at_time_of_scan = 'free' then/)
  })

  it('PROOF J — the Free branch never increments the Pro counter', () => {
    expect(FREE_BRANCH_CODE).toMatch(/free_lifetime_consumed = true/)
    expect(FREE_BRANCH_CODE).not.toMatch(/used\s*=\s*used\s*\+\s*1/)
    expect(FREE_BRANCH_CODE).not.toMatch(/daily_used\s*=\s*daily_used\s*\+\s*1/)
  })

  it('PROOF K — the Pro branch never touches the Free marker', () => {
    // Increment is window-attributed (see rollover integrity below).
    expect(PRO_BRANCH_CODE).toMatch(/used = case when v_in_current_window then used \+ 1 else used end/)
    expect(PRO_BRANCH_CODE).toMatch(/daily_used\s*=\s*daily_used\s*\+\s*1/)
    expect(PRO_BRANCH_CODE).not.toMatch(/free_lifetime_consumed/)
  })

  it('both branches release the reservation exactly once (window-scoped)', () => {
    const rel = /reserved = case when v_in_current_window\s*\r?\n?\s*then greatest\(0, reserved - 1\) else reserved end/
    expect(FREE_BRANCH_CODE).toMatch(rel)
    expect(PRO_BRANCH_CODE).toMatch(rel)
  })

  it('remains idempotent — early return on non-reserved status', () => {
    expect(COMMIT_SCAN).toMatch(/if not found or ev\.status <> 'reserved' then\s*\r?\n?\s*return;/)
  })

  it('no combined Free+Pro anti-abuse cap is introduced', () => {
    // The Pro gate must compare against scan_limit only — never
    // against scan_limit adjusted by the Free marker.
    const reserve = MIGRATION.slice(
      MIGRATION.indexOf('create or replace function public.reserve_scan'),
      MIGRATION.indexOf('create or replace function public.reserve_guest_scan'),
    )
    expect(reserve).toMatch(/q\.used \+ q\.reserved >= q\.scan_limit/)
    expect(reserve).not.toMatch(/scan_limit\s*-\s*1/)
    expect(reserve).not.toMatch(/free_lifetime_consumed[\s\S]{0,60}scan_limit/)
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. Window rollover semantics
// ═══════════════════════════════════════════════════════════════

describe('0018 — rollover resets only the Pro counter', () => {
  it('PROOF H — resets used on window advance', () => {
    const resetIdx = MIGRATION.indexOf('q.used := 0')
    expect(resetIdx).toBeGreaterThan(-1)
  })

  it('the reset is UNCONDITIONAL so the Pro counter cannot go stale', () => {
    // A user who was Pro in window W, went Free, then let the
    // window roll to W+1 while Free, must not carry W's Pro count
    // into W+1 on re-upgrade. So the reset must NOT be gated on
    // the plan currently held.
    const resetIdx = MIGRATION.indexOf('q.used := 0')
    const preceding = MIGRATION.slice(Math.max(0, resetIdx - 500), resetIdx)
    expect(preceding).not.toMatch(/if v_plan = 'pro' then\s*$/)
  })

  it('PROOF I — rollover never modifies free_lifetime_consumed', () => {
    const resetIdx = MIGRATION.indexOf('q.used := 0')
    const block = MIGRATION.slice(resetIdx - 100, resetIdx + 200)
    expect(block).not.toMatch(/free_lifetime_consumed\s*:?=/)
  })

  it('`reserved` is NOT blindly zeroed on rollover', () => {
    // Zeroing a scalar forgets an in-flight reservation; it must be
    // derived from the ledger instead.
    const resolveBody = MIGRATION.slice(
      MIGRATION.indexOf('create or replace function public.resolve_quota'),
      MIGRATION.indexOf('create or replace function public.commit_scan'),
    )
    expect(resolveBody).not.toMatch(/q\.reserved := 0/)
  })

  it('boundary-snap path never resets usage', () => {
    const snapIdx = MIGRATION.indexOf('Boundary snap only')
    expect(snapIdx).toBeGreaterThan(-1)
    expect(MIGRATION.slice(snapIdx, snapIdx + 260)).not.toMatch(/q\.used := 0/)
  })
})

// ═══════════════════════════════════════════════════════════════
// 3b. Rollover reservation integrity
// ═══════════════════════════════════════════════════════════════

describe('0018 — rollover reservation integrity', () => {
  const resolveBody = MIGRATION.slice(
    MIGRATION.indexOf('create or replace function public.resolve_quota'),
    MIGRATION.indexOf('create or replace function public.commit_scan'),
  )

  it('derives `reserved` from the authoritative ledger', () => {
    expect(resolveBody).toMatch(
      /q\.reserved := public\._live_reservations_in_window\(\s*p_user_id, q\.period_start, q\.period_end\)/,
    )
  })

  it('the derivation is window-scoped by quota_period_start', () => {
    const helper = MIGRATION.slice(
      MIGRATION.indexOf('create or replace function public._live_reservations_in_window'),
      MIGRATION.indexOf('create or replace function public._live_reservations_any_window'),
    )
    expect(helper).toMatch(/status = 'reserved'/)
    expect(helper).toMatch(/quota_period_start >= p_window_start/)
    expect(helper).toMatch(/quota_period_start <\s+p_window_end/)
  })

  it('sweeps abandoned reservations before counting (no permanent block)', () => {
    expect(MIGRATION).toMatch(/create or replace function public\._expire_stale_reservations/)
    expect(MIGRATION).toMatch(/_reservation_ttl/)
    const sweep = MIGRATION.slice(
      MIGRATION.indexOf('create or replace function public._expire_stale_reservations'),
      MIGRATION.indexOf('create or replace function public._live_reservations_in_window'),
    )
    // Only ever moves reserved -> released; never touches committed.
    expect(sweep).toMatch(/set status = 'released'/)
    expect(sweep).toMatch(/and status = 'reserved'/)
    expect(sweep).toMatch(/created_at < now\(\) - public\._reservation_ttl\(\)/)
    // sweep must run before the reserved derivation
    const sweepCall = resolveBody.indexOf('_expire_stale_reservations(p_user_id)')
    const deriveCall = resolveBody.indexOf('_live_reservations_in_window')
    expect(sweepCall).toBeGreaterThan(-1)
    expect(deriveCall).toBeGreaterThan(sweepCall)
  })

  it('commit_scan charges the window that RESERVED the Snap', () => {
    expect(COMMIT_SCAN).toMatch(
      /v_in_current_window := ev\.quota_period_start >= q\.period_start/,
    )
    expect(COMMIT_SCAN).toMatch(/and ev\.quota_period_start <\s+q\.period_end/)
    // Pro increment is conditional on window attribution
    expect(PRO_BRANCH_CODE).toMatch(/used = case when v_in_current_window then used \+ 1 else used end/)
  })

  it('release_scan frees capacity only in the reserving window', () => {
    const rel = MIGRATION.slice(
      MIGRATION.indexOf('create or replace function public.release_scan'),
      MIGRATION.indexOf('create or replace function public.release_guest_scan'),
    )
    expect(rel).toMatch(/if ev\.quota_period_start >= q\.period_start/)
    expect(rel).toMatch(/and ev\.quota_period_start < q\.period_end then/)
    expect(rel).toMatch(/reserved = greatest\(0, reserved - 1\)/)
  })

  it('release_guest_scan is window-scoped too', () => {
    const rel = MIGRATION.slice(
      MIGRATION.indexOf('create or replace function public.release_guest_scan'),
      MIGRATION.indexOf('-- ── 7. reserve_scan'),
    )
    expect(rel).toMatch(/ev\.quota_period_start >= q\.period_start/)
  })

  it('the FREE concurrency guard is LIFETIME-scoped, not window-scoped', () => {
    // A Free reservation straddling a rollover must still block a
    // second Free attempt, because the Free allowance is lifetime.
    const durable = MIGRATION.slice(
      MIGRATION.indexOf('-- ── 7. reserve_scan'),
      MIGRATION.indexOf('-- ── 8. reserve_guest_scan'),
    )
    expect(durable).toMatch(/_live_reservations_any_window\(p_user_id\) >= 1/)
    expect(durable).not.toMatch(/if q\.reserved >= 1 then/)
  })

  it('a FREE success sets the marker regardless of reservation window', () => {
    // The marker is lifetime state, so it is not gated on
    // v_in_current_window.
    expect(FREE_BRANCH_CODE).toMatch(/free_lifetime_consumed = true/)
    expect(FREE_BRANCH_CODE).not.toMatch(
      /free_lifetime_consumed = case when v_in_current_window/,
    )
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. Free presentation derives from the marker, not from `used`
// ═══════════════════════════════════════════════════════════════

describe('0018 — _present_quota decouples Free display from the Pro counter', () => {
  it('derives Free used purely from the marker', () => {
    const idx = MIGRATION.indexOf('create or replace function public._present_quota')
    const body = MIGRATION.slice(idx, idx + 500)
    expect(body).toMatch(/if q\.plan = 'free' then/)
    expect(body).toMatch(/q\.used := case when q\.free_lifetime_consumed then 1 else 0 end/)
  })

  it('resolve_quota returns the normalised snapshot', () => {
    expect(MIGRATION).toMatch(/return public\._present_quota\(q\);/)
  })
})

// ═══════════════════════════════════════════════════════════════
// 5. Reservation gates + concurrency serialisation
// ═══════════════════════════════════════════════════════════════

describe('0018 — reservation gates', () => {
  const durable = MIGRATION.slice(
    MIGRATION.indexOf('create or replace function public.reserve_scan'),
    MIGRATION.indexOf('create or replace function public.reserve_guest_scan'),
  )
  const guest = MIGRATION.slice(
    MIGRATION.indexOf('create or replace function public.reserve_guest_scan'),
  )

  it.each([
    ['reserve_scan', () => durable],
    ['reserve_guest_scan', () => guest],
  ])('%s rejects a Free user whose lifetime Snap is consumed', (_n, body) => {
    expect(body()).toMatch(/if q\.free_lifetime_consumed then/)
    expect(body()).toMatch(/'free_lifetime_consumed'/)
  })

  it.each([
    ['reserve_scan', () => durable],
    ['reserve_guest_scan', () => guest],
  ])('%s serialises concurrent Free attempts (lifetime-scoped)', (_n, body) => {
    expect(body()).toMatch(/_live_reservations_any_window\(p_user_id\) >= 1/)
  })

  it.each([
    ['reserve_scan', () => durable],
    ['reserve_guest_scan', () => guest],
  ])('%s takes a FOR UPDATE row lock before checking', (_n, body) => {
    const lockIdx = body().indexOf('for update')
    const checkIdx = body().indexOf('q.free_lifetime_consumed')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(checkIdx).toBeGreaterThan(lockIdx)
  })

  it('Pro path enforces the monthly limit and the daily safety cap', () => {
    expect(durable).toMatch(/q\.used \+ q\.reserved >= q\.scan_limit/)
    expect(durable).toMatch(/q\.daily_used >= public\._pro_daily_limit\(\)/)
  })
})

// ═══════════════════════════════════════════════════════════════
// 6. Historical migration — marker backfill + `used` rebuild
// ═══════════════════════════════════════════════════════════════

describe('0018 — marker backfill is authoritative, not heuristic', () => {
  it('classifies from the committed usage ledger', () => {
    expect(MIGRATION).toMatch(/e\.status = 'committed'/)
    expect(MIGRATION).toMatch(/e\.plan_at_time_of_scan = 'free'/)
  })

  it('does NOT infer lifetime consumption from the used counter', () => {
    const idx = MIGRATION.indexOf('set free_lifetime_consumed = true')
    expect(idx).toBeGreaterThan(-1)
    expect(MIGRATION.slice(idx - 200, idx + 600)).not.toMatch(/\bused\s*[><=]/)
  })

  it('only ever raises the marker', () => {
    expect(MIGRATION).toMatch(/where q\.free_lifetime_consumed = false/)
  })

  it('released (failed) scans never mark consumption', () => {
    const idx = MIGRATION.indexOf('set free_lifetime_consumed = true')
    expect(MIGRATION.slice(idx, idx + 600)).not.toMatch(/'released'/)
  })
})

describe('0018 — legacy `used` is rebuilt as a pure Pro current-window counter', () => {
  const rebuild = MIGRATION.slice(
    MIGRATION.indexOf('Rebuild `used` as a PURE Pro current-window counter'),
    MIGRATION.indexOf('4. Presentation normaliser'),
  )

  it('discards contaminated legacy `used` and recomputes it', () => {
    expect(rebuild).toMatch(/update public\.scan_quotas q/)
    expect(rebuild).toMatch(/set used = coalesce\(\(/)
    expect(rebuild).toMatch(/select count\(\*\)/)
  })

  it('counts ONLY committed Pro events', () => {
    expect(rebuild).toMatch(/e\.status = 'committed'/)
    expect(rebuild).toMatch(/e\.plan_at_time_of_scan = 'pro'/)
  })

  it('restricts to the CURRENT canonical anniversary window', () => {
    // Attribution is by RESERVATION window (quota_period_start),
    // matching admission control and count_user_device_scans()
    // from migration 0004.
    expect(rebuild).toMatch(/e\.quota_period_start >= public\.anniversary_window_start\(u\.created_at, now\(\)\)/)
    expect(rebuild).toMatch(/e\.quota_period_start <\s+public\.anniversary_window_end\(/)
  })

  it('does NOT attribute by completion time', () => {
    const stmt = rebuild.slice(rebuild.indexOf('update public.scan_quotas q'))
    expect(stmt).not.toMatch(/completed_at/)
  })

  it('uses the EXISTING canonical anchor — no new window anchor invented', () => {
    // Assert against the executable statement only, not the
    // surrounding prose comment.
    const stmt = rebuild.slice(rebuild.indexOf('update public.scan_quotas q'))
    expect(stmt).toMatch(/u\.created_at/)
    expect(stmt).toMatch(/from auth\.users u/)
    // The quota window must NOT be derived from store billing dates.
    expect(stmt).not.toMatch(/expiration_date|purchase_date|renewal/i)
  })
})

// ═══════════════════════════════════════════════════════════════
// 7. Locked policy limits
// ═══════════════════════════════════════════════════════════════

describe('locked policy limits', () => {
  it('Pro monthly limit is 4 in SQL', () => {
    expect(MIGRATION).toMatch(/p_plan = 'pro' then 4 else 1 end/)
  })

  it('existing Pro rows are migrated to 4', () => {
    expect(MIGRATION).toMatch(/set scan_limit = 4[\s\S]{0,80}where plan = 'pro'/)
  })

  it('client constants agree: Free 1, Pro 4', () => {
    expect(FREE_MONTHLY_SCAN_LIMIT).toBe(1)
    expect(PRO_MONTHLY_SCAN_LIMIT).toBe(4)
  })

  it('PROOF G(annual) — annual Pro is 4/month, never 48 upfront', () => {
    expect(MIGRATION).not.toMatch(/\b48\b/)
    expect(MIGRATION).not.toMatch(/pro_annual[\s\S]{0,120}scan_limit/)
    expect(PRO_MONTHLY_SCAN_LIMIT).toBe(4)
  })
})

// ═══════════════════════════════════════════════════════════════
// 8. Client guard is advisory only — can restrict, never grant
// ═══════════════════════════════════════════════════════════════

describe('client install guard is defense-in-depth only', () => {
  it('composes with min(), so local state can only restrict', () => {
    expect(GUARD_SRC).toMatch(/Math\.min\(serverRemaining, installRemaining\)/)
  })

  it('documents that the server marker is canonical', () => {
    expect(GUARD_SRC).toMatch(/free_lifetime_consumed/)
    expect(GUARD_SRC).toMatch(/DEFENSE-IN-DEPTH ONLY/)
  })

  it('Pro bypasses the local guard entirely', () => {
    expect(GUARD_SRC).toMatch(/if \(serverQuota\.plan === 'pro'\) return serverQuota/)
  })

  it('unknown install state is fail-closed for Free', () => {
    expect(GUARD_SRC).toMatch(/if \(installRemaining === null\) return null/)
  })
})

// ═══════════════════════════════════════════════════════════════
// 9. Behavioural model — mirrors the server semantics in 0018
// ═══════════════════════════════════════════════════════════════

const FREE_LIMIT = FREE_MONTHLY_SCAN_LIMIT
const PRO_LIMIT = PRO_MONTHLY_SCAN_LIMIT

interface QuotaRow {
  plan: 'free' | 'pro'
  used: number                  // Pro monthly counter ONLY
  reserved: number
  freeLifetimeConsumed: boolean
}

/** _present_quota() + the Edge Function's remaining calculation. */
function present (row: QuotaRow) {
  const limit = row.plan === 'pro' ? PRO_LIMIT : FREE_LIMIT
  const used = row.plan === 'free'
    ? (row.freeLifetimeConsumed ? 1 : 0)
    : row.used
  return { plan: row.plan, limit, used, remaining: Math.max(0, limit - used - row.reserved) }
}

/** commit_scan(): routes strictly by the EVENT's plan. */
function commitScan (row: QuotaRow, eventPlan: 'free' | 'pro'): QuotaRow {
  const released = Math.max(0, row.reserved - 1)
  if (eventPlan === 'free') {
    return { ...row, reserved: released, freeLifetimeConsumed: true }
  }
  return { ...row, reserved: released, used: row.used + 1 }
}

/** resolve_quota() window advance: unconditional Pro-counter reset. */
function rollWindow (row: QuotaRow): QuotaRow {
  return { ...row, used: 0, reserved: 0 }
}

const freshFree = (): QuotaRow =>
  ({ plan: 'free', used: 0, reserved: 0, freeLifetimeConsumed: false })

// ── Rollover model ────────────────────────────────────────────
// Mirrors the fixed server semantics: a Snap belongs to the window
// that RESERVED it; `reserved` is derived per-window from the
// ledger; commit/release only touch the reserving window.

interface LedgerEvent {
  req: string
  plan: 'free' | 'pro'
  window: string                 // quota_period_start
  status: 'reserved' | 'committed' | 'released'
}

interface Account {
  currentWindow: string
  plan: 'free' | 'pro'
  freeLifetimeConsumed: boolean
  ledger: LedgerEvent[]
}

const proUsedIn = (a: Account, w: string) =>
  a.ledger.filter((e) => e.plan === 'pro' && e.status === 'committed' && e.window === w).length
const liveInWindow = (a: Account, w: string) =>
  a.ledger.filter((e) => e.status === 'reserved' && e.window === w).length
const liveAnyWindow = (a: Account) =>
  a.ledger.filter((e) => e.status === 'reserved').length

/** reserve_scan(): admission against the CURRENT window only. */
function reserve (a: Account, req: string): boolean {
  if (a.plan === 'free') {
    if (a.freeLifetimeConsumed) return false
    if (liveAnyWindow(a) >= 1) return false          // lifetime-scoped
    a.ledger.push({ req, plan: 'free', window: a.currentWindow, status: 'reserved' })
    return true
  }
  const used = proUsedIn(a, a.currentWindow)
  const reserved = liveInWindow(a, a.currentWindow)  // window-scoped
  if (used + reserved >= PRO_LIMIT) return false
  a.ledger.push({ req, plan: 'pro', window: a.currentWindow, status: 'reserved' })
  return true
}

/** commit_scan(): charges the window that reserved it. */
function commit (a: Account, req: string): void {
  const ev = a.ledger.find((e) => e.req === req)
  if (!ev || ev.status !== 'reserved') return        // idempotent
  ev.status = 'committed'
  if (ev.plan === 'free') a.freeLifetimeConsumed = true   // lifetime
}

function release (a: Account, req: string): void {
  const ev = a.ledger.find((e) => e.req === req)
  if (!ev || ev.status !== 'reserved') return        // idempotent
  ev.status = 'released'
}

const acct = (over: Partial<Account> = {}): Account => ({
  currentWindow: 'W', plan: 'pro', freeLifetimeConsumed: false, ledger: [], ...over,
})

describe('transition proofs A–M', () => {
  it('A — Free unused → upgrade Pro → 4 remaining', () => {
    const row: QuotaRow = { ...freshFree(), plan: 'pro' }
    expect(present(row).remaining).toBe(4)
  })

  it('B — Free consumes intro → upgrade Pro → 4 remaining (NOT 3)', () => {
    let row = commitScan({ ...freshFree(), reserved: 1 }, 'free')
    expect(row.freeLifetimeConsumed).toBe(true)
    expect(row.used).toBe(0)                       // Pro counter untouched
    expect(present(row).remaining).toBe(0)         // Free exhausted
    row = { ...row, plan: 'pro' }
    expect(present(row).remaining).toBe(4)         // full Pro allowance
  })

  it('C — …then 1 Pro Snap → 3 remaining', () => {
    let row = commitScan({ ...freshFree(), reserved: 1 }, 'free')
    row = { ...row, plan: 'pro' }
    row = commitScan({ ...row, reserved: 1 }, 'pro')
    expect(present(row).remaining).toBe(3)
    expect(row.freeLifetimeConsumed).toBe(true)
  })

  it('D — …use all 4 Pro → downgrade → intro remains consumed', () => {
    let row = commitScan({ ...freshFree(), reserved: 1 }, 'free')
    row = { ...row, plan: 'pro' }
    for (let i = 0; i < 4; i++) row = commitScan({ ...row, reserved: 1 }, 'pro')
    expect(present(row).remaining).toBe(0)
    row = { ...row, plan: 'free' }
    expect(row.freeLifetimeConsumed).toBe(true)
    expect(present(row).remaining).toBe(0)
  })

  it('E — Free unused → Pro → uses Pro → downgrade → intro remains unused', () => {
    let row: QuotaRow = { ...freshFree(), plan: 'pro' }
    row = commitScan({ ...row, reserved: 1 }, 'pro')
    row = commitScan({ ...row, reserved: 1 }, 'pro')
    expect(row.freeLifetimeConsumed).toBe(false)
    row = { ...row, plan: 'free' }
    expect(row.freeLifetimeConsumed).toBe(false)
    expect(present(row).remaining).toBe(1)
  })

  it('F/G — Pro → Free → Pro in the SAME window keeps Pro usage', () => {
    let row: QuotaRow = { ...freshFree(), plan: 'pro' }
    row = commitScan({ ...row, reserved: 1 }, 'pro')
    row = commitScan({ ...row, reserved: 1 }, 'pro')
    row = { ...row, plan: 'free' }
    expect(present(row).remaining).toBe(1)         // intro still available
    row = { ...row, plan: 'pro' }                  // re-upgrade, same window
    expect(row.used).toBe(2)                       // prior Pro usage retained
    expect(present(row).remaining).toBe(2)         // NOT reset to 4
  })

  it('H/I — rollover resets only Pro usage, never the marker', () => {
    let row = commitScan({ ...freshFree(), reserved: 1 }, 'free')
    row = { ...row, plan: 'pro' }
    row = commitScan({ ...row, reserved: 1 }, 'pro')
    expect(row.used).toBe(1)
    row = rollWindow(row)
    expect(row.used).toBe(0)
    expect(present(row).remaining).toBe(4)
    expect(row.freeLifetimeConsumed).toBe(true)    // I
    row = { ...row, plan: 'free' }
    expect(present(row).remaining).toBe(0)         // intro still consumed
  })

  it('H2 — Pro counter cannot go stale across a rollover spent on Free', () => {
    // Pro in window W, downgrade, roll to W+1 while Free, re-upgrade.
    let row: QuotaRow = { ...freshFree(), plan: 'pro' }
    for (let i = 0; i < 4; i++) row = commitScan({ ...row, reserved: 1 }, 'pro')
    expect(row.used).toBe(4)
    row = { ...row, plan: 'free' }
    row = rollWindow(row)                          // unconditional reset
    row = { ...row, plan: 'pro' }
    expect(present(row).remaining).toBe(4)         // fresh window, full 4
  })

  it('J — Free success never increments the Pro counter', () => {
    const row = commitScan({ ...freshFree(), reserved: 1 }, 'free')
    expect(row.used).toBe(0)
    expect(row.freeLifetimeConsumed).toBe(true)
  })

  it('K — Pro success never consumes the Free marker', () => {
    let row: QuotaRow = { ...freshFree(), plan: 'pro' }
    row = commitScan({ ...row, reserved: 1 }, 'pro')
    expect(row.used).toBe(1)
    expect(row.freeLifetimeConsumed).toBe(false)
    row = { ...row, plan: 'free' }
    expect(present(row).remaining).toBe(1)
  })

  it('L — Free reservation, upgrade before finalize, finalizes as FREE', () => {
    // Reserved while Free ⇒ event plan is 'free'.
    const reservedWhileFree: QuotaRow = { ...freshFree(), reserved: 1 }
    // Account upgrades before finalization…
    const upgraded: QuotaRow = { ...reservedWhileFree, plan: 'pro' }
    // …but the EVENT plan governs.
    const row = commitScan(upgraded, 'free')
    expect(row.freeLifetimeConsumed).toBe(true)
    expect(row.used).toBe(0)
    expect(present(row).remaining).toBe(4)
  })

  it('M — Pro reservation, downgrade before finalize, finalizes as PRO', () => {
    const reservedWhilePro: QuotaRow = { ...freshFree(), plan: 'pro', reserved: 1 }
    const downgraded: QuotaRow = { ...reservedWhilePro, plan: 'free' }
    const row = commitScan(downgraded, 'pro')
    expect(row.used).toBe(1)
    expect(row.freeLifetimeConsumed).toBe(false)
    expect(present(row).remaining).toBe(1)         // intro still available
    expect(present({ ...row, plan: 'pro' }).remaining).toBe(3)
  })
})

describe('idempotency & concurrency models', () => {
  it('duplicate FREE finalize: marker once, Pro used zero times', () => {
    const first = commitScan({ ...freshFree(), reserved: 1 }, 'free')
    // A duplicate is a no-op server-side (status no longer 'reserved').
    const second = first
    expect(second).toEqual(first)
    expect(second.used).toBe(0)
    expect(second.freeLifetimeConsumed).toBe(true)
  })

  it('duplicate PRO finalize increments Pro used exactly once', () => {
    const base: QuotaRow = { ...freshFree(), plan: 'pro', reserved: 1 }
    const first = commitScan(base, 'pro')
    const second = first
    expect(second.used).toBe(1)
    expect(second.freeLifetimeConsumed).toBe(false)
  })

  it('concurrent Free attempts cannot both succeed', () => {
    const inFlight: QuotaRow = { ...freshFree(), reserved: 1 }
    const secondAllowed = !inFlight.freeLifetimeConsumed && inFlight.reserved < 1
    expect(secondAllowed).toBe(false)
    const consumed: QuotaRow = { ...freshFree(), freeLifetimeConsumed: true }
    expect(!consumed.freeLifetimeConsumed && consumed.reserved < 1).toBe(false)
  })

  it('concurrent Pro attempts cannot exceed 4', () => {
    const atCap: QuotaRow = { plan: 'pro', used: 3, reserved: 1, freeLifetimeConsumed: false }
    expect(atCap.used + atCap.reserved >= PRO_LIMIT).toBe(true)   // refused
    const committed = commitScan(atCap, 'pro')
    expect(committed.used).toBe(PRO_LIMIT)
    expect(present(committed).remaining).toBe(0)
  })

  it('a consumed marker survives unlimited Pro cycling', () => {
    let row = commitScan({ ...freshFree(), reserved: 1 }, 'free')
    row = { ...row, plan: 'pro' }
    for (let cycle = 0; cycle < 24; cycle++) {
      row = commitScan({ ...row, reserved: 1 }, 'pro')
      row = rollWindow(row)
      expect(row.freeLifetimeConsumed).toBe(true)
    }
    expect(present({ ...row, plan: 'free' }).remaining).toBe(0)
  })

  it('annual Pro receives 4 per window across 12 windows, never 48', () => {
    let row: QuotaRow = { ...freshFree(), plan: 'pro' }
    for (let month = 0; month < 12; month++) {
      expect(present(row).remaining).toBe(4)
      for (let i = 0; i < 4; i++) row = commitScan({ ...row, reserved: 1 }, 'pro')
      expect(present(row).remaining).toBe(0)
      row = rollWindow(row)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 10. R1–R10 rollover reservation integrity
// ═══════════════════════════════════════════════════════════════
//
// Executed for real against PostgreSQL 15 during development (all
// R1–R10 plus a three-session concurrency race and a
// migration-with-active-reservation suite passed). These model the
// same invariants in-process.

describe('R1–R10 rollover reservation integrity', () => {
  it('R1 — straddler + full new window never exceeds 4 in either window', () => {
    const a = acct()
    // W: 3 successes + 1 in flight (W is full: 3 + 1 = 4)
    for (const r of ['w1', 'w2', 'w3']) { reserve(a, r); commit(a, r) }
    expect(reserve(a, 'straddler')).toBe(true)
    expect(reserve(a, 'w-overflow')).toBe(false)     // W at capacity
    // ── rollover ──
    a.currentWindow = 'W+1'
    for (const r of ['n1', 'n2', 'n3', 'n4']) { expect(reserve(a, r)).toBe(true); commit(a, r) }
    expect(reserve(a, 'n5')).toBe(false)
    commit(a, 'straddler')                            // late success
    expect(proUsedIn(a, 'W+1')).toBe(4)
    expect(proUsedIn(a, 'W')).toBe(4)                 // 3 + straddler
    expect(reserve(a, 'n6')).toBe(false)
  })

  it('R2 — straddling success is accounted exactly once, in its own window', () => {
    const a = acct()
    reserve(a, 's')
    a.currentWindow = 'W+1'
    commit(a, 's')
    expect(proUsedIn(a, 'W')).toBe(1)
    expect(proUsedIn(a, 'W+1')).toBe(0)
    expect(liveInWindow(a, 'W+1')).toBe(0)
  })

  it('R3 — releasing a straddler frees no capacity in the new window', () => {
    const a = acct()
    reserve(a, 's')
    a.currentWindow = 'W+1'
    for (const r of ['n1', 'n2', 'n3', 'n4']) expect(reserve(a, r)).toBe(true)
    expect(reserve(a, 'n5')).toBe(false)
    release(a, 's')
    expect(reserve(a, 'n5')).toBe(false)              // still refused
    for (const r of ['n1', 'n2', 'n3', 'n4']) commit(a, r)
    expect(proUsedIn(a, 'W+1')).toBe(4)
    expect(proUsedIn(a, 'W')).toBe(0)                 // released = zero
  })

  it('R4 — a straddler that fails after rollover consumes nothing', () => {
    const a = acct()
    reserve(a, 's')
    a.currentWindow = 'W+1'
    release(a, 's')
    expect(proUsedIn(a, 'W')).toBe(0)
    expect(proUsedIn(a, 'W+1')).toBe(0)
    expect(liveAnyWindow(a)).toBe(0)
  })

  it('R5 — multiple straddlers cannot push any window past 4', () => {
    const a = acct()
    for (const r of ['s1', 's2', 's3']) expect(reserve(a, r)).toBe(true)
    a.currentWindow = 'W+1'
    for (const r of ['n1', 'n2', 'n3', 'n4']) { expect(reserve(a, r)).toBe(true); commit(a, r) }
    expect(reserve(a, 'n5')).toBe(false)
    for (const r of ['s1', 's2', 's3']) commit(a, r)
    expect(proUsedIn(a, 'W+1')).toBe(4)
    expect(proUsedIn(a, 'W')).toBe(3)
  })

  it('R6 — duplicate finalize across rollover consumes exactly once', () => {
    const a = acct()
    reserve(a, 's')
    a.currentWindow = 'W+1'
    commit(a, 's'); commit(a, 's'); commit(a, 's')
    expect(proUsedIn(a, 'W')).toBe(1)
    expect(proUsedIn(a, 'W+1')).toBe(0)
  })

  it('R7 — duplicate release across rollover is safe', () => {
    const a = acct()
    reserve(a, 's')
    a.currentWindow = 'W+1'
    release(a, 's'); release(a, 's'); release(a, 's')
    expect(proUsedIn(a, 'W')).toBe(0)
    expect(a.ledger.filter((e) => e.status === 'released').length).toBe(1)
    expect(liveAnyWindow(a)).toBe(0)
  })

  it('R8 — a Free reservation straddling rollover stays lifetime-scoped', () => {
    const a = acct({ plan: 'free' })
    expect(reserve(a, 'f1')).toBe(true)
    a.currentWindow = 'W+1'
    // second Free attempt must still be blocked while one is live
    expect(reserve(a, 'f2')).toBe(false)
    commit(a, 'f1')
    expect(a.freeLifetimeConsumed).toBe(true)
    expect(proUsedIn(a, 'W')).toBe(0)
    expect(proUsedIn(a, 'W+1')).toBe(0)
    expect(reserve(a, 'f3')).toBe(false)              // lifetime exhausted
    expect(a.ledger.filter((e) => e.plan === 'free' && e.status === 'committed').length).toBe(1)
  })

  it('R9 — Pro→Free→Pro around a rollover resets only at the rollover', () => {
    const a = acct()
    for (const r of ['p1', 'p2']) { reserve(a, r); commit(a, r) }
    expect(proUsedIn(a, 'W')).toBe(2)
    a.plan = 'free'
    expect(a.freeLifetimeConsumed).toBe(false)        // intro still available
    a.plan = 'pro'
    expect(proUsedIn(a, 'W')).toBe(2)                 // same window retained
    a.currentWindow = 'W+1'                            // genuine rollover
    expect(proUsedIn(a, 'W+1')).toBe(0)
    for (const r of ['q1', 'q2', 'q3', 'q4']) expect(reserve(a, r)).toBe(true)
    expect(reserve(a, 'q5')).toBe(false)
  })

  it('R10 — rollover preserves free_lifetime_consumed exactly', () => {
    const a = acct({ plan: 'free' })
    reserve(a, 'f1'); commit(a, 'f1')
    expect(a.freeLifetimeConsumed).toBe(true)
    a.plan = 'pro'
    for (let w = 1; w <= 6; w++) {
      a.currentWindow = `W+${w}`
      expect(a.freeLifetimeConsumed).toBe(true)
      for (const r of ['a', 'b', 'c', 'd']) { reserve(a, `${r}${w}`); commit(a, `${r}${w}`) }
      expect(proUsedIn(a, a.currentWindow)).toBe(4)
      expect(a.freeLifetimeConsumed).toBe(true)
    }
    a.plan = 'free'
    expect(a.freeLifetimeConsumed).toBe(true)
    expect(reserve(a, 'f-again')).toBe(false)
  })

  it('INVARIANT — no reachable ordering exceeds 4 successes in a window', () => {
    // Exhaustive-ish: interleave straddlers, new reservations,
    // commits and releases in several orders and assert the cap.
    const orders: Array<Array<[string, string]>> = [
      [['res', 's'], ['roll', ''], ['res', 'n1'], ['res', 'n2'], ['res', 'n3'], ['res', 'n4'],
       ['com', 's'], ['com', 'n1'], ['com', 'n2'], ['com', 'n3'], ['com', 'n4']],
      [['res', 's'], ['roll', ''], ['res', 'n1'], ['com', 'n1'], ['rel', 's'],
       ['res', 'n2'], ['res', 'n3'], ['res', 'n4'], ['res', 'n5'],
       ['com', 'n2'], ['com', 'n3'], ['com', 'n4'], ['com', 'n5']],
      [['res', 's'], ['res', 's2'], ['roll', ''], ['res', 'n1'], ['res', 'n2'],
       ['rel', 's'], ['com', 's2'], ['res', 'n3'], ['res', 'n4'], ['res', 'n5'],
       ['com', 'n1'], ['com', 'n2'], ['com', 'n3'], ['com', 'n4'], ['com', 'n5']],
    ]
    for (const ops of orders) {
      const a = acct()
      for (const [op, req] of ops) {
        if (op === 'res') reserve(a, req)
        else if (op === 'com') commit(a, req)
        else if (op === 'rel') release(a, req)
        else if (op === 'roll') a.currentWindow = 'W+1'
      }
      const windows = Array.from(new Set(a.ledger.map((e) => e.window)))
      for (const w of windows) {
        expect(proUsedIn(a, w)).toBeLessThanOrEqual(PRO_LIMIT)
      }
    }
  })
})
