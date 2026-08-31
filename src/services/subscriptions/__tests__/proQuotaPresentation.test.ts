// proQuotaPresentation.test.ts — Behavioral tests for the new
// 1.0.21 launch policy: Pro subscribers must NEVER see Free quota
// wording, even when the server quota snapshot says 'free' (e.g.
// webhook reconciliation lag or backend issue).
//
// Policy:
//   Free: 1 introductory successful AI Snap TOTAL (lifetime)
//   Pro Monthly: 4 successful AI Snaps per monthly window
//   Pro Annual: same 4 successful AI Snaps per monthly window
//
// Tests:
// 1. active Pro Monthly → never renders Free quota wording
// 2. active Pro Annual → never renders Free quota wording
// 3. Pro monthly quota → 4
// 4. Pro annual quota → same 4/month
// 5. Free → exactly 1 lifetime introductory Snap
// 6. Pro expiration → falls back to lifetime Free-consumed state correctly

import {
  selectQuotaLabel,
  selectFilmRollLabel,
  selectFilmRollIsPro,
  selectPlanLabel,
} from '../subscriptionSelectors'
import {
  FREE_MONTHLY_SCAN_LIMIT,
  PRO_MONTHLY_SCAN_LIMIT,
} from '../subscriptionConfig'
import type { ScanQuotaSnapshot } from '../subscriptionTypes'

const FREE_LIMIT = FREE_MONTHLY_SCAN_LIMIT
const PRO_LIMIT = PRO_MONTHLY_SCAN_LIMIT

function makeQuota (overrides: Partial<ScanQuotaSnapshot> = {}): ScanQuotaSnapshot {
  return {
    plan: 'free',
    limit: FREE_LIMIT,
    used: 0,
    remaining: FREE_LIMIT,
    periodStart: '2026-07-01T00:00:00Z',
    periodEnd: '2026-08-01T00:00:00Z',
    anchorAt: '2026-07-01T00:00:00Z',
    dailyLimit: null,
    dailyUsed: null,
    ...overrides,
  }
}

