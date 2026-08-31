// ─────────────────────────────────────────────────────────────
// subscriptionSelectors.ts — Pure selectors over SubscriptionState
// and quota snapshots for display. No side effects, fully testable.
// ─────────────────────────────────────────────────────────────

import type { ScanQuotaSnapshot, SubscriptionState } from './subscriptionTypes'
import { PRO_MONTHLY_SCAN_LIMIT } from './subscriptionConfig'

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
// NEW POLICY: An active Pro subscriber must NEVER see "free scans"
// quota wording. When isPro is true, the selector always renders
// Pro wording, even if the server quota snapshot still says
// plan='free' (e.g. webhook reconciliation lag or backend issue).
//
// When isPro is true but the server says Free (reconciliation lag),
// the selector uses PRO_MONTHLY_SCAN_LIMIT as the display limit
// fallback, since the server's limit=1 is the Free allowance, not
// the Pro allowance. The server's remaining is clamped to the Pro
// limit to avoid displaying more than the Pro allowance.

export function selectQuotaLabel (
  quota: ScanQuotaSnapshot | null,
  isPro?: boolean,
): string | null {
  if (!quota) return null
  if (quota.plan === 'pro' || isPro) {
    const limit = quota.plan === 'pro' ? quota.limit : PRO_MONTHLY_SCAN_LIMIT
    const remaining = quota.plan === 'pro'
      ? quota.remaining
      : Math.min(quota.remaining, PRO_MONTHLY_SCAN_LIMIT)
    return `${remaining} of ${limit} Pro scans remaining`
  }
  // Free: 1 introductory AI Snap, lifetime (not monthly).
  // Unused → "Introductory AI Snap available"
  // Consumed → "Introductory AI Snap used"
  return quota.used > 0
    ? 'Introductory AI Snap used'
    : 'Introductory AI Snap available'
}

export function selectQuotaExhausted (quota: ScanQuotaSnapshot | null): boolean {
  if (!quota) return false
  return quota.remaining <= 0
}

export function selectFilmRollLabel (
  quota: ScanQuotaSnapshot | null,
  isPro?: boolean,
): string {
  if (!quota) return '— Free'
  if (quota.plan === 'pro' || isPro) {
    const limit = quota.plan === 'pro' ? quota.limit : PRO_MONTHLY_SCAN_LIMIT
    const remaining = quota.plan === 'pro'
      ? quota.remaining
      : Math.min(quota.remaining, PRO_MONTHLY_SCAN_LIMIT)
    if (limit === 0) return '∞ Pro'
    return `${remaining}/${limit} Pro`
  }
  return `${quota.remaining}/${quota.limit} Free`
}

export function selectFilmRollRemaining (quota: ScanQuotaSnapshot | null): number {
  if (!quota) return 0
  return quota.remaining
}

export function selectFilmRollIsPro (
  quota: ScanQuotaSnapshot | null,
  isPro?: boolean,
): boolean {
  if (!quota) return false
  return quota.plan === 'pro' || Boolean(isPro)
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
