import {
  formatSavingsBadge,
  selectBillingStoreLabel,
  selectIsPro,
  selectNextRefreshLabel,
  selectPlanLabel,
  selectQuotaExhausted,
  selectQuotaLabel,
  selectRenewalLabel,
} from '../subscriptionSelectors'
import type { ScanQuotaSnapshot } from '../subscriptionTypes'

// Current authoritative policy:
//   Free = 1 AI Snap per monthly window
//   Pro  = 12 AI Snaps per monthly window
const FREE_LIMIT = 1
const PRO_LIMIT = 12

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

describe('selectIsPro / selectPlanLabel', () => {
  it('reports free correctly', () => {
    expect(selectIsPro({ isProActive: false })).toBe(false)
    expect(selectPlanLabel({ isProActive: false, currentPlan: 'free' })).toBe('Free')
  })

  it('labels monthly and annual plans', () => {
    expect(selectPlanLabel({ isProActive: true, currentPlan: 'pro_monthly' })).toBe('Pro (Monthly)')
    expect(selectPlanLabel({ isProActive: true, currentPlan: 'pro_annual' })).toBe('Pro (Annual)')
  })
})

describe('selectBillingStoreLabel', () => {
  it('maps sources to store copy', () => {
    expect(selectBillingStoreLabel({ source: 'app_store' })).toContain('Apple')
    expect(selectBillingStoreLabel({ source: 'play_store' })).toContain('Google Play')
    expect(selectBillingStoreLabel({ source: 'promotional' })).toContain('Promotional')
    expect(selectBillingStoreLabel({ source: null })).toBeNull()
  })
})

describe('selectRenewalLabel', () => {
  const future = new Date(Date.now() + 30 * 86400_000).toISOString()

  it('returns null when not pro or no expiration', () => {
    expect(selectRenewalLabel({ isProActive: false, expirationDate: null, willRenew: null, isInGracePeriod: false })).toBeNull()
    expect(selectRenewalLabel({ isProActive: true, expirationDate: null, willRenew: true, isInGracePeriod: false })).toBeNull()
  })

  it('renewal-off shows access-until, not loss of access', () => {
    const label = selectRenewalLabel({ isProActive: true, expirationDate: future, willRenew: false, isInGracePeriod: false })
    expect(label).toMatch(/^Active until/)
  })

  it('renewing subscription shows renews-on', () => {
    const label = selectRenewalLabel({ isProActive: true, expirationDate: future, willRenew: true, isInGracePeriod: false })
    expect(label).toMatch(/^Renews on/)
  })

  it('grace period is surfaced', () => {
    const label = selectRenewalLabel({ isProActive: true, expirationDate: future, willRenew: true, isInGracePeriod: true })
    expect(label).toMatch(/^Billing issue/)
  })
})

describe('quota selectors', () => {
  it('renders free usage copy for current policy (1/month)', () => {
    // Free plan: 1 AI Snap per month, 0 used → "0 of 1 free scans used this month"
    expect(selectQuotaLabel(makeQuota())).toBe('0 of 1 free scans used this month')
  })

  it('renders free usage copy when the single snap is used', () => {
    expect(selectQuotaLabel(makeQuota({ used: 1, remaining: 0 })))
      .toBe('1 of 1 free scans used this month')
  })

  it('renders pro remaining copy for current policy (12/month)', () => {
    // Pro plan: 12 AI Snaps per month, 4 used, 8 remaining
    expect(selectQuotaLabel(makeQuota({ plan: 'pro', limit: PRO_LIMIT, used: 4, remaining: 8 })))
      .toBe('8 of 12 Pro scans remaining')
  })

  it('renders pro remaining copy when fully unused', () => {
    expect(selectQuotaLabel(makeQuota({ plan: 'pro', limit: PRO_LIMIT, used: 0, remaining: 12 })))
      .toBe('12 of 12 Pro scans remaining')
  })

  it('null quota renders nothing', () => {
    expect(selectQuotaLabel(null)).toBeNull()
  })

  it('detects exhaustion for free (1 used of 1)', () => {
    expect(selectQuotaExhausted(makeQuota({ used: 1, remaining: 0 }))).toBe(true)
    expect(selectQuotaExhausted(makeQuota())).toBe(false)
    expect(selectQuotaExhausted(null)).toBe(false)
  })

  it('detects exhaustion for pro (12 used of 12)', () => {
    expect(selectQuotaExhausted(makeQuota({ plan: 'pro', limit: PRO_LIMIT, used: 12, remaining: 0 }))).toBe(true)
  })

  it('formats the next refresh date', () => {
    expect(selectNextRefreshLabel(makeQuota())).toBeTruthy()
    expect(selectNextRefreshLabel(makeQuota({ periodEnd: '' }))).toBeNull()
  })
})

describe('formatSavingsBadge', () => {
  it('formats positive savings', () => {
    expect(formatSavingsBadge(37)).toBe('Save 37%')
  })

  it('hides zero/absent savings', () => {
    expect(formatSavingsBadge(0)).toBeNull()
    expect(formatSavingsBadge(null)).toBeNull()
  })
})
