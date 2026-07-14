// ─────────────────────────────────────────────────────────────
// subscriptionSelectors.ts — Pure selectors over SubscriptionState
// and quota snapshots for display. No side effects, fully testable.
// ─────────────────────────────────────────────────────────────

import type { ScanQuotaSnapshot, SubscriptionState } from './subscriptionTypes'

export function selectIsPro (state: Pick<SubscriptionState, 'isProActive'>): boolean {
  return state.isProActive
}

export function selectPlanLabel (state: Pick<SubscriptionState, 'isProActive' | 'currentPlan'>): string {
  if (!state.isProActive) return 'Free'
  return state.currentPlan === 'pro_annual' ? 'Pro (Annual)' : 'Pro (Monthly)'
}

export function selectBillingStoreLabel (state: Pick<SubscriptionState, 'source'>): string | null {
  switch (state.source) {
    case 'app_store':
      return 'Your subscription is managed through Apple.'
    case 'play_store':
      return 'Your subscription is managed through Google Play.'
    case 'promotional':
      return 'Promotional access.'
    default:
      return null
  }
}

// Renewal / expiration copy. Turning off renewal must not read as
// losing access immediately — access continues until expiration.
export function selectRenewalLabel (
  state: Pick<SubscriptionState, 'isProActive' | 'expirationDate' | 'willRenew' | 'isInGracePeriod'>,
): string | null {
  if (!state.isProActive || !state.expirationDate) return null
  const date = new Date(state.expirationDate)
  if (Number.isNaN(date.getTime())) return null
  const formatted = date.toLocaleDateString()
  if (state.isInGracePeriod) return `Billing issue — access until ${formatted}`
  if (state.willRenew === false) return `Active until ${formatted}`
  return `Renews on ${formatted}`
}

// ── Quota display ────────────────────────────────────────────

export function selectQuotaLabel (quota: ScanQuotaSnapshot | null): string | null {
  if (!quota) return null
  if (quota.plan === 'pro') {
    return `${quota.remaining} of ${quota.limit} Pro scans remaining`
  }
  return `${quota.used} of ${quota.limit} free scans used this month`
}

export function selectQuotaExhausted (quota: ScanQuotaSnapshot | null): boolean {
  if (!quota) return false
  return quota.remaining <= 0
}

export function selectNextRefreshLabel (quota: ScanQuotaSnapshot | null): string | null {
  if (!quota || !quota.periodEnd) return null
  const date = new Date(quota.periodEnd)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString()
}

// Annual savings display, computed from localized prices upstream.
export function formatSavingsBadge (annualSavingsPercent: number | null): string | null {
  if (!annualSavingsPercent || annualSavingsPercent <= 0) return null
  return `Save ${annualSavingsPercent}%`
}