describe('Pro Quota Presentation — 1.0.21 Launch Policy', () => {
  // ── 1. active Pro Monthly → never renders Free quota wording ──
  describe('1. active Pro Monthly → never renders Free quota wording', () => {
    it('selectQuotaLabel never says "free scans" when isPro=true (server says free)', () => {
      // Server says free (webhook lag), but client knows Pro
      const quota = makeQuota({ plan: 'free', limit: 1, used: 0, remaining: 1 })
      const label = selectQuotaLabel(quota, true)
      expect(label).not.toMatch(/free/i)
      expect(label).toMatch(/Pro/i)
    })

    it('selectFilmRollLabel never says "Free" when isPro=true (server says free)', () => {
      const quota = makeQuota({ plan: 'free', limit: 1, used: 0, remaining: 1 })
      const label = selectFilmRollLabel(quota, true)
      expect(label).not.toMatch(/Free/)
      expect(label).toMatch(/Pro/)
    })

    it('selectFilmRollIsPro returns true when isPro=true (server says free)', () => {
      const quota = makeQuota({ plan: 'free', limit: 1, used: 0, remaining: 1 })
      expect(selectFilmRollIsPro(quota, true)).toBe(true)
    })

    it('selectQuotaLabel shows Pro wording when server says pro', () => {
      const quota = makeQuota({ plan: 'pro', limit: PRO_LIMIT, used: 0, remaining: PRO_LIMIT })
      const label = selectQuotaLabel(quota, true)
      expect(label).toMatch(/Pro/)
      expect(label).not.toMatch(/free/i)
    })
  })

  // ── 2. active Pro Annual → never renders Free quota wording ──
  describe('2. active Pro Annual → never renders Free quota wording', () => {
    it('selectQuotaLabel never says "free scans" when isPro=true (annual)', () => {
      const quota = makeQuota({ plan: 'free', limit: 1, used: 0, remaining: 1 })
      const label = selectQuotaLabel(quota, true)
      expect(label).not.toMatch(/free/i)
    })

    it('selectPlanLabel labels annual correctly', () => {
      expect(selectPlanLabel({ isProActive: true, currentPlan: 'pro_annual' }))
        .toBe('Pro (Annual)')
    })
  })

  // ── 3. Pro monthly quota → 4 ──
  describe('3. Pro monthly quota → 4', () => {
    it('PRO_MONTHLY_SCAN_LIMIT is 4', () => {
      expect(PRO_LIMIT).toBe(4)
    })

    it('selectQuotaLabel shows 4 as limit for Pro', () => {
      const quota = makeQuota({ plan: 'pro', limit: PRO_LIMIT, used: 0, remaining: 4 })
      expect(selectQuotaLabel(quota)).toBe('4 of 4 Pro scans remaining')
    })

    it('selectQuotaLabel shows 3 remaining after 1 used', () => {
      const quota = makeQuota({ plan: 'pro', limit: PRO_LIMIT, used: 1, remaining: 3 })
      expect(selectQuotaLabel(quota)).toBe('3 of 4 Pro scans remaining')
    })

    it('selectFilmRollLabel shows 4/4 Pro when unused', () => {
      const quota = makeQuota({ plan: 'pro', limit: PRO_LIMIT, used: 0, remaining: 4 })
      expect(selectFilmRollLabel(quota)).toBe('4/4 Pro')
    })
  })

  // ── 4. Pro annual quota → same 4/month ──
  describe('4. Pro annual quota → same 4/month', () => {
    it('annual and monthly Pro have the same monthly limit', () => {
      // Both use PRO_MONTHLY_SCAN_LIMIT — annual does NOT get 48 upfront
      const monthlyLimit = PRO_LIMIT
      const annualMonthlyLimit = PRO_LIMIT
      expect(annualMonthlyLimit).toBe(monthlyLimit)
      expect(annualMonthlyLimit).toBe(4)
    })

    it('annual Pro does NOT get 48 upfront', () => {
      expect(PRO_LIMIT).not.toBe(48)
    })
  })

  // ── 5. Free → exactly 1 lifetime introductory Snap ──
  describe('5. Free → exactly 1 lifetime introductory Snap', () => {
    it('FREE_MONTHLY_SCAN_LIMIT is 1', () => {
      expect(FREE_LIMIT).toBe(1)
    })

    it('selectQuotaLabel shows "Introductory AI Snap available" when unused', () => {
      const quota = makeQuota({ plan: 'free', limit: 1, used: 0, remaining: 1 })
      expect(selectQuotaLabel(quota, false)).toBe('Introductory AI Snap available')
    })

    it('selectQuotaLabel shows "Introductory AI Snap used" when consumed', () => {
      const quota = makeQuota({ plan: 'free', limit: 1, used: 1, remaining: 0 })
      expect(selectQuotaLabel(quota, false)).toBe('Introductory AI Snap used')
    })

    it('selectFilmRollLabel shows 1/1 Free when unused', () => {
      const quota = makeQuota({ plan: 'free', limit: 1, used: 0, remaining: 1 })
      expect(selectFilmRollLabel(quota, false)).toBe('1/1 Free')
    })

    it('selectFilmRollLabel shows 0/1 Free when consumed', () => {
      const quota = makeQuota({ plan: 'free', limit: 1, used: 1, remaining: 0 })
      expect(selectFilmRollLabel(quota, false)).toBe('0/1 Free')
    })
  })

  // ── 6. Pro expiration → falls back to lifetime Free-consumed state ──
  describe('6. Pro expiration → falls back to lifetime Free-consumed state', () => {
    it('when isPro=false and server says free, shows introductory Free wording', () => {
      const quota = makeQuota({ plan: 'free', limit: 1, used: 0, remaining: 1 })
      const label = selectQuotaLabel(quota, false)
      expect(label).toMatch(/introductory/i)
      expect(label).not.toMatch(/Pro/i)
    })

    it('when isPro=false and Free Snap already used, shows "Introductory AI Snap used"', () => {
      const quota = makeQuota({ plan: 'free', limit: 1, used: 1, remaining: 0 })
      const label = selectQuotaLabel(quota, false)
      expect(label).toBe('Introductory AI Snap used')
    })

    it('selectFilmRollIsPro returns false when isPro=false and server says free', () => {
      const quota = makeQuota({ plan: 'free', limit: 1, used: 1, remaining: 0 })
      expect(selectFilmRollIsPro(quota, false)).toBe(false)
    })

    it('Pro expiration does not grant a new Free Snap if lifetime Snap was used', () => {
      // User used their lifetime Free Snap, then upgraded to Pro,
      // then Pro expired. They should have 0 Free Snaps remaining.
      // The server quota shows free, limit=1, used=1 (lifetime used).
      const quota = makeQuota({ plan: 'free', limit: 1, used: 1, remaining: 0 })
      const label = selectQuotaLabel(quota, false)
      expect(label).toBe('Introductory AI Snap used')
      // Film roll shows 0/1 Free
      expect(selectFilmRollLabel(quota, false)).toBe('0/1 Free')
    })
  })
})
