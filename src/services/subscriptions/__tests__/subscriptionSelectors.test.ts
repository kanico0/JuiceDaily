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

function makeQuota (overrides: Partial<ScanQuotaSnapshot> = {}): ScanQuotaSnapshot {
  return {
    plan: 'free',
    limit: 5,
    used: 3,
    remaining: 2,
    periodStart: '2026-07-01T00:00:00Z',
    periodEnd: '2026-08-01T00:00:00Z',
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
  it('renders free usage copy', () => {
    expect(selectQuotaLabel(makeQuota())).toBe('3 of 5 free scans used this month')
  })

  it('renders pro remaining copy', () => {
    expect(selectQuotaLabel(makeQuota({ plan: 'pro', limit: 60, used: 18, remaining: 42 })))
      .toBe('42 of 60 Pro scans remaining')
  })

  it('null quota renders nothing', () => {
    expect(selectQuotaLabel(null)).toBeNull()
  })

  it('detects exhaustion', () => {
    expect(selectQuotaExhausted(makeQuota({ used: 5, remaining: 0 }))).toBe(true)
    expect(selectQuotaExhausted(makeQuota())).toBe(false)
    expect(selectQuotaExhausted(null)).toBe(false)
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
